// packages/engine/src/corrosion/externalEnvironment.ts
//
// Dış ortam korozivitesi: (A) atmosferik (ISO 9223:2012 kategorisi, kıyı
// mesafesi tahmini) ve (B) gömülü (toprak direnci, katodik koruma/kaçak
// akım/CP perdeleme bayrakları).
//
// Atmosferik senaryoda GERÇEK bir sayısal hız aralığı vardır (ISO 9223
// Tablo 2, karbon çeliği μm/yıl) — bu, bu dosyanın conditionalRateRangeMmPerYear
// döndürebilen TEK external-scope fonksiyonudur. Gömülü senaryoda ise
// (data/mechanisms.ts::SOIL_CORROSION'ın kendi notuyla tutarlı: "toprak
// korozifliği son derece yer-özgüdür") sayısal bir hız BULUNAMADI —
// yalnızca risk skoru + toprak korozivite etiketi döner.

import { getCoefficient, worstConfidence } from "../registry";
import type { Iso9223Category } from "../registry/coefficients/externalEnvironment";
import type { ConfidenceLevel } from "../registry/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import {
  ENGINEERING_DISCLAIMER_TR,
  classifyRiskScore,
  clampRiskScore,
  type RiskFactorContribution,
  type RiskScoreResult,
  type ValidityWarning,
} from "./types";

const RISK_POINTS_BY_CATEGORY: Record<Iso9223Category, number> = {
  C1: 5,
  C2: 15,
  C3: 35,
  C4: 55,
  CX: 90,
  C5: 75,
};

/** Kıyıya mesafeye göre ISO 9223 kategorisini KABA olarak tahmin eder (bkz. registry notları — LOW confidence). */
export function estimateIso9223CategoryFromCoastalDistance(distanceFromCoastKm: number): Iso9223Category {
  if (distanceFromCoastKm < 0) {
    throw new Error("Kıyıya mesafe negatif olamaz.");
  }
  const bands = getCoefficient<{ maxDistanceKm: number; category: Iso9223Category }[]>(
    "externalEnvironment.coastalDistanceHeuristicKm",
  ).value;
  const match = bands.find((b) => distanceFromCoastKm <= b.maxDistanceKm);
  return match ? match.category : "C1";
}

/** Bir ISO 9223 kategorisi için karbon çeliği ilk yıl korozyon hızı aralığını (mm/yıl) döndürür. */
export function getCarbonSteelRateRangeMmPerYear(category: Iso9223Category): [number, number] {
  const rangesUmPerYear = getCoefficient<Record<Iso9223Category, [number, number]>>(
    "externalEnvironment.iso9223.carbonSteelRateRangeUmPerYear",
  ).value[category];
  return [rangesUmPerYear[0] / 1000, rangesUmPerYear[1] / 1000];
}

export interface AtmosphericExternalRiskInput {
  /** Doğrudan biliniyorsa (saha ölçümü/dose-response hesabı) — sağlanırsa distanceFromCoastKm YOK SAYILIR */
  knownIso9223Category?: Iso9223Category;
  distanceFromCoastKm?: number;
  coatingPresent: boolean;
  coatingConditionGood?: boolean;
}

/**
 * Atmosferik dış korozyon riskini ve (kaplamasız durumda) ISO 9223 Tablo
 * 2'den türetilen bir hız aralığını değerlendirir.
 *
 * Model adı: ISO 9223:2012 Tablo 2 (karbon çeliği).
 * Girdi/çıktı birimleri: km → çıktı mm/yıl.
 * Bilinen sınırlamalar: kıyı-mesafesi tahmini KABA'dır (bkz. registry
 * notları, LOW confidence) — mümkünse knownIso9223Category (gerçek
 * ölçüm/dose-response) tercih edilmelidir.
 */
