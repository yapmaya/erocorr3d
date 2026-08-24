// packages/engine/src/aggregate/criticalMonitoringPoints.ts
//
// Kritik İzleme Noktası (CMP) önerisi — bir ScenarioAssessment'in
// BELİRLEYİCİ (governing) senaryosunun GERÇEK SpatialDamageField'ından
// (bkz. orchestrate/assessScenario.ts — artık sentetik demo veri DEĞİL,
// spatial/index.ts::computeDamageField'ın ürettiği gerçek alan) en yüksek
// hasarlı N noktayı seçer ve her biri için konum tarifi + önerilen izleme
// tekniği + erişilebilirlik uyarısı üretir.
//
// BASİTLEŞTİRME (KDP uydurma-yok ilkesi gereği burada AÇIKÇA belirtiliyor):
// SpatialDamageField, o senaryodaki TÜM uygulanabilir mekanizmaların
// TOPLAMIDIR (bkz. spatial/fields.ts: damage(u,v)=Σ_mekanizma[...]) — motor
// bir hotspot'un HANGİ TEK mekanizmadan geldiğini ayrıştırmaz. Bu yüzden
// önerilen izleme tekniği, o senaryonun EN YÜKSEK P50 hızına sahip TEK
// (dominant) uygulanabilir mekanizmasına göre belirlenir ve TÜM noktalara
// uygulanır — gerçek bir nokta-bazlı mekanizma ayrıştırması İCAT EDİLMEZ.

import type { Geometry } from "../types/geometry";
import type { Hotspot } from "../types/results";
import type { CaseAssessment, ScenarioAssessment } from "../orchestrate/types";
import { ENGINEERING_DISCLAIMER_TR } from "../corrosion/types";

export interface CriticalMonitoringPoint {
  rank: number;
  hotspot: Hotspot;
  /** Bileşenin başlangıcından eksenel mesafe (mm) — hotspot.u × geometry.lengthMm */
  axialDistanceMm: number;
  locationDescriptionTr: string;
  recommendedTechniquesTr: string[];
  accessibilityWarningTr: string | null;
}

export interface CriticalMonitoringPointsResult {
  governingCaseName: string;
  dominantMechanismNameTr: string | null;
  dominantMechanismNameEn: string | null;
  points: CriticalMonitoringPoint[];
  assumptionsTr: string[];
  disclaimer: string;
}

const TECHNIQUE_BY_MECHANISM_ID: Record<string, string[]> = {
  CO2_SWEET: ["UT kalınlık ölçümü", "Korozyon kuponu (hız trendi için)"],
  TOP_OF_LINE: ["UT kalınlık ölçümü (üst-hat, saat 10-2 bölgesi)", "Periyodik ıslak pigging", "ER (elektrikli direnç) prob"],
  EROSION_SAND: ["ER (elektrikli direnç) prob", "UT kalınlık ölçümü", "Akustik kum monitörü (kum üretimi varsa)"],
  EROSION_DROPLET: ["UT kalınlık ölçümü", "ER prob (çarpma bölgesi)"],
  EROSION_CORROSION_SYNERGY: ["ER prob", "UT kalınlık ölçümü (kombine erozyon-korozyon, en agresif bölge)"],
  ATMOSPHERIC_MARINE: ["Görsel muayene", "UT taraması (dış yüzey, kaplama durumu)"],
};

const DEFAULT_TECHNIQUES_TR = ["UT kalınlık ölçümü", "Görsel muayene"];

function buildAccessibilityWarningTr(geometry: Geometry): string | null {
  const warnings: string[] = [];
  if (geometry.installation === "BURIED") {
    warnings.push(
      "Gömülü hatta izleme zordur — doğrudan UT/görsel muayene kazı gerektirir; sabit ER prob/korozyon kuponu " +
        "veya akıllı pig ile iç muayene tercih edilmelidir.",
    );
  } else if (geometry.installation === "SUBSEA") {
    warnings.push("Deniz altı — ROV veya dalış operasyonu gerektirir, erişim maliyetli ve hava koşullarına bağımlıdır.");
  }
  if (geometry.isInsulated) {
    warnings.push(
      "İzolasyonlu — CUI riski nedeniyle izolasyon açılmadan UT/görsel muayene YAPILAMAZ; periyodik izolasyon " +
        "açma programı (veya sabit nokta izleme) gerekir.",
    );
  }
  return warnings.length > 0 ? warnings.join(" ") : null;
}

