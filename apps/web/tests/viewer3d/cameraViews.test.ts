// apps/web/tests/viewer3d/cameraViews.test.ts

import { describe, expect, it } from "vitest";
import {
  QUICK_VIEW_PRESETS,
  computeFitDistanceM,
  computeOrthoFitZoom,
  computeQuickViewCameraPositionM,
  getQuickViewDirection,
  getQuickViewUp,
} from "../../src/features/viewer3d/cameraViews";

describe("getQuickViewDirection", () => {
  it.each(QUICK_VIEW_PRESETS)("her ön ayar için birim vektör döner (%s)", (preset) => {
    const [x, y, z] = getQuickViewDirection(preset);
    expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 10);
  });

  it("ÖN görünüm +Z ekseninde, ÜST +Y'de, YAN +X'te", () => {
    expect(getQuickViewDirection("FRONT")).toEqual([0, 0, 1]);
    expect(getQuickViewDirection("TOP")).toEqual([0, 1, 0]);
    expect(getQuickViewDirection("SIDE")).toEqual([1, 0, 0]);
  });

  it("İZO görünüm üç eksende eşit bileşenli", () => {
    const [x, y, z] = getQuickViewDirection("ISO");
    expect(x).toBeCloseTo(y, 10);
    expect(y).toBeCloseTo(z, 10);
  });
});

describe("getQuickViewUp", () => {
  it("ÜST görünüm dışında her zaman +Y", () => {
    expect(getQuickViewUp("FRONT")).toEqual([0, 1, 0]);
    expect(getQuickViewUp("SIDE")).toEqual([0, 1, 0]);
    expect(getQuickViewUp("ISO")).toEqual([0, 1, 0]);
  });

  it("ÜST görünümde dejenere olmayan farklı bir up vektörü kullanılır", () => {
    expect(getQuickViewUp("TOP")).toEqual([0, 0, -1]);
  });
});

describe("computeFitDistanceM", () => {
  it("fov=90°'de mesafe = yarıçap×payFactor/sin(45°) (kapalı-form sınır durumu)", () => {
    const distance = computeFitDistanceM(1, 90, 1);
    expect(distance).toBeCloseTo(1 / Math.sin(Math.PI / 4), 10);
  });

  it("daha büyük yarıçap her zaman daha büyük mesafe gerektirir", () => {
    expect(computeFitDistanceM(2, 45)).toBeGreaterThan(computeFitDistanceM(1, 45));
  });

  it("daha büyük fov (daha geniş açı) her zaman daha KÜÇÜK mesafe gerektirir", () => {
    expect(computeFitDistanceM(1, 90)).toBeLessThan(computeFitDistanceM(1, 30));
  });

  it("marginFactor doğrusal olarak mesafeyi ölçekler", () => {
    const base = computeFitDistanceM(1, 45, 1);
    const withMargin = computeFitDistanceM(1, 45, 2);
    expect(withMargin).toBeCloseTo(base * 2, 10);
  });

  it.each([0, -1])("boundingRadiusM<=0 için hata fırlatır (%s)", (r) => {
    expect(() => computeFitDistanceM(r, 45)).toThrow();
  });

  it.each([0, 180, -10, 200])("verticalFovDeg (0,180) dışında hata fırlatır (%s)", (fov) => {
    expect(() => computeFitDistanceM(1, fov)).toThrow();
  });
});

describe("computeQuickViewCameraPositionM", () => {
  it("hedef merkezden yön×mesafe kadar uzaklaşır", () => {
    const target: [number, number, number] = [5, 0, 0];
    const [x, y, z] = computeQuickViewCameraPositionM("FRONT", target, 1, 45, 2);
    const expectedDistance = computeFitDistanceM(1, 45, 2);
    expect(x).toBeCloseTo(5, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(expectedDistance, 10);
  });

  it("hedef orijin değilse konum hedefe göre öteleniyor (mutlak sıfır değil)", () => {
    const [x, y, z] = computeQuickViewCameraPositionM("TOP", [1, 2, 3], 0.5, 45);
    expect(x).toBeCloseTo(1, 10);
    expect(z).toBeCloseTo(3, 10);
    expect(y).toBeGreaterThan(2);
  });
});

describe("computeOrthoFitZoom", () => {
  it("viewport yarı-yüksekliği = yarıçap×pay ise zoom=1", () => {
    expect(computeOrthoFitZoom(2, 2 * 1.35, 1.35)).toBeCloseTo(1, 10);
  });

  it("daha büyük yarıçap her zaman daha KÜÇÜK zoom gerektirir (nesne uzaklaşmış gibi görünür)", () => {
    expect(computeOrthoFitZoom(4, 500)).toBeLessThan(computeOrthoFitZoom(1, 500));
  });

  it.each([0, -1])("boundingRadiusM<=0 için hata fırlatır (%s)", (r) => {
    expect(() => computeOrthoFitZoom(r, 500)).toThrow();
  });

  it.each([0, -1])("viewportHalfHeightPx<=0 için hata fırlatır (%s)", (v) => {
    expect(() => computeOrthoFitZoom(1, v)).toThrow();
  });
});
