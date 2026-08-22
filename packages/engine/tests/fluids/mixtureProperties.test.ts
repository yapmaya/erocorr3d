// packages/engine/tests/fluids/mixtureProperties.test.ts

import { describe, expect, it } from "vitest";
import {
  computeMixtureVelocityFromSuperficial,
  computeMixtureVelocityMs,
  computeMixtureViscosityPaS,
  computeNoSlipMixtureDensityKgM3,
  computeSlipMixtureDensityKgM3,
} from "../../src/fluids/mixtureProperties";

describe("computeMixtureVelocityFromSuperficial", () => {
  it("Vm = Vsg + Vsl toplamını verir", () => {
    expect(computeMixtureVelocityFromSuperficial(3, 1)).toBeCloseTo(4, 10);
  });

  it("negatif hız için hata fırlatır", () => {
    expect(() => computeMixtureVelocityFromSuperficial(-1, 1)).toThrowError();
  });
});

describe("computeMixtureVelocityMs (kütlesel debiden)", () => {
  it("gaz ve sıvı debisi sıfırsa hız sıfırdır", () => {
    expect(computeMixtureVelocityMs(0, 0, 1, 1000, 0.1)).toBe(0);
  });

  it("boru çapı sıfır/negatif için hata fırlatır", () => {
    expect(() => computeMixtureVelocityMs(1, 1, 1, 1000, 0)).toThrowError();
  });
});

describe("computeNoSlipMixtureDensityKgM3", () => {
  it("λL=1 iken saf sıvı yoğunluğunu, λL=0 iken saf gaz yoğunluğunu verir", () => {
    expect(computeNoSlipMixtureDensityKgM3(1, 900, 40)).toBeCloseTo(900, 10);
    expect(computeNoSlipMixtureDensityKgM3(0, 900, 40)).toBeCloseTo(40, 10);
  });

  it("ara λL için hacimce ağırlıklı ortalama verir", () => {
    expect(computeNoSlipMixtureDensityKgM3(0.3, 900, 40)).toBeCloseTo(0.3 * 900 + 0.7 * 40, 10);
  });

  it("λL aralık dışıysa veya yoğunluklar negatifse hata fırlatır", () => {
    expect(() => computeNoSlipMixtureDensityKgM3(1.5, 900, 40)).toThrowError();
    expect(() => computeNoSlipMixtureDensityKgM3(0.5, -900, 40)).toThrowError();
  });
});

describe("computeSlipMixtureDensityKgM3", () => {
  it("HL=1 iken saf sıvı yoğunluğunu, HL=0 iken saf gaz yoğunluğunu verir", () => {
    expect(computeSlipMixtureDensityKgM3(1, 900, 40)).toBeCloseTo(900, 10);
    expect(computeSlipMixtureDensityKgM3(0, 900, 40)).toBeCloseTo(40, 10);
  });

  it("gerçek (kaymalı) tutulum, no-slip tutulumdan daha yüksek karışım yoğunluğu verir (fiziksel beklenti)", () => {
    // Kayma her zaman sıvının daha yavaş, dolayısıyla daha yoğun biçimde
    // birikmesine yol açar (HL >= λL), bu yüzden ρm(slip) >= ρns.
    const noSlip = computeNoSlipMixtureDensityKgM3(0.1, 900, 40);
    const slip = computeSlipMixtureDensityKgM3(0.3, 900, 40); // HL=0.3 > λL=0.1 varsayımı
    expect(slip).toBeGreaterThan(noSlip);
  });
});

describe("computeMixtureViscosityPaS", () => {
  it("λL=1 iken saf sıvı viskozitesini, λL=0 iken saf gaz viskozitesini verir", () => {
    expect(computeMixtureViscosityPaS(1, 5e-3, 1.2e-5)).toBeCloseTo(5e-3, 10);
    expect(computeMixtureViscosityPaS(0, 5e-3, 1.2e-5)).toBeCloseTo(1.2e-5, 10);
  });

  it("ara λL için Dukler (1964) ağırlıklı ortalamasını verir", () => {
    const result = computeMixtureViscosityPaS(0.4, 5e-3, 1.2e-5);
    expect(result).toBeCloseTo(0.6 * 1.2e-5 + 0.4 * 5e-3, 10);
  });

  it("λL aralık dışıysa veya viskoziteler negatifse/sıfırsa hata fırlatır", () => {
    expect(() => computeMixtureViscosityPaS(1.5, 5e-3, 1.2e-5)).toThrowError();
    expect(() => computeMixtureViscosityPaS(0.5, 0, 1.2e-5)).toThrowError();
  });
});
