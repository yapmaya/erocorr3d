// packages/engine/tests/corrosion/deWaard.test.ts

import { describe, expect, it } from "vitest";
import {
  computeDeWaardNomogramRateMmPerYear,
  computeDeWaardRate,
  computeFcond,
  computeFpH,
  computeFscale,
  computeMassTransferRateMmPerYear,
  type DeWaardInput,
} from "../../src/corrosion/deWaard";

function baseInput(overrides: Partial<DeWaardInput> = {}): DeWaardInput {
  return {
    temperatureK: 313.15, // 40°C
    totalPressurePa: 10e5,
    co2PartialPressurePa: 2e5,
    waterDewPointK: 308,
    waterCutPercent: 5,
    condensationExpected: false,
    isCondensationOnlyScenario: false,
    inhibited: false,
    ...overrides,
  };
}

describe("computeDeWaardNomogramRateMmPerYear — model sadakati", () => {
  it("40°C, 2 bar fCO2 için bağımsız kaynaklarla (Aalborg tezi + genel literatür) tutarlı elle hesaplanmış referans değerle eşleşir", () => {
    // log10(Vcor) = 5.8 - 1710/(40+273) + 0.67*log10(2) = 5.8 - 5.4632 + 0.2017 = 0.5385
    // Vcor = 10^0.5385 ≈ 3.456 mm/yıl
    const rate = computeDeWaardNomogramRateMmPerYear(313.15, 2e5);
    expect(rate).toBeCloseTo(3.456, 1);
  });

  it("CO2 fugasitesi arttıkça hız artar", () => {
    const low = computeDeWaardNomogramRateMmPerYear(313.15, 1e5);
    const high = computeDeWaardNomogramRateMmPerYear(313.15, 8e5);
    expect(high).toBeGreaterThan(low);
  });

  it("sıcaklık veya fugasite negatif/sıfırsa hata fırlatır", () => {
    expect(() => computeDeWaardNomogramRateMmPerYear(0, 2e5)).toThrowError();
    expect(() => computeDeWaardNomogramRateMmPerYear(313.15, 0)).toThrowError();
  });
});

describe("computeFscale", () => {
  it("üst sınır 1'i aşmaz", () => {
    // Çok düşük sıcaklık/basınçta log(Fscale) pozitif çıkabilir — 1'e kırpılmalı.
    expect(computeFscale(278.15, 0.1e5)).toBeLessThanOrEqual(1);
  });

  it("yüksek sıcaklıkta düşük (koruyucu film) bir değer verir", () => {
    const fscaleHighT = computeFscale(423.15, 2e5); // 150°C
    expect(fscaleHighT).toBeLessThan(1);
  });
});

describe("computeFpH", () => {
  it("gerçek pH, referans pH'a eşitse FpH=1 verir", () => {
    expect(computeFpH(4.0, 4.0)).toBeCloseTo(1, 10);
  });

  it("gerçek pH referanstan yüksekse (daha az asidik) FpH<1 verir (koruyucu)", () => {
    expect(computeFpH(4.0, 5.5)).toBeLessThan(1);
  });

  it("gerçek pH referanstan düşükse (daha asidik) FpH>1 verir", () => {
    expect(computeFpH(4.0, 3.0)).toBeGreaterThan(1);
  });
});

describe("computeMassTransferRateMmPerYear", () => {
  it("sıvı hızı arttıkça Vm artar", () => {
    const low = computeMassTransferRateMmPerYear(0.5, 0.2, 2e5);
    const high = computeMassTransferRateMmPerYear(5, 0.2, 2e5);
    expect(high).toBeGreaterThan(low);
  });

  it("negatif/sıfır girdiler için hata fırlatır", () => {
    expect(() => computeMassTransferRateMmPerYear(0, 0.2, 2e5)).toThrowError();
    expect(() => computeMassTransferRateMmPerYear(1, 0, 2e5)).toThrowError();
  });
});

describe("computeFcond", () => {
  it("varsayılan 0.1'dir", () => {
    expect(computeFcond()).toBe(0.1);
  });

  it("0.1-0.33 aralığında override kabul eder", () => {
    expect(computeFcond(0.2)).toBe(0.2);
  });

  it("aralık dışı override için hata fırlatır", () => {
    expect(() => computeFcond(0.05)).toThrowError();
    expect(() => computeFcond(0.5)).toThrowError();
  });
});

describe("computeDeWaardRate — mühendislik kuralları", () => {
  it("kuru gaz durumunda hız 0'dır", () => {
    const result = computeDeWaardRate(baseInput({ waterDewPointK: 290 }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("serbest su yoksa hız 0'dır", () => {
    const result = computeDeWaardRate(baseInput({ waterCutPercent: 0, condensationExpected: false }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("mühendislik uyarısını her sonuçta döndürür", () => {
    const result = computeDeWaardRate(baseInput());
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });

  it("sıvı hızı/boru çapı verilmezse validityWarning ekler", () => {
    const result = computeDeWaardRate(baseInput());
    expect(result.validityWarnings.some((w) => w.parameter.includes("Sıvı hızı"))).toBe(true);
  });

  it("sıvı hızı/çap verilirse Vm sınırlaması uygulanır ve hız azalır (ya da eşit kalır)", () => {
    const withoutVm = computeDeWaardRate(baseInput());
    const withVm = computeDeWaardRate(baseInput({ liquidVelocityMs: 0.3, pipeInternalDiameterM: 0.2 }));
    expect(withVm.rateMmPerYear.p50).toBeLessThanOrEqual(withoutVm.rateMmPerYear.p50);
  });

  it("yoğuşma-sadece senaryosunda (Fcond) hızı belirgin şekilde azaltır", () => {
    const withoutCond = computeDeWaardRate(baseInput({ waterCutPercent: 0, condensationExpected: true }));
    const withCond = computeDeWaardRate(
      baseInput({ waterCutPercent: 0, condensationExpected: true, isCondensationOnlyScenario: true }),
    );
    expect(withCond.rateMmPerYear.p50).toBeCloseTo(withoutCond.rateMmPerYear.p50 * 0.1, 6);
  });

  it("glikol uygulandığında hızı azaltır", () => {
    const without = computeDeWaardRate(baseInput());
    const withGlycol = computeDeWaardRate(baseInput({ glycolWeightPercent: 60 }));
    expect(withGlycol.rateMmPerYear.p50).toBeLessThan(without.rateMmPerYear.p50);
  });

  it("inhibitörlü hatta hız asla 0.1mm/yıl altına inmez", () => {
    const result = computeDeWaardRate(baseInput({ inhibited: true, inhibitorEfficiencyPercent: 99.99 }));
    expect(result.rateMmPerYear.p50).toBeGreaterThanOrEqual(0.1);
  });

  it("pH verilip referans pH'tan yüksekse (daha az asidik) hızı azaltır", () => {
    const withoutPh = computeDeWaardRate(baseInput());
    const withHighPh = computeDeWaardRate(baseInput({ pH: 6.5 }));
    expect(withHighPh.rateMmPerYear.p50).toBeLessThan(withoutPh.rateMmPerYear.p50);
  });
});
