// packages/engine/src/erosion/dnvO501.ts
//
// DNV RP O501 "Erosive Wear in Piping Systems" (Rev. 4.2, 2005) katı
// parçacık (kum) erozyonu temel hız modeli.
//
// Model: E&_L = [ṁp × K × Up^n × F(α)] / (ρt × At) × Cunit   [mm/yıl]  (Eq. 8.1)
//        F(α) = Σ(-1)^(i+1)·Ai·(α·π/180)^i, i=1..8               (Eq. 7.2/7.3, Tablo 6-1)
//        Vm (karışım hızı) = Vgs + Vls                             (Eq. 8.2-8.6)
//
// Kaynak: DNV-RP-O501, Det Norske Veritas, Rev. 4.2, 2005. Tüm sabitler
// packages/engine/src/registry/coefficients/dnvO501.ts içinde kayıtlıdır.
//
// Geçerlilik/kapsam: Bu model KAPSAMI, standardın Bölüm 8.1'inde tanımlanan
// TEMEL (generic) denklemdir — geometri-özel alt-prosedürler (dirsek Bölüm
// 8.4, kör Te Bölüm 8.5, redüksiyon Bölüm 8.6, kaynak dikişi Bölüm 8.2-8.3)
// bu dosyada implemente EDİLMEMİŞTİR; her biri kendi çarpma açısı/hedef alan
// hesap prosedürüne sahiptir ve ayrı bir gelecek fazdır. Bu fonksiyon,
// çarpma açısı (α) ve maruz kalan hedef alan (At) ÇAĞIRAN TARAF tarafından
// sağlandığında geçerli olan, tüm geometrilerin ortak temel denklemidir.
//
// Bilinen sınırlamalar: yalnızca ÇELİK/sünek malzeme F(α) eğrisi
// registry'de mevcuttur (bkz. dnvO501.impactAngleConstants notları);
// parçacık boyutu denklemde DOĞRUDAN kullanılmaz, yalnızca bir geçerlilik
// uyarısı için değerlendirilir; sıvı-katı karışımın parçacık hızını fluid
// hızından farklılaştıran "slip" etkisi bu temel modelde yoktur (Up=Vm
// varsayımı, standardın kendi varsayımı, Eq. 8.2).

import { getCoefficient, worstConfidence } from "../registry";
import type {
  DnvBlindTeeConstants,
  DnvImpactAngleConstants,
  DnvMaterialClass,
  DnvMaterialConstantRow,
} from "../registry/coefficients/dnvO501";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type CorrosionRateResult, type ValidityWarning } from "../corrosion/types";
import { computeMixtureVelocityMs } from "../fluids/mixtureProperties";
import { computeParticleSizeDensityCorrectionC2, type ErosionDamageLocation, type ErosionResult } from "./types";
import type { TraceStep } from "../types/results";

// NOT: computeMixtureVelocityMs artık fluids/mixtureProperties.ts'te tanımlıdır
// (tek doğruluk kaynağı — flowRegime.ts ve mixtureProperties.ts'in geri kalanı
// da aynı fonksiyonu kullanır). Geriye dönük uyumluluk için buradan da
// yeniden dışa aktarılır.
export { computeMixtureVelocityMs };

export interface DnvO501Input {
  /** Kum parçacığı kütlesel debisi, hedef alana çarpan (kg/s) */
  sandMassFlowRateKgS: number;
  /** Parçacık çarpma açısı (derece, 0-90) — geometriye göre çağıran taraf belirler */
  impactAngleDeg: number;
  /** Parçacık çarpma hızı Up (m/s) — bkz. computeMixtureVelocityMs() yardımcı fonksiyonu */
  impactVelocityMs: number;
  /** Maruz kalan hedef alan At (m²) — geometriye özgü, çağıran taraf sağlar */
  targetAreaM2: number;
  /** Hedef malzeme yoğunluğu ρt (kg/m³) */
  targetMaterialDensityKgM3: number;
  /** Hedef malzeme sınıfı — K/n sabitleri buna göre registry'den çekilir */
  materialClass: DnvMaterialClass;
  /** Bilgi amaçlı: gerçek parçacık boyutu (µm) — hesapta KULLANILMAZ, yalnızca geçerlilik uyarısı için */
  particleDiameterMicron?: number;
}

/**
 * F(α) — parçacık çarpma açısı fonksiyonu (Eq. 7.2/7.3, Tablo 6-1).
 *
 * Yalnızca ÇELİK/sünek malzeme davranışı için geçerlidir (bkz.
 * dnvO501.impactAngleConstants kayıt notları).
 *
 * @param impactAngleDeg Çarpma açısı (derece, 0-90)
 */
export function computeImpactAngleFactor(impactAngleDeg: number): number {
  if (impactAngleDeg < 0 || impactAngleDeg > 90) {
    throw new Error("Çarpma açısı 0-90 derece aralığında olmalıdır.");
  }
  const { a1, a2, a3, a4, a5, a6, a7, a8 } = getCoefficient<DnvImpactAngleConstants>(
    "dnvO501.impactAngleConstants",
  ).value;
  const coeffs = [a1, -a2, a3, -a4, a5, -a6, a7, -a8];
  const radians = (impactAngleDeg * Math.PI) / 180;
  return coeffs.reduce((sum, coeff, index) => sum + coeff * radians ** (index + 1), 0);
}

// TUNGSTEN_CARBIDE/CERAMIC_COATING, standardın Tablo 6-2'sinde YOK ve F(α)
// polinomu (yalnızca sünek malzeme için türetildi) bu iki malzeme için
// GEÇERSİZDİR — bkz. dnvO501.materialConstantsUnverified kaydı.
const BRITTLE_MATERIAL_CLASSES: DnvMaterialClass[] = ["TUNGSTEN_CARBIDE", "CERAMIC_COATING"];

interface MaterialLookupResult {
  row: DnvMaterialConstantRow;
  coefficientId: string;
  isBrittle: boolean;
}

function getMaterialConstants(materialClass: DnvMaterialClass): MaterialLookupResult {
  const isBrittle = BRITTLE_MATERIAL_CLASSES.includes(materialClass);
  const coefficientId = isBrittle ? "dnvO501.materialConstantsUnverified" : "dnvO501.materialConstants";
  const table = getCoefficient<DnvMaterialConstantRow[]>(coefficientId).value;
  const row = table.find((r) => r.materialClass === materialClass);
  if (!row) {
    throw new Error(`"${materialClass}" için DNV RP O501 malzeme sabiti bulunamadı.`);
  }
  return { row, coefficientId, isBrittle };
}

/**
 * TUNGSTEN_CARBIDE/CERAMIC_COATING seçildiğinde, F(α) polinomunun (yalnızca
 * sünek malzeme için geçerli) bu malzemeler için GEÇERSİZ olabileceğine dair
 * her zaman bir validityWarning üretir; diğer malzemeler için null döner.
 */
