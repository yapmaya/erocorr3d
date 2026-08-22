// apps/web/tests/shaders/demoScalarField.test.ts

import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  HEATMAP_VISUALIZATION_MODES,
  computeDemoScalarField,
  isInvertedVisualizationMode,
} from "../../src/shaders/demoScalarField";

function buildTestGeometry(uCount: number, vCount: number): BufferGeometry {
  const uvs: number[] = [];
  const positions: number[] = [];
  for (let i = 0; i < uCount; i++) {
    for (let j = 0; j < vCount; j++) {
      uvs.push(i / (uCount - 1), j / (vCount - 1));
      positions.push(0, 0, 0);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(new Float32Array(uvs), 2));
  return geometry;
}

const DEMO_PARAMS = { wtMm: 10, maxDamageMm: 6, elapsedYears: 10 };

describe("computeDemoScalarField", () => {
  const geometry = buildTestGeometry(12, 12);

  it("uv attribute'u olmayan geometride Türkçe hata fırlatır", () => {
    const bare = new BufferGeometry();
    expect(() => computeDemoScalarField(bare, "DAMAGE", DEMO_PARAMS)).toThrow(/uv/);
  });

  it.each(HEATMAP_VISUALIZATION_MODES)("her mod için sonuç uzunluğu vertex sayısına eşit ve tüm değerler sonlu (%s)", (mode) => {
    const values = computeDemoScalarField(geometry, mode, DEMO_PARAMS);
    expect(values.length).toBe(geometry.getAttribute("uv").count);
    for (let i = 0; i < values.length; i++) {
      expect(Number.isFinite(values[i])).toBe(true);
    }
  });

  it("DAMAGE modu [0, maxDamageMm] aralığında kalır", () => {
    const values = computeDemoScalarField(geometry, "DAMAGE", DEMO_PARAMS);
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(0);
      expect(values[i]).toBeLessThanOrEqual(DEMO_PARAMS.maxDamageMm + 1e-9);
    }
  });

  it("REMAINING_WALL modu asla negatif olmaz (wtMm - hasar, sıfırda taban)", () => {
    const values = computeDemoScalarField(geometry, "REMAINING_WALL", { ...DEMO_PARAMS, maxDamageMm: 999 });
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("MECHANISM_MAP modu YALNIZCA {0,1,2,3} tam sayı değerleri üretir", () => {
    const values = computeDemoScalarField(geometry, "MECHANISM_MAP", DEMO_PARAMS);
    for (let i = 0; i < values.length; i++) {
      expect(Number.isInteger(values[i])).toBe(true);
      expect(values[i]).toBeGreaterThanOrEqual(0);
      expect(values[i]).toBeLessThanOrEqual(3);
    }
  });

  it("VELOCITY_FIELD modu [0.5, 3.0] çarpan aralığında kalır", () => {
    const values = computeDemoScalarField(geometry, "VELOCITY_FIELD", DEMO_PARAMS);
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(values[i]).toBeLessThanOrEqual(3.0 + 1e-9);
    }
  });

  it("aynı geometri+mod+parametre → aynı sonuç (saf fonksiyon)", () => {
    const a = computeDemoScalarField(geometry, "UNCERTAINTY", DEMO_PARAMS);
    const b = computeDemoScalarField(geometry, "UNCERTAINTY", DEMO_PARAMS);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("isInvertedVisualizationMode", () => {
  it("KALAN DUVAR ve KALAN ÖMÜR modları ters çevrilir (düşük değer = yüksek tehlike)", () => {
    expect(isInvertedVisualizationMode("REMAINING_WALL")).toBe(true);
    expect(isInvertedVisualizationMode("REMAINING_LIFE")).toBe(true);
  });

  it("diğer modlar ters çevrilmez", () => {
    for (const mode of ["DAMAGE", "RATE", "MECHANISM_MAP", "VELOCITY_FIELD", "UNCERTAINTY"] as const) {
      expect(isInvertedVisualizationMode(mode)).toBe(false);
    }
  });
});
