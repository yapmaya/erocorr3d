// packages/engine/tests/uncertainty/defaultDistributions.test.ts

import { describe, expect, it } from "vitest";
import {
  buildDefaultCo2Distribution,
  buildDefaultInhibitorEfficiencyDistribution,
  buildDefaultPhDistribution,
  buildDefaultPressureDistribution,
  buildDefaultSandRateDistribution,
  buildDefaultTemperatureDistribution,
} from "../../src/uncertainty/defaultDistributions";

const Z90 = 1.6448536269514722;

describe("buildDefaultTemperatureDistribution", () => {
  it("NORMAL, mean=girdi, stdDev=3/Z90 döner", () => {
    const spec = buildDefaultTemperatureDistribution(40);
    expect(spec.distribution).toEqual({ type: "NORMAL", mean: 40, stdDev: 3 / Z90 });
    expect(spec.rationaleTr.length).toBeGreaterThan(0);
    expect(spec.sourcesUsed).toContain("uncertainty.defaultDistribution.temperatureStdDevC");
  });
});

describe("buildDefaultPressureDistribution", () => {
  it("NORMAL, stdDev girdinin %5'inin Z90'a bölümüdür", () => {
    const spec = buildDefaultPressureDistribution(20);
    expect(spec.distribution.type).toBe("NORMAL");
    if (spec.distribution.type === "NORMAL") {
      expect(spec.distribution.mean).toBe(20);
      expect(spec.distribution.stdDev).toBeCloseTo((20 * 0.05) / Z90, 9);
    }
  });

  it("negatif/sıfır ortalama için hata fırlatır", () => {
    expect(() => buildDefaultPressureDistribution(0)).toThrowError();
    expect(() => buildDefaultPressureDistribution(-5)).toThrowError();
  });
});

describe("buildDefaultCo2Distribution", () => {
  it("NORMAL, stdDev girdinin %10'unun Z90'a bölümüdür", () => {
    const spec = buildDefaultCo2Distribution(2);
    if (spec.distribution.type === "NORMAL") {
      expect(spec.distribution.stdDev).toBeCloseTo((2 * 0.1) / Z90, 9);
    }
  });
});

describe("buildDefaultPhDistribution", () => {
  it("NORMAL, stdDev=0,3/Z90 döner", () => {
    const spec = buildDefaultPhDistribution(6.5);
    expect(spec.distribution).toEqual({ type: "NORMAL", mean: 6.5, stdDev: 0.3 / Z90 });
  });

  it("[0,14] dışı pH için hata fırlatır", () => {
    expect(() => buildDefaultPhDistribution(-1)).toThrowError();
    expect(() => buildDefaultPhDistribution(15)).toThrowError();
  });
});

describe("buildDefaultSandRateDistribution", () => {
  it("LOGNORMAL, median=girdi, p90OverP50=1,5 döner", () => {
    const spec = buildDefaultSandRateDistribution(100);
    expect(spec.distribution).toEqual({ type: "LOGNORMAL", median: 100, p90OverP50: 1.5 });
    expect(spec.confidence).toBe("LOW");
  });

  it("sıfır/negatif medyan için hata fırlatır", () => {
    expect(() => buildDefaultSandRateDistribution(0)).toThrowError();
  });
});

describe("buildDefaultInhibitorEfficiencyDistribution", () => {
  it("ÜÇGEN dağılım, mode=nominal, ±%25 yarı-genişlik üretir", () => {
    const spec = buildDefaultInhibitorEfficiencyDistribution(0.8);
    expect(spec.distribution.type).toBe("TRIANGULAR");
    if (spec.distribution.type === "TRIANGULAR") {
      expect(spec.distribution.min).toBeCloseTo(0.6, 9);
      expect(spec.distribution.mode).toBe(0.8);
      expect(spec.distribution.max).toBe(1);
    }
  });

  it("üst sınır %100'ü aşarsa 1'e kırpılır", () => {
    const spec = buildDefaultInhibitorEfficiencyDistribution(0.95);
    if (spec.distribution.type === "TRIANGULAR") {
      expect(spec.distribution.max).toBe(1);
    }
  });

  it("(0,1] aralığı dışında hata fırlatır", () => {
    expect(() => buildDefaultInhibitorEfficiencyDistribution(0)).toThrowError();
    expect(() => buildDefaultInhibitorEfficiencyDistribution(1.5)).toThrowError();
  });
});
