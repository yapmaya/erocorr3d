// packages/engine/src/corrosion/h2s.ts
//
// H2S (ekşi/sour) servis değerlendirmesi: ISO 15156-2:2003(E) (=NACE
// MR0175 Bölüm 2) SSC çevresel şiddet bölgesi (Region 0-3), karbon/düşük
// alaşımlı çelik sertlik uygunluğu, ve CO2/H2S oranına göre baskın korozyon
// rejimi (FeS film davranışı).
//
// ⚠⚠⚠ BU MODÜL KESİN BİR mm/YIL HIZI VERMEZ ⚠⚠⚠
// SSC/HIC/SOHIC birer ÇATLAMA mekanizmasıdır (düz bir metal kaybı hızıyla
// anlamlı şekilde ifade EDİLEMEZ — bkz. data/mechanisms.ts CSCC_INTERNAL
// ile aynı gerekçe) ve H2S'in genel/lokalize metal kaybı bileşeni için de
// API RP 571 §5.1.1.10 (bkz. data/mechanisms.ts H2S_SOUR girdisi, bu " +
// projede zaten HIGH confidence ile okunmuş) HİÇBİR sayısal "tipik mm/yıl"
// vermiyor. Bu yüzden assessH2sSourRisk() bir RiskScoreResult (0-100 risk
// skoru + bölge/sertlik/rejim bayrakları) döndürür, conditionalRateRangeMmPerYear
// HER ZAMAN null'dur.
//
// Kaynak: NACE MR0175/ISO 15156-2:2003(E) (Region 0-3, sertlik sınırı — bkz.
// registry/coefficients/h2s.ts), Pots ve ark. CO2/H2S oranı sınıflandırması
// (ikincil kaynaklarla çapraz doğrulandı, MEDIUM).

import { getCoefficient, worstConfidence } from "../registry";
import type { SscRegionBoundaryCurves } from "../registry/coefficients/h2s";
import type { ConfidenceLevel } from "../registry/types";
import {
  ENGINEERING_DISCLAIMER_TR,
  classifyRiskScore,
  clampRiskScore,
  type RiskFactorContribution,
  type RiskScoreResult,
  type ValidityWarning,
} from "./types";

export type SscRegion = "REGION_0" | "SSC_REGION_1" | "SSC_REGION_2" | "SSC_REGION_3";

export type Co2H2sRegime = "SWEET_DOMINANT" | "MIXED_TRANSITION" | "SOUR_DOMINANT";

/**
 * H2S kısmi basıncını (Dalton yasası — tanımsal, KDP kaynağı gerektirmez)
 * hesaplar.
 *
 * @param totalPressureKpa Toplam (mutlak) basınç (kPa)
 * @param h2sMoleFraction H2S mol kesri (0-1)
 */
export function computeH2sPartialPressureKpa(totalPressureKpa: number, h2sMoleFraction: number): number {
  if (totalPressureKpa <= 0) {
    throw new Error("Toplam basınç pozitif olmalıdır.");
  }
  if (h2sMoleFraction < 0 || h2sMoleFraction > 1) {
    throw new Error("H2S mol kesri 0-1 aralığında olmalıdır.");
  }
  return totalPressureKpa * h2sMoleFraction;
}

function interpolateBoundaryPh(
  pH2sKpa: number,
  boundary: { startKpa: number; startPh: number; endKpa: number; endPh: number },
): number {
  if (pH2sKpa <= boundary.startKpa) {
    return boundary.startPh;
  }
  if (pH2sKpa >= boundary.endKpa) {
    return boundary.endPh;
  }
  const logStart = Math.log10(boundary.startKpa);
  const logEnd = Math.log10(boundary.endKpa);
  const logX = Math.log10(pH2sKpa);
  const t = (logX - logStart) / (logEnd - logStart);
  return boundary.startPh + t * (boundary.endPh - boundary.startPh);
}

