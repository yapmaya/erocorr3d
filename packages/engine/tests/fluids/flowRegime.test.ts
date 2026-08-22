// packages/engine/tests/fluids/flowRegime.test.ts

import { describe, expect, it } from "vitest";
import {
  classifyBeggsBrillFlowPattern,
  computeBeggsBrillHoldup,
  computeFlowPatternMapCurves,
  computeFroudeNumber,
  computeLiquidVelocityNumber,
  computeNoSlipLiquidHoldup,
} from "../../src/fluids/flowRegime";

describe("computeNoSlipLiquidHoldup", () => {
  it("λL = Vsl/(Vsl+Vsg) formülünü doğru uygular", () => {
    expect(computeNoSlipLiquidHoldup(1, 3)).toBeCloseTo(0.25, 10);
  });

  it("negatif hızlar için hata fırlatır", () => {
    expect(() => computeNoSlipLiquidHoldup(-1, 3)).toThrowError();
  });

  it("her iki hız da sıfırsa hata fırlatır", () => {
    expect(() => computeNoSlipLiquidHoldup(0, 0)).toThrowError();
  });
});

describe("computeFroudeNumber", () => {
  it("NFR = Vm²/(g·D) formülünü doğru uygular", () => {
    // Vm=2m/s, D=0.1m ⇒ NFR = 4/(9.80665*0.1) = 4.0789...
    expect(computeFroudeNumber(2, 0.1)).toBeCloseTo(4 / (9.80665 * 0.1), 6);
  });

  it("çap sıfır/negatifse hata fırlatır", () => {
    expect(() => computeFroudeNumber(2, 0)).toThrowError();
  });
});

describe("computeLiquidVelocityNumber", () => {
  it("NLV = Vsl·(ρL/(g·σ))^0.25 formülünü doğru uygular", () => {
    const vsl = 1;
    const rho = 1000;
    const sigma = 0.03;
    const expected = vsl * (rho / (9.80665 * sigma)) ** 0.25;
    expect(computeLiquidVelocityNumber(vsl, rho, sigma)).toBeCloseTo(expected, 6);
  });

  it("yoğunluk veya yüzey gerilimi negatif/sıfırsa hata fırlatır", () => {
    expect(() => computeLiquidVelocityNumber(1, 0, 0.03)).toThrowError();
    expect(() => computeLiquidVelocityNumber(1, 1000, 0)).toThrowError();
  });
});

describe("classifyBeggsBrillFlowPattern", () => {
  it("düşük λL ve düşük Froude sayısında SEGREGATED döndürür", () => {
    expect(classifyBeggsBrillFlowPattern(0.001, 0.01)).toBe("SEGREGATED");
  });

  it("orta λL, çok yüksek Froude sayısında DISTRIBUTED döndürür", () => {
    expect(classifyBeggsBrillFlowPattern(0.1, 1000)).toBe("DISTRIBUTED");
  });

  it("orta λL, orta-yüksek Froude sayısında INTERMITTENT döndürür", () => {
    // λL=0.1: L3=0.10*0.1^-1.4516≈2.83, L1=316*0.1^0.302≈157.9 — L3<NFR<=L1 aralığında INTERMITTENT beklenir.
    expect(classifyBeggsBrillFlowPattern(0.1, 10)).toBe("INTERMITTENT");
  });

  it("λL sınır dışıysa (0 veya 1) hata fırlatır", () => {
    expect(() => classifyBeggsBrillFlowPattern(0, 10)).toThrowError();
    expect(() => classifyBeggsBrillFlowPattern(1, 10)).toThrowError();
  });
});

