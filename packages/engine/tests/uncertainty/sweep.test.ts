// packages/engine/tests/uncertainty/sweep.test.ts

import { describe, expect, it } from "vitest";
import { computeParameterSweep } from "../../src/uncertainty/sweep";

describe("computeParameterSweep", () => {
  it("uç noktaları ve ara noktaları doğru üretir (varsayılan 25 nokta)", () => {
    const points = computeParameterSweep({
      baseInputs: {},
      parameter: "velocityMs",
      minValue: 1,
      maxValue: 20,
      modelFn: (inputs) => inputs.velocityMs,
    });
    expect(points).toHaveLength(25);
    expect(points[0].parameterValue).toBeCloseTo(1, 6);
    expect(points[points.length - 1].parameterValue).toBeCloseTo(20, 6);
  });

  it("eğri boyunca değerler artan sıradadır (monoton artan modelde)", () => {
    const points = computeParameterSweep({
      baseInputs: {},
      parameter: "velocityMs",
      minValue: 1,
      maxValue: 20,
      modelFn: (inputs) => inputs.velocityMs ** 2,
      pointCount: 10,
    });
    for (let i = 1; i < points.length; i++) {
      expect(points[i].outputMmPerYear).toBeGreaterThan(points[i - 1].outputMmPerYear);
    }
  });

  it("diğer girdileri baseInputs'taki değerinde sabit tutar", () => {
    const points = computeParameterSweep({
      baseInputs: { velocityMs: 999, temperature: 40 },
      parameter: "velocityMs",
      minValue: 1,
      maxValue: 10,
      modelFn: (inputs) => inputs.velocityMs + inputs.temperature,
      pointCount: 5,
    });
    expect(points[0].outputMmPerYear).toBeCloseTo(1 + 40, 6);
    expect(points[points.length - 1].outputMmPerYear).toBeCloseTo(10 + 40, 6);
  });

  it("negatif model çıktıları 0'a kırpılır", () => {
    const points = computeParameterSweep({
      baseInputs: {},
      parameter: "x",
      minValue: -10,
      maxValue: 10,
      modelFn: (inputs) => inputs.x,
      pointCount: 5,
    });
    expect(points[0].outputMmPerYear).toBe(0);
  });

  it("minValue >= maxValue hata fırlatır", () => {
    expect(() =>
      computeParameterSweep({ baseInputs: {}, parameter: "x", minValue: 10, maxValue: 5, modelFn: () => 0 }),
    ).toThrowError();
  });

  it("pointCount < 2 hata fırlatır", () => {
    expect(() =>
      computeParameterSweep({
        baseInputs: {},
        parameter: "x",
        minValue: 0,
        maxValue: 10,
        modelFn: () => 0,
        pointCount: 1,
      }),
    ).toThrowError();
  });

  it("baseInputs'ta önceden bulunmayan bir parametreyi de tarayabilir", () => {
    const points = computeParameterSweep({
      baseInputs: { other: 5 },
      parameter: "newParam",
      minValue: 0,
      maxValue: 4,
      modelFn: (inputs) => inputs.newParam + inputs.other,
      pointCount: 5,
    });
    expect(points[0].outputMmPerYear).toBeCloseTo(5, 6);
    expect(points[points.length - 1].outputMmPerYear).toBeCloseTo(9, 6);
  });
});