/**
 * ISO 15156-2 Şekil 1'e göre SSC çevresel şiddet bölgesini (Region 0-3)
 * belirler.
 *
 * Model adı: ISO 15156-2:2003(E) §7.2.1.2, Şekil 1 (dijitize edilmiş —
 * bkz. registry/coefficients/h2s.ts::h2s.sscRegionBoundaryCurves notları).
 * Girdi/çıktı birimleri: pH2sKpa (kPa), inSituPh (boyutsuz).
 * Geçerlilik aralığı: standardın kendisi 0,3 kPa altı ve 1 MPa üstünde
 * "belirsizlik" olduğunu belirtir (§Şekil 1 NOT 1) — bu aralıklarda sonuç
 * yine de hesaplanır ama validityWarnings'e uyarı eklenir.
 */
export function determineSscRegion(pH2sKpa: number, inSituPh: number): SscRegion {
  if (pH2sKpa < 0) {
    throw new Error("H2S kısmi basıncı negatif olamaz.");
  }
  const threshold0 = getCoefficient<number>("h2s.region0ThresholdKpa").value;
  if (pH2sKpa < threshold0) {
    return "REGION_0";
  }
  const curves = getCoefficient<SscRegionBoundaryCurves>("h2s.sscRegionBoundaryCurves").value;

  // NOT: pH2sKpa >= threshold0 (Region 0 sınırı) burada zaten aşıldı — ISO
  // 15156-2 §7.2.1.3'ün kendi metni Region 0'ı YALNIZCA pH2S<0,3kPa olarak
  // tanımlar (pH'DAN BAĞIMSIZ). Şekil 1'deki SOL diyagonal (boundary01),
  // "0" etiketli alanın x<0,3kPa dikey sınırıyla görsel/estetik SÜREKLİLİĞİ
  // için çizilmiştir — metinde pH2S≥0,3kPa için AYRI bir "Region 0'a geri
  // dönüş" tanımlanmaz, bu yüzden burada boundary01 bir SINIFLANDIRMA
  // sınırı olarak KULLANILMAZ (yalnızca registry'de belgeleme amaçlı
  // tutulur) — bu aralıkta yalnızca 1/2/3 arasında sınıflandırma yapılır.

  if (pH2sKpa >= curves.region3ThresholdKpa) {
    const boundary12PhAtCap = curves.boundary12.endPh; // 5.5 — 1/2 sınırının yatay tavanı
    if (inSituPh > boundary12PhAtCap) {
      return "SSC_REGION_1";
    }
    return "SSC_REGION_3";
  }

  if (pH2sKpa < curves.boundary12.startKpa) {
    return "SSC_REGION_1";
  }
  const ph12 = interpolateBoundaryPh(pH2sKpa, curves.boundary12);
  if (inSituPh >= ph12) {
    return "SSC_REGION_1";
  }
  return "SSC_REGION_2";
}

/**
 * Karbon/düşük alaşımlı çelik sertliğinin, belirlenen SSC bölgesi için
 * ISO 15156-2 Tablo 3 sertlik sınırını (22 HRC/250 HV/237 HBW) karşılayıp
 * karşılamadığını değerlendirir. Region 0'da sınır normalde uygulanmaz.
 */
export function assessHardnessCompliance(
  actualHardnessHrc: number,
  region: SscRegion,
): { isCompliant: boolean; limitHrc: number } {
  const limit = getCoefficient<{ hrc: number }>("h2s.hardnessLimit.csLowAlloySteel").value;
  if (region === "REGION_0") {
    return { isCompliant: true, limitHrc: limit.hrc };
  }
  return { isCompliant: actualHardnessHrc <= limit.hrc, limitHrc: limit.hrc };
}

/**
 * PCO2/PH2S oranına göre baskın korozyon rejimini (FeS film davranışı)
 * sınıflandırır (Pots ve ark. sınıflandırması — bkz. registry notları).
 */
