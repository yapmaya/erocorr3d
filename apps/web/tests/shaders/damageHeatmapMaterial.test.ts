// apps/web/tests/shaders/damageHeatmapMaterial.test.ts

import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";
import {
  DamageHeatmapMaterial,
  sanitizeScalarValues,
  writeDamageAttribute,
} from "../../src/shaders/damageHeatmapMaterial";

function buildGeometryWithDamage(vertexCount: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3));
  geometry.setAttribute("damage", new Float32BufferAttribute(new Float32Array(vertexCount), 1));
  return geometry;
}

describe("sanitizeScalarValues", () => {
  it("NaN/+Infinity/-Infinity değerlerini 0'a çevirir, sonlu değerleri korur", () => {
    const input = new Float32Array([1.5, NaN, Infinity, -Infinity, -2.5, 0]);
    const out = sanitizeScalarValues(input);
    expect(Array.from(out)).toEqual([1.5, 0, 0, 0, -2.5, 0]);
  });

  it("orijinal diziyi mutasyona uğratmaz (yeni dizi döner)", () => {
    const input = new Float32Array([1, 2, 3]);
    const out = sanitizeScalarValues(input);
    expect(out).not.toBe(input);
    expect(Array.from(input)).toEqual([1, 2, 3]);
  });
});

describe("writeDamageAttribute", () => {
  it("'damage' attribute'u olmayan geometride Türkçe hata fırlatır", () => {
    const geometry = new BufferGeometry();
    expect(() => writeDamageAttribute(geometry, new Float32Array([1, 2]))).toThrow(/damage/);
  });

  it("uzunluk uyuşmazlığında hata fırlatır", () => {
    const geometry = buildGeometryWithDamage(4);
    expect(() => writeDamageAttribute(geometry, new Float32Array([1, 2]))).toThrow(/eşleşmiyor/);
  });

  it("değerleri yazar, sanitize eder ve needsUpdate=true yapar (version artışıyla doğrulanır — BufferAttribute.needsUpdate salt-yazılır)", () => {
    const geometry = buildGeometryWithDamage(3);
    const attribute = geometry.getAttribute("damage") as BufferAttribute;
    const versionBefore = attribute.version;
    writeDamageAttribute(geometry, new Float32Array([1, NaN, Infinity]));
    expect(Array.from(attribute.array as Float32Array)).toEqual([1, 0, 0]);
    expect(attribute.version).toBeGreaterThan(versionBefore);
  });
});

describe("DamageHeatmapMaterial", () => {
  it("varsayılan uniform değerleriyle kurulur", () => {
    const material = new DamageHeatmapMaterial();
    expect(material.uniforms.uMinValue.value).toBe(0);
    expect(material.uniforms.uMaxValue.value).toBe(1);
    expect(material.uniforms.uOpacity.value).toBe(1);
    expect(material.uniforms.uDeformEnabled.value).toBe(false);
    expect(material.uniforms.uInvertColormap.value).toBe(false);
    expect(material.colormapName).toBe("corrosion");
    material.dispose();
  });

  it("setRange, min<max olacak şekilde güvenli aralık kurar (max<=min ise minimumu zorlar)", () => {
    const material = new DamageHeatmapMaterial();
    material.setRange(2, 10);
    expect(material.uniforms.uMinValue.value).toBe(2);
    expect(material.uniforms.uMaxValue.value).toBe(10);

    material.setRange(5, 5);
    expect(material.uniforms.uMaxValue.value).toBeGreaterThan(material.uniforms.uMinValue.value);
    material.dispose();
  });

  it("setColormap eski texture'ı değiştirir ve colormapName günceller", () => {
    const material = new DamageHeatmapMaterial({ colormap: "corrosion" });
    const oldTexture = material.uniforms.uColormapTexture.value;
    material.setColormap("viridis");
    expect(material.colormapName).toBe("viridis");
    expect(material.uniforms.uColormapTexture.value).not.toBe(oldTexture);
    material.dispose();
  });

  it("aynı colormap'e tekrar setColormap çağrısı texture'ı DEĞİŞTİRMEZ (gereksiz realloc yok)", () => {
    const material = new DamageHeatmapMaterial({ colormap: "corrosion" });
    const texture = material.uniforms.uColormapTexture.value;
    material.setColormap("corrosion");
    expect(material.uniforms.uColormapTexture.value).toBe(texture);
    material.dispose();
  });

  it("setThresholds/setWallThicknessMm/setIsoStepMm/setDeform/setInvertColormap uniformları günceller", () => {
    const material = new DamageHeatmapMaterial();
    material.setThresholds(3, 6);
    material.setWallThicknessMm(12);
    material.setIsoStepMm(0.25);
    material.setDeform(true, 20);
    material.setInvertColormap(true);

    expect(material.uniforms.uThresholdWarn.value).toBe(3);
    expect(material.uniforms.uThresholdCritical.value).toBe(6);
    expect(material.uniforms.uWallThicknessMm.value).toBe(12);
    expect(material.uniforms.uIsoStepMm.value).toBe(0.25);
    expect(material.uniforms.uDeformEnabled.value).toBe(true);
    expect(material.uniforms.uDeformExaggeration.value).toBe(20);
    expect(material.uniforms.uInvertColormap.value).toBe(true);
    material.dispose();
  });

  it("setOpacity<1 iken transparent=true yapar", () => {
    const material = new DamageHeatmapMaterial();
    expect(material.transparent).toBe(false);
    material.setOpacity(0.5);
    expect(material.transparent).toBe(true);
    expect(material.uniforms.uOpacity.value).toBe(0.5);
    material.dispose();
  });

  it("advanceTime, uTime uniformunu biriktirir (nabız animasyonu)", () => {
    const material = new DamageHeatmapMaterial();
    material.advanceTime(0.5);
    material.advanceTime(0.25);
    expect(material.uniforms.uTime.value).toBeCloseTo(0.75, 6);
    material.dispose();
  });
});
