// apps/web/tests/viewer3d/vertexColorBaking.test.ts

import { describe, expect, it } from "vitest";
import { bakeVertexColors, computeVertexColorRgb } from "../../src/features/viewer3d/export/vertexColorBaking";
import { sampleColormap } from "../../src/shaders/colormaps";

describe("computeVertexColorRgb", () => {
  it("minValue'da colormap'in t=0 rengini döner", () => {
    expect(computeVertexColorRgb(0, 0, 10, "corrosion", false)).toEqual(sampleColormap("corrosion", 0));
  });

  it("maxValue'da colormap'in t=1 rengini döner", () => {
    expect(computeVertexColorRgb(10, 0, 10, "corrosion", false)).toEqual(sampleColormap("corrosion", 1));
  });

  it("invertColormap=true iken t'yi ters çevirir", () => {
    expect(computeVertexColorRgb(0, 0, 10, "corrosion", true)).toEqual(sampleColormap("corrosion", 1));
    expect(computeVertexColorRgb(10, 0, 10, "corrosion", true)).toEqual(sampleColormap("corrosion", 0));
  });

  it("aralık dışı değerleri [0,1]'e kırpar (patlamaz)", () => {
    expect(computeVertexColorRgb(-100, 0, 10, "corrosion", false)).toEqual(sampleColormap("corrosion", 0));
    expect(computeVertexColorRgb(100, 0, 10, "corrosion", false)).toEqual(sampleColormap("corrosion", 1));
  });

  it("NaN değeri minValue'ymış gibi ele alır (çökmez)", () => {
    expect(computeVertexColorRgb(NaN, 0, 10, "corrosion", false)).toEqual(sampleColormap("corrosion", 0));
  });
});

describe("bakeVertexColors", () => {
  it("her değer için 3 float (RGB) üretir", () => {
    const values = new Float32Array([0, 5, 10]);
    const colors = bakeVertexColors(values, 0, 10, "viridis", false);
    expect(colors.length).toBe(9);
  });

  it("her bileşen [0,1] aralığındadır", () => {
    const values = new Float32Array([0, 3, 7, 10]);
    const colors = bakeVertexColors(values, 0, 10, "turbo", false);
    for (let i = 0; i < colors.length; i++) {
      expect(colors[i]).toBeGreaterThanOrEqual(0);
      expect(colors[i]).toBeLessThanOrEqual(1);
    }
  });

  it("ilk üçlü computeVertexColorRgb'nin ilk değeriyle eşleşir (Float32 depolama hassasiyetiyle)", () => {
    const values = new Float32Array([2.5, 6]);
    const colors = bakeVertexColors(values, 0, 10, "plasma", false);
    const [r, g, b] = computeVertexColorRgb(2.5, 0, 10, "plasma", false);
    // `colors` bir Float32Array — 64-bit `r/g/b` değerlerine göre ~1e-7 mertebesinde
    // depolama yuvarlaması BEKLENİR, bu bir hata değildir.
    expect(colors[0]).toBeCloseTo(r, 6);
    expect(colors[1]).toBeCloseTo(g, 6);
    expect(colors[2]).toBeCloseTo(b, 6);
  });
});
