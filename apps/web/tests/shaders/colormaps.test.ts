// apps/web/tests/shaders/colormaps.test.ts

import { describe, expect, it } from "vitest";
import { LinearFilter, NearestFilter, RGBAFormat, UnsignedByteType } from "three";
import {
  COLORMAP_NAMES,
  COLORMAP_TEXTURE_WIDTH,
  DISCRETE4_COLORS,
  colormapToCssGradient,
  createColormapTexture,
  sampleColormap,
} from "../../src/shaders/colormaps";

describe("sampleColormap", () => {
  it.each(COLORMAP_NAMES)("t=0 ve t=1 sınır değerleri [0,1] RGB aralığında (%s)", (name) => {
    for (const t of [0, 1]) {
      const [r, g, b] = sampleColormap(name, t);
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each(COLORMAP_NAMES)("[0,1] dışındaki t değerleri kırpılır (clamp) (%s)", (name) => {
    expect(sampleColormap(name, -5)).toEqual(sampleColormap(name, 0));
    expect(sampleColormap(name, 5)).toEqual(sampleColormap(name, 1));
  });

  it("discrete4, sürekli değil TAM OLARAK 4 ayrı bant döndürür", () => {
    const seen = new Set<string>();
    for (let i = 0; i <= 100; i++) {
      seen.add(JSON.stringify(sampleColormap("discrete4", i / 100)));
    }
    expect(seen.size).toBe(4);
  });

  it("discrete4 bantları DISCRETE4_COLORS ile birebir eşleşir", () => {
    expect(sampleColormap("discrete4", 0.1)).toEqual(DISCRETE4_COLORS[0]);
    expect(sampleColormap("discrete4", 0.3)).toEqual(DISCRETE4_COLORS[1]);
    expect(sampleColormap("discrete4", 0.6)).toEqual(DISCRETE4_COLORS[2]);
    expect(sampleColormap("discrete4", 0.9)).toEqual(DISCRETE4_COLORS[3]);
  });

  it("NaN/Infinity girdisinde çökmez (net bir sonuç döner, throw etmez)", () => {
    expect(() => sampleColormap("corrosion", NaN)).not.toThrow();
    expect(() => sampleColormap("corrosion", Infinity)).not.toThrow();
    expect(() => sampleColormap("corrosion", -Infinity)).not.toThrow();
  });
});

describe("createColormapTexture", () => {
  it.each(COLORMAP_NAMES)("256×1 RGBA UnsignedByte doku üretir (%s)", (name) => {
    const texture = createColormapTexture(name);
    expect(texture.image.width).toBe(COLORMAP_TEXTURE_WIDTH);
    expect(texture.image.height).toBe(1);
    expect(texture.format).toBe(RGBAFormat);
    expect(texture.type).toBe(UnsignedByteType);
    expect((texture.image.data as Uint8Array).length).toBe(COLORMAP_TEXTURE_WIDTH * 4);
  });

  it("discrete4 NearestFilter, diğer paletler LinearFilter kullanır", () => {
    const discrete = createColormapTexture("discrete4");
    expect(discrete.minFilter).toBe(NearestFilter);
    expect(discrete.magFilter).toBe(NearestFilter);

    const continuous = createColormapTexture("corrosion");
    expect(continuous.minFilter).toBe(LinearFilter);
    expect(continuous.magFilter).toBe(LinearFilter);
  });

  it("alpha kanalı her zaman 255 (tam opak)", () => {
    const texture = createColormapTexture("viridis");
    const data = texture.image.data as Uint8Array;
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
    }
  });
});

describe("colormapToCssGradient", () => {
  it("geçerli bir CSS linear-gradient string'i üretir", () => {
    for (const name of COLORMAP_NAMES) {
      const css = colormapToCssGradient(name);
      expect(css.startsWith("linear-gradient(to top,")).toBe(true);
      expect(css.endsWith(")")).toBe(true);
    }
  });

  it("invert=true iken uçlardaki renkler ters çevrilir", () => {
    const normal = colormapToCssGradient("corrosion", 4, false);
    const inverted = colormapToCssGradient("corrosion", 4, true);
    expect(normal).not.toBe(inverted);
  });
});
