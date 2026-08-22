// apps/web/tests/viewer3d/sectionCapDimensions.test.ts

import { describe, expect, it } from "vitest";
import {
  computeAnnulusHatchTicks2D,
  computeWallThicknessDimensionLine2D,
} from "../../src/features/viewer3d/sectionPlane/sectionCapDimensions";

describe("computeAnnulusHatchTicks2D", () => {
  it("istenen sayıda çizgi üretir", () => {
    expect(computeAnnulusHatchTicks2D(0.2, 0.18, 24)).toHaveLength(24);
  });

  it("her çizginin orta noktası annulus'un ORTA yarıçapına yakındır", () => {
    const outerRadiusM = 0.2;
    const innerRadiusM = 0.16;
    const midRadiusM = (outerRadiusM + innerRadiusM) / 2;
    for (const tick of computeAnnulusHatchTicks2D(outerRadiusM, innerRadiusM, 16)) {
      const midX = (tick.start.x + tick.end.x) / 2;
      const midY = (tick.start.y + tick.end.y) / 2;
      expect(Math.sqrt(midX * midX + midY * midY)).toBeCloseTo(midRadiusM, 6);
    }
  });

  it("ilk çizginin yönü, radyal doğrultuyla YAKLAŞIK hatchAngleDeg açı yapar", () => {
    const [tick] = computeAnnulusHatchTicks2D(0.2, 0.16, 32, 45);
    // İlk tick açısı=0 → radyal yön=(1,0). Çizginin kendi yönü ile radyal
    // yön arasındaki açı hatchAngleDeg (45°) olmalı.
    const dirX = tick.end.x - tick.start.x;
    const dirY = tick.end.y - tick.start.y;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    const cosAngle = dirX / dirLen; // radyal yön (1,0) ile nokta çarpımı
    const angleDeg = (Math.acos(Math.abs(cosAngle)) * 180) / Math.PI;
    expect(angleDeg).toBeCloseTo(45, 3);
  });

  it.each([
    [0.1, 0.1],
    [0.1, 0.2],
  ])("outerRadiusM<=innerRadiusM için hata fırlatır (%s,%s)", (outer, inner) => {
    expect(() => computeAnnulusHatchTicks2D(outer, inner)).toThrow();
  });

  it("innerRadiusM negatifse hata fırlatır", () => {
    expect(() => computeAnnulusHatchTicks2D(0.2, -0.1)).toThrow();
  });

  it.each([2, 2.5])("tickCount<3 veya tam sayı değilse hata fırlatır (%s)", (n) => {
    expect(() => computeAnnulusHatchTicks2D(0.2, 0.1, n)).toThrow();
  });
});

describe("computeWallThicknessDimensionLine2D", () => {
  it("et kalınlığını mm cinsinden doğru hesaplar", () => {
    const result = computeWallThicknessDimensionLine2D(0.162, 0.1525);
    expect(result.wallThicknessMm).toBeCloseTo(9.5, 6);
  });

  it("başlangıç noktası iç yarıçapta, bitiş noktası dış yarıçapta", () => {
    const outerRadiusM = 0.2;
    const innerRadiusM = 0.18;
    const result = computeWallThicknessDimensionLine2D(outerRadiusM, innerRadiusM);
    const startDist = Math.sqrt(result.startXY.x ** 2 + result.startXY.y ** 2);
    const endDist = Math.sqrt(result.endXY.x ** 2 + result.endXY.y ** 2);
    expect(startDist).toBeCloseTo(innerRadiusM, 10);
    expect(endDist).toBeCloseTo(outerRadiusM, 10);
  });

  it("etiket konumu dış yarıçapın DIŞINDADIR (çakışmasın diye)", () => {
    const outerRadiusM = 0.2;
    const result = computeWallThicknessDimensionLine2D(outerRadiusM, 0.18);
    const labelDist = Math.sqrt(result.labelPositionXY.x ** 2 + result.labelPositionXY.y ** 2);
    expect(labelDist).toBeGreaterThan(outerRadiusM);
  });

  it.each([
    [0.1, 0.1],
    [0.1, 0.2],
  ])("outerRadiusM<=innerRadiusM için hata fırlatır (%s,%s)", (outer, inner) => {
    expect(() => computeWallThicknessDimensionLine2D(outer, inner)).toThrow();
  });

  it("innerRadiusM negatifse hata fırlatır", () => {
    expect(() => computeWallThicknessDimensionLine2D(0.2, -0.1)).toThrow();
  });
});
