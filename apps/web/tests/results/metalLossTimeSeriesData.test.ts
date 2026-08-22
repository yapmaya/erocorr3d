// apps/web/tests/results/metalLossTimeSeriesData.test.ts

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import { buildMetalLossTimeSeriesData } from "../../src/features/results/charts/metalLossTimeSeriesData";
import { getTemplate } from "../../src/features/input/templates";

function buildAssessment(templateId: string) {
  const values = getTemplate(templateId)!.apply();
  const assessment = assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
  return { operatingProfile: values.operatingProfile, assessment };
}

describe("buildMetalLossTimeSeriesData", () => {
  it("son nokta tasarım ömrüne eşittir ve P50 değeri totalServiceLifeCorrosionMm.p50 ile eşleşir", () => {
    const { operatingProfile, assessment } = buildAssessment("wet-gas-gathering");
    const data = buildMetalLossTimeSeriesData(operatingProfile, assessment);
    const last = data.points[data.points.length - 1];
    expect(last.year).toBeCloseTo(operatingProfile.designLifeYears, 9);
    expect(last.p50).toBeCloseTo(assessment.metalLoss.totalServiceLifeCorrosionMm.p50, 6);
  });

  it("P10 ≤ P50 ≤ P90 her noktada korunur", () => {
    const { operatingProfile, assessment } = buildAssessment("sandy-wellhead");
    const data = buildMetalLossTimeSeriesData(operatingProfile, assessment);
    for (const point of data.points) {
      expect(point.p10).toBeLessThanOrEqual(point.p50 + 1e-9);
      expect(point.p50).toBeLessThanOrEqual(point.p90 + 1e-9);
    }
  });

  it("tükenme yılı = korozyon payı / yıllık P50 hızı", () => {
    const { operatingProfile, assessment } = buildAssessment("wet-gas-gathering");
    const data = buildMetalLossTimeSeriesData(operatingProfile, assessment);
    if (data.depletionYearP50 !== null) {
      expect(data.depletionYearP50).toBeCloseTo(
        operatingProfile.corrosionAllowanceMm / assessment.metalLoss.totalAnnualLossMmPerYear.p50,
        9,
      );
    }
  });

  it("hız 0 ise (kuru gaz) tükenme yılı null'dur — asla sonsuz bir sayı UYDURULMAZ", () => {
    const { operatingProfile, assessment } = buildAssessment("dry-sales-gas");
    const data = buildMetalLossTimeSeriesData(operatingProfile, assessment);
    expect(assessment.metalLoss.totalAnnualLossMmPerYear.p50).toBe(0);
    expect(data.depletionYearP50).toBeNull();
  });

  it("ilk nokta t=0 iken kümülatif kayıp 0'dır", () => {
    const { operatingProfile, assessment } = buildAssessment("wet-gas-gathering");
    const data = buildMetalLossTimeSeriesData(operatingProfile, assessment);
    expect(data.points[0].year).toBe(0);
    expect(data.points[0].p50).toBe(0);
  });
});
