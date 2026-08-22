// packages/engine/tests/norsok.test.ts

import { describe, expect, it } from "vitest";
import { computeNorsokCo2Rate, type NorsokCo2Input } from "../src/corrosion/norsok";

function baseInput(overrides: Partial<NorsokCo2Input> = {}): NorsokCo2Input {
  return {
    temperatureK: 313.15, // 40°C
    totalPressurePa: 10e5, // 10 bar
    co2PartialPressurePa: 2e5, // 2 bar
    wallShearStressPa: 20,
    pH: 5.5,
    waterDewPointK: 308, // 35°C -> ΔT = 5°C, kuru gaz DEĞİL
    waterCutPercent: 5,
    condensationExpected: false,
    inhibited: false,
    ...overrides,
  };
}

describe("computeNorsokCo2Rate — model sadakati (fidelity)", () => {
  it("T=40°C, pH=5.5, P=10 bar, pCO2=2 bar, S=20 Pa için bağımsız referans implementasyonla (dungnguyen2/norsokm506) eşleşir", () => {
    // Referans değer, aynı NORSOK M-506 formülünün bağımsız Python
    // implementasyonu (https://github.com/dungnguyen2/norsokm506) kullanılarak
    // elle hesaplanmıştır: rate ≈ 7.2696050557 mm/yıl (T=313.15K, 273.15 ofsetli).
    const result = computeNorsokCo2Rate(baseInput());
    expect(result.rateMmPerYear.p50).toBeCloseTo(7.2696, 3);
    expect(result.rateMmPerYear.p10).toBeCloseTo(7.2696 / 2.5, 3);
    expect(result.rateMmPerYear.p90).toBeCloseTo(7.2696 * 2.5, 3);
    expect(result.validityWarnings).toHaveLength(0);
  });

  it("belirsizlik bandı faktörü UNVERIFIED olduğundan genel güven seviyesi UNVERIFIED'dır", () => {
    const result = computeNorsokCo2Rate(baseInput());
    expect(result.confidence).toBe("UNVERIFIED");
  });

  it("mühendislik uyarısını her sonuçta döndürür", () => {
    const result = computeNorsokCo2Rate(baseInput());
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("computeNorsokCo2Rate — mühendislik kuralları", () => {
  it("kuru gaz (ΔT ≥ 10°C) durumunda hız 0'dır", () => {
    const result = computeNorsokCo2Rate(
      baseInput({ waterDewPointK: 290, temperatureK: 313.15 }), // ΔT = 23.15°C
    );
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("serbest su yoksa (water cut = 0, yoğuşma yok) hız 0'dır", () => {
    const result = computeNorsokCo2Rate(
      baseInput({ waterCutPercent: 0, condensationExpected: false }),
    );
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("inhibitörlü hatta hız asla 0.1 mm/yıl'ın altına inmez", () => {
    const result = computeNorsokCo2Rate(
      baseInput({ inhibited: true, inhibitorEfficiencyPercent: 99.99 }),
    );
    expect(result.rateMmPerYear.p10).toBeGreaterThanOrEqual(0.1);
    expect(result.rateMmPerYear.p50).toBeGreaterThanOrEqual(0.1);
    expect(result.rateMmPerYear.p90).toBeGreaterThanOrEqual(0.1);
  });

  it("geçerlilik aralığı dışındaki pH için hesabı yapar ama uyarı ekler", () => {
    const result = computeNorsokCo2Rate(baseInput({ pH: 7.5 }));
    expect(result.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(result.validityWarnings.some((w) => w.parameter === "pH")).toBe(true);
  });
});
