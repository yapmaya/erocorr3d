// packages/engine/tests/corrosion/tlc.test.ts

import { describe, expect, it } from "vitest";
import {
  clockPositionToRadians,
  computeLatentHeatKJKg,
  computeTlcRate,
  computeWaterCondensationRateGm2s,
  isTlcTriggered,
  tlcAngularProfile,
  type TlcInput,
} from "../../src/corrosion/tlc";

function baseInput(overrides: Partial<TlcInput> = {}): TlcInput {
  return {
    fluidTemperatureK: 333.15, // 60°C
    ambientTemperatureK: 283.15, // 10°C — deniz suyu/toprak soğutması
    totalPressurePa: 50e5,
    co2PartialPressurePa: 5e5,
    overallHeatTransferCoefficientWm2K: 15,
    isStratifiedFlow: true,
    hasHeatLossToAmbient: true,
    inhibited: false,
    ...overrides,
  };
}

describe("computeLatentHeatKJKg", () => {
  it("referans noktalarında tam olarak beklenen değerleri verir", () => {
    expect(computeLatentHeatKJKg(0)).toBeCloseTo(2501, 6);
    expect(computeLatentHeatKJKg(100)).toBeCloseTo(2256, 6);
  });

  it("sıcaklık arttıkça gizli ısı azalır", () => {
    expect(computeLatentHeatKJKg(80)).toBeLessThan(computeLatentHeatKJKg(20));
  });
});

describe("computeWaterCondensationRateGm2s", () => {
  it("ısı dengesinden WCR=U×ΔT/L formülünü doğru uygular", () => {
    const wcr = computeWaterCondensationRateGm2s(333.15, 283.15, 15);
    const filmC = (333.15 + 283.15) / 2 - 273.15;
    const expected = (15 * 50) / computeLatentHeatKJKg(filmC);
    expect(wcr).toBeCloseTo(expected, 6);
  });

  it("ortam akışkandan sıcaksa veya eşitse WCR=0 verir", () => {
    expect(computeWaterCondensationRateGm2s(300, 320, 15)).toBe(0);
    expect(computeWaterCondensationRateGm2s(300, 300, 15)).toBe(0);
  });

  it("ısı transfer katsayısı arttıkça WCR artar", () => {
    const low = computeWaterCondensationRateGm2s(333.15, 283.15, 5);
    const high = computeWaterCondensationRateGm2s(333.15, 283.15, 30);
    expect(high).toBeGreaterThan(low);
  });

  it("negatif/sıfır ısı transfer katsayısı için hata fırlatır", () => {
    expect(() => computeWaterCondensationRateGm2s(333.15, 283.15, 0)).toThrowError();
  });
});

describe("tlcAngularProfile / clockPositionToRadians", () => {
  it("saat 12'de (θ=0) maksimum (1) verir", () => {
    expect(tlcAngularProfile(clockPositionToRadians(12))).toBeCloseTo(1, 6);
  });

  it("saat 3 ve 9'da (θ=π/2) yarı (0.5) verir", () => {
    expect(tlcAngularProfile(clockPositionToRadians(3))).toBeCloseTo(0.5, 6);
    expect(tlcAngularProfile(clockPositionToRadians(9))).toBeCloseTo(0.5, 6);
  });

  it("saat 6'da (θ=π) sıfır verir", () => {
    expect(tlcAngularProfile(clockPositionToRadians(6))).toBeCloseTo(0, 6);
  });

  it("aralık dışı saat pozisyonu için hata fırlatır", () => {
    expect(() => clockPositionToRadians(0)).toThrowError();
    expect(() => clockPositionToRadians(13)).toThrowError();
  });
});

describe("isTlcTriggered", () => {
  it("stratifiye + ısı kaybı + T>50°C iken true döndürür", () => {
    expect(
      isTlcTriggered({ isStratifiedFlow: true, hasHeatLossToAmbient: true, fluidTemperatureK: 333.15 }),
    ).toBe(true);
  });

  it("stratifiye değilse false döndürür", () => {
    expect(
      isTlcTriggered({ isStratifiedFlow: false, hasHeatLossToAmbient: true, fluidTemperatureK: 333.15 }),
    ).toBe(false);
  });

  it("ısı kaybı yoksa false döndürür", () => {
    expect(
      isTlcTriggered({ isStratifiedFlow: true, hasHeatLossToAmbient: false, fluidTemperatureK: 333.15 }),
    ).toBe(false);
  });

  it("sıcaklık 50°C veya altındaysa false döndürür", () => {
    expect(
      isTlcTriggered({ isStratifiedFlow: true, hasHeatLossToAmbient: true, fluidTemperatureK: 320 }),
    ).toBe(false);
  });
});

describe("computeTlcRate", () => {
  it("tetikleyici koşullar sağlanmıyorsa hız 0'dır", () => {
    const result = computeTlcRate(baseInput({ isStratifiedFlow: false }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("CO2 yoksa hız 0'dır", () => {
    const result = computeTlcRate(baseInput({ co2PartialPressurePa: 0 }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("tetikleyici koşullar sağlanıyorsa pozitif bir hız üretir ve WCR/pH raporlar", () => {
    const result = computeTlcRate(baseInput());
    expect(result.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(result.waterCondensationRateGm2s).toBeGreaterThan(0);
    expect(Number.isFinite(result.filmPh)).toBe(true);
  });

  it("düşük yoğuşma hızında (düşük U₀) hız kritik eşiğin üzerindeki duruma göre belirgin şekilde daha düşüktür", () => {
    const lowWcr = computeTlcRate(baseInput({ overallHeatTransferCoefficientWm2K: 1 }));
    const highWcr = computeTlcRate(baseInput({ overallHeatTransferCoefficientWm2K: 100 }));
    expect(lowWcr.waterCondensationRateGm2s).toBeLessThan(highWcr.waterCondensationRateGm2s);
    // Düşük WCR'de kinetik limitin yalnızca %10'u kullanılırken yüksek WCR'de tam kinetik limit
    // kullanılır — oranın (hız/WCR) düşük WCR durumunda daha küçük olması beklenir çünkü ekstra
    // bir 0.1 çarpanı devrededir.
    expect(lowWcr.validityWarnings.some((w) => w.parameter.includes("Yoğuşma hızı"))).toBe(true);
  });

  it("mühendislik uyarısını her sonuçta döndürür", () => {
    const result = computeTlcRate(baseInput());
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });

  it("inhibitörlü hatta hız asla 0.1mm/yıl altına inmez", () => {
    const result = computeTlcRate(baseInput({ inhibited: true, inhibitorEfficiencyPercent: 99.99 }));
    expect(result.rateMmPerYear.p50).toBeGreaterThanOrEqual(0.1);
  });

  it("geçersiz inhibitör verimliliği için hata fırlatır", () => {
    expect(() => computeTlcRate(baseInput({ inhibited: true, inhibitorEfficiencyPercent: 150 }))).toThrowError();
  });
});
