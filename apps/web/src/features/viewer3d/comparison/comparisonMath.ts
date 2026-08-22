// apps/web/src/features/viewer3d/comparison/comparisonMath.ts
//
// Karşılaştırma modunun SAF matematiği: iki skaler alan arasındaki FARK
// (delta) haritası (master görev madde 6). KDP kapsamı DIŞINDADIR (element-
// bazlı çıkarma/aralık bulma, mühendislik katsayısı değil).

/** delta = B - A — POZİTİF değer "B, A'dan DAHA FAZLA hasarlı" anlamına gelir. */
export function computeDeltaField(valuesA: Float32Array, valuesB: Float32Array): Float32Array {
  if (valuesA.length !== valuesB.length) {
    throw new Error("valuesA ve valuesB aynı uzunlukta olmalıdır (aynı geometriden gelmeliler).");
  }
  const out = new Float32Array(valuesA.length);
  for (let i = 0; i < valuesA.length; i++) {
    out[i] = valuesB[i] - valuesA[i];
  }
  return out;
}

export interface DeltaRange {
  minValue: number;
  maxValue: number;
  maxAbsValue: number;
}

/** [-maxAbs, +maxAbs] — SIFIR MERKEZLİ, diverging bir colormap'in doğru ortalanması için. */
export function computeDeltaRange(delta: Float32Array): DeltaRange {
  let maxAbs = 0;
  for (let i = 0; i < delta.length; i++) {
    const abs = Math.abs(delta[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  const safeMaxAbs = Math.max(maxAbs, 1e-6);
  return { minValue: -safeMaxAbs, maxValue: safeMaxAbs, maxAbsValue: safeMaxAbs };
}
