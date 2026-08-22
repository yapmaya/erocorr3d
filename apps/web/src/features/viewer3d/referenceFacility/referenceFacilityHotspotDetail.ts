// apps/web/src/features/viewer3d/referenceFacility/referenceFacilityHotspotDetail.ts
//
// Seçili bir hotspot'un GERÇEK detayını üretir — hotspots/hotspotDetail.ts
// ile AYNI çıktı şeklini (DemoHotspotDetail — HotspotPanel.tsx başka bir
// değişiklik gerektirmeden bunu da render edebilsin diye) taşır, ama
// modelUsed/formula/sourceRefs/validityWarnings artık GERÇEK bir
// MechanismResult'tan (mm/yıl hızı, kullanılan model, hesaplama izi, kaynak
// atıfları) gelir — master görev madde 4'ün ("hangi denklemden geldiği,
// uygulanan faktörler, KAYNAK ATIFLARI") ilk gerçek (sentetik olmayan)
// karşılığıdır.

import type { CaseAssessment, Hotspot, MechanismResult } from "@erocorr3d/engine";
import type { DemoHotspotDetail } from "../hotspots/hotspotDetail";

function pickDominantMechanism(applicable: MechanismResult[]): MechanismResult | null {
  if (applicable.length === 0) return null;
  return applicable.reduce((max, r) => (r.rateP50 > max.rateP50 ? r : max), applicable[0]);
}

/**
 * Bu (u,v) noktasında birden fazla mekanizma birlikte katkı sağlıyor olabilir
 * (computeDamageField tüm applicable sonuçları TOPLAR, bkz. spatial/fields.ts)
 * — bu fonksiyon en büyük P50 hızına sahip (BASKIN) mekanizmayı "model/denklem"
 * olarak gösterir, ama TÜM katkı sağlayan mekanizmaların kaynak atıflarını
 * birleştirir ve birden fazla mekanizma varsa bunu AÇIKÇA belirtir (hiçbir
 * katkı sessizce gizlenmez).
 */
export function buildReferenceFacilityHotspotDetail(hotspot: Hotspot, caseAssessment: CaseAssessment, wallThicknessMm: number): DemoHotspotDetail {
  if (wallThicknessMm <= 0) throw new Error("wallThicknessMm pozitif olmalıdır.");

  const applicable = caseAssessment.mechanismResults.filter((r) => r.isApplicable);
  const dominant = pickDominantMechanism(applicable);
  const totalRateMmPerYear = applicable.reduce((sum, r) => sum + r.rateP50, 0);
  const allSourceRefs = [...new Set(applicable.flatMap((r) => r.sourceRefs))];
  const lastTraceStep = dominant?.calculationTrace[dominant.calculationTrace.length - 1];

  return {
    hotspot,
    scenarioLabelTr: caseAssessment.caseName,
    rateMmPerYear: totalRateMmPerYear,
    remainingWallMm: Math.max(wallThicknessMm - hotspot.valueMm, 0),
    modelUsed: dominant ? `${dominant.nameTr} — ${dominant.modelUsed}` : "Bu senaryoda aktif bir mekanizma yok",
    formula: lastTraceStep ? `${lastTraceStep.stepName}: ${lastTraceStep.formula}` : (dominant?.modelUsed ?? "-"),
    sourceRefs: allSourceRefs.length > 0 ? allSourceRefs : ["Bu senaryoda uygulanabilir (isApplicable=true) bir mekanizma yok."],
    validityWarnings: [
      ...(applicable.length > 1 && dominant
        ? [
            `Bu noktada ${applicable.length} mekanizma BİRLİKTE katkı sağlıyor (toplam hız gösterilir); ` +
              `model/denklem alanı en büyük katkıyı yapan mekanizmayı ("${dominant.nameTr}") gösterir.`,
          ]
        : []),
      ...applicable.flatMap((r) => r.validityWarnings),
      ...caseAssessment.assumptionsTr,
    ],
  };
}