function findDominantMechanism(caseAssessment: CaseAssessment) {
  const applicable = caseAssessment.mechanismResults.filter((r) => r.isApplicable && r.rateP50 > 0);
  if (applicable.length === 0) return null;
  return applicable.reduce((max, r) => (r.rateP50 > max.rateP50 ? r : max));
}

/**
 * En kritik `topN` izleme noktasını seçer (master görev madde 1).
 *
 * Girdi: `assessment.governingCaseName`'e karşılık gelen `CaseAssessment`
 * BULUNAMAZSA (tutarsız bir `ScenarioAssessment` anlamına gelir, normalde
 * olmamalı) hata fırlatılır — sessizce ilk senaryoya DÜŞÜLMEZ.
 */
export function selectCriticalMonitoringPoints(
  assessment: ScenarioAssessment,
  geometry: Geometry,
  topN = 5,
): CriticalMonitoringPointsResult {
  if (topN <= 0) {
    throw new Error("topN pozitif olmalıdır.");
  }
  const governingCase = assessment.perCase.find((c) => c.caseName === assessment.governingCaseName);
  if (!governingCase) {
    throw new Error(
      `Belirleyici senaryo ("${assessment.governingCaseName}") perCase içinde bulunamadı — tutarsız bir ScenarioAssessment.`,
    );
  }

  const assumptionsTr: string[] = [];
  const dominantMechanism = findDominantMechanism(governingCase);
  if (!dominantMechanism) {
    assumptionsTr.push(
      "Belirleyici senaryoda uygulanabilir (isApplicable=true, hız>0) hiçbir sayısal mekanizma bulunamadı — " +
        "izleme tekniği önerisi genel varsayılanlara (UT + görsel muayene) düşürüldü.",
    );
  } else {
    assumptionsTr.push(
      `İzleme tekniği önerisi, belirleyici senaryonun en yüksek P50 hızına sahip TEK mekanizmasına ` +
        `("${dominantMechanism.nameTr}") göre belirlendi ve TÜM noktalara uygulandı — hasar alanı tüm ` +
        "uygulanabilir mekanizmaların TOPLAMI olduğundan, motor nokta-bazlı bir mekanizma ayrıştırması yapmaz.",
    );
  }

  const techniques = dominantMechanism
    ? (TECHNIQUE_BY_MECHANISM_ID[dominantMechanism.mechanismId] ?? DEFAULT_TECHNIQUES_TR)
    : DEFAULT_TECHNIQUES_TR;
  const accessibilityWarningTr = buildAccessibilityWarningTr(geometry);

  const sortedHotspots = [...governingCase.spatialDamageFieldFullLife.hotspots].sort((a, b) => b.valueMm - a.valueMm);
  const points: CriticalMonitoringPoint[] = sortedHotspots.slice(0, topN).map((hotspot, index) => {
    const axialDistanceMm = hotspot.u * geometry.lengthMm;
    return {
      rank: index + 1,
      hotspot,
      axialDistanceMm,
      locationDescriptionTr: `Eksenel ${axialDistanceMm.toFixed(0)} mm — ${hotspot.descriptionTr}`,
      recommendedTechniquesTr: techniques,
      accessibilityWarningTr,
    };
  });

  if (sortedHotspots.length < topN) {
    assumptionsTr.push(
      `Belirleyici senaryonun hasar alanında yalnızca ${sortedHotspots.length} belirgin hotspot bulundu ` +
        `(istenen ${topN} yerine) — sahte nokta İCAT EDİLMEDİ.`,
    );
  }

  return {
    governingCaseName: assessment.governingCaseName,
    dominantMechanismNameTr: dominantMechanism?.nameTr ?? null,
    dominantMechanismNameEn: dominantMechanism?.nameEn ?? null,
    points,
    assumptionsTr,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