export function classifyCo2H2sRegime(pCo2Kpa: number, pH2sKpa: number): Co2H2sRegime {
  if (pCo2Kpa < 0 || pH2sKpa < 0) {
    throw new Error("Kısmi basınçlar negatif olamaz.");
  }
  if (pH2sKpa === 0) {
    return "SWEET_DOMINANT";
  }
  const ratio = pCo2Kpa / pH2sKpa;
  const { sweetDominantAboveRatio, sourDominantBelowRatio } = getCoefficient<{
    sweetDominantAboveRatio: number;
    sourDominantBelowRatio: number;
  }>("h2s.co2H2sRatioThresholds").value;
  if (ratio > sweetDominantAboveRatio) {
    return "SWEET_DOMINANT";
  }
  if (ratio < sourDominantBelowRatio) {
    return "SOUR_DOMINANT";
  }
  return "MIXED_TRANSITION";
}

export interface H2sSourRiskInput {
  /** Toplam (mutlak) sistem basıncı (kPa) */
  totalPressureKpa: number;
  h2sMoleFraction: number;
  co2MoleFraction: number;
  inSituPh: number;
  /** Malzemenin gerçek sertliği (HRC) — sağlanmazsa sertlik uygunluğu değerlendirilmez */
  materialHardnessHrc?: number;
  /** Serbest sulu faz var mı — yoksa SSC/H2S korozyonu mekanizması geçerli değildir (bkz. rules.ts hasFreeWater) */
  freeWaterPresent: boolean;
}

const RISK_SCORE_ORTA_ESIK = 25;

/**
 * H2S sour servis risk skorunu (0-100) ve bölge/rejim/sertlik bayraklarını
 * değerlendirir.
 *
 * Model adı: ISO 15156-2 SSC bölgesi + Pots CO2/H2S rejimi + bu projenin
 * kendi risk-skoru ağırlıklandırması (bkz. dosya başı yorumu — ağırlıklar
 * KDP kapsamı DIŞINDADIR, corrosion/rules.ts ile aynı "proje kuralı" statüsü).
 * Girdi/çıktı birimleri: SI (kPa) → çıktı boyutsuz risk skoru (0-100).
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur
 * (bkz. dosya başı yorumu).
 */
