// apps/web/src/shaders/colormaps.ts
//
// Isı haritası renk skalaları (colormap). ÖNEMLİ: bu dosyadaki renk
// değerleri GÖRSEL TASARIM seçimleridir, MÜHENDİSLİK KATSAYISI değildir —
// proje talimatındaki "Kaynak Doğrulama Protokolü" (KDP) korozyon/erozyon
// hesap sabitleri/formülleri için geçerlidir, bir grafiğin hangi tonlarla
// çizileceği için değil. `viridis`/`turbo`/`plasma` bilinen kontrol
// noktalarına dayanan YAKLAŞIK reprodüksiyonlardır (matplotlib/Google'ın
// resmi 256 girişli tablolarının bit-eksact kopyası değildir) — amaç
// bilimsel-görünümlü, tanıdık bir palet sunmaktır, KDP kapsamında bir
// "kaynaktan doğrulama" iddiası taşımazlar.

import { ClampToEdgeWrapping, DataTexture, LinearFilter, NearestFilter, RGBAFormat, UnsignedByteType } from "three";

export type ColormapName = "corrosion" | "viridis" | "turbo" | "plasma" | "discrete4" | "colorblindSafe";

export const COLORMAP_NAMES: ColormapName[] = ["corrosion", "viridis", "turbo", "plasma", "discrete4", "colorblindSafe"];

interface ColorStop {
  t: number;
  color: [number, number, number];
}

/** Proje kendi hasar skalası: koyu mavi-gri → yeşil → sarı → turuncu → kırmızı → mor. */
const CORROSION_STOPS: ColorStop[] = [
  { t: 0.0, color: [0.106, 0.165, 0.22] },
  { t: 0.2, color: [0.133, 0.486, 0.298] },
  { t: 0.45, color: [0.918, 0.702, 0.031] },
  { t: 0.65, color: [0.976, 0.451, 0.086] },
  { t: 0.85, color: [0.863, 0.149, 0.149] },
  { t: 1.0, color: [0.494, 0.133, 0.808] },
];

const VIRIDIS_STOPS: ColorStop[] = [
  { t: 0.0, color: [0.267, 0.005, 0.329] },
  { t: 0.25, color: [0.283, 0.141, 0.458] },
  { t: 0.5, color: [0.128, 0.567, 0.551] },
  { t: 0.75, color: [0.369, 0.789, 0.383] },
  { t: 1.0, color: [0.993, 0.906, 0.144] },
];

const PLASMA_STOPS: ColorStop[] = [
  { t: 0.0, color: [0.05, 0.03, 0.53] },
  { t: 0.25, color: [0.494, 0.012, 0.658] },
  { t: 0.5, color: [0.798, 0.28, 0.469] },
  { t: 0.75, color: [0.973, 0.585, 0.253] },
  { t: 1.0, color: [0.94, 0.975, 0.131] },
];

const TURBO_STOPS: ColorStop[] = [
  { t: 0.0, color: [0.19, 0.072, 0.232] },
  { t: 0.17, color: [0.275, 0.408, 0.859] },
  { t: 0.33, color: [0.164, 0.71, 0.965] },
  { t: 0.5, color: [0.475, 0.933, 0.406] },
  { t: 0.67, color: [0.973, 0.788, 0.184] },
  { t: 0.83, color: [0.925, 0.365, 0.098] },
  { t: 1.0, color: [0.48, 0.012, 0.012] },
];

/** RdYlBu tersine (ColorBrewer diverging) esintili, kırmızı-yeşil ayrımına DAYANMAYAN palet. */
const COLORBLIND_SAFE_STOPS: ColorStop[] = [
  { t: 0.0, color: [0.192, 0.212, 0.584] },
  { t: 0.25, color: [0.455, 0.678, 0.82] },
  { t: 0.5, color: [1.0, 1.0, 0.749] },
  { t: 0.75, color: [0.992, 0.682, 0.38] },
  { t: 1.0, color: [0.647, 0.0, 0.149] },
];

const STOP_TABLES: Record<Exclude<ColormapName, "discrete4">, ColorStop[]> = {
  corrosion: CORROSION_STOPS,
  viridis: VIRIDIS_STOPS,
  plasma: PLASMA_STOPS,
  turbo: TURBO_STOPS,
  colorblindSafe: COLORBLIND_SAFE_STOPS,
};

