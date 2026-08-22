// apps/web/tests/viewer3d/demoTimeDependentField.test.ts

import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  DEMO_SCENARIOS,
  computeDemoBreachYear,
  computeDemoDamageIntensity,
  computeDemoTimeDependentDamageMm,
  computeDemoTimeDependentField,
} from "../../src/features/viewer3d/timeSlider/demoTimeDependentField";

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

const [SCENARIO] = DEMO_SCENARIOS;

describe("computeDemoDamageIntensity", () => {
  it("her zaman [0,1] aralığındadır", () => {
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const value = computeDemoDamageIntensity(i / 10, j / 10, SCENARIO.hotspotSeed);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("farklı hotspotSeed değerleri farklı desenler üretir", () => {
    const a = computeDemoDamageIntensity(0.3, 0.3, 0);
    const b = computeDemoDamageIntensity(0.3, 0.3, 2);
    expect(a).not.toBeCloseTo(b, 6);
  });
});

describe("computeDemoTimeDependentDamageMm", () => {
  it("t=0'da hasar sıfırdır (her (u,v) için)", () => {
    expect(computeDemoTimeDependentDamageMm(0.5, 0.5, 0, SCENARIO)).toBe(0);
  });

  it("hasar zamanla MONOTON ARTAR (aynı (u,v) için)", () => {
    const at5 = computeDemoTimeDependentDamageMm(0.17, 0.37, 5, SCENARIO);
    const at10 = computeDemoTimeDependentDamageMm(0.17, 0.37, 10, SCENARIO);
    const at20 = computeDemoTimeDependentDamageMm(0.17, 0.37, 20, SCENARIO);
    expect(at10).toBeGreaterThan(at5);
    expect(at20).toBeGreaterThan(at10);
  });

  it("hasar t ile DOĞRUSAL ölçeklenir (yoğunluk sabitken)", () => {
    const at10 = computeDemoTimeDependentDamageMm(0.17, 0.37, 10, SCENARIO);
    const at20 = computeDemoTimeDependentDamageMm(0.17, 0.37, 20, SCENARIO);
    expect(at20).toBeCloseTo(at10 * 2, 6);
  });

  it("elapsedYears negatifse hata fırlatır", () => {
    expect(() => computeDemoTimeDependentDamageMm(0.5, 0.5, -1, SCENARIO)).toThrow();
  });
});

describe("computeDemoBreachYear", () => {
  it("wtMm / peakRateMmPerYear'a eşittir", () => {
    expect(computeDemoBreachYear(10, SCENARIO)).toBeCloseTo(10 / SCENARIO.peakRateMmPerYear, 10);
  });

  it("peakRateMmPerYear<=0 için Infinity döner (asla delinmez)", () => {
    expect(computeDemoBreachYear(10, { ...SCENARIO, peakRateMmPerYear: 0 })).toBe(Infinity);
  });

  it("wtMm<=0 için hata fırlatır", () => {
    expect(() => computeDemoBreachYear(0, SCENARIO)).toThrow();
  });
});

describe("computeDemoTimeDependentField", () => {
  const geometry = buildTestGeometry(12, 12);

  it("uv attribute'u olmayan geometride Türkçe hata fırlatır", () => {
    const bare = new BufferGeometry();
    expect(() => computeDemoTimeDependentField(bare, 5, SCENARIO)).toThrow(/uv/);
  });

  it("sonuç uzunluğu vertex sayısına eşit ve tüm değerler sonlu/negatif-olmayan", () => {
    const values = computeDemoTimeDependentField(geometry, 8, SCENARIO);
    expect(values.length).toBe(geometry.getAttribute("uv").count);
    for (let i = 0; i < values.length; i++) {
      expect(Number.isFinite(values[i])).toBe(true);
      expect(values[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("t=0'da tüm değerler sıfırdır", () => {
    const values = computeDemoTimeDependentField(geometry, 0, SCENARIO);
    for (let i = 0; i < values.length; i++) {
      expect(values[i]).toBe(0);
    }
  });

  it.each(DEMO_SCENARIOS)("her senaryo için çalışır ve id'si benzersizdir (%o)", (scenario) => {
    const values = computeDemoTimeDependentField(geometry, 5, scenario);
    expect(values.length).toBeGreaterThan(0);
  });
});

describe("DEMO_SCENARIOS", () => {
  it("tüm senaryo id'leri benzersizdir", () => {
    const ids = DEMO_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tüm tepe hızları pozitiftir", () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.peakRateMmPerYear).toBeGreaterThan(0);
    }
  });
});
