// apps/web/tests/viewer3d/sectionPlaneMath.test.ts

import { describe, expect, it } from "vitest";
import {
  computeSectionOffsetRangeM,
  computeSectionPlaneConstant,
  computeSectionPlaneEquation,
  computeSectionPlaneNormal,
} from "../../src/features/viewer3d/sectionPlane/sectionPlaneMath";

const ZERO_ANGLES = { thetaDeg: 0, phiDeg: 0 };

describe("computeSectionPlaneNormal", () => {
  it("X/Y/Z ön ayarları birim eksen vektörlerini döner", () => {
    expect(computeSectionPlaneNormal("X", ZERO_ANGLES)).toEqual([1, 0, 0]);
    expect(computeSectionPlaneNormal("Y", ZERO_ANGLES)).toEqual([0, 1, 0]);
    expect(computeSectionPlaneNormal("Z", ZERO_ANGLES)).toEqual([0, 0, 1]);
  });

  it("FREE modu θ=0'da Z ön ayarıyla SÜREKLİDİR (φ ne olursa olsun)", () => {
    const [x, y, z] = computeSectionPlaneNormal("FREE", { thetaDeg: 0, phiDeg: 137 });
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(1, 10);
  });

  it("FREE modu θ=90°/φ=0°'da X ön ayarıyla SÜREKLİDİR", () => {
    const [x, y, z] = computeSectionPlaneNormal("FREE", { thetaDeg: 90, phiDeg: 0 });
    expect(x).toBeCloseTo(1, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it("FREE modu θ=90°/φ=90°'da Y ön ayarıyla SÜREKLİDİR", () => {
    const [x, y, z] = computeSectionPlaneNormal("FREE", { thetaDeg: 90, phiDeg: 90 });
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(z).toBeCloseTo(0, 10);
  });

  it("FREE modu HER ZAMAN birim vektör üretir", () => {
    for (const [thetaDeg, phiDeg] of [
      [30, 45],
      [60, 200],
      [120, 10],
    ]) {
      const [x, y, z] = computeSectionPlaneNormal("FREE", { thetaDeg, phiDeg });
      expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 10);
    }
  });
});

describe("computeSectionPlaneConstant", () => {
  it("orijinden geçen düzlem (offset=0) sabiti 0'dır", () => {
    expect(computeSectionPlaneConstant(0)).toBeCloseTo(0, 10);
  });

  it("normal·(normal×offset)+constant=0 sağlanır (birim normal varsayımıyla)", () => {
    const offsetM = 1.75;
    const constant = computeSectionPlaneConstant(offsetM);
    // nokta = normal*offsetM, normal birim vektör varsayıldığından normal·nokta = offsetM
    expect(offsetM + constant).toBeCloseTo(0, 10);
  });
});

describe("computeSectionPlaneEquation", () => {
  it("axis+offset+angles'ı tek bir düzlem denklemine birleştirir", () => {
    const eq = computeSectionPlaneEquation("X", 0.5, ZERO_ANGLES);
    expect(eq.normal).toEqual([1, 0, 0]);
    expect(eq.constant).toBeCloseTo(-0.5, 10);
  });
});

describe("computeSectionOffsetRangeM", () => {
  it("X ekseni [0, lengthM] aralığı verir (borunun İÇİNDE)", () => {
    expect(computeSectionOffsetRangeM("X", 4, 0.2)).toEqual([0, 4]);
  });

  it("Y/Z/FREE eksenleri dış yarıçapla simetrik sınırlanır", () => {
    expect(computeSectionOffsetRangeM("Y", 4, 0.2)).toEqual([-0.2, 0.2]);
    expect(computeSectionOffsetRangeM("Z", 4, 0.2)).toEqual([-0.2, 0.2]);
    expect(computeSectionOffsetRangeM("FREE", 4, 0.2)).toEqual([-0.2, 0.2]);
  });

  it.each([0, -1])("lengthM<=0 için hata fırlatır (%s)", (l) => {
    expect(() => computeSectionOffsetRangeM("X", l, 0.2)).toThrow();
  });

  it.each([0, -1])("outerRadiusM<=0 için hata fırlatır (%s)", (r) => {
    expect(() => computeSectionOffsetRangeM("X", 4, r)).toThrow();
  });
});
