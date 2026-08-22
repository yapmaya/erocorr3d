// packages/engine/src/mechanicalIntegrity/b31g.ts
//
// ASME B31G (orijinal) ve Modified B31G (0,85dL yöntemi) kalan dayanım
// (güvenli basınç) hesabı + ASME B31.8 §841.1.1 et kalınlığı tasarım
// formülü (t=PD/2SFET). Sabitler/kaynaklar: registry/coefficients/b31g.ts.
//
// SÖZLEŞME: Bu proje SI birimleri (Pa, m) zorunlu tutar. B31G'nin kendi
// ampirik sabitleri (Modified Kriter'in "SMYS+10.000 psi" akış gerilmesi
// terimi HARİÇ) SI'de de birim-bağımsız kalır — Folias faktörü ve P'/P
// oranları BOYUTSUZ ORANLARDIR (D,t,L aynı uzunluk biriminde, P ve S aynı
// basınç biriminde tutuldukça sonuç değişmez); yalnızca Modified Kriter'in
// additif 10.000 psi terimi Pa'ya dönüştürülerek registry'de saklanır (bkz.
// b31g.modifiedFlowStressAdderPa).
//
// KAPSAM SINIRLAMASI: bkz. registry/coefficients/b31g.ts dosya başı notu
// (RSTRENG Effective Area yöntemi ve B31G'nin ters-problem denklemleri bu
// modülde YOKTUR).

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { LocationClassDesignFactorRow, TemperatureDeratingFactorRow } from "../registry/coefficients/b31g";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { SpatialDamageField } from "../types/results";

export type LocationClass = 1 | 2 | 3 | 4;

// ─────────────────────────────────────────────────────────────────────────
// Ortak yardımcılar
// ─────────────────────────────────────────────────────────────────────────

function getLocationClassDesignFactor(locationClass: LocationClass): number {
  const table = getCoefficient<LocationClassDesignFactorRow[]>("b31g.locationClassDesignFactor").value;
  const row = table.find((r) => r.locationClass === locationClass);
  if (!row) {
    throw new Error(`Geçersiz konum sınıfı: ${locationClass} (1-4 olmalıdır).`);
  }
  return row.designFactor;
}

export interface TemperatureDeratingLookup {
  factor: number;
  validityWarnings: ValidityWarning[];
}

/**
 * ASME B31.8 sıcaklık türetme faktörü T'yi verilen sıcaklık için bulur.
 *
 * Kaynak: b31g.temperatureDeratingFactorTable (ASME B31.8 Tablo 841.1.8-1).
 * Geçerlilik aralığı: tablo yalnızca 121,1-232,2°C (250-450°F) arasında
 * ayrık noktalar verir; bu ARALAR ARASI için bu projenin kendi tercihi olan
 * DOĞRUSAL enterpolasyon uygulanır (standardın kendisi enterpolasyon
 * yöntemini belirtmez — mühendislik pratiğinde yaygın kabul). 232,2°C
 * ÜZERİNDE tablo veri vermez; bu durumda en düşük bilinen faktör (0,867)
 * kullanılır VE validityWarnings'e eklenir (asla sessizce ekstrapolasyon
 * yapılmaz).
 */
export function lookupTemperatureDeratingFactor(temperatureC: number): TemperatureDeratingLookup {
  const table = getCoefficient<TemperatureDeratingFactorRow[]>("b31g.temperatureDeratingFactorTable").value;
  const sorted = [...table].sort((a, b) => a.temperatureC - b.temperatureC);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  if (temperatureC <= lowest.temperatureC) {
    return { factor: 1.0, validityWarnings: [] };
  }
  if (temperatureC > highest.temperatureC) {
    return {
      factor: highest.factor,
      validityWarnings: [
        {
          parameter: "temperatureC",
          value: temperatureC,
          min: lowest.temperatureC,
          max: highest.temperatureC,
          unit: "°C",
          message: `Sıcaklık (${temperatureC.toFixed(1)}°C), ASME B31.8 sıcaklık türetme tablosunun üst sınırının (${highest.temperatureC.toFixed(1)}°C) üzerinde — en düşük bilinen faktör (${highest.factor}) muhafazakâr olarak kullanıldı, gerçek T bu değerden DAHA DÜŞÜK olabilir.`,
        },
      ],
    };
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (temperatureC >= lo.temperatureC && temperatureC <= hi.temperatureC) {
      const fraction = (temperatureC - lo.temperatureC) / (hi.temperatureC - lo.temperatureC);
      return { factor: lo.factor + fraction * (hi.factor - lo.factor), validityWarnings: [] };
    }
  }
  // Buraya asla ulaşılmamalı (sorted+sınır kontrolleri her aralığı kapsar).
  return { factor: highest.factor, validityWarnings: [] };
}

