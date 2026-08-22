// packages/engine/tests/spatial/flowFieldLite.test.ts

import { describe, expect, it } from "vitest";
import { integrateOverUnitSquare, normalizeShapeFn } from "../../src/spatial/fields";
import {
  applyVelocityScaling,
  computeBendVelocityMultiplierField,
  computeReducerVelocityMultiplierField,
  computeVenaContractaVelocityMultiplier,
} from "../../src/spatial/flowFieldLite";

describe("computeBendVelocityMultiplierField", () => {
  it("extrados'ta (v=0) dış duvar çarpanını, intrados'ta (v=0,5) iç duvar çarpanını verir", () => {
    const field = computeBendVelocityMultiplierField();
    expect(field(0.5, 0)).toBeCloseTo(1.45, 6);
    expect(field(0.5, 0.5)).toBeCloseTo(0.7, 6);
  });

  it("u'dan bağımsızdır (yalnızca çevresel)", () => {
    const field = computeBendVelocityMultiplierField();
    expect(field(0.1, 0.25)).toBeCloseTo(field(0.9, 0.25), 9);
  });
});

describe("computeReducerVelocityMultiplierField", () => {
  it("boğazda (D1/D2)² kat artış verir (süreklilik denklemi)", () => {
    const field = computeReducerVelocityMultiplierField(0.2, 0.1, 0.15); // D1/D2=2 → 4×
    expect(field(0.9, 0)).toBeCloseTo(4, 1); // boğazdan çok sonra, tam artış
  });

  it("boğazdan önce çarpan ≈1'dir", () => {
    const field = computeReducerVelocityMultiplierField(0.2, 0.1, 0.15);
    expect(field(0.0, 0)).toBeCloseTo(1, 1);
  });

  it("eşit çaplarda çarpan her yerde 1'dir", () => {
    const field = computeReducerVelocityMultiplierField(0.15, 0.15);
    expect(field(0.5, 0)).toBeCloseTo(1, 6);
  });

  it("geçersiz çaplar için hata fırlatır", () => {
    expect(() => computeReducerVelocityMultiplierField(0, 0.1)).toThrowError();
  });
});

describe("computeVenaContractaVelocityMultiplier", () => {
  it("tam açıklıkta (1) çarpan 1/Cc'dir", () => {
    expect(computeVenaContractaVelocityMultiplier(1)).toBeCloseTo(1 / 0.61, 6);
  });

  it("açıklık azaldıkça çarpan artar", () => {
    const wide = computeVenaContractaVelocityMultiplier(0.8);
    const narrow = computeVenaContractaVelocityMultiplier(0.2);
    expect(narrow).toBeGreaterThan(wide);
  });

  it("[0,1] dışı açıklık için hata fırlatır", () => {
    expect(() => computeVenaContractaVelocityMultiplier(0)).toThrowError();
    expect(() => computeVenaContractaVelocityMultiplier(1.5)).toThrowError();
  });
});

describe("applyVelocityScaling", () => {
  it("sonucu yeniden normalize eder (∫∫≈1 korunur)", () => {
    const baseShape = normalizeShapeFn(() => 1, 300);
    const bendField = computeBendVelocityMultiplierField();
    const scaled = applyVelocityScaling(baseShape, bendField, 2.5);
    const integral = integrateOverUnitSquare(scaled, 300);
    expect(integral).toBeCloseTo(1, 2);
  });

  it("hız çarpanı yüksek olan bölgede şekli görece güçlendirir (extrados > intrados)", () => {
    const baseShape = normalizeShapeFn(() => 1, 300);
    const bendField = computeBendVelocityMultiplierField();
    const scaled = applyVelocityScaling(baseShape, bendField, 2);
    expect(scaled(0.5, 0)).toBeGreaterThan(scaled(0.5, 0.5));
  });

  it("exponentN pozitif olmalıdır", () => {
    const baseShape = normalizeShapeFn(() => 1);
    expect(() => applyVelocityScaling(baseShape, () => 1, 0)).toThrowError();
  });
});