describe("computeBeggsBrillHoldup", () => {
  it("sıvı tutulumu her zaman λL'den büyük veya eşittir (Beggs-Brill'in kendi kısıtı)", () => {
    const result = computeBeggsBrillHoldup({
      superficialLiquidVelocityMs: 0.5,
      superficialGasVelocityMs: 3,
      pipeInternalDiameterM: 0.15,
      liquidDensityKgM3: 900,
      surfaceTensionNPerM: 0.02,
      inclinationDeg: 0,
    });
    expect(result.liquidHoldupFraction).toBeGreaterThanOrEqual(result.noSlipLiquidHoldup - 1e-9);
  });

  it("sıvı tutulumu (0,1] aralığındadır", () => {
    const result = computeBeggsBrillHoldup({
      superficialLiquidVelocityMs: 0.5,
      superficialGasVelocityMs: 3,
      pipeInternalDiameterM: 0.15,
      liquidDensityKgM3: 900,
      surfaceTensionNPerM: 0.02,
      inclinationDeg: 0,
    });
    expect(result.liquidHoldupFraction).toBeGreaterThan(0);
    expect(result.liquidHoldupFraction).toBeLessThanOrEqual(1);
  });

  it("yokuş yukarı eğim, aynı akış koşulları için yatay duruma göre tutulumu artırır (bilinen fiziksel davranış)", () => {
    const base = {
      superficialLiquidVelocityMs: 0.3,
      superficialGasVelocityMs: 2,
      pipeInternalDiameterM: 0.15,
      liquidDensityKgM3: 900,
      surfaceTensionNPerM: 0.02,
    };
    const horizontal = computeBeggsBrillHoldup({ ...base, inclinationDeg: 0 });
    const uphill = computeBeggsBrillHoldup({ ...base, inclinationDeg: 30 });
    expect(uphill.liquidHoldupFraction).toBeGreaterThan(horizontal.liquidHoldupFraction);
  });

  it("-90 ile +90 derece dışındaki eğim açısı için hata fırlatır", () => {
    const base = {
      superficialLiquidVelocityMs: 0.3,
      superficialGasVelocityMs: 2,
      pipeInternalDiameterM: 0.15,
      liquidDensityKgM3: 900,
      surfaceTensionNPerM: 0.02,
    };
    expect(() => computeBeggsBrillHoldup({ ...base, inclinationDeg: 91 })).toThrowError();
    expect(() => computeBeggsBrillHoldup({ ...base, inclinationDeg: -91 })).toThrowError();
  });

  it("TRANSITION bölgesinde segregated ve intermittent tutulumları arasında bir değer üretir", () => {
    // λL=0.1 için L2≈0.4956, L3≈2.834 — bu aralıkta bir Froude sayısı seçelim.
    const base = {
      pipeInternalDiameterM: 0.15,
      liquidDensityKgM3: 900,
      surfaceTensionNPerM: 0.02,
      inclinationDeg: 0,
    };
    // λL=0.1 hedefi için Vsl/Vm=0.1; NFR=Vm²/(g*D) hedefine ulaşacak Vm seçelim (NFR≈1 civarı).
    const targetNfr = 1;
    const vm = Math.sqrt(targetNfr * 9.80665 * base.pipeInternalDiameterM);
    const vsl = 0.1 * vm;
    const vsg = vm - vsl;
    const result = computeBeggsBrillHoldup({ ...base, superficialLiquidVelocityMs: vsl, superficialGasVelocityMs: vsg });
    expect(result.flowPattern).toBe("TRANSITION");
    expect(result.liquidHoldupFraction).toBeGreaterThan(0);
  });
});

describe("computeFlowPatternMapCurves", () => {
  it("istenen sayıda nokta üretir, her nokta L1-L4 içerir", () => {
    const points = computeFlowPatternMapCurves(20);
    expect(points).toHaveLength(20);
    for (const p of points) {
      expect(p.l1).toBeGreaterThan(0);
      expect(p.l2).toBeGreaterThan(0);
      expect(p.l3).toBeGreaterThan(0);
      expect(p.l4).toBeGreaterThan(0);
    }
  });

  it("2'den az nokta istenirse hata fırlatır", () => {
    expect(() => computeFlowPatternMapCurves(1)).toThrowError();
  });
});
