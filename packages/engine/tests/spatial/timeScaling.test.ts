// packages/engine/tests/spatial/timeScaling.test.ts

import { describe, expect, it } from "vitest";
import { computeDamageField } from "../../src/spatial/index";
import { scaleSpatialDamageField } from "../../src/spatial/timeScaling";
import type { Geometry } from "../../src/types/geometry";
import type { MechanismResult } from "../../src/types/results";

function baseGeometry(): Geometry {
  return {
    componentType: "STRAIGHT_PIPE",
    npsInch: 6,
    schedule: "40",
    odMm: 168.3,
    wallThicknessMm: 7.11,
    idMm: 154.08,
    lengthMm: 6000,
    orientation: "HORIZONTAL",
    roughnessMm: 0.046,
    installation: "ABOVE_GROUND",
    isInsulated: false,
  };
}

function baseResult(overrides: Partial<MechanismResult> = {}): MechanismResult {
  return {
    mechanismId: "test.mechanism",
    nameTr: "Test",
    nameEn: "Test",
    rateMmPerYear: 1,
    rateP10: 0.4,
    rateP50: 1,
    rateP90: 2.5,
    isApplicable: true,
    confidence: "MEDIUM",
    modelUsed: "Test Model",
    sourceRefs: [],
    validityWarnings: [],
    governingParameters: {},
    spatialSignatureId: "UNIFORM_FULL_BORE",
    calculationTrace: [],
    ...overrides,
  };
}

describe("scaleSpatialDamageField", () => {
  it("elapsedYears/designLifeYears oranıyla ölçeklenen alan, o yılda YENİDEN hesaplanan alanla BİREBİR eşleşir (doğrusallık)", () => {
    const geometry = baseGeometry();
    const results = [baseResult({ rateP50: 3 })];
    const designLifeYears = 20;
    const targetYears = 7;

    const fullLifeField = computeDamageField(geometry, results, designLifeYears, { resolutionU: 40, resolutionV: 30 });
    const scaled = scaleSpatialDamageField(fullLifeField, targetYears / designLifeYears);
    const recomputed = computeDamageField(geometry, results, targetYears, { resolutionU: 40, resolutionV: 30 });

    for (let i = 0; i < scaled.valuesMm.length; i++) {
      expect(scaled.valuesMm[i]).toBeCloseTo(recomputed.valuesMm[i], 5);
    }
    expect(scaled.maxValueMm).toBeCloseTo(recomputed.maxValueMm, 5);
  });

  it("faktör 0 → tüm alan sıfırlanır", () => {
    const geometry = baseGeometry();
    const field = computeDamageField(geometry, [baseResult()], 10);
    const scaled = scaleSpatialDamageField(field, 0);
    expect(scaled.maxValueMm).toBe(0);
    for (let i = 0; i < scaled.valuesMm.length; i++) expect(scaled.valuesMm[i]).toBe(0);
  });

  it("negatif faktör için hata fırlatır", () => {
    const geometry = baseGeometry();
    const field = computeDamageField(geometry, [baseResult()], 10);
    expect(() => scaleSpatialDamageField(field, -1)).toThrowError();
  });

  it("hotspot değerleri de aynı oranla ölçeklenir", () => {
    const geometry = baseGeometry();
    const field = computeDamageField(geometry, [baseResult({ rateP50: 5 })], 10, { resolutionU: 60, resolutionV: 40 });
    const scaled = scaleSpatialDamageField(field, 0.5);
    expect(scaled.hotspots.length).toBe(field.hotspots.length);
    for (let i = 0; i < field.hotspots.length; i++) {
      expect(scaled.hotspots[i].valueMm).toBeCloseTo(field.hotspots[i].valueMm * 0.5, 5);
    }
  });
});