export function assessAtmosphericExternalRisk(input: AtmosphericExternalRiskInput): RiskScoreResult {
  const validityWarnings: ValidityWarning[] = [];
  const sourcesUsed = ["externalEnvironment.iso9223.carbonSteelRateRangeUmPerYear"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("externalEnvironment.iso9223.carbonSteelRateRangeUmPerYear").confidence,
  ];

  let category: Iso9223Category;
  if (input.knownIso9223Category) {
    category = input.knownIso9223Category;
  } else if (input.distanceFromCoastKm !== undefined) {
    category = estimateIso9223CategoryFromCoastalDistance(input.distanceFromCoastKm);
    sourcesUsed.push("externalEnvironment.coastalDistanceHeuristicKm");
    usedConfidences.push(getCoefficient("externalEnvironment.coastalDistanceHeuristicKm").confidence);
    validityWarnings.push({
      parameter: "ISO 9223 kategorisi (kıyı mesafesinden tahmin)",
      value: input.distanceFromCoastKm,
      min: 0,
      max: Infinity,
      unit: "km",
      message:
        "ISO 9223'ün KENDİSİ mesafeye dayalı bir tablo VERMEZ — bu, rüzgar/topografya gibi faktörleri göz " +
        "ardı eden KABA bir tahmindir (confidence=LOW). Mümkünse gerçek saha ölçümü/dose-response hesabı " +
        "(knownIso9223Category) kullanılmalıdır.",
    });
  } else {
    throw new Error("knownIso9223Category veya distanceFromCoastKm sağlanmalıdır.");
  }

  const [rangeMinMmYr, rangeMaxMmYr] = getCarbonSteelRateRangeMmPerYear(category);
  const isCoated = input.coatingPresent && (input.coatingConditionGood ?? false);

  const factorContributions: RiskFactorContribution[] = [
    { factorTr: `ISO 9223 kategorisi (${category})`, points: RISK_POINTS_BY_CATEGORY[category], rationaleTr: "bkz. ISO 9223 Tablo 2 / Ek C." },
  ];

  let conditionalRateRangeMmPerYear: UncertaintyBand | null = {
    p10: rangeMinMmYr,
    p50: (rangeMinMmYr + rangeMaxMmYr) / 2,
    p90: rangeMaxMmYr,
  };

  if (isCoated) {
    const coatingReductionFactor = 0.05;
    factorContributions.push({
      factorTr: "İyi durumda kaplama",
      points: -40,
      rationaleTr: "Sağlam bir kaplama, atmosferik korozyonu neredeyse ortadan kaldırır (bu proje kabulü — KDP kapsamı dışı, ×0,05 azaltma).",
    });
    conditionalRateRangeMmPerYear = {
      p10: conditionalRateRangeMmPerYear.p10 * coatingReductionFactor,
      p50: conditionalRateRangeMmPerYear.p50 * coatingReductionFactor,
      p90: conditionalRateRangeMmPerYear.p90 * coatingReductionFactor,
    };
    validityWarnings.push({
      parameter: "Kaplama azaltma faktörü",
      value: coatingReductionFactor,
      min: 0,
      max: 1,
      unit: "-",
      message: "Kaplama azaltma faktörü (×0,05) bu projenin kendi mühendislik kabulüdür, KDP-sourced bir sayı DEĞİLDİR.",
    });
  } else if (input.coatingPresent && input.coatingConditionGood === undefined) {
    validityWarnings.push({
      parameter: "Kaplama durumu",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message: "coatingConditionGood belirtilmedi — kaplama VAR ama durumu bilinmiyor, kaplamasız (muhafazakâr) hız aralığı kullanıldı.",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  return {
    isMechanismActive: true,
    riskScore,
    riskLevel: classifyRiskScore(riskScore),
    factorContributions,
    conditionalRateRangeMmPerYear,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

export interface BuriedExternalRiskInput {
  soilResistivityOhmCm: number;
  coatingPresent: boolean;
  coatingConditionGood?: boolean;
  cathodicProtectionActive: boolean;
  /** Ayrılmış/disbonde kaplama, ısıl yalıtım, gevşek sargı vb. — bkz. data/mechanisms.ts::CP_SHIELDING (HIGH, NACE SP0169) */
  cpShieldingRiskPresent: boolean;
  /** Yakında DC/AC kaçak akım kaynağı (tren hattı, redresör vb.) var mı — bkz. data/mechanisms.ts::STRAY_CURRENT (HIGH, NACE SP0169) */
  strayCurrentRiskPresent: boolean;
}

/** Toprak direncini korozivite etiketine sınıflandırır (bkz. registry notları). */
export function classifySoilResistivity(soilResistivityOhmCm: number): string {
  if (soilResistivityOhmCm < 0) {
    throw new Error("Toprak direnci negatif olamaz.");
  }
  const bands = getCoefficient<{ maxOhmCm: number; label: string }[]>(
    "externalEnvironment.soilResistivityBandsOhmCm",
  ).value;
  const match = bands.find((b) => soilResistivityOhmCm <= b.maxOhmCm);
  return match ? match.label : "ÖNEMSİZ";
}

/**
 * Gömülü hat dış korozyon riskini değerlendirir.
 *
 * Model adı: toprak direnci sınıflandırması + katodik koruma/kaçak akım/CP
 * perdeleme bayrakları (bkz. dosya başı yorumu).
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur
 * (data/mechanisms.ts::SOIL_CORROSION ile aynı gerekçe — toprak korozifliği
 * son derece yer-özgüdür, sayısal bir kaynak bulunamadı).
 */
export function assessBuriedExternalRisk(input: BuriedExternalRiskInput): RiskScoreResult {
  const validityWarnings: ValidityWarning[] = [];
  const soilLabel = classifySoilResistivity(input.soilResistivityOhmCm);
  const sourcesUsed = ["externalEnvironment.soilResistivityBandsOhmCm"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("externalEnvironment.soilResistivityBandsOhmCm").confidence];

  const soilPoints: Record<string, number> = {
    ÇOK_KOROZİF: 60,
    KOROZİF: 45,
    ORTA_KOROZİF: 30,
    HAFİF_KOROZİF: 15,
    ÖNEMSİZ: 5,
  };
  const factorContributions: RiskFactorContribution[] = [
    { factorTr: `Toprak korozivitesi (${soilLabel}, ${input.soilResistivityOhmCm} ohm-cm)`, points: soilPoints[soilLabel] ?? 30, rationaleTr: "bkz. registry externalEnvironment.soilResistivityBandsOhmCm." },
  ];

  const isProtected = input.coatingPresent && (input.coatingConditionGood ?? false) && input.cathodicProtectionActive;
  if (isProtected) {
    factorContributions.push({
      factorTr: "Kaplama + katodik koruma",
      points: -50,
      rationaleTr: "Sağlam kaplama + aktif CP kombinasyonu, gömülü korozyonu neredeyse durdurur (bu proje kabulü).",
    });
  }

  if (input.cpShieldingRiskPresent) {
    factorContributions.push({
      factorTr: "CP perdeleme (shielding) riski",
      points: 35,
      rationaleTr: "NACE SP0169-2013 §2/§6.3.7 (bkz. data/mechanisms.ts::CP_SHIELDING) — perdelenen bölgeler CP'den BAĞIMSIZ olarak korumasız kalır.",
    });
    validityWarnings.push({
      parameter: "CP perdeleme",
      value: 1,
      min: 0,
      max: 1,
      unit: "-",
      message: "CP aktif olsa bile perdeleme riski taşıyan bölgeler (disbonde kaplama, ısıl yalıtım altı, gevşek sargı) KORUNMASIZ olabilir — CP potansiyel ölçümü bu bölgelerde YANILTICI olabilir.",
    });
  }

  if (input.strayCurrentRiskPresent) {
    factorContributions.push({
      factorTr: "Kaçak akım riski",
      points: 30,
      rationaleTr: "NACE SP0169-2013 §9 (bkz. data/mechanisms.ts::STRAY_CURRENT) — akımın yapıdan ÇIKTIĞI nokta CP'den bağımsız olarak şiddetli lokalize korozyona uğrayabilir.",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  return {
    isMechanismActive: true,
    riskScore,
    riskLevel: classifyRiskScore(riskScore),
    factorContributions,
    conditionalRateRangeMmPerYear: null,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
