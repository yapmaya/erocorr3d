// apps/web/tests/results/monteCarloData.test.ts

import { describe, expect, it } from "vitest";
import { buildMonteCarloResult, MONTE_CARLO_ITERATIONS } from "../../src/features/results/charts/monteCarloData";
import { getTemplate } from "../../src/features/input/templates";

describe("buildMonteCarloResult", () => {
  it("CO2 mevcut senaryoda gerçek bir P10/P50/P90 dağılımı üretir", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const result = buildMonteCarloResult({
      geometry: values.geometry,
      mitigation: values.mitigation,
      operatingCase: values.operatingProfile.cases[0],
      operatingProfile: values.operatingProfile,
    });
    expect(result).not.toBeNull();
    expect(result!.iterations).toBe(MONTE_CARLO_ITERATIONS);
    expect(result!.p10MmPerYear).toBeLessThanOrEqual(result!.p50MmPerYear);
    expect(result!.p50MmPerYear).toBeLessThanOrEqual(result!.p90MmPerYear);
    expect(result!.histogram.length).toBeGreaterThan(0);
  });

  it("designLifeAllowanceCheck verildiği için tükenme olasılığı null DEĞİLDİR", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const result = buildMonteCarloResult({
      geometry: values.geometry,
      mitigation: values.mitigation,
      operatingCase: values.operatingProfile.cases[0],
      operatingProfile: values.operatingProfile,
    });
    expect(result!.probabilityOfExceedingAllowancePercent).not.toBeNull();
  });

  it("CO2 mol yüzdesi 0 ise null döner", () => {
    const values = getTemplate("seawater")!.apply();
    const result = buildMonteCarloResult({
      geometry: values.geometry,
      mitigation: values.mitigation,
      operatingCase: values.operatingProfile.cases[0],
      operatingProfile: values.operatingProfile,
    });
    expect(result).toBeNull();
  });

  it("aynı girdiyle iki çalıştırma AYNI sonucu verir (tohumlanmış RNG, tekrarlanabilir)", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const buildInput = {
      geometry: values.geometry,
      mitigation: values.mitigation,
      operatingCase: values.operatingProfile.cases[0],
      operatingProfile: values.operatingProfile,
    };
    const first = buildMonteCarloResult(buildInput);
    const second = buildMonteCarloResult(buildInput);
    expect(first!.p50MmPerYear).toBe(second!.p50MmPerYear);
  });
});
