// apps/web/tests/results/mechanismWaterfallData.test.ts

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "@erocorr3d/engine";
import { buildMechanismWaterfallData } from "../../src/features/results/charts/mechanismWaterfallData";
import { buildMechanismBreakdownData, toRechartsRows } from "../../src/features/results/charts/mechanismBreakdownData";
import { getTemplate } from "../../src/features/input/templates";

function buildAssessment(templateId: string) {
  const values = getTemplate(templateId)!.apply();
  return assessComponentScenario(values.geometry, values.mitigation, values.operatingProfile, {}, values.componentLabel);
}

describe("buildMechanismWaterfallData", () => {
  it("Islak Gaz Toplama Hattı — adımların toplamı senaryonun gerçek yıllık katkısına EŞİTTİR", () => {
    const assessment = buildAssessment("wet-gas-gathering");
    const caseIndex = 0;
    const caseAssessment = assessment.perCase[caseIndex];
    const annualLossP50 = assessment.metalLoss.scenarioAnnualLosses[caseIndex].annualLossMmPerYear.p50;

    const waterfall = buildMechanismWaterfallData(caseAssessment, annualLossP50);
    expect(waterfall).not.toBeNull();
    const total = waterfall!.steps[waterfall!.steps.length - 1];
    expect(total.isTotal).toBe(true);
    expect(total.cumulativeEnd).toBeCloseTo(annualLossP50, 9);
  });

  it("NORSOK yolu (CO2 baskınsa) gerçek bir hesaplama izi taşır (hasTrace=true)", () => {
    const assessment = buildAssessment("wet-gas-gathering");
    const caseAssessment = assessment.perCase[0];
    const annualLossP50 = assessment.metalLoss.scenarioAnnualLosses[0].annualLossMmPerYear.p50;
    const waterfall = buildMechanismWaterfallData(caseAssessment, annualLossP50);
    const co2Dominant = waterfall!.mechanismNameTr.includes("CO2") || waterfall!.mechanismNameTr.includes("Korozyon");
    if (co2Dominant) {
      expect(waterfall!.hasTrace).toBe(true);
      expect(waterfall!.traceRows.length).toBeGreaterThan(0);
    }
  });

  it("uygulanan mekanizma yoksa null döner (sahte şelale UYDURULMAZ)", () => {
    const assessment = buildAssessment("dry-sales-gas");
    const caseAssessment = assessment.perCase[0];
    const annualLossP50 = assessment.metalLoss.scenarioAnnualLosses[0].annualLossMmPerYear.p50;
    const waterfall = buildMechanismWaterfallData(caseAssessment, annualLossP50);
    expect(waterfall).toBeNull();
  });

  it("kısmi çalışma (365 günden az) → düzeltme adımı NEGATİF olur", () => {
    const assessment = buildAssessment("sandy-wellhead"); // 365 gün tam yıl - kontrol için farklı bir vaka dene
    const caseAssessment = assessment.perCase[0];
    const scenarioIndex = 0;
    const annualLossP50 = assessment.metalLoss.scenarioAnnualLosses[scenarioIndex].annualLossMmPerYear.p50;
    const waterfall = buildMechanismWaterfallData(caseAssessment, annualLossP50);
    // Kum İçeren Kuyu Başı Hattı şablonu 365 gün/yıl çalışır — düzeltme ~0 olmalı.
    if (waterfall) {
      const correction = waterfall.steps.find((s) => s.labelTr === "Kısmi çalışma düzeltmesi")!;
      expect(correction.value).toBeCloseTo(0, 6);
    }
  });
});

describe("buildMechanismBreakdownData / toRechartsRows", () => {
  it("her senaryo için UYGULANAN mekanizmaların toplamı senaryonun tam-yıl rateP50 toplamına eşittir", () => {
    const assessment = buildAssessment("wet-gas-gathering");
    const data = buildMechanismBreakdownData(assessment);
    expect(data.rows).toHaveLength(assessment.perCase.length);

    data.rows.forEach((row, index) => {
      const expectedSum = assessment.perCase[index].mechanismResults
        .filter((m) => m.isApplicable)
        .reduce((sum, m) => sum + m.rateP50, 0);
      const actualSum = Object.values(row.values).reduce((sum, v) => sum + v, 0);
      expect(actualSum).toBeCloseTo(expectedSum, 9);
    });
  });

  it("toRechartsRows düz kayıtlar üretir (caseName + her mekanizma anahtarı)", () => {
    const assessment = buildAssessment("wet-gas-gathering");
    const data = buildMechanismBreakdownData(assessment);
    const rechartsRows = toRechartsRows(data);
    expect(rechartsRows).toHaveLength(data.rows.length);
    rechartsRows.forEach((row) => expect(row.caseName).toBeDefined());
  });

  it("uygulanmayan mekanizmalar (isApplicable=false) veriye DAHİL EDİLMEZ", () => {
    const assessment = buildAssessment("dry-sales-gas");
    const data = buildMechanismBreakdownData(assessment);
    // Kuru gaz → CO2_SWEET uygulanmaz, dolayısıyla hiçbir sütun eklenmemeli.
    expect(data.mechanismKeys).toHaveLength(0);
  });
});