/** Kategorik hasar seviyeleri (NEGLIGIBLE/LOW/MEDIUM/HIGH) — sürekli değil, 4 sabit bant. */
export const DISCRETE4_COLORS: [number, number, number][] = [
  [0.392, 0.451, 0.545],
  [0.133, 0.773, 0.369],
  [0.961, 0.62, 0.043],
  [0.863, 0.149, 0.149],
];

export const DISCRETE4_LABELS_TR = ["İHMAL EDİLEBİLİR", "DÜŞÜK", "ORTA", "YÜKSEK"] as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function sampleStopTable(stops: ColorStop[], t: number): [number, number, number] {
  const clamped = Math.min(Math.max(t, 0), 1);
  if (clamped <= stops[0].t) return stops[0].color;
  const last = stops[stops.length - 1];
  if (clamped >= last.t) return last.color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const span = Math.max(b.t - a.t, 1e-9);
      const localT = (clamped - a.t) / span;
      return [lerp(a.color[0], b.color[0], localT), lerp(a.color[1], b.color[1], localT), lerp(a.color[2], b.color[2], localT)];
    }
  }
  return last.color;
}

/** t∈[0,1] için RGB (0..1 aralığında) örnekler. `discrete4` için 4 sabit bandı (sürekli olmayan) döndürür. */
export function sampleColormap(name: ColormapName, t: number): [number, number, number] {
  const safeT = Number.isFinite(t) ? t : 0;
  const clamped = Math.min(Math.max(safeT, 0), 1);
  if (name === "discrete4") {
    const index = Math.min(3, Math.floor(clamped * 4));
    return DISCRETE4_COLORS[index];
  }
  return sampleStopTable(STOP_TABLES[name], clamped);
}

export const COLORMAP_TEXTURE_WIDTH = 256;

/** GPU'da fragment shader'ın `texture2D(uColormapTexture, vec2(t, 0.5))` ile örnekleyeceği 256×1 doku. */
export function createColormapTexture(name: ColormapName): DataTexture {
  const width = COLORMAP_TEXTURE_WIDTH;
  const data = new Uint8Array(width * 4);
  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const [r, g, b] = sampleColormap(name, t);
    data[i * 4 + 0] = Math.round(r * 255);
    data[i * 4 + 1] = Math.round(g * 255);
    data[i * 4 + 2] = Math.round(b * 255);
    data[i * 4 + 3] = 255;
  }
  const texture = new DataTexture(data, width, 1, RGBAFormat, UnsignedByteType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  const isDiscrete = name === "discrete4";
  texture.minFilter = isDiscrete ? NearestFilter : LinearFilter;
  texture.magFilter = isDiscrete ? NearestFilter : LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function toCssRgb([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

/**
 * `Colorbar.tsx` gibi DOM/canvas bileşenleri için CSS `linear-gradient()` string'i üretir
 * (GPU dokusu DEĞİL — ekranda görülen lejant bunu, mesh'in kendisi `createColormapTexture`u kullanır).
 * `discrete4` için sürekli değil, 4 sert basamak üretir. `invert=true` iken renk örneklemesi
 * (1-t) üzerinden yapılır — "düşük değer = yüksek tehlike" modlarında (bkz.
 * `demoScalarField.ts::isInvertedVisualizationMode`) shader'ın kendi `uInvertColormap` davranışıyla
 * TUTARLI kalması için (böylece lejant, mesh üzerinde GERÇEKTEN görünen renkleri gösterir).
 */
export function colormapToCssGradient(name: ColormapName, steps = 32, invert = false): string {
  const sampleAt = (t: number) => sampleColormap(name, invert ? 1 - t : t);
  if (name === "discrete4") {
    const parts: string[] = [];
    for (let i = 0; i < DISCRETE4_COLORS.length; i++) {
      const t = (i + 0.5) / DISCRETE4_COLORS.length;
      const color = toCssRgb(sampleAt(t));
      const t0 = (i / DISCRETE4_COLORS.length) * 100;
      const t1 = ((i + 1) / DISCRETE4_COLORS.length) * 100;
      parts.push(`${color} ${t0}%`, `${color} ${t1}%`);
    }
    return `linear-gradient(to top, ${parts.join(", ")})`;
  }
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const color = toCssRgb(sampleAt(t));
    parts.push(`${color} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to top, ${parts.join(", ")})`;
}
