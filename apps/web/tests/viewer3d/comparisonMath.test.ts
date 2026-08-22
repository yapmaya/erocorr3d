// apps/web/tests/viewer3d/comparisonMath.test.ts

import { describe, expect, it } from "vitest";
import { computeDeltaField, computeDeltaRange } from "../../src/features/viewer3d/comparison/comparisonMath";

describe("computeDeltaField", () => {
  it("delta = B - A", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1.5, 1, 5]);
    const delta = computeDeltaField(a, b);
    expect(delta[0]).toBeCloseTo(0.5, 6);
    expect(delta[1]).toBeCloseTo(-1, 6);
    expect(delta[2]).toBeCloseTo(2, 6);
  });

  it("aynı diziler için delta her yerde sıfırdır", () => {
    const a = new Float32Array([1, 2, 3]);
    const delta = computeDeltaField(a, a);
    for (let i = 0; i < delta.length; i++) expect(delta[i]).toBe(0);
  });

  it("farklı uzunluklarda hata fırlatır", () => {
    expect(() => computeDeltaField(new Float32Array([1, 2]), new Float32Array([1]))).toThrow();
  });
});

describe("computeDeltaRange", () => {
  it("sıfır-merkezli, en büyük mutlak değere göre simetrik aralık döner", () => {
    const delta = new Float32Array([-2, 5, -1, 3]);
    const range = computeDeltaRange(delta);
    expect(range.maxAbsValue).toBe(5);
    expect(range.minValue).toBe(-5);
    expect(range.maxValue).toBe(5);
  });

  it("tüm değerler sıfırsa çökmez, pozitif küçük bir aralık döner", () => {
    const range = computeDeltaRange(new Float32Array([0, 0, 0]));
    expect(range.maxAbsValue).toBeGreaterThan(0);
    expect(range.minValue).toBeLessThan(0);
    expect(range.maxValue).toBeGreaterThan(0);
  });

  it("aralık her zaman minValue === -maxValue şeklindedir (sıfır-merkezli)", () => {
    const range = computeDeltaRange(new Float32Array([-7, 2, 4]));
    expect(range.minValue).toBeCloseTo(-range.maxValue, 10);
  });
});
