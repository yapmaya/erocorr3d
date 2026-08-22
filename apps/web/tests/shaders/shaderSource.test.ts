// apps/web/tests/shaders/shaderSource.test.ts
//
// "Shader derleniyor" testinin bu ortamdaki gerçekçi karşılığı: bu sandbox'ta
// gerçek bir WebGL bağlamı (headless-gl vb.) YOK — bkz. proje hafızası,
// aynı "tarayıcı eklentisi bağlı değil" kısıtı 3+ oturumdur tekrarlanıyor.
// Bu yüzden GERÇEK GPU derlemesi burada test EDİLEMEZ. Bunun yerine GLSL
// kaynak string'lerinin damageHeatmapMaterial.ts'in beklediği uniform/
// attribute isimleriyle TUTARLI olduğunu ve temel söz dizimi bütünlüğünü
// (dengeli parantez, tek main()) regex ile kontrol eder — isim
// uyuşmazlığı/yazım hatalarını yakalar, gerçek derleme hatalarını YAKALAMAZ.

import { describe, expect, it } from "vitest";
import fragmentSource from "../../src/shaders/heatmap.frag.glsl?raw";
import vertexSource from "../../src/shaders/heatmap.vert.glsl?raw";
import { DamageHeatmapMaterial } from "../../src/shaders/damageHeatmapMaterial";

function countChar(source: string, char: string): number {
  return source.split(char).length - 1;
}

describe("heatmap shader kaynak tutarlılığı", () => {
  it("parantez ve süslü parantezler dengeli (vertex)", () => {
    expect(countChar(vertexSource, "{")).toBe(countChar(vertexSource, "}"));
    expect(countChar(vertexSource, "(")).toBe(countChar(vertexSource, ")"));
  });

  it("parantez ve süslü parantezler dengeli (fragment)", () => {
    expect(countChar(fragmentSource, "{")).toBe(countChar(fragmentSource, "}"));
    expect(countChar(fragmentSource, "(")).toBe(countChar(fragmentSource, ")"));
  });

  it("her iki shader'da da tam olarak bir main() fonksiyonu var", () => {
    expect((vertexSource.match(/void\s+main\s*\(/g) ?? []).length).toBe(1);
    expect((fragmentSource.match(/void\s+main\s*\(/g) ?? []).length).toBe(1);
  });

  it("damageHeatmapMaterial.ts'in tanımladığı HER uniform, shader kaynağının birinde deklare edilmiş", () => {
    const material = new DamageHeatmapMaterial();
    const combined = `${vertexSource}\n${fragmentSource}`;
    for (const uniformName of Object.keys(material.uniforms)) {
      const pattern = new RegExp(`uniform\\s+\\S+\\s+${uniformName}\\s*;`);
      expect(combined, `uniform '${uniformName}' shader kaynağında deklare edilmemiş`).toMatch(pattern);
    }
    material.dispose();
  });

  it("vertex shader 'damage' attribute'unu deklare eder ve kullanır", () => {
    expect(vertexSource).toMatch(/attribute\s+float\s+damage\s*;/);
    expect(vertexSource).toMatch(/vDamage\s*=\s*damage\s*;/);
  });

  it("fragment shader NaN için erken siyah çıkış içerir (self-inequality tekniği)", () => {
    expect(fragmentSource).toMatch(/vDamage\s*!=\s*vDamage/);
    expect(fragmentSource).toMatch(/gl_FragColor\s*=\s*vec4\(0\.0,\s*0\.0,\s*0\.0,\s*uOpacity\)/);
  });

  it("fragment shader Infinity koruması içerir", () => {
    expect(fragmentSource).toMatch(/1\.0e30/);
  });

  it("fragment shader iso-kontur için fwidth kullanır", () => {
    expect(fragmentSource).toMatch(/fwidth\(/);
  });

  it("fragment shader cameraPosition (Fresnel için, three.js built-in) kullanır", () => {
    expect(fragmentSource).toMatch(/cameraPosition/);
  });
});
