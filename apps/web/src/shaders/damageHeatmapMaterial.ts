// apps/web/src/shaders/damageHeatmapMaterial.ts
//
// `damage` (veya seçili görselleştirme modunun) skaler alanını renge çeviren
// özel ShaderMaterial. Dikkat: attribute adı `damage`dır ama HER ZAMAN
// "mm cinsinden aşınma" anlamına gelmez — çağıran taraf (ör. GeometryLab'in
// ısı haritası paneli) seçili moda göre (KALAN DUVAR/HIZ/KALAN ÖMÜR/...)
// FARKLI bir skaler diziyi bu attribute'a yazabilir; isim, geometrinin
// zaten `geometry/helpers.ts::allocateDamageAttribute` ile ayırdığı
// attribute ile tutarlılık için korunmuştur.

import { BufferAttribute, BufferGeometry, DoubleSide, Plane, ShaderMaterial, Vector3, type Texture } from "three";
import fragmentShaderSource from "./heatmap.frag.glsl?raw";
import vertexShaderSource from "./heatmap.vert.glsl?raw";
import { createColormapTexture, type ColormapName } from "./colormaps";

export interface DamageHeatmapMaterialOptions {
  colormap?: ColormapName;
  minValue?: number;
  maxValue?: number;
  opacity?: number;
  thresholdWarn?: number;
  thresholdCritical?: number;
  wallThicknessMm?: number;
  isoStepMm?: number;
  deformEnabled?: boolean;
  deformExaggeration?: number;
  invertColormap?: boolean;
  lightDirection?: Vector3;
}

const DEFAULT_LIGHT_DIRECTION = new Vector3(0.4, 0.8, 0.5).normalize();

const DEFAULTS: Required<DamageHeatmapMaterialOptions> = {
  colormap: "corrosion",
  minValue: 0,
  maxValue: 1,
  opacity: 1,
  thresholdWarn: 0.6,
  thresholdCritical: 0.85,
  // 0 => "duvar delindi" tehlike deseni devre dışı (bkz. heatmap.frag.glsl::breached), varsayılan güvenli.
  wallThicknessMm: 0,
  isoStepMm: 0.5,
  deformEnabled: false,
  deformExaggeration: 1,
  invertColormap: false,
  lightDirection: DEFAULT_LIGHT_DIRECTION,
};

export class DamageHeatmapMaterial extends ShaderMaterial {
  private activeColormapName: ColormapName;

  constructor(options: DamageHeatmapMaterialOptions = {}) {
    const merged = { ...DEFAULTS, ...options };
    const colormapTexture = createColormapTexture(merged.colormap);

    super({
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
      side: DoubleSide,
      transparent: merged.opacity < 1,
      uniforms: {
        uMinValue: { value: merged.minValue },
        uMaxValue: { value: merged.maxValue },
        uColormapTexture: { value: colormapTexture as Texture },
        uOpacity: { value: merged.opacity },
        uThresholdWarn: { value: merged.thresholdWarn },
        uThresholdCritical: { value: merged.thresholdCritical },
        uWallThicknessMm: { value: merged.wallThicknessMm },
        uIsoStepMm: { value: merged.isoStepMm },
        uTime: { value: 0 },
        uDeformEnabled: { value: merged.deformEnabled },
        uDeformExaggeration: { value: merged.deformExaggeration },
        uInvertColormap: { value: merged.invertColormap },
        uLightDirection: { value: merged.lightDirection.clone() },
        uClipEnabled: { value: false },
        uClipPlaneNormal: { value: new Vector3(0, 0, 1) },
        uClipPlaneConstant: { value: 0 },
      },
    });

    this.activeColormapName = merged.colormap;
  }

  get colormapName(): ColormapName {
    return this.activeColormapName;
  }

