// packages/engine/tests/spatial/sampling.test.ts

import { describe, expect, it } from "vitest";
import { sampleSpatialDamageFieldMm } from "../../src/spatial/sampling";
import type { SpatialDamageField } from "../../src/types/results";

function buildField(resolutionU: number, resolutionV: number, fn: (u: number, v: number) => number): SpatialDamageField {
  const valuesMm = new Float32Array(resolutionU * resolutionV);
  for (let iv = 0; iv < resolutionV; iv++) {
    for (let iu = 0; iu < resolutionU; iu++) {
      const u = (iu + 0.5) / resolutionU;
      const v = (iv + 0.5) / resolutionV;
      valuesMm[iv * resolutionU + iu] = fn(u, v);
    }
  }
  return {
    parameterization: "CYLINDRICAL_UV",
    resolutionU,
    resolutionV,
    valuesMm,
    maxValueMm: Math.max(...valuesMm),
    maxLocation: { u: 0.5, v: 0.5, descriptionTr: "test", clockPosition: 6 },
    hotspots: [],
  };
}

describe("sampleSpatialDamageFieldMm", () => {
  it("tam hücre merkezinde sorgulanınca o hücrenin değerini birebir döndürür", () => {
    const field = buildField(8, 8, (u) => u * 10);
    for (let iu = 0; iu < 8; iu++) {
      const u = (iu + 0.5) / 8;
      expect(sampleSpatialDamageFieldMm(field, u, 0.5)).toBeCloseTo(u * 10, 5);
    }
  });

  it("sabit bir alanda her (u,v) noktası aynı değeri döndürür", () => {
    const field = buildField(16, 16, () => 3.5);
    expect(sampleSpatialDamageFieldMm(field, 0.1, 0.9)).toBeCloseTo(3.5, 5);
    expect(sampleSpatialDamageFieldMm(field, 0.99, 0.01)).toBeCloseTo(3.5, 5);
  });

  it("doğrusal bir eksenel gradyanı ARA noktalarda doğru enterpole eder", () => {
    const field = buildField(4, 4, (u) => u); // 0,0.25,0.5,0.75 hücre merkezleri
    // u=0.375, iki hücre (0.25 ve 0.5) arasının tam ortası → ~0.375 beklenir
    expect(sampleSpatialDamageFieldMm(field, 0.375, 0.5)).toBeCloseTo(0.375, 2);
  });

  it("v ekseninde dairesel sarma yapar (v=0 ile v=1 aynı komşuluktadır)", () => {
    const field = buildField(4, 8, (_u, v) => (v < 0.5 ? 0 : 10));
    // v=0'a çok yakın bir nokta ile v=1'e çok yakın bir nokta, v ekseninde KOMŞU olmalı
    const nearZero = sampleSpatialDamageFieldMm(field, 0.5, 0.01);
    const nearOne = sampleSpatialDamageFieldMm(field, 0.5, 0.99);
    // ikisi de v=0 civarındaki düşük-değerli bölgeye yakın olmalı (periyodik sarma sayesinde patlama/süreksizlik olmamalı)
    expect(Math.abs(nearZero - nearOne)).toBeLessThan(10);
  });

  it("u sınırlarının dışına taşan sorgular kırpılır (0-1 aralığına)", () => {
    const field = buildField(8, 8, (u) => u * 100);
    expect(sampleSpatialDamageFieldMm(field, -5, 0.5)).toBeCloseTo(sampleSpatialDamageFieldMm(field, 0, 0.5), 3);
    expect(sampleSpatialDamageFieldMm(field, 5, 0.5)).toBeCloseTo(sampleSpatialDamageFieldMm(field, 1, 0.5), 3);
  });
});