/**
 * "Kod tabanlı" (code-basis) basınç: P = 2×S×t×F×E×T/D — ASME B31.4/B31.8/
 * B31.11 tasarım formülünün basınç için çözülmüş hâli. B31G'nin kendi
 * güvenli-basınç formüllerinde (ORNL raporu Eq.5/6/15) "P" bu değerdir
 * (veya varsa tesis edilmiş MAOP'un büyüğü — bkz. computeGoverningPressurePa).
 *
 * NOT: ORNL raporunun kendi P=2StFT/D formülü AYRI bir E terimi göstermez
 * (bkz. registry/coefficients/b31g.ts::longitudinalJointFactorSeamlessErw
 * notu) — bu fonksiyon E'yi opsiyonel tutar, verilmezse registry'nin
 * dikişsiz/ERW değeri (1,0) kullanılır (matematiksel olarak sonucu
 * değiştirmez, yalnızca kaynaklı/E≠1 boru için doğru davranış sağlar).
 */
export function computeCodeBasisPressurePa(
  odM: number,
  wallThicknessM: number,
  smysPa: number,
  locationClass: LocationClass,
  temperatureC: number,
  longitudinalJointFactorE?: number,
): number {
  if (odM <= 0 || wallThicknessM <= 0 || smysPa <= 0) {
    throw new Error("odM, wallThicknessM ve smysPa pozitif olmalıdır.");
  }
  const F = getLocationClassDesignFactor(locationClass);
  const E =
    longitudinalJointFactorE ?? getCoefficient<number>("b31g.longitudinalJointFactorSeamlessErw").value;
  const { factor: T } = lookupTemperatureDeratingFactor(temperatureC);
  return (2 * smysPa * wallThicknessM * F * E * T) / odM;
}

/** İşletilen (tesis edilmiş) MAOP biliniyorsa, kod-tabanlı basınçla karşılaştırıp büyüğünü döndürür — ORNL raporunun "P = tesis edilmiş MAOP veya 2StFT/D, hangisi büyükse" tanımıyla TUTARLI. */
export function computeGoverningPressurePa(codeBasisPressurePa: number, establishedMaopPa?: number): number {
  return Math.max(codeBasisPressurePa, establishedMaopPa ?? 0);
}

export interface DesignWallThicknessResult {
  designWallThicknessM: number;
  requiredWithAllowanceM: number;
  locationClassDesignFactor: number;
  jointFactorE: number;
  temperatureDeratingFactorT: number;
  validityWarnings: ValidityWarning[];
  confidence: ConfidenceLevel;
  sourcesUsed: string[];
  disclaimer: string;
}

/**
 * ASME B31.8 §841.1.1 basınç tasarımı et kalınlığı: t = P×D/(2×S×F×E×T).
 *
 * Model adı: ASME B31.8 et kalınlığı tasarım formülü.
 * Kaynak: registry/coefficients/b31g.ts (SRC_B318_JOINT_TEMP_SECONDARY,
 * MEDIUM güven — yalnızca ikincil özet kaynaklarla doğrulandı).
 * Girdi: designPressurePa (Pa), odM (m), smysPa (Pa), locationClass (1-4),
 * temperatureC (°C), corrosionAllowanceM (m, opsiyonel — varsayılan 0).
 * Çıktı: designWallThicknessM (t, korozyon payı HARİÇ), requiredWithAllowanceM
 * (t+CA, gerçekte belirtilmesi gereken minimum nominal kalınlık).
 * Geçerlilik aralığı: E ve T tabloları MEDIUM güvendedir (bkz. registry notu).
 * Bilinen sınırlama: bu formül DÜZ BORU gövdesi içindir; dirsek/te/redüksiyon
 * gibi fitting'ler için ayrı yoğunlaştırma faktörleri (bu projenin kapsamı
 * dışında) gerekebilir.
 */