export function assessH2sSourRisk(input: H2sSourRiskInput): RiskScoreResult {
  if (input.totalPressureKpa <= 0) {
    throw new Error("Toplam basınç pozitif olmalıdır.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const sourcesUsed = ["h2s.region0ThresholdKpa", "h2s.sscRegionBoundaryCurves"];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("h2s.region0ThresholdKpa").confidence,
    getCoefficient("h2s.sscRegionBoundaryCurves").confidence,
  ];

  if (!input.freeWaterPresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Serbest sulu faz yok — H2S sour korozyon mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const pH2sKpa = computeH2sPartialPressureKpa(input.totalPressureKpa, input.h2sMoleFraction);
  const pCo2Kpa = computeH2sPartialPressureKpa(input.totalPressureKpa, input.co2MoleFraction);
  const region = determineSscRegion(pH2sKpa, input.inSituPh);
  const co2H2sRegime = classifyCo2H2sRegime(pCo2Kpa, pH2sKpa);
  sourcesUsed.push("h2s.co2H2sRatioThresholds");
  usedConfidences.push(getCoefficient("h2s.co2H2sRatioThresholds").confidence);

  if (pH2sKpa < 0.3 || pH2sKpa > 1000) {
    validityWarnings.push({
      parameter: "H2S kısmi basıncı",
      value: pH2sKpa,
      min: 0.3,
      max: 1000,
      unit: "kPa",
      message:
        "ISO 15156-2 Şekil 1'in kendi NOT 1'i, 0,3 kPa altı VE 1 MPa (1000 kPa) üstünde H2S kısmi basıncı " +
        "ölçümü/çelik davranışı için BELİRSİZLİK olduğunu belirtiyor — sonuç yine de hesaplandı ama bu " +
        "aralıkta ekstra dikkatle değerlendirilmelidir.",
      });
  }

  const isMechanismActive = region !== "REGION_0";
  const factorContributions: RiskFactorContribution[] = [];

  const regionPoints: Record<SscRegion, number> = {
    REGION_0: 5,
    SSC_REGION_1: 35,
    SSC_REGION_2: 60,
    SSC_REGION_3: 85,
  };
  factorContributions.push({
    factorTr: `SSC bölgesi (${region})`,
    points: regionPoints[region],
    rationaleTr: "ISO 15156-2 Şekil 1'e göre pH2S/pH konumu — bkz. determineSscRegion().",
  });

  if (co2H2sRegime === "SOUR_DOMINANT") {
    factorContributions.push({
      factorTr: "CO2/H2S rejimi (H2S-baskın)",
      points: 10,
      rationaleTr:
        "PCO2/PH2S<20 — FeS/makinawit filmi baskın; bu film KORUYUCU olabilir ama yeterli H2S yoksa veya " +
        "akış filmi bozarsa lokalize çukurlaşma riski taşır (ek puan bu belirsizliği yansıtır).",
    });
  } else if (co2H2sRegime === "MIXED_TRANSITION") {
    factorContributions.push({
      factorTr: "CO2/H2S rejimi (geçiş)",
      points: 15,
      rationaleTr: "PCO2/PH2S 20-500 arası — karışık FeCO3/FeS film davranışı, en belirsiz/öngörülemez rejim.",
    });
  }

  if (input.materialHardnessHrc !== undefined) {
    const compliance = assessHardnessCompliance(input.materialHardnessHrc, region);
    sourcesUsed.push("h2s.hardnessLimit.csLowAlloySteel");
    usedConfidences.push(getCoefficient("h2s.hardnessLimit.csLowAlloySteel").confidence);
    if (!compliance.isCompliant) {
      factorContributions.push({
        factorTr: "Sertlik uygunluğu",
        points: 25,
        rationaleTr: `Malzeme sertliği (${input.materialHardnessHrc} HRC), ${region} için ISO 15156-2 sınırını (${compliance.limitHrc} HRC) AŞIYOR — SSC riski önemli ölçüde artar.`,
      });
      validityWarnings.push({
        parameter: "Malzeme sertliği",
        value: input.materialHardnessHrc,
        min: 0,
        max: compliance.limitHrc,
        unit: "HRC",
        message: `Malzeme sertliği ISO 15156-2 sınırını (${compliance.limitHrc} HRC) aşıyor — ${region} için UYGUN DEĞİL, malzeme değişikliği veya HIC/SSC test onayı gerekir.`,
      });
    }
  } else if (isMechanismActive) {
    validityWarnings.push({
      parameter: "Malzeme sertliği",
      value: 0,
      min: 0,
      max: 0,
      unit: "HRC",
      message: "materialHardnessHrc sağlanmadı — sertlik uygunluğu değerlendirilemedi.",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));
  const riskLevel = classifyRiskScore(riskScore);

  if (riskScore >= RISK_SCORE_ORTA_ESIK) {
    validityWarnings.push({
      parameter: "SSC/HIC/SOHIC riski",
      value: riskScore,
      min: 0,
      max: 100,
      unit: "-",
      message:
        "SSC/HIC/SOHIC birer ÇATLAMA mekanizmasıdır — bu risk skoru bir mm/yıl metal kaybı hızı DEĞİLDİR, " +
        "malzeme seçimi/HIC testi gerekliliğine dair bir SIRALAMA göstergesidir.",
    });
  }

  return {
    isMechanismActive,
    riskScore,
    riskLevel,
    factorContributions,
    conditionalRateRangeMmPerYear: null,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

export type { RiskScoreResult } from "./types";
