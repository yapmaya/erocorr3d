// packages/engine/tests/uncertainty/monteCarlo.test.ts

import { describe, expect, it } from "vitest";
import { runMonteCarloSimulation, sampleFromDistribution, type MonteCarloConfig } from "../../src/uncertainty/monteCarlo";

/** Basit, doğrusal bir test modeli: rate = temperatureC × 0,1 + pressureBara × 0,05 (mm/yıl varsayımsal). */
function linearTestModel(sample: Readonly<Record<string, number>>): number {
  return sample.temperatureC * 0.1 + sample.pressureBara * 0.05;
}

function baseConfig(overrides: Partial<MonteCarloConfig> = {}): MonteCarloConfig {
  return {
    variables: [
      { name: "temperatureC", distribution: { type: "NORMAL", mean: 40, stdDev: 3 } },
      { name: "pressureBara", distribution: { type: "NORMAL", mean: 20, stdDev: 1 } },
    ],
    modelFn: linearTestModel,
    iterations: 10_000,
    seed: 7,
    ...overrides,
  };
}

describe("runMonteCarloSimulation — tekrarlanabilirlik", () => {
  it("aynı seed ile aynı sonucu üretir (durationMs hariç)", () => {
    const resultA = runMonteCarloSimulation(baseConfig());
    const resultB = runMonteCarloSimulation(baseConfig());
    const { durationMs: _a, ...restA } = resultA;
    const { durationMs: _b, ...restB } = resultB;
    expect(restA).toEqual(restB);
  });

  it("farklı seed farklı (ama benzer mertebede) sonuç üretir", () => {
    const resultA = runMonteCarloSimulation(baseConfig({ seed: 1 }));
    const resultB = runMonteCarloSimulation(baseConfig({ seed: 2 }));
    expect(resultA.p50MmPerYear).not.toBe(resultB.p50MmPerYear);
    expect(resultA.p50MmPerYear).toBeCloseTo(resultB.p50MmPerYear, 0);
  });
});

describe("runMonteCarloSimulation — istatistiksel tutarlılık", () => {
  it("P10 < P50 < P90", () => {
    const result = runMonteCarloSimulation(baseConfig());
    expect(result.p10MmPerYear).toBeLessThan(result.p50MmPerYear);
    expect(result.p50MmPerYear).toBeLessThan(result.p90MmPerYear);
  });

  it("P50, deterministik (ortalama girdilerle hesaplanan) sonuca yakındır", () => {
    const result = runMonteCarloSimulation(baseConfig());
    const deterministic = linearTestModel({ temperatureC: 40, pressureBara: 20 });
    expect(result.p50MmPerYear).toBeCloseTo(deterministic, 1);
  });

  it("histogram bin sayıları toplamı iterasyon sayısına eşittir", () => {
    const result = runMonteCarloSimulation(baseConfig());
    const total = result.histogram.reduce((sum, bin) => sum + bin.count, 0);
    expect(total).toBe(10_000);
  });

  it("kümülatif dağılım artan ve [0,1] aralığındadır", () => {
    const result = runMonteCarloSimulation(baseConfig());
    for (let i = 1; i < result.cumulativeDistribution.length; i++) {
      expect(result.cumulativeDistribution[i].cumulativeProbability).toBeGreaterThanOrEqual(
        result.cumulativeDistribution[i - 1].cumulativeProbability,
      );
    }
    expect(result.cumulativeDistribution[result.cumulativeDistribution.length - 1].cumulativeProbability).toBe(1);
  });

  it("negatif model çıktıları 0'a kırpılır", () => {
    const result = runMonteCarloSimulation(
      baseConfig({
        variables: [{ name: "x", distribution: { type: "NORMAL", mean: 0, stdDev: 1 } }],
        modelFn: (s) => s.x, // yaklaşık yarısı negatif olacak
      }),
    );
    expect(result.minMmPerYear).toBe(0);
  });
});

describe("runMonteCarloSimulation — tasarım ömrü tükenme olasılığı", () => {
  it("çok düşük korozyon payı için yüksek aşılma olasılığı verir", () => {
    const result = runMonteCarloSimulation(
      baseConfig({ designLifeAllowanceCheck: { designLifeYears: 30, corrosionAllowanceMm: 0.1 } }),
    );
    expect(result.probabilityOfExceedingAllowancePercent).not.toBeNull();
    expect(result.probabilityOfExceedingAllowancePercent!).toBeGreaterThan(90);
  });

  it("çok yüksek korozyon payı için düşük aşılma olasılığı verir", () => {
    const result = runMonteCarloSimulation(
      baseConfig({ designLifeAllowanceCheck: { designLifeYears: 30, corrosionAllowanceMm: 1000 } }),
    );
    expect(result.probabilityOfExceedingAllowancePercent!).toBeLessThan(1);
  });

  it("designLifeAllowanceCheck verilmezse null döner", () => {
    const result = runMonteCarloSimulation(baseConfig());
    expect(result.probabilityOfExceedingAllowancePercent).toBeNull();
  });
});

describe("runMonteCarloSimulation — performans", () => {
  it("10.000 iterasyon 3 saniyenin altında tamamlanır", () => {
    const start = Date.now();
    runMonteCarloSimulation(baseConfig({ iterations: 10_000 }));
    expect(Date.now() - start).toBeLessThan(3000);
  });
});

describe("sampleFromDistribution", () => {
  const rng = () => 0.5; // sabit orta-nokta rng, sınır davranışlarını test etmek için

  it("UNIFORM aralığın ortasını döndürür (u=0,5)", () => {
    expect(sampleFromDistribution({ type: "UNIFORM", min: 0, max: 10 }, rng)).toBeCloseTo(5, 6);
  });

  it("geçersiz UNIFORM (min>=max) hata fırlatır", () => {
    expect(() => sampleFromDistribution({ type: "UNIFORM", min: 10, max: 0 }, rng)).toThrowError();
  });

  it("geçersiz TRIANGULAR (min>mode) hata fırlatır", () => {
    expect(() =>
      sampleFromDistribution({ type: "TRIANGULAR", min: 10, mode: 0, max: 20 }, rng),
    ).toThrowError();
  });

  it("geçersiz LOGNORMAL (p90OverP50<=1) hata fırlatır", () => {
    expect(() => sampleFromDistribution({ type: "LOGNORMAL", median: 10, p90OverP50: 1 }, rng)).toThrowError();
  });

  it("LOGNORMAL örnekleri her zaman pozitiftir (çok sayıda örnek)", () => {
    let state = 123;
    const seededRng = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
    for (let i = 0; i < 500; i++) {
      const sample = sampleFromDistribution({ type: "LOGNORMAL", median: 5, p90OverP50: 1.5 }, seededRng);
      expect(sample).toBeGreaterThan(0);
    }
  });
});
