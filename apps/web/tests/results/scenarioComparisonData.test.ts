// apps/web/tests/results/scenarioComparisonData.test.ts

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import { buildScenarioComparisonData } from "../../src/features/results/charts/scenarioComparisonData";
import { getTemplate } from "../../src/features/input/templates";

describe("buildScenarioComparisonData", () => {
  it("tam senaryo sayısı kadar satır üretir, tam olarak bir tanesi belirleyici senaryodur", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const assessment = assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
    const rows = buildScenarioComparisonData(assessment);

    expect(rows).toHaveLength(assessment.perCase.length);
    expect(rows.filter((r) => r.isGoverning)).toHaveLength(1);
    expect(rows.find((r) => r.isGoverning)!.caseName).toBe(assessment.governingCaseName);
  });

  it("P10 ≤ P50 ≤ P90 sıralaması her satırda korunur", () => {
    const values = getTemplate("sandy-wellhead")!.apply();
    const assessment = assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
    const rows = buildScenarioComparisonData(assessment);
    for (const row of rows) {
      expect(row.rateP10).toBeLessThanOrEqual(row.rateP50);
      expect(row.rateP50).toBeLessThanOrEqual(row.rateP90);
    }
  });

  it("annualLossP50, metalLoss.scenarioAnnualLosses ile birebir eşleşir", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const assessment = assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
    const rows = buildScenarioComparisonData(assessment);
    rows.forEach((row, i) => {
      expect(row.annualLossP50).toBeCloseTo(assessment.metalLoss.scenarioAnnualLosses[i].annualLossMmPerYear.p50, 9);
    });
  });
});
