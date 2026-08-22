// apps/web/tests/viewer3d/measurementMath.test.ts

import { describe, expect, it } from "vitest";
import { computeDistanceMm, computeMidpoint, computeWallProbeResult } from "../../src/features/viewer3d/measurement/measurementMath";
import { DEMO_SCENARIOS } from "../../src/features/viewer3d/timeSlider/demoTimeDependentField";

const [SCENARIO] = DEMO_SCENARIOS;

describe("computeDistanceMm", () => {
  it("aynı nokta için 0 döner", () => {
    expect(computeDistanceMm([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("1 metrelik eksen-hizalı mesafeyi 1000mm olarak hesaplar", () => {
    expect(computeDistanceMm([0, 0, 0], [1, 0, 0])).toBeCloseTo(1000, 6);
  });

  it("3-4-5 üçgeninde Öklid mesafesini doğru hesaplar (metre→mm)", () => {
    expect(computeDistanceMm([0, 0, 0], [0.3, 0.4, 0])).toBeCloseTo(500, 6);
  });

  it("simetriktir: d(a,b) === d(b,a)", () => {
    const a: [number, number, number] = [1, 2, 3];
    const b: [number, number, number] = [4, -1, 2];
    expect(computeDistanceMm(a, b)).toBeCloseTo(computeDistanceMm(b, a), 10);
  });
});

describe("computeMidpoint", () => {
  it("iki noktanın tam ortasını döner", () => {
    expect(computeMidpoint([0, 0, 0], [2, 4, 6])).toEqual([1, 2, 3]);
  });

  it("aynı nokta için o noktayı döner", () => {
    expect(computeMidpoint([1, 1, 1], [1, 1, 1])).toEqual([1, 1, 1]);
  });
});

describe("computeWallProbeResult", () => {
  it("t=0'da kalan et tam et kalınlığına eşittir (hasar sıfır)", () => {
    const result = computeWallProbeResult(0.5, 0.5, 10, 0, SCENARIO);
    expect(result.damageMm).toBe(0);
    expect(result.remainingWallMm).toBe(10);
  });

  it("kalan et = wtMm - damageMm", () => {
    const result = computeWallProbeResult(0.17, 0.37, 10, 5, SCENARIO);
    expect(result.remainingWallMm).toBeCloseTo(10 - result.damageMm, 10);
  });

  it("hasar et kalınlığını aşarsa kalan et 0'da taban yapar", () => {
    const result = computeWallProbeResult(0.17, 0.37, 0.001, 50, SCENARIO);
    expect(result.remainingWallMm).toBe(0);
  });

  it("wtMm<=0 için hata fırlatır", () => {
    expect(() => computeWallProbeResult(0.5, 0.5, 0, 5, SCENARIO)).toThrow();
  });
});
