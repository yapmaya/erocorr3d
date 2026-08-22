// packages/engine/tests/rules.test.ts

import { describe, expect, it } from "vitest";
import {
  applyCondensationFactor,
  applyInhibitorFloor,
  applyPartialOperationFactor,
  hasFreeWater,
  isDryGas,
} from "../src/corrosion/rules";

describe("isDryGas", () => {
  it("sıcaklık, çiy noktasının ≥10°C üzerindeyse true döner", () => {
    expect(isDryGas(50, 40)).toBe(true);
    expect(isDryGas(50, 39.9)).toBe(true);
  });

  it("fark 10°C'nin altındaysa false döner", () => {
    expect(isDryGas(50, 41)).toBe(false);
  });
});

describe("hasFreeWater", () => {
  it("kuru gazda her zaman false döner", () => {
    expect(
      hasFreeWater({ isDryGasFlow: true, waterCutPercent: 50, condensationExpected: true }),
    ).toBe(false);
  });

  it("water cut > 0 ise true döner", () => {
    expect(
      hasFreeWater({ isDryGasFlow: false, waterCutPercent: 1, condensationExpected: false }),
    ).toBe(true);
  });

  it("water cut = 0 ama yoğuşma bekleniyorsa true döner", () => {
    expect(
      hasFreeWater({ isDryGasFlow: false, waterCutPercent: 0, condensationExpected: true }),
    ).toBe(true);
  });

  it("water cut = 0 ve yoğuşma yoksa false döner", () => {
    expect(
      hasFreeWater({ isDryGasFlow: false, waterCutPercent: 0, condensationExpected: false }),
    ).toBe(false);
  });
});

describe("applyCondensationFactor", () => {
  it("0-1 aralığı dışında hata fırlatır", () => {
    expect(() => applyCondensationFactor(1, 1.5)).toThrow();
    expect(() => applyCondensationFactor(1, -0.1)).toThrow();
  });

  it("hızı faktörle orantılı azaltır", () => {
    expect(applyCondensationFactor(2, 0.5)).toBe(1);
  });
});

describe("applyPartialOperationFactor", () => {
  it("91/365 günlük çalışma metal kaybını orantılı azaltır", () => {
    expect(applyPartialOperationFactor(3.65, 91)).toBeCloseTo(3.65 * (91 / 365), 6);
  });

  it("0-365 aralığı dışında hata fırlatır", () => {
    expect(() => applyPartialOperationFactor(1, 400)).toThrow();
    expect(() => applyPartialOperationFactor(1, -1)).toThrow();
  });
});

describe("applyInhibitorFloor", () => {
  it("yüksek verimlilikte bile 0.1 mm/yıl altına inmez", () => {
    expect(applyInhibitorFloor(10, 99.999)).toBeGreaterThanOrEqual(0.1);
  });

  it("düşük verimlilikte inhibitörlü hız, tabanın üzerinde orantılı hesaplanır", () => {
    expect(applyInhibitorFloor(1, 50)).toBeCloseTo(0.5, 6);
  });

  it("%0-100 aralığı dışında hata fırlatır", () => {
    expect(() => applyInhibitorFloor(1, 150)).toThrow();
    expect(() => applyInhibitorFloor(1, -1)).toThrow();
  });
});
