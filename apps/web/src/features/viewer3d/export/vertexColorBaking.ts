// apps/web/src/features/viewer3d/export/vertexColorBaking.ts
//
// GLTF/GLB dışa aktarımı için ısı haritası rengini gerçek vertex-color
// attribute'una "pişirir" (master görev madde 9: "hasar rengi vertex color
// olarak gömülü"). GLTF, bu projenin özel `DamageHeatmapMaterial`
// shader'ını (uniform'lar/uColormapTexture) ANLAMAZ — bu yüzden GPU'da
// shader-zamanında yapılan renk örneklemesi (bkz. heatmap.frag.glsl),
// AYNI `shaders/colormaps.ts::sampleColormap` fonksiyonu kullanılarak CPU
// tarafında, dışa aktarım ANINDA, kalıcı bir `color` attribute'una
// dönüştürülür — GLTF içindeki HERHANGİ bir görüntüleyicide (Blender,
// three.js, vb.) ek bir shader gerektirmeden doğru renkte görünür.

import { sampleColormap, type ColormapName } from "../../../shaders/colormaps";

/** Tek bir skaler değeri, ısı haritasıyla AYNI [min,max]/invert kurallarıyla RGB'ye (0..1) çevirir. */
export function computeVertexColorRgb(
  value: number,
  minValue: number,
  maxValue: number,
  colormap: ColormapName,
  invertColormap: boolean,
): [number, number, number] {
  const range = Math.max(maxValue - minValue, 1e-6);
  const safeValue = Number.isFinite(value) ? value : minValue;
  const t = Math.min(Math.max((safeValue - minValue) / range, 0), 1);
  const sampledT = invertColormap ? 1 - t : t;
  return sampleColormap(colormap, sampledT);
}

/** Skaler dizinin TAMAMI için düz (interleaved) bir RGB Float32Array üretir — `BufferAttribute(itemSize=3)`e doğrudan verilebilir. */
export function bakeVertexColors(
  values: Float32Array,
  minValue: number,
  maxValue: number,
  colormap: ColormapName,
  invertColormap: boolean,
): Float32Array {
  const out = new Float32Array(values.length * 3);
  for (let i = 0; i < values.length; i++) {
    const [r, g, b] = computeVertexColorRgb(values[i], minValue, maxValue, colormap, invertColormap);
    out[i * 3] = r;
    out[i * 3 + 1] = g;
    out[i * 3 + 2] = b;
  }
  return out;
}