export function computeAsmeB318DesignWallThickness(
  designPressurePa: number,
  odM: number,
  smysPa: number,
  locationClass: LocationClass,
  temperatureC: number,
  corrosionAllowanceM = 0,
  longitudinalJointFactorE?: number,
): DesignWallThicknessResult {
  if (designPressurePa <= 0 || odM <= 0 || smysPa <= 0) {
    throw new Error("designPressurePa, odM ve smysPa pozitif olmalıdır.");
  }
  if (corrosionAllowanceM < 0) {
    throw new Error("corrosionAllowanceM negatif olamaz.");
  }
  const F = getLocationClassDesignFactor(locationClass);
  const E =
    longitudinalJointFactorE ?? getCoefficient<number>("b31g.longitudinalJointFactorSeamlessErw").value;
  const temperature = lookupTemperatureDeratingFactor(temperatureC);
  const T = temperature.factor;

  const designWallThicknessM = (designPressurePa * odM) / (2 * smysPa * F * E * T);

  const jointFactorCoefficient = getCoefficient<number>("b31g.longitudinalJointFactorSeamlessErw");
  const temperatureCoefficient = getCoefficient<TemperatureDeratingFactorRow[]>("b31g.temperatureDeratingFactorTable");
  const locationFactorCoefficient = getCoefficient<LocationClassDesignFactorRow[]>("b31g.locationClassDesignFactor");

  return {
    designWallThicknessM,
    requiredWithAllowanceM: designWallThicknessM + corrosionAllowanceM,
    locationClassDesignFactor: F,
    jointFactorE: E,
    temperatureDeratingFactorT: T,
    validityWarnings: temperature.validityWarnings,
    confidence: worstConfidence([
      jointFactorCoefficient.confidence,
      temperatureCoefficient.confidence,
      locationFactorCoefficient.confidence,
    ]),
    sourcesUsed: [
      "b31g.longitudinalJointFactorSeamlessErw",
      "b31g.temperatureDeratingFactorTable",
      "b31g.locationClassDesignFactor",
    ],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Folias ("bulging") faktörleri
// ─────────────────────────────────────────────────────────────────────────

/** Orijinal B31G iki-terimli Folias faktörü: M=√(1+0,8L²/(Dt)) (ORNL raporu Eq.8). */
export function computeOriginalFoliasFactor(defectLengthM: number, odM: number, wallThicknessM: number): number {
  if (defectLengthM < 0 || odM <= 0 || wallThicknessM <= 0) {
    throw new Error("defectLengthM negatif olamaz; odM ve wallThicknessM pozitif olmalıdır.");
  }
  return Math.sqrt(1 + (0.8 * defectLengthM ** 2) / (odM * wallThicknessM));
}

/**
 * Modified B31G Folias faktörü M_T — L²/(Dt) eşiğine (registry:
 * b31g.modifiedFoliasLengthRatioThreshold=50) göre üç-terimli (Eq.10) veya
 * iki-terimli (Eq.11) forma dallanır.
 */
export function computeModifiedFoliasFactor(defectLengthM: number, odM: number, wallThicknessM: number): number {
  if (defectLengthM < 0 || odM <= 0 || wallThicknessM <= 0) {
    throw new Error("defectLengthM negatif olamaz; odM ve wallThicknessM pozitif olmalıdır.");
  }
  const threshold = getCoefficient<number>("b31g.modifiedFoliasLengthRatioThreshold").value;
  const lengthRatio = defectLengthM ** 2 / (odM * wallThicknessM);
  if (lengthRatio <= threshold) {
    const term = 1 + 0.6275 * lengthRatio - 0.003375 * lengthRatio ** 2;
    return Math.sqrt(Math.max(term, 0));
  }
  return 0.032 * lengthRatio + 3.3;
}

// ─────────────────────────────────────────────────────────────────────────
// Güvenli basınç (kalan dayanım)
// ─────────────────────────────────────────────────────────────────────────

export interface B31gDefectInput {
  odM: number;
  wallThicknessM: number;
  defectDepthM: number;
  defectLengthM: number;
  smysPa: number;
  locationClass: LocationClass;
  temperatureC: number;
  /** Tesis edilmiş MAOP (Pa) — biliniyorsa kod-tabanlı basınçla karşılaştırılıp büyüğü esas alınır (bkz. computeGoverningPressurePa). */
  establishedMaopPa?: number;
  longitudinalJointFactorE?: number;
}

export interface B31gSafePressureResult {
  safePressurePa: number;
  governingPressurePa: number;
  depthOverThickness: number;
  foliasFactor: number;
  branch: string;
  validityWarnings: ValidityWarning[];
  confidence: ConfidenceLevel;
  sourcesUsed: string[];
  disclaimer: string;
}

function checkDepthValidity(depthOverThickness: number): ValidityWarning[] {
  const maxFraction = getCoefficient<number>("b31g.maxCorrosionDepthFraction").value;
  if (depthOverThickness > maxFraction) {
    return [
      {
        parameter: "d/t",
        value: depthOverThickness,
        min: 0,
        max: maxFraction,
        unit: "-",
        message: `Kusur derinliği (d/t=${(depthOverThickness * 100).toFixed(1)}%), B31G/Modified B31G'nin geçerlilik üst sınırının (%${(maxFraction * 100).toFixed(0)}) ÜZERİNDE — standart bu derinlikte artık geçerli DEĞİLDİR, bölgenin onarılması/değiştirilmesi gerekir. Sonuç yine de hesaplandı ama GÜVENİLMEZ kabul edilmelidir.`,
      },
    ];
  }
  return [];
}

/**
 * Orijinal B31G Kriteri — güvenli maksimum basınç P' (ORNL raporu Eq.5/Eq.6).
 *
 * Model adı: ASME B31G-1991 (Reaffirmed 2004), "Manual for Determining the
 * Remaining Strength of Corroded Pipelines".
 * Kaynak: registry/coefficients/b31g.ts (ORNL/TM-2019/1192).
 * Girdi: SI (Pa, m). Çıktı: safePressurePa (Pa).
 * Geçerlilik aralığı: d/t≤%80 (aşılırsa uyarı); kaba/geniş, sığ profilli
 * korozyon (gouge/oyuk, kaynak dikişi, SCC/HIC DEĞİL — bkz. sınırlamalar).
 * Bilinen sınırlamalar: RSTRENG effective-area yöntemi UYGULANMAZ (bkz.
 * modül başı notu); kaynak dikişi/HAZ, mekanik hasar (gouge), SCC/HIC için
 * GEÇERSİZDİR (ORNL raporu §E.2.2).
 */
export function computeOriginalB31gSafePressurePa(input: B31gDefectInput): B31gSafePressureResult {
  const { odM, wallThicknessM, defectDepthM, defectLengthM, smysPa, locationClass, temperatureC } = input;
  if (defectDepthM < 0 || defectLengthM < 0) {
    throw new Error("defectDepthM ve defectLengthM negatif olamaz.");
  }
  const depthOverThickness = defectDepthM / wallThicknessM;
  const codeBasisPressurePa = computeCodeBasisPressurePa(
    odM,
    wallThicknessM,
    smysPa,
    locationClass,
    temperatureC,
    input.longitudinalJointFactorE,
  );
  const governingPressurePa = computeGoverningPressurePa(codeBasisPressurePa, input.establishedMaopPa);
  const flowStressMultiplier = getCoefficient<number>("b31g.originalFlowStressMultiplier").value;
  const lengthRatioThreshold = getCoefficient<number>("b31g.originalFoliasLengthRatioThreshold").value;
  const lengthRatio = defectLengthM ** 2 / (odM * wallThicknessM);

  let safePressurePa: number;
  let branch: string;
  let foliasFactor: number;

  if (lengthRatio <= lengthRatioThreshold) {
    foliasFactor = computeOriginalFoliasFactor(defectLengthM, odM, wallThicknessM);
    const numerator = 1 - (2 / 3) * depthOverThickness;
    const denominator = 1 - (2 / 3) * (depthOverThickness / foliasFactor);
    safePressurePa = flowStressMultiplier * governingPressurePa * (numerator / denominator);
    branch = "Eq.5 (L²/Dt ≤ 20)";
  } else {
    foliasFactor = Number.POSITIVE_INFINITY; // Eq.6'da Folias faktörü kullanılmaz (uzun kusur formu).
    safePressurePa = Math.min(
      flowStressMultiplier * governingPressurePa * (1 - depthOverThickness),
      governingPressurePa,
    );
    branch = "Eq.6 (L²/Dt > 20, P' ≤ P ile sınırlı)";
  }

  const flowStressCoefficient = getCoefficient<number>("b31g.originalFlowStressMultiplier");
  const thresholdCoefficient = getCoefficient<number>("b31g.originalFoliasLengthRatioThreshold");

  return {
    safePressurePa: Math.max(safePressurePa, 0),
    governingPressurePa,
    depthOverThickness,
    foliasFactor,
    branch,
    validityWarnings: checkDepthValidity(depthOverThickness),
    confidence: worstConfidence([flowStressCoefficient.confidence, thresholdCoefficient.confidence]),
    sourcesUsed: ["b31g.originalFlowStressMultiplier", "b31g.originalFoliasLengthRatioThreshold", "b31g.maxCorrosionDepthFraction"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

/**
 * Modified B31G Kriteri — 0,85dL yöntemi, güvenli maksimum basınç P'
 * (ORNL raporu Eq.15).
 *
 * Model adı: PRCI PR 3-805 "A Modified Criterion for Evaluating the
 * Remaining Strength of Corroded Pipe" (R-STRENG, 1989) — 0,85dL yöntemi
 * (tam RSTRENG "Effective Area" yöntemi DEĞİL, bkz. modül başı notu).
 * Kaynak: registry/coefficients/b31g.ts (ORNL/TM-2019/1192).
 * Girdi: SI (Pa, m). Çıktı: safePressurePa (Pa).
 * Geçerlilik aralığı: d/t≤%80 (aşılırsa uyarı).
 * Bilinen sınırlamalar: orijinal B31G ile aynı (kaynak dikişi/HAZ/gouge/
 * SCC için geçersiz). Literatür, bu yöntemin orijinal B31G'ye göre DAHA AZ
 * muhafazakâr (yani daha yüksek, daha "gerçekçi" P') olduğunu gösterir —
 * bkz. ORNL raporu Tablo E.1 (Class 1'de Modified daha az muhafazakâr,
 * Class 3-4'te daha muhafazakâr).
 */
export function computeModifiedB31gSafePressurePa(input: B31gDefectInput): B31gSafePressureResult {
  const { odM, wallThicknessM, defectDepthM, defectLengthM, smysPa, locationClass, temperatureC } = input;
  if (defectDepthM < 0 || defectLengthM < 0) {
    throw new Error("defectDepthM ve defectLengthM negatif olamaz.");
  }
  const depthOverThickness = defectDepthM / wallThicknessM;
  const codeBasisPressurePa = computeCodeBasisPressurePa(
    odM,
    wallThicknessM,
    smysPa,
    locationClass,
    temperatureC,
    input.longitudinalJointFactorE,
  );
  const governingPressurePa = computeGoverningPressurePa(codeBasisPressurePa, input.establishedMaopPa);
  const F = getLocationClassDesignFactor(locationClass);
  const flowStressAdderPa = getCoefficient<number>("b31g.modifiedFlowStressAdderPa").value;
  const factorOfSafety = getCoefficient<number>("b31g.factorOfSafety").value;
  const foliasFactor = computeModifiedFoliasFactor(defectLengthM, odM, wallThicknessM);
  const effectiveDepthOverThickness = 0.85 * depthOverThickness;

  // Eq.15: P'DFs/2t = [PD/(2tF)+adder] × (1-0,85d/t)/(1-(0,85d/t)/M_T)
  const bracket = (governingPressurePa * odM) / (2 * wallThicknessM * F) + flowStressAdderPa;
  const numerator = 1 - effectiveDepthOverThickness;
  const denominator = 1 - effectiveDepthOverThickness / foliasFactor;
  const rightHandSide = bracket * (numerator / denominator);
  const safePressurePa = (2 * wallThicknessM * rightHandSide) / (odM * factorOfSafety);

  const flowStressCoefficient = getCoefficient<number>("b31g.modifiedFlowStressAdderPa");
  const foliasThresholdCoefficient = getCoefficient<number>("b31g.modifiedFoliasLengthRatioThreshold");
  const factorOfSafetyCoefficient = getCoefficient<number>("b31g.factorOfSafety");

  return {
    safePressurePa: Math.max(safePressurePa, 0),
    governingPressurePa,
    depthOverThickness,
    foliasFactor,
    branch:
      defectLengthM ** 2 / (odM * wallThicknessM) <=
      getCoefficient<number>("b31g.modifiedFoliasLengthRatioThreshold").value
        ? "Eq.10 (L²/Dt ≤ 50, üç terimli)"
        : "Eq.11 (L²/Dt > 50, iki terimli)",
    validityWarnings: checkDepthValidity(depthOverThickness),
    confidence: worstConfidence([
      flowStressCoefficient.confidence,
      foliasThresholdCoefficient.confidence,
      factorOfSafetyCoefficient.confidence,
    ]),
    sourcesUsed: ["b31g.modifiedFlowStressAdderPa", "b31g.modifiedFoliasLengthRatioThreshold", "b31g.factorOfSafety", "b31g.maxCorrosionDepthFraction"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Uzamsal hasar alanından eksenel kusur boyutu (d,L) çıkarımı
// ─────────────────────────────────────────────────────────────────────────

export interface AxialDefectExtent {
  /** Kusurun eksenel uzunluğu (m) — B31G'nin "L" girdisi. */
  lengthM: number;
  /** Kusur bölgesindeki en derin nokta (mm) — B31G'nin "d" girdisi. */
  maxDepthMm: number;
  centerU: number;
  v: number;
  clockPosition: number;
}

/**
 * Bir SpatialDamageField üzerinde, EN DERİN noktayı (field.maxLocation)
 * içeren, o saat pozisyonu boyunca (sabit v satırı) SÜREKLİ (kesintisiz)
 * d/t ≥ qualificationDepthFraction (varsayılan %10, B31G'nin kendi kusur
 * tanımı) olan eksenel aralığı bulur.
 *
 * MÜHENDİSLİK BASİTLEŞTİRMESİ (KDP kapsamı dışı, bu projenin kendi
 * yöntemsel tercihi — B31G standardının kendisi "L nasıl ölçülür" sorusunu
 * SAHA ÖLÇÜMÜNE bırakır, bir algoritma vermez): gerçek B31G değerlendirmesi
 * saha ultrasonik/ILI taramasından ELLE ölçülen d,L kullanır. Bu fonksiyon,
 * simüle edilmiş/hesaplanmış bir SpatialDamageField'dan TUTARLI bir (d,L)
 * çifti türetmek için bu projenin kendi kuralını uygular. u EKSENİ
 * PERİYODİK DEĞİLDİR (bkz. spatial/fields.ts), bu yüzden aralık sınırda
 * kesilebilir.
 *
 * @returns Tepe değeri kalifikasyon eşiğinin ALTINDAYSA (yani %10'dan sığ
 * bir korozyon varsa, B31G'nin kendi tanımına göre "değerlendirilecek bir
 * kusur" YOKTUR) null döner.
 */
export function findAxialDefectExtentM(
  field: SpatialDamageField,
  componentLengthM: number,
  wallThicknessMm: number,
  qualificationDepthFraction?: number,
): AxialDefectExtent | null {
  if (componentLengthM <= 0 || wallThicknessMm <= 0) {
    throw new Error("componentLengthM ve wallThicknessMm pozitif olmalıdır.");
  }
  const fraction =
    qualificationDepthFraction ?? getCoefficient<number>("b31g.defectQualificationDepthFraction").value;
  const thresholdMm = fraction * wallThicknessMm;
  if (field.maxValueMm < thresholdMm) {
    return null;
  }

  const { resolutionU, resolutionV, valuesMm } = field;
  const peakIu = Math.min(Math.max(Math.floor(field.maxLocation.u * resolutionU), 0), resolutionU - 1);
  const peakIv = Math.min(Math.max(Math.floor(field.maxLocation.v * resolutionV), 0), resolutionV - 1);

  const getMm = (iu: number): number => valuesMm[peakIv * resolutionU + iu];

  let iuMin = peakIu;
  while (iuMin > 0 && getMm(iuMin - 1) >= thresholdMm) iuMin--;
  let iuMax = peakIu;
  while (iuMax < resolutionU - 1 && getMm(iuMax + 1) >= thresholdMm) iuMax++;

  const cellCountInExtent = iuMax - iuMin + 1;
  const lengthM = (cellCountInExtent / resolutionU) * componentLengthM;

  return {
    lengthM,
    maxDepthMm: field.maxValueMm,
    centerU: field.maxLocation.u,
    v: field.maxLocation.v,
    clockPosition: field.maxLocation.clockPosition,
  };
}
