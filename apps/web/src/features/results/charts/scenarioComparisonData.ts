// apps/web/src/features/results/charts/scenarioComparisonData.ts
//
// Senaryo Karşılaştırma (C) verisi — bileşenin TÜM senaryolarının (tam yıl
// bazlı P10/P50/P90 toplam hızı + kısmi-çalışma düzeltmesi uygulanmış
// gerçek yıllık katkısı) yan yana karşılaştırması. `governingCaseName`
// (motorun KENDİ, P50 bazlı "belirleyici senaryo" seçimi — bkz.
// orchestrate/assessScenario.ts) DOĞRUDAN kullanılır, burada YENİDEN
// hesaplanmaz.

import type { ScenarioAssessment } from "@erocorr3d/engine";

export interface ScenarioComparisonRow {
  caseName: string;
  rateP10: number;
  rateP50: number;
  rateP90: number;
  annualLossP50: number;
  isGoverning: boolean;
}

export function buildScenarioComparisonData(assessment: ScenarioAssessment): ScenarioComparisonRow[] {
  return assessment.perCase.map((caseAssessment, index) => {
    const applicable = caseAssessment.mechanismResults.filter((m) => m.isApplicable);
    const rateP10 = applicable.reduce((sum, m) => sum + m.rateP10, 0);
    const rateP50 = applicable.reduce((sum, m) => sum + m.rateP50, 0);
    const rateP90 = applicable.reduce((sum, m) => sum + m.rateP90, 0);
    const annualLossP50 = assessment.metalLoss.scenarioAnnualLosses[index]?.annualLossMmPerYear.p50 ?? 0;
    return {
      caseName: caseAssessment.caseName,
      rateP10,
      rateP50,
      rateP90,
      annualLossP50,
      isGoverning: caseAssessment.caseName === assessment.governingCaseName,
    };
  });
}
