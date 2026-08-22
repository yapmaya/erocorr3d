// packages/engine/src/erosion/valveHydraulics.ts
//
// Vana hidroliği: sıvı servisi için ISA S75.01.01 / IEC 60534-2-1 boyutlandırma
// denklemleri kullanılarak, verilen bir Cv/FL ve basınç koşulları altında
// (1) geçen hacimsel debi, (2) tıkanmış (choked) akış durumu ve (3) kavitasyon
// riski indeksi hesaplanır.
//
// Model: W = Cv × N6 × FP × √(ΔPsizing[bar] × ρ1)                    [kg/h]
//        ΔPchoked = FL² × (P1 - FF×Pv)                                [Pa]
//        FF = C1 - C2×√(Pv/Pc)                                        (-)
//        xF = ΔPaktüel / (P1 - Pv)                                    (-, kavitasyon indeksi)
//
// Kaynak: ISA S75.01.01/IEC 60534-2-1 boyutlandırma denklemleri (N6, FF
// formülü — bkz. registry/coefficients/valves.ts). Vana TİPİNE özgü FL/xT
// değerleri packages/engine/src/data/valveCatalog.ts'ten alınmalıdır (bu
// fonksiyona doğrudan sayısal girdi olarak verilir, burada içeri
// aktarılmaz — hidrolik hesap, katalog verisinden BAĞIMSIZ ve genel amaçlıdır).
//
// Geçerlilik/kapsam: yalnızca SIVI servisi için ISA sıkışmamış/sıkışmış akış
// denklemleridir (Bölüm 5.8, Fisher Control Valve Handbook). Gaz/buhar
// servisi (Y genleşme faktörü, xT kriteri) bu dosyada implemente EDİLMEMİŞTİR
// — ayrı bir gelecek fazdır.
//
// Bilinen sınırlamalar: kavitasyon riski yalnızca çağıran taraf Kc (kavitasyon
// başlangıç katsayısı, üretici test verisi) sağladığında değerlendirilebilir
// — bkz. data/valveCatalog.ts'teki not: bu oturumda hiçbir vana tipi için
// genel/literatür kaynaklı bir Kc değeri bulunamadı, bu yüzden Kc burada
// KESTİRİLMEZ/varsayılmaz, yalnızca doğrudan sağlandığında kullanılır.

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";
import type { ComponentType } from "../types/enums";
import { getValveErosionProfile } from "../data/valveCatalog";

export interface ValveHydraulicsInput {
  /** Vana girişi mutlak basıncı P1 (Pa) */
  upstreamPressurePa: number;
  /** Vana çıkışı mutlak basıncı P2 (Pa) */
  downstreamPressurePa: number;
  /** Akış sıcaklığında sıvının buhar basıncı Pv (Pa) */
  vaporPressurePa: number;
  /** Sıvının termodinamik kritik basıncı Pc (Pa) */
  thermodynamicCriticalPressurePa: number;
  /** Bu açıklıktaki anma akış katsayısı Cv */
  flowCoefficientCv: number;
  /** Sıvı basınç geri kazanım faktörü FL (bu açıklık için, valveCatalog.ts veya üretici verisinden) */
  liquidPressureRecoveryFactorFl: number;
  /** Akışkan yoğunluğu ρ1 (kg/m³) */
  fluidDensityKgM3: number;
  /** Boru geometrisi faktörü FP — vana girişine doğrudan bağlı redüksiyon/dirsek yoksa 1.0 */
  pipingGeometryFactorFp?: number;
  /** Kavitasyon başlangıç katsayısı Kc — üretici test verisinden; sağlanmazsa kavitasyon riski değerlendirilemez */
  cavitationCoefficientKc?: number;
}

export type CavitationRisk = "UNKNOWN" | "UNLIKELY" | "LIKELY";

