// packages/engine/tests/fluids/friction.test.ts

import { describe, expect, it } from "vitest";
import {
  classifyFlowRegimeByReynolds,
  computeFrictionFactor,
  computeFrictionFactorChurchill,
  computeFrictionFactorColebrookWhite,
  computeReynoldsNumber,
  computeWallShearStressPa,
} from "../../src/fluids/friction";

describe("computeReynoldsNumber", () => {
  it("Re = ρ·u·D/μ formülünü doğru uygular", () => {
    // Su, 1000 kg/m³, 2 m/s, 0.1 m çap, 1e-3 Pa·s ⇒ Re = 1000*2*0.1/1e-3 = 200000
    expect(computeReynoldsNumber(1000, 2, 0.1, 1e-3)).toBeCloseTo(200000, 6);
  });

  it("negatif/sıfır girdilerde hata fırlatır", () => {
    expect(() => computeReynoldsNumber(-1, 2, 0.1, 1e-3)).toThrowError();
    expect(() => computeReynoldsNumber(1000, -2, 0.1, 1e-3)).toThrowError();
    expect(() => computeReynoldsNumber(1000, 2, 0, 1e-3)).toThrowError();
    expect(() => computeReynoldsNumber(1000, 2, 0.1, 0)).toThrowError();
  });
});

describe("classifyFlowRegimeByReynolds", () => {
  it("Re<2300 için LAMINAR, 2300-4000 için TRANSITIONAL, Re>4000 için TURBULENT döndürür", () => {
    expect(classifyFlowRegimeByReynolds(1000)).toBe("LAMINAR");
    expect(classifyFlowRegimeByReynolds(3000)).toBe("TRANSITIONAL");
    expect(classifyFlowRegimeByReynolds(100000)).toBe("TURBULENT");
  });
});

describe("computeFrictionFactorColebrookWhite", () => {
  it("Re<=4000 için hata fırlatır (yalnızca türbülans için tanımlı)", () => {
    expect(() => computeFrictionFactorColebrookWhite(4000, 0.001)).toThrowError();
  });

  it("düzgün boru (ε/D≈0) için Re arttıkça sürtünme faktörü azalır", () => {
    const fLow = computeFrictionFactorColebrookWhite(1e4, 1e-6);
    const fHigh = computeFrictionFactorColebrookWhite(1e6, 1e-6);
    expect(fHigh).toBeLessThan(fLow);
  });

  it("Colebrook-White ve Churchill türbülans bölgesinde birbirine yakın sonuç verir (literatürde belgelenen uyum)", () => {
    // Re=1e5, ε/D=0.001 — tipik ticari çelik boru mertebesi.
    const colebrook = computeFrictionFactorColebrookWhite(1e5, 0.001);
    const churchill = computeFrictionFactorChurchill(1e5, 0.001);
    expect(colebrook).toBeGreaterThan(0);
    expect(Math.abs(colebrook - churchill) / colebrook).toBeLessThan(0.02);
  });
});

describe("computeFrictionFactorChurchill", () => {
  it("düşük Re'de (derin laminer bölge) tam analitik f=64/Re sonucuna yakınsar", () => {
    const re = 100;
    expect(computeFrictionFactorChurchill(re, 0.001)).toBeCloseTo(64 / re, 3);
  });

  it("tüm Re>0 için pozitif bir değer döndürür (kapalı form, iterasyonsuz)", () => {
    expect(computeFrictionFactorChurchill(500, 0.001)).toBeGreaterThan(0);
    expect(computeFrictionFactorChurchill(3000, 0.001)).toBeGreaterThan(0);
    expect(computeFrictionFactorChurchill(1e7, 0.001)).toBeGreaterThan(0);
  });
});

describe("computeFrictionFactor", () => {
  it("laminer rejimde tam analitik f=64/Re verir ve method LAMINAR_EXACT olur", () => {
    const result = computeFrictionFactor({ reynoldsNumber: 1000, relativeRoughness: 0.001 });
    expect(result.frictionFactor).toBeCloseTo(64 / 1000, 10);
    expect(result.regime).toBe("LAMINAR");
    expect(result.methodUsed).toBe("LAMINAR_EXACT");
    expect(result.validityWarnings).toHaveLength(0);
  });

  it("geçiş rejiminde hesap yapar ama validityWarnings ekler", () => {
    const result = computeFrictionFactor({ reynoldsNumber: 3000, relativeRoughness: 0.001 });
    expect(result.regime).toBe("TRANSITIONAL");
    expect(result.frictionFactor).toBeGreaterThan(0);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("türbülans rejiminde varsayılan olarak Churchill yöntemini kullanır", () => {
    const result = computeFrictionFactor({ reynoldsNumber: 1e5, relativeRoughness: 0.001 });
    expect(result.methodUsed).toBe("CHURCHILL");
    expect(result.validityWarnings).toHaveLength(0);
  });

  it("method='COLEBROOK_WHITE' açıkça istenirse türbülans rejiminde onu kullanır", () => {
    const result = computeFrictionFactor({
      reynoldsNumber: 1e5,
      relativeRoughness: 0.001,
      method: "COLEBROOK_WHITE",
    });
    expect(result.methodUsed).toBe("COLEBROOK_WHITE");
  });
});

describe("computeWallShearStressPa", () => {
  it("τ = f_Darcy/8 × ρ × u² formülünü doğru uygular", () => {
    // f=0.02, ρ=1000 kg/m³, u=2 m/s ⇒ τ = 0.02/8*1000*4 = 10 Pa
    expect(computeWallShearStressPa(0.02, 1000, 2)).toBeCloseTo(10, 6);
  });

  it("negatif sürtünme faktörü/yoğunluk/hız için hata fırlatır", () => {
    expect(() => computeWallShearStressPa(-0.01, 1000, 2)).toThrowError();
    expect(() => computeWallShearStressPa(0.02, -1000, 2)).toThrowError();
    expect(() => computeWallShearStressPa(0.02, 1000, -2)).toThrowError();
  });
});