function brittleMaterialWarningIfApplicable(materialClass: DnvMaterialClass): ValidityWarning | null {
  if (!BRITTLE_MATERIAL_CLASSES.includes(materialClass)) {
    return null;
  }
  return {
    parameter: "Malzeme sınıfı (F(α) geçerliliği)",
    value: 0,
    min: 0,
    max: 0,
    unit: "-",
    message:
      `F(α) çarpma açısı fonksiyonu YALNIZCA sünek (ductile) malzemeler için türetilmiştir. "${materialClass}" ` +
      "gevrek (brittle) bir malzemedir — standart, gevrek malzemelerin maksimum erozyonu ~90° (normal " +
      "çarpma) civarında yaşadığını NİTEL olarak belirtir ama sayısal bir eğri vermez. Bu sonuç, sünek " +
      "F(α) eğrisiyle hesaplandığı için GERÇEK davranışı YANLIŞ TEMSİL EDİYOR OLABİLİR — ayrıca K/n " +
      "değerinin kendisi de DOĞRULANMAMIŞ bir tahmindir (bkz. dnvO501.materialConstantsUnverified).",
  };
}

/**
 * DNV RP O501 temel katı parçacık (kum) erozyon hızını hesaplar.
 *
 * Model adı: DNV-RP-O501 (Rev. 4.2, 2005), Bölüm 8.1 temel denklemi (Eq. 8.1).
 * Girdi/çıktı birimleri: SI (kg/s, m/s, m², kg/m³) → çıktı mm/yıl.
 * Geçerlilik aralığı: kum içeriği tipik 1-50 ppmW, parçacık boyutu tipik
 * 250-500 µm (yalnızca bilgi/uyarı amaçlı kontrol edilir, denklemde girdi
 * değildir); malzeme farkının iyi karakterize edildiği üst hız sınırı ~100 m/s.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu (yalnızca temel/generic
 * denklem, geometri-özel alt-prosedürler henüz implemente edilmedi).
 */