export interface ValveHydraulicsResult {
  volumetricFlowRateM3H: number;
  massFlowRateKgH: number;
  pressureDropPa: number;
  chokedPressureDropPa: number;
  isChokedFlow: boolean;
  liquidCriticalPressureRatioFactorFf: number;
  cavitationIndexXf: number;
  cavitationRisk: CavitationRisk;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

const PA_PER_BAR = 1e5;

/**
 * Sıvı kritik basınç oranı faktörü FF'yi hesaplar.
 *
 * FF = C1 - C2×√(Pv/Pc). Pv≈0 iken FF→C1 (≈0.96); Pv→Pc'ye yaklaştıkça FF azalır.
 */
export function computeLiquidCriticalPressureRatioFactor(
  vaporPressurePa: number,
  thermodynamicCriticalPressurePa: number,
): number {
  if (thermodynamicCriticalPressurePa <= 0) {
    throw new Error("Termodinamik kritik basınç pozitif olmalıdır.");
  }
  if (vaporPressurePa < 0) {
    throw new Error("Buhar basıncı negatif olamaz.");
  }
  const c1 = getCoefficient<number>("valves.isa60534.ffFormulaConstant1").value;
  const c2 = getCoefficient<number>("valves.isa60534.ffFormulaConstant2").value;
  return c1 - c2 * Math.sqrt(vaporPressurePa / thermodynamicCriticalPressurePa);
}

/**
 * Vana hidroliğini hesaplar: sıvı servisi ISA S75.01.01/IEC 60534-2-1
 * boyutlandırma denklemleriyle geçen debi, tıkanmış akış durumu ve
 * kavitasyon riski indeksi.
 *
 * Model adı: ISA S75.01.01/IEC 60534-2-1 sıvı boyutlandırma denklemleri.
 * Girdi/çıktı birimleri: SI (Pa, kg/m³) → çıktı m³/h, kg/h.
 * Geçerlilik aralığı: yalnızca tek-bileşenli, sıkışmayan (non-flashing
 * olmayan durumlar dahil, choked flow denklemi flashing/kavitasyon
 * başlangıcını da kapsar) sıvı akışı için (bkz. dosya başı yorumu).
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeValveHydraulics(input: ValveHydraulicsInput): ValveHydraulicsResult {
  if (input.upstreamPressurePa <= 0 || input.downstreamPressurePa < 0) {
    throw new Error("Giriş/çıkış basınçları mutlak ve pozitif olmalıdır.");
  }
  if (input.flowCoefficientCv <= 0) {
    throw new Error("Akış katsayısı Cv pozitif olmalıdır.");
  }
  if (input.liquidPressureRecoveryFactorFl <= 0 || input.liquidPressureRecoveryFactorFl > 1) {
    throw new Error("FL (0, 1] aralığında olmalıdır.");
  }
  if (input.fluidDensityKgM3 <= 0) {
    throw new Error("Akışkan yoğunluğu pozitif olmalıdır.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const fp = input.pipingGeometryFactorFp ?? 1;

  const pressureDropPa = input.upstreamPressurePa - input.downstreamPressurePa;
  if (pressureDropPa <= 0) {
    validityWarnings.push({
      parameter: "Basınç düşümü",
      value: pressureDropPa,
      min: 0,
      max: Infinity,
      unit: "Pa",
      message:
        "Vana girişi basıncı çıkış basıncından büyük veya eşit değil; bu yönde akış oluşmaz (debi 0 kabul edildi).",
    });
    return {
      volumetricFlowRateM3H: 0,
      massFlowRateKgH: 0,
      pressureDropPa,
      chokedPressureDropPa: 0,
      isChokedFlow: false,
      liquidCriticalPressureRatioFactorFf: 0,
      cavitationIndexXf: 0,
      cavitationRisk: "UNKNOWN",
      confidence: "HIGH",
      validityWarnings,
      sourcesUsed: [],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
    };
  }

  const ff = computeLiquidCriticalPressureRatioFactor(
    input.vaporPressurePa,
    input.thermodynamicCriticalPressurePa,
  );
  const chokedPressureDropPa =
    input.liquidPressureRecoveryFactorFl ** 2 * (input.upstreamPressurePa - ff * input.vaporPressurePa);
  const isChokedFlow = pressureDropPa >= chokedPressureDropPa;
  const sizingPressureDropPa = Math.min(pressureDropPa, chokedPressureDropPa);

  if (sizingPressureDropPa <= 0) {
    validityWarnings.push({
      parameter: "Boyutlandırma basınç düşümü",
      value: sizingPressureDropPa,
      min: 0,
      max: Infinity,
      unit: "Pa",
      message:
        "Hesaplanan tıkanmış basınç düşümü (ΔPchoked) 0 veya negatif — bu genellikle buhar basıncının giriş " +
        "basıncına çok yakın/üzerinde olduğu, akışkanın zaten buharlaştığı bir durumu işaret eder. Debi 0 " +
        "kabul edildi; girdi koşulları (özellikle buhar basıncı) kontrol edilmelidir.",
    });
  }

  const sizingPressureDropBar = Math.max(sizingPressureDropPa, 0) / PA_PER_BAR;
  const n6 = getCoefficient<number>("valves.isa60534.n6Metric").value;
  const massFlowRateKgH =
    input.flowCoefficientCv * n6 * fp * Math.sqrt(sizingPressureDropBar * input.fluidDensityKgM3);
  const volumetricFlowRateM3H = massFlowRateKgH / input.fluidDensityKgM3;

  const cavitationDrivingPressurePa = input.upstreamPressurePa - input.vaporPressurePa;
  const cavitationIndexXf =
    cavitationDrivingPressurePa > 0 ? pressureDropPa / cavitationDrivingPressurePa : Number.POSITIVE_INFINITY;

  let cavitationRisk: CavitationRisk = "UNKNOWN";
  const sourcesUsed = [
    "valves.isa60534.n6Metric",
    "valves.isa60534.ffFormulaConstant1",
    "valves.isa60534.ffFormulaConstant2",
  ];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("valves.isa60534.n6Metric").confidence,
    getCoefficient("valves.isa60534.ffFormulaConstant1").confidence,
    getCoefficient("valves.isa60534.ffFormulaConstant2").confidence,
  ];

  if (input.cavitationCoefficientKc !== undefined) {
    cavitationRisk = cavitationIndexXf >= input.cavitationCoefficientKc ? "LIKELY" : "UNLIKELY";
  } else {
    validityWarnings.push({
      parameter: "Kavitasyon başlangıç katsayısı (Kc)",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "Kc (kavitasyon başlangıç katsayısı) sağlanmadı — kavitasyon riski değerlendirilemedi, yalnızca " +
        "kavitasyon indeksi (xF) hesaplandı. Kc, vana üreticisinin test verisinden alınmalıdır (bkz. " +
        "data/valveCatalog.ts kcTypical alanı notu — bu oturumda genel bir Kc kaynağı bulunamadı).",
    });
  }

  if (isChokedFlow) {
    validityWarnings.push({
      parameter: "Akış durumu",
      value: pressureDropPa,
      min: 0,
      max: chokedPressureDropPa,
      unit: "Pa",
      message:
        "Akış TIKANMIŞ (choked) durumda — aktüel basınç düşümü (ΔP), tıkanma basınç düşümünü (ΔPchoked) " +
        "aşıyor. Debi, ΔPchoked ile sınırlıdır; giriş/çıkış basıncını daha fazla değiştirmek debiyi artırmaz.",
    });
  }

  return {
    volumetricFlowRateM3H,
    massFlowRateKgH,
    pressureDropPa,
    chokedPressureDropPa,
    isChokedFlow,
    liquidCriticalPressureRatioFactorFf: ff,
    cavitationIndexXf,
    cavitationRisk,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// A) SIVI SERVİSİ — ISA-RP75.23-1995 "sigma (σ)" YÖNTEMİ
//
// Yukarıdaki computeValveHydraulics()/cavitationIndexXf, ISA S75.01.01/IEC
// 60534-2-1'in BOYUTLANDIRMA denklemindeki xF=(P1-P2)/(P1-Pv) kavitasyon
// göstergesini kullanır (Kc ile NOKTASAL karşılaştırma). Aşağıdaki bölüm
// ONU DEĞİŞTİRMEZ — bunun yerine ISA-RP75.23-1995'in AYRI, daha zengin
// "sigma yöntemini" (σ=(P1-Pv)/(P1-P2)=1/xF, kademeli kavitasyon rejimleri,
// üretici test verisine göre BOYUT/BASINÇ ölçeklenmiş hasar-başlangıcı eşiği
// σv) EKLER. Kaynak: bkz. registry/coefficients/valves.ts — Masoneilan/
// Stares (2007) + DeZURIK Alpha I Cavitation Guide, İKİ BAĞIMSIZ kaynak,
// TAM SAYISAL bir örnekle (2" VPB vana) bu oturumda çapraz doğrulandı.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kavitasyon indeksi σ = (P1-Pv)/(P1-P2) — ISA-RP75.23-1995'in kendi
 * formu (küçük σ = yüksek kavitasyon potansiyeli). computeValveHydraulics'
 * teki cavitationIndexXf'in (=ΔP/(P1-Pv)) TERSİDİR — iki gösterge de aynı
 * fiziksel bilgiyi taşır, yalnızca ISA'nın iki farklı belgesi (S75.01.01
 * boyutlandırma vs. RP75.23 kavitasyon değerlendirmesi) farklı kural
 * kullanır.
 */
export function computeCavitationIndexSigma(
  upstreamPressurePa: number,
  downstreamPressurePa: number,
  vaporPressurePa: number,
): number {
  const denom = upstreamPressurePa - downstreamPressurePa;
  if (denom <= 0) {
    throw new Error("Vana girişi basıncı çıkış basıncından büyük olmalıdır.");
  }
  return (upstreamPressurePa - vaporPressurePa) / denom;
}

/**
 * Boğulma noktasındaki sigma (σch) — ayrı bir kaynak sabiti GEREKTİRMEZ,
 * zaten sourced olan ΔPchoked=FL²(P1-Ff·Pv) denkleminden CEBİRSEL olarak
 * türetilir (bkz. registry/coefficients/valves.ts::
 * valves.isaRp7523.chokingSigmaFromFlRelation — yalnızca belgeleme amaçlı).
 */
export function computeChokingSigma(
  upstreamPressurePa: number,
  vaporPressurePa: number,
  liquidPressureRecoveryFactorFl: number,
  liquidCriticalPressureRatioFactorFf: number,
): number {
  if (liquidPressureRecoveryFactorFl <= 0 || liquidPressureRecoveryFactorFl > 1) {
    throw new Error("FL (0, 1] aralığında olmalıdır.");
  }
  const chokedPressureDropPa =
    liquidPressureRecoveryFactorFl ** 2 * (upstreamPressurePa - liquidCriticalPressureRatioFactorFf * vaporPressurePa);
  if (chokedPressureDropPa <= 0) {
    throw new Error("Hesaplanan ΔPchoked 0 veya negatif — girdi koşulları (özellikle buhar basıncı) kontrol edilmelidir.");
  }
  return (upstreamPressurePa - vaporPressurePa) / chokedPressureDropPa;
}

/**
 * ISA-RP75.23-1995 boyut ölçekleme üsteli b — YALNIZCA aynı Cv/d² oranını
 * koruyan bir vana serisi için geçerli yaklaşık formül (b=0.068×(Cv/d²)^0.25).
 * Cv: gerekli (servis) akış katsayısı (ABD gpm birim sistemi), d: uygulama
 * vana boyutu (inç).
 */
export function computeSizeScaleExponentB(requiredFlowCoefficientCv: number, applicationValveSizeInch: number): number {
  if (requiredFlowCoefficientCv <= 0 || applicationValveSizeInch <= 0) {
    throw new Error("Akış katsayısı ve vana boyutu pozitif olmalıdır.");
  }
  const c = getCoefficient<number>("valves.isaRp7523.sizeScaleExponentBFormulaConstant").value;
  return c * (requiredFlowCoefficientCv / applicationValveSizeInch ** 2) ** 0.25;
}

/** ISA-RP75.23-1995 boyut ölçek etkisi SSE = (d/dR)^b. */
export function computeSizeScaleEffect(
  applicationValveSizeInch: number,
  referenceValveSizeInch: number,
  sizeScaleExponentB: number,
): number {
  if (applicationValveSizeInch <= 0 || referenceValveSizeInch <= 0) {
    throw new Error("Vana boyutları pozitif olmalıdır.");
  }
  return (applicationValveSizeInch / referenceValveSizeInch) ** sizeScaleExponentB;
}

/**
 * ISA-RP75.23-1995 basınç ölçek etkisi PSE = [(P1-Pv)/(P1-Pv)R]^a.
 * referencePressureDropPa, üretici testinin referans (P1-Pv)R değeridir —
 * uygulama basıncıyla AYNI birimde (Pa) verilmelidir.
 */
export function computePressureScaleEffect(
  upstreamPressurePa: number,
  vaporPressurePa: number,
  referencePressureDropPa: number,
  pressureScaleExponentA: number,
): number {
  if (referencePressureDropPa <= 0) {
    throw new Error("Referans basınç düşümü pozitif olmalıdır.");
  }
  return ((upstreamPressurePa - vaporPressurePa) / referencePressureDropPa) ** pressureScaleExponentA;
}

/**
 * ISA-RP75.23-1995 ölçeklenmiş hasar-başlangıcı sigma'sı:
 * σv = (σmr×SSE - 1)×PSE + 1. σmr, SSE, PSE — HİÇBİRİ jenerik bir sayı
 * DEĞİLDİR, üçü de üretici test verisinden gelmelidir (bkz. computeSizeScaleEffect/
 * computePressureScaleEffect ve dosya başı yorumu).
 */
export function computeScaledIncipientDamageSigma(
  manufacturerRecommendedSigmaMr: number,
  sizeScaleEffectSse: number,
  pressureScaleEffectPse: number,
): number {
  return (manufacturerRecommendedSigmaMr * sizeScaleEffectSse - 1) * pressureScaleEffectPse + 1;
}

export type CavitationRegimeLevel = "BİLİNMİYOR" | "GÜVENLİ" | "BAŞLANGIÇ_HASARI" | "HASAR_RİSKİ" | "BOĞULMUŞ";

export interface CavitationRegimeResult {
  level: CavitationRegimeLevel;
  /** σ/σv — yalnızca σv mevcutsa; DeZURIK Alpha I Guide'ın kendi kabul kriteri: ≥1.0 güvenli, <0.90 kavitasyon başlangıcı. */
  sigmaToScaledDamageRatio: number | null;
}

/**
 * Sigma değerini, boğulma eşiği (σch, her zaman FL'den türetilebilir) ve
 * (varsa) ölçeklenmiş hasar-başlangıcı eşiğine (σv, yalnızca üretici σmr
 * verisi sağlanmışsa) göre ayrık bir rejime sınıflandırır.
 *
 * Eşik kuralı (σ/σv oranı bazlı) DeZURIK Alpha I Guide'ın KENDİ, doğrudan
 * belirttiği kabul kriteridir (KDP kapsamı dışı bir proje yorumlaması
 * DEĞİLDİR): "if σ ≥ σvσP, no warnings...if σ < σvσP, then starting when σ
 * is 90% of σvσP the onset of cavitation exists."
 */
export function classifyCavitationRegime(
  sigma: number,
  chokingSigma: number,
  scaledIncipientDamageSigma: number | null,
): CavitationRegimeResult {
  if (sigma <= chokingSigma) {
    return { level: "BOĞULMUŞ", sigmaToScaledDamageRatio: null };
  }
  if (scaledIncipientDamageSigma === null) {
    return { level: "BİLİNMİYOR", sigmaToScaledDamageRatio: null };
  }
  const ratio = sigma / scaledIncipientDamageSigma;
  if (ratio >= 1.0) {
    return { level: "GÜVENLİ", sigmaToScaledDamageRatio: ratio };
  }
  if (ratio >= 0.9) {
    return { level: "BAŞLANGIÇ_HASARI", sigmaToScaledDamageRatio: ratio };
  }
  return { level: "HASAR_RİSKİ", sigmaToScaledDamageRatio: ratio };
}

/**
 * Eşik ALTINDA (aktif kavitasyon hasarı riski) GÖSTERGE (indicative) hasar
 * hızı — erosion/dropletErosion.ts İLE AYNI FELSEFE: hiçbir kaynak mutlak
 * bir mm/yıl değeri vermiyor, yalnızca eşiğe göreli mesafenin KABA bir
 * üstel ölçeklemesi. HER ZAMAN confidence=UNVERIFIED taşır (çağıran taraf
 * bunu ayrıca kontrol etmelidir — bkz. assessLiquidCavitationRisk).
 *
 * @param relativeMaterialHardnessFactor Hedef malzemenin, CS'ye göre GÖRELİ
 * kavitasyon direnci — üretici/malzeme test verisi olmadan VARSAYILAN 1.0
 * (CS-eşdeğeri) kullanılır. Bu proje şu an materials.ts'te bir sertlik alanı
 * TAŞIMIYOR (bu oturumda eklenmedi) — bu yüzden burada yalnızca ÇAĞIRAN
 * TARAFIN doğrudan sağlayabileceği opsiyonel bir çarpandır, otomatik
 * hesaplanmaz.
 */
export function estimateIndicativeCavitationDamageRateMmPerYear(
  sigma: number,
  referenceThresholdSigma: number,
  relativeMaterialHardnessFactor = 1,
): UncertaintyBand | null {
  if (sigma >= referenceThresholdSigma) {
    return null;
  }
  if (relativeMaterialHardnessFactor <= 0) {
    throw new Error("Göreli malzeme sertliği çarpanı pozitif olmalıdır.");
  }
  const severityRatio = referenceThresholdSigma / sigma;
  const [exponentMin] = getCoefficient<[number, number]>("valves.cavitationDamage.severityExponentRange").value;
  const referenceRateMmPerYear = getCoefficient<number>(
    "valves.cavitationDamage.indicativeRateAtThresholdMmPerYear",
  ).value;
  const centralRateMmPerYear = (referenceRateMmPerYear * severityRatio ** exponentMin) / relativeMaterialHardnessFactor;
  const uncertaintyFactor = getCoefficient<number>("valves.cavitationDamage.uncertaintyBandFactor").value;
  return applyMultiplicativeUncertaintyBand(centralRateMmPerYear, uncertaintyFactor);
}

export interface LiquidCavitationAssessmentInput {
  upstreamPressurePa: number;
  downstreamPressurePa: number;
  vaporPressurePa: number;
  thermodynamicCriticalPressurePa: number;
  liquidPressureRecoveryFactorFl: number;
  /**
   * ISA-RP75.23-1995 üretici ölçekleme verisi — TÜMÜ opsiyonel. Üçü de
   * birlikte sağlanmazsa yalnızca boğulma durumu (σch) değerlendirilir,
   * "hasar başlangıcı" rejimi BİLİNMİYOR döner (bkz. data/valveCatalog.ts'
   * teki kcTypical alanı ile AYNI gerekçe — jenerik bir σmr/SSE/PSE
   * YOKTUR).
   */
  manufacturerRecommendedSigmaMr?: number;
  sizeScaleEffectSse?: number;
  pressureScaleEffectPse?: number;
  relativeMaterialHardnessFactor?: number;
}

export interface LiquidCavitationAssessmentResult {
  cavitationIndexSigma: number;
  chokingSigma: number;
  scaledIncipientDamageSigma: number | null;
  regimeLevel: CavitationRegimeLevel;
  sigmaToScaledDamageRatio: number | null;
  isFlashing: boolean;
  indicativeDamageRateMmPerYear: UncertaintyBand | null;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
  screeningOnlyNoteTr: string;
}

const LIQUID_CAVITATION_SCREENING_NOTE_TR =
  "σi (kavitasyon başlangıcı) ve σc (sabit/tam kavitasyon) eşikleri, ISA-RP75.23-1995'e göre yalnızca " +
  "ÜRETİCİNİN kendi vana geometrisi için yaptığı titreşim-testi eğrisinden (Şekil 7/8, akustik ivmeölçer " +
  "ile) elde edilebilir — hiçbir jenerik/vana-tipinden-bağımsız sayı YOKTUR ve bu fonksiyon bunları " +
  "ÜRETMEZ. σmr (hasar başlangıcı) sağlanmadığında yalnızca boğulma (σch, FL'den türetilir) " +
  "değerlendirilebilir. Kavitasyon hasar hızı tahmini (varsa) HER ZAMAN DOĞRULANMAMIŞ (UNVERIFIED) bir " +
  "göstergedir, kesin bir ölçüm DEĞİLDİR.";

/**
 * ISA-RP75.23-1995 sigma yöntemiyle sıvı servisi kavitasyon riskini tam
 * olarak değerlendirir: σ, σch (boğulma), varsa σv (ölçeklenmiş hasar
 * başlangıcı), ayrık rejim, flashing bayrağı ve (eşik altındaysa) GÖSTERGE
 * hasar hızı.
 *
 * Model adı: ISA-RP75.23-1995 sigma yöntemi + ISA S75.01.01/IEC 60534-2-1
 * (FL/FF, boğulma).
 * Girdi/çıktı birimleri: SI (Pa) → çıktı boyutsuz (σ) + mm/yıl (gösterge hız).
 * Geçerlilik/bilinen sınırlamalar: bkz. dosya başı yorumu ve
 * LIQUID_CAVITATION_SCREENING_NOTE_TR.
 */
export function assessLiquidCavitationRisk(input: LiquidCavitationAssessmentInput): LiquidCavitationAssessmentResult {
  if (input.upstreamPressurePa <= 0 || input.downstreamPressurePa < 0) {
    throw new Error("Giriş/çıkış basınçları mutlak ve pozitif olmalıdır.");
  }
  if (input.vaporPressurePa < 0) {
    throw new Error("Buhar basıncı negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const isFlashing = input.downstreamPressurePa <= input.vaporPressurePa;

  if (isFlashing) {
    validityWarnings.push({
      parameter: "Flashing durumu",
      value: input.downstreamPressurePa,
      min: input.vaporPressurePa,
      max: Infinity,
      unit: "Pa",
      message:
        "Çıkış basıncı (P2), buhar basıncının (Pv) altında/eşit — FLASHING oluşuyor. Bu, kavitasyondan " +
        "FARKLI bir hasar desenidir: DeZURIK Alpha I Cavitation Guide'a göre kavitasyon 'cindered/pitted' " +
        "(çukurlaşmış/kraterli) görünümdeyken, flashing hasarı DAHA LOKALİZE, düzgün ve cilalı (smooth/" +
        "polished) bir malzeme kaybı bırakır. Aşağıdaki σ/σch/σv değerlendirmesi kavitasyon MODELİDİR — " +
        "flashing için doğrudan geçerli değildir, yalnızca bilgi amaçlı hesaplanmaya devam edilir.",
    });
  }

  if (input.upstreamPressurePa - input.downstreamPressurePa <= 0) {
    return {
      cavitationIndexSigma: Number.POSITIVE_INFINITY,
      chokingSigma: Number.POSITIVE_INFINITY,
      scaledIncipientDamageSigma: null,
      regimeLevel: "GÜVENLİ",
      sigmaToScaledDamageRatio: null,
      isFlashing,
      indicativeDamageRateMmPerYear: null,
      confidence: "HIGH",
      validityWarnings,
      sourcesUsed: [],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
      screeningOnlyNoteTr: LIQUID_CAVITATION_SCREENING_NOTE_TR,
    };
  }

  const ff = computeLiquidCriticalPressureRatioFactor(input.vaporPressurePa, input.thermodynamicCriticalPressurePa);
  const sigma = computeCavitationIndexSigma(input.upstreamPressurePa, input.downstreamPressurePa, input.vaporPressurePa);
  const chokingSigma = computeChokingSigma(
    input.upstreamPressurePa,
    input.vaporPressurePa,
    input.liquidPressureRecoveryFactorFl,
    ff,
  );

  const sourcesUsed = ["valves.isa60534.ffFormulaConstant1", "valves.isa60534.ffFormulaConstant2"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("valves.isa60534.ffFormulaConstant1").confidence,
    getCoefficient("valves.isa60534.ffFormulaConstant2").confidence,
  ];

  let scaledIncipientDamageSigma: number | null = null;
  if (
    input.manufacturerRecommendedSigmaMr !== undefined &&
    input.sizeScaleEffectSse !== undefined &&
    input.pressureScaleEffectPse !== undefined
  ) {
    scaledIncipientDamageSigma = computeScaledIncipientDamageSigma(
      input.manufacturerRecommendedSigmaMr,
      input.sizeScaleEffectSse,
      input.pressureScaleEffectPse,
    );
    sourcesUsed.push("valves.isaRp7523.scaledIncipientDamageSigmaFormula");
    usedConfidences.push(getCoefficient("valves.isaRp7523.scaledIncipientDamageSigmaFormula").confidence);
  } else {
    validityWarnings.push({
      parameter: "Üretici σmr/SSE/PSE verisi",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "manufacturerRecommendedSigmaMr/sizeScaleEffectSse/pressureScaleEffectPse sağlanmadı — hasar " +
        "başlangıcı rejimi değerlendirilemedi, yalnızca boğulma (σch) kontrol edildi. Bu değerler vana " +
        "üreticisinin kendi ISA-RP75.23-1995 titreşim testi verisinden alınmalıdır.",
    });
  }

  const { level: regimeLevel, sigmaToScaledDamageRatio } = classifyCavitationRegime(
    sigma,
    chokingSigma,
    scaledIncipientDamageSigma,
  );

  let indicativeDamageRateMmPerYear: UncertaintyBand | null = null;
  const referenceThresholdSigma = scaledIncipientDamageSigma ?? chokingSigma;
  const referenceThresholdIsChokingFallback = scaledIncipientDamageSigma === null;

  if (regimeLevel === "HASAR_RİSKİ" || regimeLevel === "BOĞULMUŞ" || regimeLevel === "BAŞLANGIÇ_HASARI") {
    if (input.relativeMaterialHardnessFactor === undefined) {
      validityWarnings.push({
        parameter: "Göreli malzeme sertliği çarpanı",
        value: 1,
        min: 0,
        max: Infinity,
        unit: "-",
        message:
          "relativeMaterialHardnessFactor sağlanmadı — karbon çeliği (CS) eşdeğeri (1.0) varsayıldı. " +
          "Daha sert/tokluk trim malzemeleri (ör. Stellite) kavitasyon hasarını YAVAŞLATIR ama bu proje " +
          "bunu otomatik hesaplamaz (materials.ts'te henüz bir sertlik alanı yok).",
      });
    }
    indicativeDamageRateMmPerYear = estimateIndicativeCavitationDamageRateMmPerYear(
      sigma,
      referenceThresholdSigma,
      input.relativeMaterialHardnessFactor ?? 1,
    );
    if (indicativeDamageRateMmPerYear !== null) {
      sourcesUsed.push(
        "valves.cavitationDamage.severityExponentRange",
        "valves.cavitationDamage.indicativeRateAtThresholdMmPerYear",
        "valves.cavitationDamage.uncertaintyBandFactor",
      );
      usedConfidences.push(
        getCoefficient("valves.cavitationDamage.severityExponentRange").confidence,
        getCoefficient("valves.cavitationDamage.indicativeRateAtThresholdMmPerYear").confidence,
        getCoefficient("valves.cavitationDamage.uncertaintyBandFactor").confidence,
      );
      validityWarnings.push({
        parameter: "Gösterge kavitasyon hasar hızı",
        value: indicativeDamageRateMmPerYear.p50,
        min: 0,
        max: Infinity,
        unit: "mm/yıl",
        message:
          `Bu hız DOĞRULANMAMIŞ (UNVERIFIED) bir göstergedir — hiçbir kaynak kavitasyon hasarı için mutlak ` +
          `bir mm/yıl büyüklüğü vermiyor, yalnızca eşiğe göreli uzaklığın kaba bir üstel ölçeklemesidir` +
          (referenceThresholdIsChokingFallback
            ? " (σv sağlanmadığı için referans eşik olarak boğulma sigma'sı σch kullanıldı, bu daha az " +
              "muhafazakâr/daha kaba bir yaklaşımdır)."
            : "."),
      });
    }
  }

  return {
    cavitationIndexSigma: sigma,
    chokingSigma,
    scaledIncipientDamageSigma,
    regimeLevel,
    sigmaToScaledDamageRatio,
    isFlashing,
    indicativeDamageRateMmPerYear,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    screeningOnlyNoteTr: LIQUID_CAVITATION_SCREENING_NOTE_TR,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// B) GAZ/BUHAR SERVİSİ — IEC 60534-2-1 boğulma kriteri, genleşme faktörü Y,
// sonik hız/Mach sayısı, aerodinamik gürültü TARAMASI
//
// Kaynak: HIT VALVE S.p.A. "Valve Sizing Calculator — Reference Guide"
// (bkz. registry/coefficients/valves.ts) — IEC 60534-2-1'in kendisi bu
// oturumda ücretli olduğu için doğrudan okunmadı, ancak bu kaynak
// standardın denklemlerini açık atıfla birebir tekrarlıyor.
//
// ⚠ VDMA 24422/IEC 60534-8-3'ün TAM aerodinamik gürültü (dB) denklemi
// (ΔLG, ΔLP, ΔLP2 vana-özel düzeltme katsayıları GEREKTİRİR — hiçbiri
// jenerik/vana-tipinden-bağımsız DEĞİLDİR) bu dosyada İMPLEMENTE
// EDİLMEMİŞTİR — bkz. assessAerodynamicNoiseRisk'in screeningOnlyNoteTr'si.
// Yalnızca Mach sayısı TARAMASI + 110dBA "asla aşılmaması gereken" sabit
// sınırı uygulanır (api14e.ts/dropletErosion.ts İLE AYNI TARAMA felsefesi).
// ═══════════════════════════════════════════════════════════════════════

/** Fγ = γ/1.4 — özgül ısı oranı düzeltme faktörü. */
export function computeSpecificHeatRatioFactor(specificHeatRatioGamma: number): number {
  if (specificHeatRatioGamma <= 1) {
    throw new Error("Özgül ısı oranı (γ) 1'den büyük olmalıdır.");
  }
  const reference = getCoefficient<number>("valves.gasSizing.referenceSpecificHeatRatio").value;
  return specificHeatRatioGamma / reference;
}

/** x = ΔP/P1 — gaz/buhar basınç düşümü oranı. */
export function computeGasPressureDropRatio(upstreamPressurePa: number, downstreamPressurePa: number): number {
  if (upstreamPressurePa <= 0 || downstreamPressurePa < 0 || downstreamPressurePa > upstreamPressurePa) {
    throw new Error("Basınçlar geçersiz: P1>0 ve 0≤P2≤P1 olmalıdır.");
  }
  return (upstreamPressurePa - downstreamPressurePa) / upstreamPressurePa;
}

/** xchoked = Fγ×xT — boğulma basınç düşümü oranı. */
export function computeGasChokedPressureDropRatio(
  specificHeatRatioFactorFGamma: number,
  pressureDifferentialRatioFactorXt: number,
): number {
  if (pressureDifferentialRatioFactorXt <= 0 || pressureDifferentialRatioFactorXt > 1) {
    throw new Error("xT (0, 1] aralığında olmalıdır.");
  }
  return specificHeatRatioFactorFGamma * pressureDifferentialRatioFactorXt;
}

/**
 * Y = 1 - xsizing/(3×xchoked) — genleşme faktörü. xsizing=min(x,xchoked)
 * (boğulmada Y→2/3'e sabitlenir — bu oturumda BİR arama-motoru sentezinde
 * hatalı biçimde "1/3" olarak bulunmuştu; HIT VALVE'in kendi denklem
 * türetmesiyle (Y=1-xchoked/(3×xchoked)=1-1/3=2/3) ve elle doğrulamayla
 * ÇÖZÜLEN bir KDP tutarsızlığı — bkz. dosya başı araştırma notları).
 */
export function computeGasExpansionFactorY(
  pressureDropRatioX: number,
  chokedPressureDropRatioXChoked: number,
): number {
  if (chokedPressureDropRatioXChoked <= 0) {
    throw new Error("xchoked pozitif olmalıdır.");
  }
  const xSizing = Math.min(pressureDropRatioX, chokedPressureDropRatioXChoked);
  return 1 - xSizing / (3 * chokedPressureDropRatioXChoked);
}

/**
 * Sonik hız c=√(γRT/M) — vena contracta'da boğulmuş akışta gaz bu hıza
 * ulaşır (standart termodinamik ideal-gaz bağıntısı, R=evrensel gaz sabiti
 * bkz. prEos.universalGasConstant, zaten sourced).
 */
export function computeSonicVelocityMs(
  specificHeatRatioGamma: number,
  temperatureK: number,
  molarMassKgPerMol: number,
): number {
  if (temperatureK <= 0 || molarMassKgPerMol <= 0) {
    throw new Error("Sıcaklık ve molar kütle pozitif olmalıdır.");
  }
  const universalGasConstant = getCoefficient<number>("prEos.universalGasConstant").value;
  return Math.sqrt((specificHeatRatioGamma * universalGasConstant * temperatureK) / molarMassKgPerMol);
}

export type GasErosionNoiseRiskLevel = "GÜVENLİ" | "YAKLAŞIYOR" | "KRİTİK";

export interface GasValveErosionInput {
  upstreamPressurePa: number;
  downstreamPressurePa: number;
  specificHeatRatioGamma: number;
  /** xT — vana tipine özgü, data/valveCatalog.ts'teki xtRange'den veya üretici verisinden */
  pressureDifferentialRatioFactorXt: number;
  temperatureK: number;
  molarMassKgPerMol: number;
  /** Vana çıkışındaki GERÇEK gaz hızı — sağlanırsa Mach sayısı hesaplanır (ör. Q/A'dan çağıran taraf hesaplar) */
  actualOutletVelocityMs?: number;
}

export interface GasValveErosionResult {
  pressureDropRatioX: number;
  chokedPressureDropRatioXChoked: number;
  isChoked: boolean;
  specificHeatRatioFactorFGamma: number;
  expansionFactorY: number;
  sonicVelocityMs: number;
  machNumber: number | null;
  noiseRiskLevel: GasErosionNoiseRiskLevel;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
  screeningOnlyNoteTr: string;
}

const GAS_EROSION_SCREENING_NOTE_TR =
  "Bu bir TARAMA sonucudur, VDMA 24422/IEC 60534-8-3'ün TAM aerodinamik gürültü (dB) hesabı DEĞİLDİR — o " +
  "hesap vana-özel düzeltme katsayıları (ΔLG, ΔLP, ΔLP2) gerektirir ve jenerik/vana-tipinden-bağımsız bir " +
  "sayı YOKTUR. Mach sayısı ≥1'de akış SONİK'tir (boğulmuş); genleşme bölgesinde (trim çıkışı/vena " +
  "contracta sonrası) şok hücreleri (shock cells) oluşur ve trim/boru cidarında yerel erozyonu hızlandırır. " +
  "Sürekli kısma servisinde Mach≥0.33 için gürültü azaltma trim'i değerlendirilmelidir. Ses basıncı seviyesi " +
  "110 dBA'yı ASLA aşmamalıdır (mekanik hasar riski).";

/**
 * Gaz/buhar servisi vana erozyon/gürültü riskini değerlendirir: x, xchoked,
 * Y (genleşme faktörü), boğulma durumu, sonik hız, (sağlanırsa) Mach sayısı
 * ve ayrık gürültü/erozyon risk seviyesi.
 *
 * Model adı: IEC 60534-2-1 gaz/buhar boyutlandırma denklemleri (Fγ, xT,
 * boğulma, Y) + ideal-gaz sonik hız bağıntısı.
 * Girdi/çıktı birimleri: SI (Pa, K, kg/mol) → çıktı m/s, boyutsuz.
 * Geçerlilik/bilinen sınırlamalar: bkz. dosya başı yorumu ve
 * GAS_EROSION_SCREENING_NOTE_TR.
 */
export function assessGasValveErosionRisk(input: GasValveErosionInput): GasValveErosionResult {
  const validityWarnings: ValidityWarning[] = [];

  const fGamma = computeSpecificHeatRatioFactor(input.specificHeatRatioGamma);
  const x = computeGasPressureDropRatio(input.upstreamPressurePa, input.downstreamPressurePa);
  const xChoked = computeGasChokedPressureDropRatio(fGamma, input.pressureDifferentialRatioFactorXt);
  const isChoked = x >= xChoked;
  const expansionFactorY = computeGasExpansionFactorY(x, xChoked);
  const sonicVelocityMs = computeSonicVelocityMs(input.specificHeatRatioGamma, input.temperatureK, input.molarMassKgPerMol);

  const sourcesUsed = [
    "valves.gasSizing.referenceSpecificHeatRatio",
    "valves.gasSizing.massFlowEquationReusesLiquidN6",
    "prEos.universalGasConstant",
  ];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("valves.gasSizing.referenceSpecificHeatRatio").confidence,
    getCoefficient("prEos.universalGasConstant").confidence,
  ];

  let machNumber: number | null = null;
  let noiseRiskLevel: GasErosionNoiseRiskLevel = "GÜVENLİ";

  if (input.actualOutletVelocityMs !== undefined) {
    if (input.actualOutletVelocityMs < 0) {
      throw new Error("Gerçek çıkış hızı negatif olamaz.");
    }
    machNumber = input.actualOutletVelocityMs / sonicVelocityMs;
    const machLimit = getCoefficient<number>("valves.gasSizing.machNumberContinuousThrottlingLimit").value;
    sourcesUsed.push("valves.gasSizing.machNumberContinuousThrottlingLimit");
    usedConfidences.push(getCoefficient("valves.gasSizing.machNumberContinuousThrottlingLimit").confidence);

    if (machNumber >= 1.0) {
      noiseRiskLevel = "KRİTİK";
    } else if (machNumber >= machLimit) {
      noiseRiskLevel = "YAKLAŞIYOR";
    } else {
      noiseRiskLevel = "GÜVENLİ";
    }
  } else if (isChoked) {
    // Boğulmuş akışta vena contracta'da hız TANIM GEREĞİ sonik (Mach=1) —
    // gerçek çıkış hızı sağlanmasa bile bu durum bilinir.
    machNumber = 1.0;
    noiseRiskLevel = "KRİTİK";
  } else {
    validityWarnings.push({
      parameter: "Gerçek çıkış hızı",
      value: 0,
      min: 0,
      max: 0,
      unit: "m/s",
      message:
        "actualOutletVelocityMs sağlanmadı ve akış boğulmamış — Mach sayısı hesaplanamadı, yalnızca " +
        "x/xchoked/Y değerlendirildi.",
    });
  }

  if (isChoked) {
    validityWarnings.push({
      parameter: "Akış durumu (gaz)",
      value: x,
      min: 0,
      max: xChoked,
      unit: "-",
      message: `Gaz akışı BOĞULMUŞ (x=${x.toFixed(3)} ≥ xchoked=${xChoked.toFixed(3)}) — vena contracta'da hız sonik, trim/genleşme bölgesinde erozyon riski YÜKSEK.`,
    });
  }

  return {
    pressureDropRatioX: x,
    chokedPressureDropRatioXChoked: xChoked,
    isChoked,
    specificHeatRatioFactorFGamma: fGamma,
    expansionFactorY,
    sonicVelocityMs,
    machNumber,
    noiseRiskLevel,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    screeningOnlyNoteTr: GAS_EROSION_SCREENING_NOTE_TR,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// C) KISMİ AÇIKLIK ETKİSİ — şiddet çarpanı eğrisi enterpolasyonu +
// gate/ball vana kısma-uygunluğu uyarısı
// ═══════════════════════════════════════════════════════════════════════

export interface PartialOpeningMultiplierPoint {
  openingPercent: number;
  multiplier: number;
}

/**
 * Bir açıklık-şiddet-çarpanı kontrol noktası eğrisinde DOĞRUSAL
 * enterpolasyon yapar (uç noktaların dışında sabit/clamp). Bu, data/
 * valveCatalog.ts'teki HER vana tipi/bölgesinin partialOpeningMultiplierCurve
 * alanı İÇİN JENERİK bir yardımcıdır — kendi eğrisi yoksa
 * valves.partialOpeningSeverity.genericMultiplierCurve (bkz. registry)
 * yedek olarak kullanılabilir.
 */
export function interpolatePartialOpeningMultiplier(
  openingPercent: number,
  curve: PartialOpeningMultiplierPoint[],
): number {
  if (openingPercent < 0 || openingPercent > 100) {
    throw new Error("Açıklık yüzdesi 0-100 aralığında olmalıdır.");
  }
  if (curve.length < 2) {
    throw new Error("Enterpolasyon için en az 2 kontrol noktası gerekir.");
  }
  const sorted = [...curve].sort((a, b) => a.openingPercent - b.openingPercent);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (openingPercent <= first.openingPercent) {
    return first.multiplier;
  }
  if (openingPercent >= last.openingPercent) {
    return last.multiplier;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (openingPercent >= a.openingPercent && openingPercent <= b.openingPercent) {
      const t = (openingPercent - a.openingPercent) / (b.openingPercent - a.openingPercent);
      return a.multiplier + t * (b.multiplier - a.multiplier);
    }
  }
  /* istanbul ignore next -- sıralı ve sınırları kontrol edilmiş dizide erişilemez */
  throw new Error("Enterpolasyon başarısız — beklenmeyen eğri verisi.");
}

/** valves.partialOpeningSeverity.genericMultiplierCurve — bkz. registry notları (UNVERIFIED, kalibre edilebilir varsayılan). */
export function getGenericPartialOpeningSeverityCurve(): PartialOpeningMultiplierPoint[] {
  return getCoefficient<PartialOpeningMultiplierPoint[]>("valves.partialOpeningSeverity.genericMultiplierCurve").value;
}

// data/valveCatalog.ts'in kendi applicabilityTr metninde AÇIKÇA "kısma için
// tasarlanmamıştır" dediği tipler — burada YENİ bir KDP iddiası ÜRETİLMEZ,
// zaten valveCatalog.ts'te belgelenmiş gerçek buraya taşınır.
const NOT_SUITABLE_FOR_THROTTLING: ComponentType[] = ["GATE_VALVE", "BALL_VALVE_FULL"];

export interface PartialOpeningSuitabilityResult {
  isSuitable: boolean;
  validityWarnings: ValidityWarning[];
}

/**
 * Sürgülü (gate) ve tam geçişli küresel (ball, full-port) vanalar kısma
 * servisi için TASARLANMAMIŞTIR (bkz. data/valveCatalog.ts'teki
 * GATE_VALVE/BALL_VALVE_FULL applicabilityTr alanları) — bu fonksiyon,
 * %100'ün altında bir açıklık girildiğinde açık bir uyarı üretir.
 */
export function assessPartialOpeningSuitability(
  componentType: ComponentType,
  openingPercent: number,
): PartialOpeningSuitabilityResult {
  const validityWarnings: ValidityWarning[] = [];
  const isSuitable = !(NOT_SUITABLE_FOR_THROTTLING.includes(componentType) && openingPercent < 100);
  if (!isSuitable) {
    validityWarnings.push({
      parameter: "Vana tipi / açıklık uygunluğu",
      value: openingPercent,
      min: 100,
      max: 100,
      unit: "%",
      message:
        `"${componentType}" kısma (throttling) servisi için TASARLANMAMIŞTIR — %${openingPercent} açıklıkta ` +
        "çalıştırılması ciddi 'wire drawing'/erozyon riski taşır (bkz. data/valveCatalog.ts). Kısma servisi " +
        "için tasarlanmış bir tip (ör. BALL_VALVE_REDUCED, GLOBE_VALVE, kontrol vanası) kullanılmalıdır.",
    });
  }
  return { isSuitable, validityWarnings };
}

// ═══════════════════════════════════════════════════════════════════════
// D) BÖLGE BAZLI HASAR DAĞILIMI — 3B ısı haritası modülünün DOĞRUDAN girdisi
// ═══════════════════════════════════════════════════════════════════════

export type ValveZoneDamageMap = Record<string, UncertaintyBand>;

/**
 * data/valveCatalog.ts'teki bir vana tipinin TÜM erozyon bölgelerine, bir
 * TABAN aşınma hızını (baseRateMmPerYear — mekanizmadan BAĞIMSIZ: sızan
 * kum için dnvO501, kavitasyon için assessLiquidCavitationRisk'in
 * indicativeDamageRateMmPerYear'ı, vb. — çağıran taraf hangi mekanizmanın
 * geçerli olduğuna karar verir) her bölgenin defaultSeverityWeight'i ve
 * mevcut açıklıktaki partialOpeningMultiplierCurve'ünden enterpole edilen
 * çarpanla dağıtır.
 *
 * ⚠ zoneId→UncertaintyBand haritasındaki her bant, TABAN hızın (kendi
 * belirsizliğiyle) bölge ağırlığı×açıklık çarpanıyla ÖLÇEKLENMİŞ halidir —
 * bölgeler ARASI toplam bir "vana geneli" hasar hızı DEĞİLDİR, her bölge
 * BAĞIMSIZ bir konum tahminidir (3B ısı haritası bunları AYRI AYRI, aynı
 * bileşen üzerinde farklı konumlara render eder).
 */
export function computeValveZoneDamage(
  componentType: ComponentType,
  openingPercent: number,
  baseRateMmPerYear: UncertaintyBand,
): ValveZoneDamageMap {
  const profile = getValveErosionProfile(componentType);
  const result: ValveZoneDamageMap = {};
  for (const zone of profile.zones) {
    const multiplier = interpolatePartialOpeningMultiplier(openingPercent, zone.partialOpeningMultiplierCurve);
    const factor = zone.defaultSeverityWeight * multiplier;
    result[zone.id] = {
      p10: baseRateMmPerYear.p10 * factor,
      p50: baseRateMmPerYear.p50 * factor,
      p90: baseRateMmPerYear.p90 * factor,
    };
  }
  return result;
}