  setColormap(name: ColormapName): void {
    if (name === this.activeColormapName) return;
    const oldTexture = this.uniforms.uColormapTexture.value as Texture | null;
    oldTexture?.dispose();
    this.uniforms.uColormapTexture.value = createColormapTexture(name);
    this.activeColormapName = name;
  }

  setRange(minValue: number, maxValue: number): void {
    this.uniforms.uMinValue.value = minValue;
    this.uniforms.uMaxValue.value = Math.max(maxValue, minValue + 1e-6);
  }

  setThresholds(thresholdWarn: number, thresholdCritical: number): void {
    this.uniforms.uThresholdWarn.value = thresholdWarn;
    this.uniforms.uThresholdCritical.value = thresholdCritical;
  }

  setWallThicknessMm(wallThicknessMm: number): void {
    this.uniforms.uWallThicknessMm.value = wallThicknessMm;
  }

  setIsoStepMm(isoStepMm: number): void {
    this.uniforms.uIsoStepMm.value = Math.max(isoStepMm, 1e-4);
  }

  setOpacity(opacity: number): void {
    this.uniforms.uOpacity.value = opacity;
    this.transparent = opacity < 1;
  }

  setDeform(enabled: boolean, exaggeration: number): void {
    this.uniforms.uDeformEnabled.value = enabled;
    this.uniforms.uDeformExaggeration.value = exaggeration;
  }

  setInvertColormap(invert: boolean): void {
    this.uniforms.uInvertColormap.value = invert;
  }

  /**
   * Kesit düzlemini uygular (world-space). `null` → kırpma kapalı.
   * Yön kuralı `components/three/SectionStencilPasses.tsx`'in kullandığı
   * üç.js `clippingPlanes` ile AYNIDIR: `plane.normal·nokta+plane.constant
   * ≥ 0` olan taraf TUTULUR (bkz. heatmap.frag.glsl'in kendi açıklaması).
   */
  setClipPlane(plane: Plane | null): void {
    this.uniforms.uClipEnabled.value = plane !== null;
    if (plane) {
      this.uniforms.uClipPlaneNormal.value.copy(plane.normal);
      this.uniforms.uClipPlaneConstant.value = plane.constant;
    }
  }

  /** Nabız animasyonu için — `useFrame`de her karede `delta` (saniye) ile çağrılır. */
  advanceTime(deltaSeconds: number): void {
    this.uniforms.uTime.value += deltaSeconds;
  }

  override dispose(): void {
    (this.uniforms.uColormapTexture.value as Texture | null)?.dispose();
    super.dispose();
  }
}

/**
 * `damage` (Float32) girdi dizisini GPU'ya yüklemeden önce güvenli hale getirir:
 * NaN/±Infinity değerlerini 0'a sabitler. Fragment shader'ın kendi NaN/Infinity
 * koruması (bkz. heatmap.frag.glsl) bu fonksiyonun bir YEDEĞİDİR, yerine geçmez —
 * bazı GPU sürücülerinde bozuk float'ların GPU'ya yüklenmesi tanımsız davranışa
 * yol açabilir, bu yüzden CPU tarafında da temizlenir.
 */
export function sanitizeScalarValues(values: Float32Array): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out[i] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

/** Bir BufferGeometry'nin `damage` attribute'unu YENİ bir skaler dizi ile günceller. */
export function writeDamageAttribute(geometry: BufferGeometry, values: Float32Array): void {
  const attribute = geometry.getAttribute("damage") as BufferAttribute | undefined;
  if (!attribute) {
    throw new Error("Geometride 'damage' attribute'u bulunamadı. Önce helpers.ts::allocateDamageAttribute çağrılmalı.");
  }
  if (attribute.array.length !== values.length) {
    throw new Error(
      `'damage' attribute uzunluğu (${attribute.array.length}) ile verilen dizi uzunluğu (${values.length}) eşleşmiyor.`,
    );
  }
  const safeValues = sanitizeScalarValues(values);
  (attribute.array as Float32Array).set(safeValues);
  attribute.needsUpdate = true;
}
