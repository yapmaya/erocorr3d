// packages/engine/tests/types/material-results.test.ts

import { describe, expect, it } from "vitest";
import { MaterialSpecSchema } from "../../src/types/material";
import {
  AssessmentResultSchema,
  MechanismResultSchema,
  SpatialDamageFieldSchema,
  TraceStepSchema,
} from "../../src/types/results";

describe("MaterialSpecSchema", () => {
  const validMaterial = {
    materialId: "cs-a106b",
    family: "Carbon Steel",
    displayNameTr: "Karbon Çelik (A106 Gr.B)",
    displayNameEn: "Carbon Steel (A106 Gr.B)",
    minDesignTempC: -29,
    maxServiceTempC: 400,
    relativeCostIndex: 1.0,
    densityKgM3: 7850,
    notesTr: "Genel amaçlı taşıma hattı malzemesi.",
  };

  it("zorunlu alanlarla geçerli bir malzemeyi kabul eder", () => {
    expect(MaterialSpecSchema.safeParse(validMaterial).success).toBe(true);
  });

  it("opsiyonel pren alanı olmadan da geçerlidir", () => {
    expect(MaterialSpecSchema.safeParse(validMaterial).success).toBe(true);
  });

  it("100'ü aşan PREN değerini reddeder", () => {
    const result = MaterialSpecSchema.safeParse({ ...validMaterial, pren: 150 });
    expect(result.success).toBe(false);
  });
});

describe("TraceStep / MechanismResult", () => {
  const validTraceStep = {
    stepName: "CTL_i hesabı",
    formula: "CTL_i = 0.25 × 30 × Cri",
    inputs: { fraction: 0.25, designLifeYears: 30, Cri_mmPerYear: 0.148 },
    output: 1.11,
    unit: "mm",
    coefficientIds: [] as string[],
  };

  it("geçerli bir TraceStep'i kabul eder", () => {
    expect(TraceStepSchema.safeParse(validTraceStep).success).toBe(true);
  });

  const validMechanismResult = {
    mechanismId: "corrosion.norsok",
    nameTr: "NORSOK CO2 Korozyonu",
    nameEn: "NORSOK CO2 Corrosion",
    rateMmPerYear: 0.148,
    rateP10: 0.06,
    rateP50: 0.148,
    rateP90: 0.37,
    isApplicable: true,
    confidence: "MEDIUM" as const,
    modelUsed: "NORSOK M-506",
    sourceRefs: ["NORSOK Standard M-506 Rev.2"],
    validityWarnings: [] as string[],
    governingParameters: { temperatureC: 15, pH: 5.5 },
    spatialSignatureId: "spatial.001",
    calculationTrace: [validTraceStep],
  };

  it("geçerli bir MechanismResult'ı kabul eder", () => {
    expect(MechanismResultSchema.safeParse(validMechanismResult).success).toBe(true);
  });

  it("negatif hızı reddeder", () => {
    const result = MechanismResultSchema.safeParse({ ...validMechanismResult, rateP50: -1 });
    expect(result.success).toBe(false);
  });

  it("UNVERIFIED bir confidence değerini reddeder (yalnızca HIGH/MEDIUM/LOW)", () => {
    const result = MechanismResultSchema.safeParse({
      ...validMechanismResult,
      confidence: "UNVERIFIED",
    });
    expect(result.success).toBe(false);
  });
});

describe("AssessmentResultSchema", () => {
  it("geçerli bir nihai değerlendirmeyi kabul eder", () => {
    const result = AssessmentResultSchema.safeParse({
      componentId: "line-1030",
      perCaseResults: [],
      governingCase: "Kış Çekiş Modu (Withdrawal)",
      totalMetalLossMm: 1.11,
      totalMetalLossP10: 0.45,
      totalMetalLossP90: 2.8,
      requiredCaMm: 3,
      ctlAtlRatio: 0.37,
      likelihoodCategory: "NEGLIGIBLE" as const,
      remainingLifeYears: 30,
      recommendedMaterial: "cs-a106b",
      alternativeMaterials: ["ss-316l"],
      unverifiedCoefficientsUsed: ["uncertainty.defaultMultiplicativeBandFactor"],
      warnings: [] as string[],
      assumptions: [] as string[],
    });
    expect(result.success).toBe(true);
  });
});

describe("SpatialDamageFieldSchema", () => {
  const resolutionU = 4;
  const resolutionV = 3;

  it("valuesMm uzunluğu resolutionU×resolutionV ile eşleşince kabul eder", () => {
    const result = SpatialDamageFieldSchema.safeParse({
      parameterization: "CYLINDRICAL_UV" as const,
      resolutionU,
      resolutionV,
      valuesMm: new Float32Array(resolutionU * resolutionV),
      maxValueMm: 0.5,
      maxLocation: { u: 0.5, v: 0.5, descriptionTr: "Alt kısım, orta nokta", clockPosition: 6 },
      hotspots: [],
    });
    expect(result.success).toBe(true);
  });

  it("valuesMm uzunluğu eşleşmezse reddeder", () => {
    const result = SpatialDamageFieldSchema.safeParse({
      parameterization: "CYLINDRICAL_UV" as const,
      resolutionU,
      resolutionV,
      valuesMm: new Float32Array(5),
      maxValueMm: 0.5,
      maxLocation: { u: 0.5, v: 0.5, descriptionTr: "Alt kısım, orta nokta", clockPosition: 6 },
      hotspots: [],
    });
    expect(result.success).toBe(false);
  });

  it("saat pozisyonu 12'yi aşarsa reddeder", () => {
    const result = SpatialDamageFieldSchema.safeParse({
      parameterization: "CYLINDRICAL_UV" as const,
      resolutionU,
      resolutionV,
      valuesMm: new Float32Array(resolutionU * resolutionV),
      maxValueMm: 0.5,
      maxLocation: { u: 0.5, v: 0.5, descriptionTr: "Alt kısım", clockPosition: 13 },
      hotspots: [],
    });
    expect(result.success).toBe(false);
  });
});
