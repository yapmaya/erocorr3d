// apps/web/src/shaders/demoScalarField.ts
//
// ⚠ SENTETİK / DEMO VERİ ÜRETİCİSİ — gerçek `packages/engine/src/spatial/`
// katmanına (MechanismResult[] → SpatialDamageField zinciri) BAĞLI DEĞİLDİR.
// O üretim zinciri henüz kurulmadı (bkz. proje hafızası). Bu dosya, sadece
// Geometri Laboratuvarı'nda ısı haritası shader/material/lejant katmanını
// GÖRSEL OLARAK test edebilmek için, geometrinin var olan `uv` attribute'u
// üzerinden çok-tepeli bir sahte hasar deseni üretir. Hiçbir değeri
// mühendislik anlamında doğru kabul ETME — KDP bu dosyaya uygulanmaz çünkü
// burada "hesaplanan" bir mühendislik sonucu yok, salt görsel demo verisi var.

import type { BufferGeometry } from "three";

export type HeatmapVisualizationMode =
  | "DAMAGE"
  | "REMAINING_WALL"
  | "RATE"
  | "REMAINING_LIFE"
  | "MECHANISM_MAP"
  | "VELOCITY_FIELD"
  | "UNCERTAINTY";

export const HEATMAP_VISUALIZATION_MODES: HeatmapVisualizationMode[] = [
  "DAMAGE",
  "REMAINING_WALL",
  "RATE",
  "REMAINING_LIFE",
  "MECHANISM_MAP",
  "VELOCITY_FIELD",
  "UNCERTAINTY",
];

/** "Düşük değer = yüksek tehlike" anlamına gelen modlar — kırmızının her zaman tehlikeyi göstermesi için colormap ters örneklenmeli. */
export function isInvertedVisualizationMode(mode: HeatmapVisualizationMode): boolean {
  return mode === "REMAINING_WALL" || mode === "REMAINING_LIFE";
}

export interface DemoScalarFieldParams {
  /** Bileşenin et kalınlığı (mm) — KALAN DUVAR/KALAN ÖMÜR hesapları için. */
  wtMm: number;
  /** Sentetik en yüksek hasar tepe değeri (mm). */
  maxDamageMm: number;
  /** Sentetik "geçen yıl" varsayımı — HIZ/KALAN ÖMÜR hesapları için. */
  elapsedYears: number;
  /** Kaç adet sahte sıcak nokta (hotspot) üretileceği. */
  hotspotCount?: number;
}

type ResolvedParams = Required<DemoScalarFieldParams>;

const DEFAULT_HOTSPOT_COUNT = 3;

function resolveParams(params: DemoScalarFieldParams): ResolvedParams {
  return { hotspotCount: DEFAULT_HOTSPOT_COUNT, ...params };
}

/** v dairesel (0=1 dikişi) — iki nokta arası en kısa dairesel mesafe. */
function circularDelta(v: number, center: number): number {
  const raw = Math.abs(v - center);
  return Math.min(raw, 1 - raw);
}

function gaussian(distance: number, sigma: number): number {
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

/** (u,v) üzerinde çok-tepeli, dairesel-wrap'li (v ekseninde) sahte hasar yoğunluğu — [0,1] normalize. */
function demoIntensity(u: number, v: number, hotspotCount: number): number {
  let acc = 0;
  for (let i = 0; i < hotspotCount; i++) {
    const centerU = (i + 0.5) / hotspotCount;
    const centerV = (i * 0.37) % 1;
    const sigma = 0.1 + 0.04 * (i % 2);
    const weight = 1 - i * 0.15;
    const du = u - centerU;
    const dv = circularDelta(v, centerV);
    const d = Math.sqrt(du * du + dv * dv);
    acc += weight * gaussian(d, sigma);
  }
  return Math.min(acc, 1);
}

function demoDamageMm(u: number, v: number, params: ResolvedParams): number {
  return demoIntensity(u, v, params.hotspotCount) * params.maxDamageMm;
}

/**
 * Geometrinin `uv` attribute'u üzerinden, seçili görselleştirme modu için
 * sentetik bir skaler dizi üretir (vertex sayısı kadar). `HeatmapMesh.tsx`
 * bunu `damageHeatmapMaterial.ts::writeDamageAttribute` ile geometriye yazar.
 */
export function computeDemoScalarField(
  geometry: BufferGeometry,
  mode: HeatmapVisualizationMode,
  params: DemoScalarFieldParams,
): Float32Array {
  const uvAttribute = geometry.getAttribute("uv");
  if (!uvAttribute) {
    throw new Error("Geometride 'uv' attribute'u bulunamadı — sentetik hasar alanı üretilemez.");
  }
  const resolved = resolveParams(params);
  const count = uvAttribute.count;
  const out = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = uvAttribute.getX(i);
    const v = uvAttribute.getY(i);
    const damageMm = demoDamageMm(u, v, resolved);

    switch (mode) {
      case "DAMAGE":
        out[i] = damageMm;
        break;
      case "REMAINING_WALL":
        out[i] = Math.max(resolved.wtMm - damageMm, 0);
        break;
      case "RATE":
        out[i] = damageMm / Math.max(resolved.elapsedYears, 1e-6);
        break;
      case "REMAINING_LIFE": {
        const rateMmPerYear = damageMm / Math.max(resolved.elapsedYears, 1e-6);
        const remainingWallMm = Math.max(resolved.wtMm - damageMm, 0);
        out[i] = rateMmPerYear > 1e-6 ? remainingWallMm / rateMmPerYear : resolved.wtMm * 100;
        break;
      }
      case "MECHANISM_MAP": {
        const wave = (Math.sin(u * 11.3) * 0.5 + 0.5 + (Math.cos(v * 7.9) * 0.5 + 0.5)) * 2;
        out[i] = Math.min(3, Math.floor(wave));
        break;
      }
      case "VELOCITY_FIELD":
        out[i] = 0.5 + 2.5 * (damageMm / Math.max(resolved.maxDamageMm, 1e-6));
        break;
      case "UNCERTAINTY": {
        const noise = Math.abs(Math.sin(u * 53.7 + v * 91.3)) * 0.5;
        out[i] = damageMm * 0.4 + noise * resolved.maxDamageMm * 0.3;
        break;
      }
      default:
        out[i] = damageMm;
    }
  }

  return out;
}
