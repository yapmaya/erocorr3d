// packages/engine/tests/spatial/index.test.ts

import { describe, expect, it } from "vitest";
import { computeDamageField } from "../../src/spatial/index";
import type { Geometry } from "../../src/types/geometry";
import type { MechanismResult } from "../../src/types/results";

function baseGeometry(overrides: Partial<Geometry> = {}): Geometry {
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
    ...overrides,
  };
}

function baseResult(overrides: Partial<MechanismResult> = {}): MechanismResult {
  return {
    mechanismId: "test.mechanism",
    nameTr: "Test Mekanizması",
    nameEn: "Test Mechanism",
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

describe("computeDamageField — boru/fitting yönlendirme", () => {
  it("BLC_STRATIFIED: kütle korunumu ve tepe konumu", () => {
    const geometry = baseGeometry();
    const results = [
      baseResult({
        mechanismId: "corrosion.deWaard",
        spatialSignatureId: "BLC_STRATIFIED",
        rateP50: 2,
        governingParameters: { liquidHoldupFraction: 0.3 },
      }),
    ];
    const field = computeDamageField(geometry, results, 10, { resolutionU: 60, resolutionV: 60 });

    let sum = 0;
    for (let i = 0; i < field.valuesMm.length; i++) sum += field.valuesMm[i];
    const mean = sum / field.valuesMm.length;
    expect(mean).toBeGreaterThan(20 * 0.95);
    expect(mean).toBeLessThan(20 * 1.05);
    expect(field.maxLocation.clockPosition).toBeCloseTo(6, 0);
  });

  it("isApplicable=false sonuçlar alana KATKIDA BULUNMAZ", () => {
    const geometry = baseGeometry();
    const results = [
      baseResult({ spatialSignatureId: "UNIFORM_FULL_BORE", rateP50: 5, isApplicable: false }),
    ];
    const field = computeDamageField(geometry, results, 10);
    let sum = 0;
    for (let i = 0; i < field.valuesMm.length; i++) sum += field.valuesMm[i];
    expect(sum).toBe(0);
  });

  it("ELBOW_EXTRADOS_IMPINGEMENT: otomatik olarak BEND_INTRADOS_SECONDARY katkısını da ekler", () => {
    const geometry = baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 1.5, bendAngleDeg: 90 });
    const results = [
      baseResult({
        mechanismId: "erosion.dnvO501.bend",
        spatialSignatureId: "ELBOW_EXTRADOS_IMPINGEMENT",
        rateP50: 2,
        governingParameters: {},
      }),
    ];
    const field = computeDamageField(geometry, results, 10, { resolutionU: 100, resolutionV: 60 });
    let sum = 0;
    for (let i = 0; i < field.valuesMm.length; i++) sum += field.valuesMm[i];
    const mean = sum / field.valuesMm.length;
    // beklenen ≈ 2×10×(1+0,15) = 23 (extrados + intrados ikincil katkı)
    expect(mean).toBeGreaterThan(23 * 0.9);
    expect(mean).toBeLessThan(23 * 1.1);
  });

  it("tanınmayan spatialSignatureId için hata fırlatır", () => {
    const geometry = baseGeometry();
    const results = [baseResult({ spatialSignatureId: "NOT_A_REAL_SIGNATURE" })];
    expect(() => computeDamageField(geometry, results, 10)).toThrowError();
  });

  it("negatif elapsedYears için hata fırlatır", () => {
    const geometry = baseGeometry();
    expect(() => computeDamageField(geometry, [baseResult()], -1)).toThrowError();
  });

  it("CYLINDRICAL_UV parametrizasyonunu kullanır (boru/fitting için)", () => {
    const geometry = baseGeometry();
    const field = computeDamageField(geometry, [baseResult()], 5);
    expect(field.parameterization).toBe("CYLINDRICAL_UV");
  });
});

describe("computeDamageField — vana yönlendirme", () => {
  it("vana bileşen tipleri spatial/valves.ts'e devredilir (LATHE_PROFILE)", () => {
    const geometry = baseGeometry({ componentType: "GATE_VALVE" });
    const results = [
      baseResult({
        mechanismId: "erosion.valveHydraulics",
        rateP50: 1,
        rateP10: 0.4,
        rateP90: 2,
        governingParameters: { openingPercent: 100 },
      }),
    ];
    const field = computeDamageField(geometry, results, 10);
    expect(field.parameterization).toBe("LATHE_PROFILE");
    expect(field.maxValueMm).toBeGreaterThan(0);
  });
});