export function computeDnvO501ErosionRate(input: DnvO501Input): CorrosionRateResult {
  if (input.sandMassFlowRateKgS < 0) {
    throw new Error("Kum kütlesel debisi negatif olamaz.");
  }
  if (input.targetAreaM2 <= 0) {
    throw new Error("Hedef alan (At) pozitif olmalıdır.");
  }
  if (input.targetMaterialDensityKgM3 <= 0) {
    throw new Error("Hedef malzeme yoğunluğu pozitif olmalıdır.");
  }
  if (input.impactVelocityMs < 0) {
    throw new Error("Çarpma hızı negatif olamaz.");
  }

  if (input.sandMassFlowRateKgS === 0) {
    return {
      rateMmPerYear: { p10: 0, p50: 0, p90: 0 },
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Kum kütlesel debisi 0; katı parçacık erozyonu oluşmaz. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const validityWarnings: ValidityWarning[] = [];

  const maxCharacterizedVelocity = getCoefficient<number>(
    "dnvO501.validity.maxCharacterizedVelocityMs",
  ).value;
  if (input.impactVelocityMs > maxCharacterizedVelocity) {
    validityWarnings.push({
      parameter: "Çarpma hızı",
      value: input.impactVelocityMs,
      min: 0,
      max: maxCharacterizedVelocity,
      unit: "m/s",
      message: `Çarpma hızı (${input.impactVelocityMs} m/s), DNV-RP-O501'in malzeme farkını iyi karakterize ettiği üst sınırın (${maxCharacterizedVelocity} m/s) üzerinde. Hesap yapıldı ancak malzeme seçimi arasındaki göreli fark belirsizliği artmış olabilir.`,
    });
  }

  if (input.particleDiameterMicron !== undefined) {
    const [minD, maxD] = getCoefficient<[number, number]>(
      "dnvO501.validity.particleDiameterMicron",
    ).value;
    if (input.particleDiameterMicron < minD || input.particleDiameterMicron > maxD) {
      validityWarnings.push({
        parameter: "Parçacık boyutu",
        value: input.particleDiameterMicron,
        min: minD,
        max: maxD,
        unit: "µm",
        message: `Parçacık boyutu (${input.particleDiameterMicron} µm), DNV-RP-O501'in tipik gözlemlenen aralığının (${minD}-${maxD} µm) dışında. Model K/n sabitleri bu tipik aralık için kalibre edilmiştir; sonuç yine de hesaplandı ancak dikkatle yorumlanmalıdır.`,
      });
    }
  }

  const impactAngleFactor = computeImpactAngleFactor(input.impactAngleDeg);
  const {
    row: { k, n },
    coefficientId: materialCoefficientId,
  } = getMaterialConstants(input.materialClass);
  const cUnit = getCoefficient<number>("dnvO501.unitConversionConstant").value;

  const brittleWarning = brittleMaterialWarningIfApplicable(input.materialClass);
  if (brittleWarning) {
    validityWarnings.push(brittleWarning);
  }

  const baseRateMmPerYear =
    (input.sandMassFlowRateKgS * k * input.impactVelocityMs ** n * impactAngleFactor * cUnit) /
    (input.targetMaterialDensityKgM3 * input.targetAreaM2);

  const sourcesUsed = ["dnvO501.impactAngleConstants", materialCoefficientId, "dnvO501.unitConversionConstant"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("dnvO501.impactAngleConstants").confidence,
    getCoefficient(materialCoefficientId).confidence,
    getCoefficient("dnvO501.unitConversionConstant").confidence,
  ];

  const uncertaintyFactor = getCoefficient<number>("uncertainty.defaultMultiplicativeBandFactor").value;
  sourcesUsed.push("uncertainty.defaultMultiplicativeBandFactor");
  usedConfidences.push(getCoefficient("uncertainty.defaultMultiplicativeBandFactor").confidence);

  const band = applyMultiplicativeUncertaintyBand(Math.max(baseRateMmPerYear, 0), uncertaintyFactor);

  return {
    rateMmPerYear: band,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// GEOMETRİ-ÖZEL ALT-PROSEDÜRLER (Bölüm 8.2-8.6)
//
// Yukarıdaki computeDnvO501ErosionRate() SADECE Eq. 8.1'in çekirdeğidir
// (α ve At çağıran taraftan gelir). Aşağıdaki fonksiyonlar, standardın her
// bileşen tipi için verdiği KENDİ α/At/G/C1 hesap prosedürünü uygulayıp bu
// çekirdeğin eşdeğerini kendi içlerinde kurar ve ortak ErosionResult
// biçimine (erosion/types.ts) dönüştürür — CorrosionRateResult'tan farklı
// olarak model adı, parçacık çarpma açısı/hızı, 3B konum ve hesap izi de
// taşır (bkz. erosion/types.ts başlık yorumu).
// ═══════════════════════════════════════════════════════════════════════

function zeroGeometryResult(modelUsed: string, location: ErosionDamageLocation): ErosionResult {
  return {
    rateMmPerYear: { p10: 0, p50: 0, p90: 0 },
    modelUsed,
    particleImpactAngleDeg: 0,
    particleVelocityMs: 0,
    maxLocationDescriptionTr: location.maxLocationDescriptionTr,
    angularPositionDeg: location.angularPositionDeg,
    axialPositionFraction: location.axialPositionFraction,
    isAboveApi14eLimit: null,
    confidence: "HIGH",
    validityWarnings: [],
    sourcesUsed: [],
    calculationTrace: [],
    disclaimer: `Kum kütlesel debisi 0; katı parçacık erozyonu oluşmaz. ${ENGINEERING_DISCLAIMER_TR}`,
  };
}

interface FinalizeGeometryParams {
  baseRateMmPerYear: number;
  modelUsed: string;
  particleImpactAngleDeg: number;
  particleVelocityMs: number;
  location: ErosionDamageLocation;
  sourcesUsed: string[];
  usedConfidences: ConfidenceLevel[];
  uncertaintyFactorId: string;
  validityWarnings: ValidityWarning[];
  calculationTrace: TraceStep[];
}

function finalizeGeometryResult(params: FinalizeGeometryParams): ErosionResult {
  const uncertaintyFactor = getCoefficient<number>(params.uncertaintyFactorId).value;
  const sourcesUsed = [...params.sourcesUsed, params.uncertaintyFactorId];
  const usedConfidences = [...params.usedConfidences, getCoefficient(params.uncertaintyFactorId).confidence];
  const band = applyMultiplicativeUncertaintyBand(Math.max(params.baseRateMmPerYear, 0), uncertaintyFactor);

  return {
    rateMmPerYear: band,
    modelUsed: params.modelUsed,
    particleImpactAngleDeg: params.particleImpactAngleDeg,
    particleVelocityMs: params.particleVelocityMs,
    maxLocationDescriptionTr: params.location.maxLocationDescriptionTr,
    angularPositionDeg: params.location.angularPositionDeg,
    axialPositionFraction: params.location.axialPositionFraction,
    isAboveApi14eLimit: null,
    confidence: worstConfidence(usedConfidences),
    validityWarnings: params.validityWarnings,
    sourcesUsed,
    calculationTrace: params.calculationTrace,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

const UNCERTAINTY_FACTOR_ID = "uncertainty.defaultMultiplicativeBandFactor";

// ─────────────────────────────────────────────────────────────────────────
// 1) Düz boru (Bölüm 8.2, Eq. 8.9) — Eq.8.1 çekirdeğinden BAĞIMSIZ, kapalı
//    biçimli, YALNIZCA düşey çelik borular için ampirik korelasyon.
// ─────────────────────────────────────────────────────────────────────────

export interface StraightPipeErosionInput {
  sandMassFlowRateKgS: number;
  impactVelocityMs: number;
  pipeIdM: number;
  orientation?: "VERTICAL" | "HORIZONTAL";
}

/**
 * DNV RP O501 §8.2 (Eq. 8.9) düz boru erozyon hızı.
 *
 * Model adı: DNV-RP-O501 §8.2. Girdi/çıktı: SI → mm/yıl.
 * Geçerlilik: standart YALNIZCA düşey çelik borular için türetildiğini
 * belirtir ("erosion in smooth pipes is generally small and negligible").
 * Bilinen sınırlamalar: yatay borular için ayrı korelasyon YOK — bu
 * fonksiyon yatay girişte de hesap yapar ama validityWarning ekler.
 */
export function computeStraightPipeErosionRate(input: StraightPipeErosionInput): ErosionResult {
  if (input.pipeIdM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.impactVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      "Boru çeperi boyunca düşük şiddette, dağınık erozyon — standardın kendi ifadesiyle 'genellikle " +
      "önemsiz'; belirgin tek bir sıcak nokta beklenmez.",
    angularPositionDeg: null,
    axialPositionFraction: 0.5,
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult("DNV-RP-O501 §8.2 Düz Boru", location);
  }

  const validityWarnings: ValidityWarning[] = [];
  const orientation = input.orientation ?? "VERTICAL";
  if (orientation === "HORIZONTAL") {
    validityWarnings.push({
      parameter: "Boru yönelimi",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "Eq. 8.9 standardın metninde YALNIZCA düşey borular için verilmiştir; yatay borular için ayrı bir " +
        "korelasyon yoktur. Hesap yine de yapıldı (aynı korelasyon uygulandı) ama bu bir DOĞRULANMAMIŞ " +
        "uzantıdır.",
    });
  }

  const constant = getCoefficient<number>("dnvO501.straightPipe.constant").value;
  const baseRateMmPerYear =
    constant * input.impactVelocityMs ** 2.6 * input.sandMassFlowRateKgS * input.pipeIdM ** -2;

  const calculationTrace: TraceStep[] = [
    {
      stepName: "Düz boru erozyon hızı (Eq. 8.9)",
      formula: "E_L = 2,5×10⁻⁵ × U^2,6 × ṁp × D⁻²",
      inputs: {
        U: input.impactVelocityMs,
        mp: input.sandMassFlowRateKgS,
        D: input.pipeIdM,
      },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: ["dnvO501.straightPipe.constant"],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed: "DNV-RP-O501 §8.2 Düz Boru",
    particleImpactAngleDeg: 0,
    particleVelocityMs: input.impactVelocityMs,
    location,
    sourcesUsed: ["dnvO501.straightPipe.constant"],
    usedConfidences: [getCoefficient("dnvO501.straightPipe.constant").confidence],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 2) Kaynak dikişi — akışa bakan yüz (Bölüm 8.3.1, Eq. 8.10-8.13)
// ─────────────────────────────────────────────────────────────────────────

export interface WeldReinforcementErosionInput {
  sandMassFlowRateKgS: number;
  impactVelocityMs: number;
  pipeIdM: number;
  /** Çarpma açısı (derece) — bilinmiyorsa standardın muhafazakâr varsayılanı (60°) kullanılır */
  impactAngleDeg?: number;
  particleDiameterM: number;
  mixtureDensityKgM3: number;
  targetMaterialDensityKgM3: number;
  materialClass: DnvMaterialClass;
}

/**
 * DNV RP O501 §8.3.1 (Eq. 8.10-8.13) kaynak dikişinin akışa bakan yüzünün
 * erozyon hızı.
 *
 * Model adı: DNV-RP-O501 §8.3.1. Girdi/çıktı: SI → mm/yıl.
 * Bilinen sınırlamalar: standart, bu yüzeydeki erozyonun kaynağı zamanla
 * YUVARLATTIĞINI ve bu yüzden boru bütünlüğü için SINIRLAYICI OLMADIĞINI
 * açıkça belirtiyor (bilgi amaçlı bir sonuçtur, boyutlandırma kriteri
 * DEĞİLDİR).
 */
export function computeWeldReinforcementErosionRate(input: WeldReinforcementErosionInput): ErosionResult {
  if (input.pipeIdM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.impactVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      "Kaynak dikişinin akışa bakan (yukarı akış) yüzeyi — zamanla yuvarlanır, boru bütünlüğü için " +
      "SINIRLAYICI DEĞİLDİR (standardın kendi ifadesi).",
    angularPositionDeg: null,
    axialPositionFraction: 0,
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult("DNV-RP-O501 §8.3.1 Kaynak Dikişi (akışa bakan yüz)", location);
  }

  const validityWarnings: ValidityWarning[] = [];
  let angleDeg = input.impactAngleDeg;
  if (angleDeg === undefined) {
    angleDeg = getCoefficient<number>("dnvO501.conservativeDefaultImpactAngleDeg").value;
    validityWarnings.push({
      parameter: "Çarpma açısı",
      value: angleDeg,
      min: 0,
      max: 90,
      unit: "derece",
      message: `Çarpma açısı verilmedi — standardın muhafazakâr varsayılanı (${angleDeg}°) kullanıldı.`,
    });
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  const pipeAreaM2 = (Math.PI * input.pipeIdM ** 2) / 4;
  const impactAngleFactor = computeImpactAngleFactor(angleDeg);
  const c2 = computeParticleSizeDensityCorrectionC2(input.particleDiameterM, input.mixtureDensityKgM3);
  const {
    row: { k, n },
    coefficientId: materialCoefficientId,
  } = getMaterialConstants(input.materialClass);
  const materialBrittleWarning = brittleMaterialWarningIfApplicable(input.materialClass);
  if (materialBrittleWarning) {
    validityWarnings.push(materialBrittleWarning);
  }
  const cUnit = getCoefficient<number>("dnvO501.unitConversionConstant").value;

  const baseRateMmPerYear =
    (input.sandMassFlowRateKgS *
      k *
      impactAngleFactor *
      input.impactVelocityMs ** n *
      Math.sin(angleRad) *
      c2 *
      cUnit) /
    (input.targetMaterialDensityKgM3 * pipeAreaM2);

  const calculationTrace: TraceStep[] = [
    {
      stepName: "Kaynak dikişi erozyon hızı (Eq. 8.13)",
      formula: "E_L = ṁp·K·F(α)·Up^n·sin(α)/(ρt·Apipe) · C2 · Cunit",
      inputs: { alphaDeg: angleDeg, Up: input.impactVelocityMs, C2: c2 },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: [
        "dnvO501.impactAngleConstants",
        materialCoefficientId,
        "dnvO501.unitConversionConstant",
        "dnvO501.particleSizeDensityCorrection.denominatorConstant",
      ],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed: "DNV-RP-O501 §8.3.1 Kaynak Dikişi (akışa bakan yüz)",
    particleImpactAngleDeg: angleDeg,
    particleVelocityMs: input.impactVelocityMs,
    location,
    sourcesUsed: [
      "dnvO501.impactAngleConstants",
      materialCoefficientId,
      "dnvO501.unitConversionConstant",
      "dnvO501.particleSizeDensityCorrection.denominatorConstant",
    ],
    usedConfidences: [
      getCoefficient("dnvO501.impactAngleConstants").confidence,
      getCoefficient(materialCoefficientId).confidence,
      getCoefficient("dnvO501.unitConversionConstant").confidence,
    ],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3) Kaynak dikişi — aşağı akış (Bölüm 8.3.2, Eq. 8.14) — Eq.8.1
//    çekirdeğinden BAĞIMSIZ, kapalı biçimli, YALNIZCA çelik için.
// ─────────────────────────────────────────────────────────────────────────

export interface DownstreamWeldErosionInput {
  sandMassFlowRateKgS: number;
  impactVelocityMs: number;
  pipeIdM: number;
  /** Kaynak dikişi yüksekliği h (m) */
  weldHeightM: number;
  materialClass: DnvMaterialClass;
}

const STEEL_FAMILY_MATERIAL_CLASSES: DnvMaterialClass[] = ["STEEL", "CS", "DSS", "SDSS", "NI_ALLOY"];

/**
 * DNV RP O501 §8.3.2 (Eq. 8.14) aşağı akış kaynak dikişi erozyon hızı.
 *
 * Model adı: DNV-RP-O501 §8.3.2. Girdi/çıktı: SI → mm/yıl.
 * Bilinen sınırlamalar: bu korelasyon çarpma açısı İÇERMEZ (türbülanslı
 * yeniden-tutunma bölgesi kaynaklı erozyon) — particleImpactAngleDeg alanı
 * bu yüzden 0 olarak raporlanır, yalnızca arayüz tutarlılığı içindir.
 * YALNIZCA çelik için türetilmiştir; materialClass çelik ailesi (STEEL/CS/
 * DSS/SDSS/NI_ALLOY) dışındaysa validityWarning eklenir.
 */
export function computeDownstreamWeldErosionRate(input: DownstreamWeldErosionInput): ErosionResult {
  if (input.pipeIdM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (input.weldHeightM < 0) {
    throw new Error("Kaynak yüksekliği negatif olamaz.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.impactVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      "Kaynak dikişinin hemen mansap (aşağı akış) tarafı — türbülanslı yeniden-tutunma bölgesi.",
    angularPositionDeg: null,
    axialPositionFraction: 0.05,
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult("DNV-RP-O501 §8.3.2 Aşağı Akış Kaynak Dikişi", location);
  }

  const validityWarnings: ValidityWarning[] = [];
  if (!STEEL_FAMILY_MATERIAL_CLASSES.includes(input.materialClass)) {
    validityWarnings.push({
      parameter: "Malzeme sınıfı",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "Eq. 8.14 standardın metninde YALNIZCA çelik için türetilmiştir. Bu malzeme sınıfı için sonuç " +
        "DOĞRULANMAMIŞ bir uzantıdır.",
    });
  }

  const { leadingCoefficient, heightOffsetM } = getCoefficient<{
    leadingCoefficient: number;
    heightOffsetM: number;
  }>("dnvO501.downstreamWeld.constants").value;

  const baseRateMmPerYear =
    leadingCoefficient *
    (heightOffsetM + input.weldHeightM) *
    input.impactVelocityMs ** 2.6 *
    input.pipeIdM ** -2 *
    input.sandMassFlowRateKgS;

  const calculationTrace: TraceStep[] = [
    {
      stepName: "Aşağı akış kaynak dikişi erozyon hızı (Eq. 8.14)",
      formula: "E_L = 0,33×10⁻²×(7,5×10⁻⁴+h)×Up^2,6×D⁻²×ṁp",
      inputs: { h: input.weldHeightM, Up: input.impactVelocityMs, D: input.pipeIdM },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: ["dnvO501.downstreamWeld.constants"],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed: "DNV-RP-O501 §8.3.2 Aşağı Akış Kaynak Dikişi",
    particleImpactAngleDeg: 0,
    particleVelocityMs: input.impactVelocityMs,
    location,
    sourcesUsed: ["dnvO501.downstreamWeld.constants"],
    usedConfidences: [getCoefficient("dnvO501.downstreamWeld.constants").confidence],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 4) Dirsek / Bükme (Bölüm 8.4, Eq. 8.15-8.21) — EN KRİTİK MODEL. Tepe
//    konumu (α) R/D'ye, parçacık-boyutu düzeltmesi (G) HEM parçacık çapına
//    HEM R/D'ye (γc üzerinden) bağlıdır — sabit bir açı YAZILMAZ.
// ─────────────────────────────────────────────────────────────────────────

export interface BendErosionInput {
  sandMassFlowRateKgS: number;
  /** Parçacık çarpma hızı Up (m/s) — bkz. computeMixtureVelocityMs() */
  impactVelocityMs: number;
  pipeIdM: number;
  /** Bükme yarıçapı oranı R/D (>=0.5 tipik) */
  bendRadiusRatio: number;
  /** Dirseğin toplam sapma açısı (derece) — yalnızca 3B konum tahmini için, varsayılan 90° */
  bendSweepAngleDeg?: number;
  particleDiameterM: number;
  mixtureDensityKgM3: number;
  mixtureViscosityPaS: number;
  /** Parçacık (kum) yoğunluğu ρp (kg/m³) — tipik kuvars kumu ~2650 kg/m³ */
  particleDensityKgM3: number;
  targetMaterialDensityKgM3: number;
  materialClass: DnvMaterialClass;
}

/**
 * DNV RP O501 §8.4 (Eq. 8.15-8.21) dirsek/bükme erozyon hızı — standardın
 * en kritik alt-modeli.
 *
 * Model adı: DNV-RP-O501 §8.4. Girdi/çıktı: SI → mm/yıl.
 * Geçerlilik: standart, dirsekten önce düz bir boru bölümü (>10D)
 * varsayıyor; karmaşık izometrilerde konum/hız DEĞİŞEBİLİR (standardın
 * kendi uyarısı).
 * Bilinen sınırlamalar: kritik parçacık çapı formülü (Eq. 8.17) γc'yi
 * (0,0.1) aralığına KIRPAR (bkz. kod içi yorum) — standardın kendi metninde
 * bu kırpmanın tam koşulu net değildi, Madani Sani et al. (2019) Eq. 21'in
 * sunduğu domain (0<γc<0,1) ile TUTARLI bir kırpma bu projede uygulandı.
 */
/**
 * DNV RP O501 §8.4 dirsek tepe darbe açısı α=atan(1/(2×R/D)) (derece).
 * spatial/pipeFittings.ts'in ELBOW_EXTRADOS_IMPINGEMENT imzası da BU
 * fonksiyonu kullanır (tek kaynak, ayrı bir kopya formül YOKTUR).
 */
export function computeBendPeakAngleDeg(bendRadiusRatio: number): number {
  if (bendRadiusRatio <= 0) {
    throw new Error("Bükme yarıçapı oranı (R/D) pozitif olmalıdır.");
  }
  const alphaRad = Math.atan(1 / (2 * bendRadiusRatio));
  return (alphaRad * 180) / Math.PI;
}

export function computeBendErosionRate(input: BendErosionInput): ErosionResult {
  if (input.pipeIdM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (input.bendRadiusRatio <= 0) {
    throw new Error("Bükme yarıçapı oranı (R/D) pozitif olmalıdır.");
  }
  if (input.mixtureViscosityPaS <= 0 || input.mixtureDensityKgM3 <= 0 || input.particleDensityKgM3 <= 0) {
    throw new Error("Viskozite ve yoğunluklar pozitif olmalıdır.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.impactVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const alphaRad = Math.atan(1 / (2 * input.bendRadiusRatio));
  const alphaDeg = computeBendPeakAngleDeg(input.bendRadiusRatio);
  const sweepDeg = input.bendSweepAngleDeg ?? 90;

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      `Dirseğin dış yarıçapı, giriş düzleminden yaklaşık ${alphaDeg.toFixed(0)}° dönük konumda ` +
      "(DNV Şekil 7-2 'Area of erosion'). Bu konum R/D VE parçacık çapına göre kayar (sabit 45° " +
      "değildir) — bkz. hesap izi.",
    angularPositionDeg: alphaDeg,
    axialPositionFraction: Math.min(1, alphaDeg / sweepDeg),
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult("DNV-RP-O501 §8.4 Dirsek", location);
  }

  const validityWarnings: ValidityWarning[] = [];

  const beta = input.particleDensityKgM3 / input.mixtureDensityKgM3;
  const reynoldsD =
    (input.mixtureDensityKgM3 * input.impactVelocityMs * input.pipeIdM) / input.mixtureViscosityPaS;
  const dimensionlessGroupA = reynoldsD * (Math.tan(alphaRad) / beta);

  let gammaC = 0.1;
  if (dimensionlessGroupA > 0) {
    const bracket = 1.88 * Math.log(dimensionlessGroupA) - 6.04;
    const rawGammaC = bracket !== 0 ? 1 / (beta * bracket) : Number.NaN;
    if (Number.isFinite(rawGammaC) && rawGammaC > 0 && rawGammaC < 0.1) {
      gammaC = rawGammaC;
    } else {
      validityWarnings.push({
        parameter: "Kritik parçacık çapı (γc)",
        value: Number.isFinite(rawGammaC) ? rawGammaC : -1,
        min: 0,
        max: 0.1,
        unit: "-",
        message:
          "Eq. 8.17'den hesaplanan γc, (0, 0,1) geçerlilik aralığının dışına düştü — üst sınır olan 0,1 " +
          "kullanıldı (Madani Sani et al. 2019, Eq. 21'de belirtilen domain fallback).",
      });
    }
  }

  const gamma = input.particleDiameterM / input.pipeIdM;
  const sizeCorrectionG = gamma < gammaC ? gamma / gammaC : 1;

  const pipeAreaM2 = (Math.PI * input.pipeIdM ** 2) / 4;
  const impactAngleFactor = computeImpactAngleFactor(alphaDeg);
  const geometryFactorC1 = getCoefficient<number>("dnvO501.bend.geometryFactorC1").value;
  const {
    row: { k, n },
    coefficientId: materialCoefficientId,
  } = getMaterialConstants(input.materialClass);
  const materialBrittleWarning = brittleMaterialWarningIfApplicable(input.materialClass);
  if (materialBrittleWarning) {
    validityWarnings.push(materialBrittleWarning);
  }
  const cUnit = getCoefficient<number>("dnvO501.unitConversionConstant").value;

  const baseRateMmPerYear =
    ((input.sandMassFlowRateKgS *
      k *
      impactAngleFactor *
      Math.sin(alphaRad) *
      input.impactVelocityMs ** n) /
      (input.targetMaterialDensityKgM3 * pipeAreaM2)) *
    sizeCorrectionG *
    geometryFactorC1 *
    cUnit;

  const maxVelocity = getCoefficient<number>("dnvO501.validity.maxCharacterizedVelocityMs").value;
  if (input.impactVelocityMs > maxVelocity) {
    validityWarnings.push({
      parameter: "Çarpma hızı",
      value: input.impactVelocityMs,
      min: 0,
      max: maxVelocity,
      unit: "m/s",
      message: `Çarpma hızı (${input.impactVelocityMs} m/s), ${maxVelocity} m/s üst sınırının üzerinde.`,
    });
  }

  const calculationTrace: TraceStep[] = [
    {
      stepName: "Karakteristik çarpma açısı (Eq. 8.15)",
      formula: "α = arctan(1/(2·R/D))",
      inputs: { bendRadiusRatio: input.bendRadiusRatio },
      output: alphaDeg,
      unit: "derece",
      coefficientIds: [],
    },
    {
      stepName: "Kritik parçacık çapı oranı ve boyut düzeltmesi (Eq. 8.16-8.18)",
      formula: "γc=1/(β·[1,88·ln(A)−6,04]); G=min(1, γ/γc)",
      inputs: { beta, dimensionlessGroupA, gammaC, gamma, G: sizeCorrectionG },
      output: sizeCorrectionG,
      unit: "-",
      coefficientIds: ["dnvO501.bend.criticalDiameterConstants"],
    },
    {
      stepName: "Dirsek erozyon hızı (Eq. 8.21)",
      formula: "E_L = ṁp·K·F(α)·sin(α)·Up^n/(ρt·Apipe) · G · C1 · Cunit",
      inputs: { alphaDeg, Up: input.impactVelocityMs, G: sizeCorrectionG, C1: geometryFactorC1 },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: [
        "dnvO501.impactAngleConstants",
        materialCoefficientId,
        "dnvO501.unitConversionConstant",
        "dnvO501.bend.geometryFactorC1",
      ],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed: "DNV-RP-O501 §8.4 Dirsek",
    particleImpactAngleDeg: alphaDeg,
    particleVelocityMs: input.impactVelocityMs,
    location,
    sourcesUsed: [
      "dnvO501.impactAngleConstants",
      materialCoefficientId,
      "dnvO501.unitConversionConstant",
      "dnvO501.bend.geometryFactorC1",
      "dnvO501.bend.criticalDiameterConstants",
    ],
    usedConfidences: [
      getCoefficient("dnvO501.impactAngleConstants").confidence,
      getCoefficient(materialCoefficientId).confidence,
      getCoefficient("dnvO501.unitConversionConstant").confidence,
      getCoefficient("dnvO501.bend.geometryFactorC1").confidence,
      getCoefficient("dnvO501.bend.criticalDiameterConstants").confidence,
    ],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 5) Miter Bükme — DNV RP O501'İN KAPSAMI DIŞINDADIR (standart yalnızca
//    sürekli-yarıçaplı dirsekleri kapsar). Bu proje, gerçek bir kaynak
//    bulunamadığı için (bkz. registry görevi notları), dirsek modelini
//    ÇAĞIRANIN sağladığı bendRadiusRatio ile AYNEN yeniden kullanır — bu
//    R/D, tek bir keskin gönye eklemi için "eşdeğer" bir yarıçap DEĞİLDİR,
//    çağıran tarafın kendi mühendislik yargısıdır (tipik pratik: keskin tek
//    gönye ~R/D 0,5-1,0 kısa-yarıçap dirseğe benzetilir). HER ZAMAN bir
//    validityWarning eklenir.
// ─────────────────────────────────────────────────────────────────────────

export type MiterBendErosionInput = BendErosionInput;

export function computeMiterBendErosionRate(input: MiterBendErosionInput): ErosionResult {
  const bendResult = computeBendErosionRate(input);
  if (input.sandMassFlowRateKgS === 0) {
    return { ...bendResult, modelUsed: "DNV-RP-O501 §8.4 Dirsek modeli (miter bükme yaklaşımı)" };
  }
  return {
    ...bendResult,
    modelUsed: "DNV-RP-O501 §8.4 Dirsek modeli (miter bükme için yaklaşık uzantı)",
    confidence: "LOW",
    validityWarnings: [
      ...bendResult.validityWarnings,
      {
        parameter: "Geometri modeli",
        value: input.bendRadiusRatio,
        min: 0,
        max: 0,
        unit: "-",
        message:
          "Miter (gönye) bükmeler DNV-RP-O501'in KAPSAMI DIŞINDADIR — standart yalnızca sürekli-yarıçaplı " +
          "dirsekleri kapsar, tek keskin gönye eklemi için literatürde doğrulanmış bir 'eşdeğer R/D' " +
          "formülü bu oturumda bulunamadı. Bu sonuç, çağıranın sağladığı R/D değeriyle dirsek modelinin " +
          "DOĞRUDAN (yaklaşık) uygulanmasıdır — DOĞRULANMAMIŞ, bir korozyon/erozyon mühendisi tarafından " +
          "gözden geçirilmelidir.",
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 6) Kör Te / Blinded Tee (Bölüm 8.5, Eq. 8.22-8.29) — β=ρp/ρm eşiğine göre
//    iki dallı formül; F(α)/sin(α) TERİMİ YOKTUR (Eq. 8.29), etki G/C1
//    içine gömülüdür.
// ─────────────────────────────────────────────────────────────────────────

export interface BlindTeeErosionInput {
  sandMassFlowRateKgS: number;
  impactVelocityMs: number;
  pipeIdM: number;
  particleDiameterM: number;
  mixtureDensityKgM3: number;
  mixtureViscosityPaS: number;
  particleDensityKgM3: number;
  targetMaterialDensityKgM3: number;
  materialClass: DnvMaterialClass;
}

/**
 * DNV RP O501 §8.5 (Eq. 8.22-8.29) kör Te (blinded tee) erozyon hızı.
 *
 * Model adı: DNV-RP-O501 §8.5. Girdi/çıktı: SI → mm/yıl.
 * Geçerlilik: yalnızca KÖR (dead-end) Te — akışın devam ettiği dallanma/
 * geçiş Te'si için bu model GEÇERLİ DEĞİLDİR (bkz. computeTeeBranchErosionRate).
 * Bilinen sınırlamalar: standart parçacıkların kör bölgeye YAKLAŞIK NORMAL
 * (90°) çarptığını varsayar (ayrı bir α girdisi yoktur) — particleImpactAngleDeg
 * bu yüzden 90 olarak raporlanır.
 */
export function computeBlindTeeErosionRate(input: BlindTeeErosionInput): ErosionResult {
  if (input.pipeIdM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (input.mixtureViscosityPaS <= 0 || input.mixtureDensityKgM3 <= 0 || input.particleDensityKgM3 <= 0) {
    throw new Error("Viskozite ve yoğunluklar pozitif olmalıdır.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.impactVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      "Kör Te'nin kör (dead-end) ucu — ana hat ile çıkış borusunun kesişim bölgesi (DNV Şekil 8-1).",
    angularPositionDeg: null,
    axialPositionFraction: 1,
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult("DNV-RP-O501 §8.5 Kör Te", location);
  }

  const validityWarnings: ValidityWarning[] = [];
  const beta = input.particleDensityKgM3 / input.mixtureDensityKgM3;
  const reynoldsD =
    (input.mixtureDensityKgM3 * input.impactVelocityMs * input.pipeIdM) / input.mixtureViscosityPaS;
  const gamma = input.particleDiameterM / input.pipeIdM;

  const constants = getCoefficient<DnvBlindTeeConstants>("dnvO501.blindTee.constants").value;

  let gammaC: number;
  let cExponent: number;
  let geometryFactorC1: number;

  if (beta < constants.betaThreshold) {
    gammaC = constants.lowBeta.criticalDiameterNumerator / beta;
    cExponent = gamma < gammaC ? constants.lowBeta.cReCoefficient / Math.log(reynoldsD) : 0;
    geometryFactorC1 = constants.lowBeta.geometryFactorC1Numerator / beta ** 0.3;
  } else {
    const bInner = Math.log(reynoldsD / constants.highBeta.bReynoldsScale + 1) + 1;
    const bExp = bInner ** constants.highBeta.bExponent + constants.highBeta.bOffset;
    gammaC = constants.highBeta.criticalDiameterCoefficient * (beta / constants.betaThreshold) ** bExp;
    cExponent =
      gamma < gammaC
        ? constants.highBeta.cReCoefficient / Math.log(reynoldsD)
        : constants.highBeta.cLeadingCoefficient *
          (1 - constants.highBeta.cDecayBase ** -(beta - constants.betaThreshold));
    geometryFactorC1 = constants.highBeta.geometryFactorC1;
  }

  const sizeCorrectionG = gammaC > 0 ? (gamma / gammaC) ** cExponent : 1;

  const pipeAreaM2 = (Math.PI * input.pipeIdM ** 2) / 4;
  const {
    row: { k, n },
    coefficientId: materialCoefficientId,
  } = getMaterialConstants(input.materialClass);
  const materialBrittleWarning = brittleMaterialWarningIfApplicable(input.materialClass);
  if (materialBrittleWarning) {
    validityWarnings.push(materialBrittleWarning);
  }
  const cUnit = getCoefficient<number>("dnvO501.unitConversionConstant").value;

  const baseRateMmPerYear =
    ((input.sandMassFlowRateKgS * k * input.impactVelocityMs ** n) /
      (input.targetMaterialDensityKgM3 * pipeAreaM2)) *
    sizeCorrectionG *
    geometryFactorC1 *
    cUnit;

  const calculationTrace: TraceStep[] = [
    {
      stepName: "β=ρp/ρm ve dallanma seçimi (Eq. 8.22-8.26)",
      formula: "β<40 ise düşük-β dalı, β≥40 ise yüksek-β dalı",
      inputs: { beta, betaThreshold: constants.betaThreshold, gammaC, gamma, c: cExponent, C1: geometryFactorC1 },
      output: sizeCorrectionG,
      unit: "-",
      coefficientIds: ["dnvO501.blindTee.constants"],
    },
    {
      stepName: "Kör Te erozyon hızı (Eq. 8.29)",
      formula: "E_L = ṁp·K·Up^n/(ρt·At) · G · C1 · Cunit",
      inputs: { Up: input.impactVelocityMs, G: sizeCorrectionG, C1: geometryFactorC1 },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: [materialCoefficientId, "dnvO501.unitConversionConstant"],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed: "DNV-RP-O501 §8.5 Kör Te",
    particleImpactAngleDeg: 90,
    particleVelocityMs: input.impactVelocityMs,
    location,
    sourcesUsed: ["dnvO501.blindTee.constants", materialCoefficientId, "dnvO501.unitConversionConstant"],
    usedConfidences: [
      getCoefficient("dnvO501.blindTee.constants").confidence,
      getCoefficient(materialCoefficientId).confidence,
      getCoefficient("dnvO501.unitConversionConstant").confidence,
    ],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 7) Redüksiyon (Bölüm 8.6, Eq. 8.30-8.35) — RESTRICTION_ORIFICE için de
//    (geometrik olarak D2≪D1 dejenere bir redüksiyon örneğidir)
//    computeRestrictionOrificeErosionRate() ADIYLA AYNI ÇEKİRDEĞİ kullanır.
// ─────────────────────────────────────────────────────────────────────────

export interface ReducerErosionInput {
  sandMassFlowRateKgS: number;
  /** Redüksiyon ÖNCESİ (yukarı akış) hızı U1 (m/s) */
  upstreamVelocityMs: number;
  upstreamIdM: number;
  downstreamIdM: number;
  /** Çarpma açısı (derece) — bilinmiyorsa standardın muhafazakâr varsayılanı (60°) kullanılır */
  impactAngleDeg?: number;
  particleDiameterM: number;
  mixtureDensityKgM3: number;
  targetMaterialDensityKgM3: number;
  materialClass: DnvMaterialClass;
}

function computeReducerErosionRateCore(input: ReducerErosionInput, modelUsed: string): ErosionResult {
  if (input.upstreamIdM <= 0 || input.downstreamIdM <= 0) {
    throw new Error("Çaplar pozitif olmalıdır.");
  }
  if (input.downstreamIdM >= input.upstreamIdM) {
    throw new Error("Redüksiyon için çıkış çapı, giriş çapından küçük olmalıdır.");
  }
  if (input.sandMassFlowRateKgS < 0 || input.upstreamVelocityMs < 0) {
    throw new Error("Debi ve hız negatif olamaz.");
  }

  const location: ErosionDamageLocation = {
    maxLocationDescriptionTr:
      "Daralma düzleminin hemen mansap tarafı — DNV Şekil 8-2'deki dairesel/huni biçimli erozyon bölgesi.",
    angularPositionDeg: null,
    axialPositionFraction: 0,
  };

  if (input.sandMassFlowRateKgS === 0) {
    return zeroGeometryResult(modelUsed, location);
  }

  const validityWarnings: ValidityWarning[] = [];
  let angleDeg = input.impactAngleDeg;
  if (angleDeg === undefined) {
    angleDeg = getCoefficient<number>("dnvO501.conservativeDefaultImpactAngleDeg").value;
    validityWarnings.push({
      parameter: "Çarpma açısı",
      value: angleDeg,
      min: 0,
      max: 90,
      unit: "derece",
      message: `Çarpma açısı verilmedi — standardın muhafazakâr varsayılanı (${angleDeg}°) kullanıldı.`,
    });
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  const d1 = input.upstreamIdM;
  const d2 = input.downstreamIdM;
  const targetAreaM2 = (Math.PI / (4 * Math.sin(angleRad))) * (d1 ** 2 - d2 ** 2);
  const areaRatio = 1 - d2 ** 2 / d1 ** 2;
  const downstreamVelocityMs = input.upstreamVelocityMs * (d1 / d2) ** 2;

  const impactAngleFactor = computeImpactAngleFactor(angleDeg);
  const c2 = computeParticleSizeDensityCorrectionC2(input.particleDiameterM, input.mixtureDensityKgM3);
  const {
    row: { k, n },
    coefficientId: materialCoefficientId,
  } = getMaterialConstants(input.materialClass);
  const materialBrittleWarning = brittleMaterialWarningIfApplicable(input.materialClass);
  if (materialBrittleWarning) {
    validityWarnings.push(materialBrittleWarning);
  }
  const cUnit = getCoefficient<number>("dnvO501.unitConversionConstant").value;

  const baseRateMmPerYear =
    ((input.sandMassFlowRateKgS * k * impactAngleFactor * downstreamVelocityMs ** n) /
      (input.targetMaterialDensityKgM3 * targetAreaM2)) *
    areaRatio *
    c2 *
    cUnit;

  const calculationTrace: TraceStep[] = [
    {
      stepName: "Daralma sonrası hız ve hedef alan (Eq. 8.30-8.32)",
      formula: "U2=U1·(D1/D2)²; At=π/(4sinα)·(D1²−D2²); Aratio=1−D2²/D1²",
      inputs: { U1: input.upstreamVelocityMs, D1: d1, D2: d2, alphaDeg: angleDeg },
      output: downstreamVelocityMs,
      unit: "m/s",
      coefficientIds: [],
    },
    {
      stepName: "Redüksiyon erozyon hızı (Eq. 8.35)",
      formula: "E_L = ṁp·K·F(α)·U2^n/(ρt·At) · Aratio · C2 · Cunit",
      inputs: { areaRatio, C2: c2 },
      output: baseRateMmPerYear,
      unit: "mm/yıl",
      coefficientIds: [
        "dnvO501.impactAngleConstants",
        materialCoefficientId,
        "dnvO501.unitConversionConstant",
        "dnvO501.particleSizeDensityCorrection.denominatorConstant",
      ],
    },
  ];

  return finalizeGeometryResult({
    baseRateMmPerYear,
    modelUsed,
    particleImpactAngleDeg: angleDeg,
    particleVelocityMs: downstreamVelocityMs,
    location,
    sourcesUsed: [
      "dnvO501.impactAngleConstants",
      materialCoefficientId,
      "dnvO501.unitConversionConstant",
      "dnvO501.particleSizeDensityCorrection.denominatorConstant",
    ],
    usedConfidences: [
      getCoefficient("dnvO501.impactAngleConstants").confidence,
      getCoefficient(materialCoefficientId).confidence,
      getCoefficient("dnvO501.unitConversionConstant").confidence,
    ],
    uncertaintyFactorId: UNCERTAINTY_FACTOR_ID,
    validityWarnings,
    calculationTrace,
  });
}

/**
 * DNV RP O501 §8.6 (Eq. 8.30-8.35) redüksiyon (kontraksiyon) erozyon hızı.
 *
 * Model adı: DNV-RP-O501 §8.6. Girdi/çıktı: SI → mm/yıl.
 */
export function computeReducerErosionRate(input: ReducerErosionInput): ErosionResult {
  return computeReducerErosionRateCore(input, "DNV-RP-O501 §8.6 Redüksiyon");
}

/**
 * Kısıtlama orifisi (restriction orifice) — DNV RP O501'de AYRI bir bölüm
 * olarak yer ALMAZ, ama geometrik olarak (D2≪D1, akış alanının aniden
 * daralması) standardın redüksiyon modeliyle (§8.6) birebir aynı fiziksel
 * sınıftadır — orifis PLAKASININ inceliği (redüksiyonun konik geçişine
 * karşı) standardın kendi denklemine bir girdi OLMADIĞI için bu ayrım
 * denklemi ETKİLEMEZ. downstreamIdM = orifis deliği çapı olarak verilmelidir.
 */
export function computeRestrictionOrificeErosionRate(input: ReducerErosionInput): ErosionResult {
  const result = computeReducerErosionRateCore(input, "DNV-RP-O501 §8.6 Redüksiyon modeli (kısıtlama orifisi)");
  if (input.sandMassFlowRateKgS === 0) {
    return result;
  }
  return {
    ...result,
    validityWarnings: [
      ...result.validityWarnings,
      {
        parameter: "Geometri modeli",
        value: 0,
        min: 0,
        max: 0,
        unit: "-",
        message:
          "Kısıtlama orifisi DNV-RP-O501'de ayrı bir bölüm olarak yer almaz — standardın redüksiyon " +
          "modeli (§8.6), aynı fiziksel sınıf (ani akış alanı daralması) olduğu için doğrudan uygulandı.",
      },
    ],
  };
}

/**
 * Choke vana trimi erozyon hızı — DNV RP O501'İN KENDİ METNİ AÇIKÇA choke
 * vanalarını KAPSAM DIŞI bırakır ("the recommended calculation procedure is
 * not applicable to certain components with highly complicated flow
 * geometry; including manifolds and chokes", DNV RP O501 §2). Choke'a özgü
 * bir model (Tulsa/E/CRC, Tablo 5 FP=0,055 m/kg) bu oturumda ARAŞTIRILDI
 * (bkz. registry/coefficients/tulsaEcrc.ts) ama MUTLAK BİRİMİ (m/s mi,
 * m/yıl mı) ikincil kaynaktan KESİN olarak çözülemediği için (bkz. o
 * dosyanın başlık yorumu) MUTLAK hız hesabında KULLANILMADI. Bunun yerine
 * bu fonksiyon, choke trim geçişini (giriş gövde çapından trim/oturak
 * deliğine ani daralma) DNV'nin KENDİ redüksiyon modeliyle (§8.6, birincil
 * kaynaklı, tam doğrulanmış) YAKLAŞIK olarak temsil eder —
 * downstreamIdM = trim/oturak efektif akış çapı olarak verilmelidir.
 *
 * Malzeme seçiminde Haugen/Kvernvold/Ronold/Sandberg (Wear 186-187, 1995,
 * "Sand Erosion of Wear-Resistant Materials: Erosion in Choke Valves" —
 * DNV'nin kendi Ref./8/'i) NİTEL olarak dikkate alınmalıdır: tungsten
 * karbür/seramik trimler çelikten belirgin biçimde daha dayanıklıdır (bkz.
 * dnvO501.materialConstants TUNGSTEN_CARBIDE/CERAMIC_COATING notları,
 * UNVERIFIED sayısal tahmin).
 */
export function computeChokeValveErosionRate(input: ReducerErosionInput): ErosionResult {
  const result = computeReducerErosionRateCore(input, "DNV-RP-O501 §8.6 Redüksiyon modeli (choke vana trimi yaklaşımı)");
  if (input.sandMassFlowRateKgS === 0) {
    return result;
  }
  return {
    ...result,
    confidence: "LOW",
    maxLocationDescriptionTr: "Choke trim/oturak geçişinin hemen mansap tarafı (yaklaşık — DNV kapsamı dışı).",
    validityWarnings: [
      ...result.validityWarnings,
      {
        parameter: "Geometri modeli",
        value: 0,
        min: 0,
        max: 0,
        unit: "-",
        message:
          "Choke vanaları DNV-RP-O501'İN KENDİ METNİNDE AÇIKÇA kapsam dışı bırakılmıştır (§2, karmaşık " +
          "akış geometrisi). Bu sonuç, redüksiyon modelinin choke trim geçişine YAKLAŞIK bir uzantısıdır — " +
          "gerçek choke geometrisi (çok kademeli trim, kavitasyon, jet çarpması) burada MODELLENMEMİŞTİR. " +
          "Kesin değerlendirme için üretici test verisi veya CFD gereklidir.",
      },
    ],
  };
}

/**
 * Dallanma/geçiş Te'si (TEE_BRANCH/TEE_SWEEPING — akışın DEVAM ETTİĞİ Te,
 * KÖR Te ile KARIŞTIRILMAMALI, bkz. computeBlindTeeErosionRate) erozyon
 * hızı. DNV RP O501'İN "Blinded Tee" modeli YALNIZCA kör Te'yi kapsar; bu
 * geometri için ayrı bir DNV bölümü YOKTUR. Dallanma akışının ~90°'lik
 * yönelim değişimi, standardın KENDİ dirsek modeliyle (§8.4, birincil
 * kaynaklı) fiziksel olarak en yakın analojidir (bkz.
 * registry/coefficients/tulsaEcrc.ts başlık yorumu — Tulsa/E/CRC Tee FP
 * verisi mutlak birim belirsizliği nedeniyle KULLANILMADI).
 * bendRadiusRatio, dallanma boru geometrisine göre çağıran tarafça
 * (tipik: eşit çaplı dallanma Te için R/D≈1) sağlanmalıdır.
 */
export function computeTeeBranchErosionRate(input: BendErosionInput): ErosionResult {
  const bendResult = computeBendErosionRate(input);
  if (input.sandMassFlowRateKgS === 0) {
    return { ...bendResult, modelUsed: "DNV-RP-O501 §8.4 Dirsek modeli (dallanma Te yaklaşımı)" };
  }
  return {
    ...bendResult,
    modelUsed: "DNV-RP-O501 §8.4 Dirsek modeli (dallanma Te için yaklaşık uzantı)",
    confidence: "LOW",
    maxLocationDescriptionTr: "Dallanma Te'sinin ana hat/dal kesişim bölgesi, dal tarafı iç yarıçapı (yaklaşık).",
    validityWarnings: [
      ...bendResult.validityWarnings,
      {
        parameter: "Geometri modeli",
        value: 0,
        min: 0,
        max: 0,
        unit: "-",
        message:
          "DNV-RP-O501'in kör Te modeli AKIŞ DEVAM EDEN bir dallanma/geçiş Te'sini KAPSAMAZ. Bu sonuç, " +
          "dirsek modelinin dallanma akışına YAKLAŞIK bir uzantısıdır — DOĞRULANMAMIŞ.",
      },
    ],
  };
}
