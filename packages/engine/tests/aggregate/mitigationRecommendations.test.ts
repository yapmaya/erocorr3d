// packages/engine/tests/aggregate/mitigationRecommendations.test.ts

import { describe, expect, it } from "vitest";
import { recommendMitigations } from "../../src/aggregate/mitigationRecommendations";
import { assessComponentScenario } from "../../src/orchestrate/assessScenario";
import { referenceLine1 } from "../../src/fixtures/referenceFacility";
import { DamageField } from "../../src/spatial/fields";
import type { CaseAssessment, QualitativeRiskFinding, ScenarioAssessment } from "../../src/orchestrate/types";
import type { MechanismResult } from "../../src/types/results";
import type { Mitigation } from "../../src/types/mitigation";

const EMPTY_FIELD = new DamageField(4, 4, "CYLINDRICAL_UV").toSpatialDamageField();

function buildFinding(mechanismId: string, riskLevel: QualitativeRiskFinding["riskLevel"]): QualitativeRiskFinding {
  return {
    mechanismId,
    nameTr: mechanismId,
    isMechanismActive: true,
    riskScore: 80,
    riskLevel,
    rationaleTr: "test",
    sourceRefs: [],
    confidence: "MEDIUM",
  };
}

function buildScenario(qualitativeRiskFindings: QualitativeRiskFinding[], mechanismResults: MechanismResult[] = []): ScenarioAssessment {
  const caseAssessment: CaseAssessment = {
    caseName: "Test Senaryosu",
    mechanismResults,
    qualitativeRiskFindings,
    spatialDamageFieldFullLife: EMPTY_FIELD,
    assumptionsTr: [],
  };
  return {
    componentLabel: "Test",
    perCase: [caseAssessment],
    metalLoss: {
      scenarioAnnualLosses: [],
      totalAnnualLossMmPerYear: { p10: 0, p50: 0, p90: 0 },
      designLifeYears: 30,
      totalServiceLifeCorrosionMm: { p10: 0, p50: 0, p90: 0 },
      governingScenarioNameTr: "Test Senaryosu",
      confidence: "MEDIUM",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: "",
    },
    governingCaseName: "Test Senaryosu",
  };
}

const NO_MITIGATION: Mitigation = {
  inhibitorUsed: false,
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  cathodicProtection: false,
};

describe("recommendMitigations — referans tesis (gerçek CO2_SWEET, inhibitorUsed=true)", () => {
  it("CO2 aktifken, inhibitör zaten uygulanıyorsa 'zaten ele alındı' olarak işaretler", () => {
    const scenario = assessComponentScenario(referenceLine1.geometry, referenceLine1.mitigation, referenceLine1.operatingProfile);
    expect(referenceLine1.mitigation.inhibitorUsed).toBe(true);
    const result = recommendMitigations(scenario, referenceLine1.mitigation);
    const co2Rec = result.recommendations.find((r) => r.triggerTr.includes("CO2"));
    expect(co2Rec?.alreadyAddressed).toBe(true);
  });

  it("tutarsız governingCaseName ile hata fırlatır", () => {
    const scenario = assessComponentScenario(referenceLine1.geometry, referenceLine1.mitigation, referenceLine1.operatingProfile);
    const broken = { ...scenario, governingCaseName: "Var Olmayan Senaryo" };
    expect(() => recommendMitigations(broken, referenceLine1.mitigation)).toThrowError();
  });
});

describe("recommendMitigations — niteliksel bulgular (el ile kurulmuş senaryo)", () => {
  it("MIC YÜKSEK + biyosit kullanılmıyorsa biyosit + pigging önerir", () => {
    const scenario = buildScenario([buildFinding("MIC", "YÜKSEK")]);
    const result = recommendMitigations(scenario, NO_MITIGATION);
    const micRec = result.recommendations.find((r) => r.triggerTr.includes("MIC"));
    expect(micRec).toBeDefined();
    expect(micRec?.alreadyAddressed).toBe(false);
    expect(micRec?.recommendationsTr.some((t) => t.includes("Biyosit"))).toBe(true);
  });

  it("MIC ORTA ise (eşik altı) öneri üretilmez", () => {
    const scenario = buildScenario([buildFinding("MIC", "ORTA")]);
    const result = recommendMitigations(scenario, NO_MITIGATION);
    expect(result.recommendations.find((r) => r.triggerTr.includes("MIC"))).toBeUndefined();
  });

  it("UNDER_DEPOSIT ÇOK_YÜKSEK ise drenaj/ölü bacak önerisi üretir", () => {
    const scenario = buildScenario([buildFinding("UNDER_DEPOSIT", "ÇOK_YÜKSEK")]);
    const result = recommendMitigations(scenario, NO_MITIGATION);
    const rec = result.recommendations.find((r) => r.triggerTr.includes("ölü bacak") || r.triggerTr.includes("Birikinti"));
    expect(rec?.recommendationsTr.some((t) => t.includes("Drenaj") || t.includes("dead-leg"))).toBe(true);
  });

  it("OXYGEN YÜKSEK + o2ScavengerUsed=true ise 'zaten ele alındı' olarak işaretler", () => {
    const scenario = buildScenario([buildFinding("OXYGEN", "YÜKSEK")]);
    const result = recommendMitigations(scenario, { ...NO_MITIGATION, o2ScavengerUsed: true });
    const rec = result.recommendations.find((r) => r.triggerTr.includes("oksijen"));
    expect(rec?.alreadyAddressed).toBe(true);
  });

  it("CUI YÜKSEK ise izolasyon açma programı önerir", () => {
    const scenario = buildScenario([buildFinding("CUI", "YÜKSEK")]);
    const result = recommendMitigations(scenario, NO_MITIGATION);
    const rec = result.recommendations.find((r) => r.triggerTr.includes("CUI"));
    expect(rec?.recommendationsTr.some((t) => t.includes("izolasyon"))).toBe(true);
  });

  it("isMechanismActive=false ise hiçbir öneri üretilmez", () => {
    const scenario = buildScenario([{ ...buildFinding("MIC", "ÇOK_YÜKSEK"), isMechanismActive: false }]);
    const result = recommendMitigations(scenario, NO_MITIGATION);
    expect(result.recommendations.find((r) => r.triggerTr.includes("MIC"))).toBeUndefined();
  });
});
