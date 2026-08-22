// packages/engine/src/spatial/sampling.ts
//
// Bir SpatialDamageField'ı, ızgara noktalarından BAĞIMSIZ, keyfi bir (u,v)
// sorgu noktasında örnekler (bilineer enterpolasyon). Bu, hesaplanmış
// (u,v) ızgarasını render mesh'inin (genellikle FARKLI çözünürlükte) vertex
// UV koordinatlarına eşlemek için gereklidir — apps/web/viewer3d bu
// fonksiyonu kullanarak GERÇEK motor çıktısını (sentetik değil) mesh'in
// `uv` attribute'u üzerine yazar.
//
// Saf matematik/enterpolasyon — KDP kapsamı dışı (spatial/fields.ts'in
// dosya başı yorumundaki AYNI gerekçe).

import type { SpatialDamageField } from "../types/results";

/**
 * (u,v) noktasındaki hasar değerini (mm), en yakın 4 ızgara hücresi
 * arasında bilineer enterpolasyonla tahmin eder.
 *
 * u∈[0,1): eksenel — ızgara sınırlarının DIŞINDA KIRPILIR (periyodik değil,
 * DamageField'ın kendi "u periyodik değil" kuralıyla TUTARLI, bkz. fields.ts
 * ::DamageField.extractHotspots'un komşuluk arama notu).
 * v∈[0,1): çevresel — DAİRESEL/periyodik SARILIR (v=0≡v=1 tam tur).
 */
export function sampleSpatialDamageFieldMm(field: SpatialDamageField, uRaw: number, vRaw: number): number {
  const { resolutionU, resolutionV, valuesMm } = field;
  const u = Math.min(Math.max(uRaw, 0), 1 - 1e-9);
  const v = ((vRaw % 1) + 1) % 1;

  const fu = u * resolutionU - 0.5;
  const fv = v * resolutionV - 0.5;

  const iu0 = Math.floor(fu);
  const iv0 = Math.floor(fv);
  const tu = fu - iu0;
  const tv = fv - iv0;

  const clampU = (i: number) => Math.min(Math.max(i, 0), resolutionU - 1);
  const wrapV = (i: number) => ((i % resolutionV) + resolutionV) % resolutionV;

  const iu0c = clampU(iu0);
  const iu1c = clampU(iu0 + 1);
  const iv0w = wrapV(iv0);
  const iv1w = wrapV(iv0 + 1);

  const get = (iu: number, iv: number): number => valuesMm[iv * resolutionU + iu];

  const v00 = get(iu0c, iv0w);
  const v10 = get(iu1c, iv0w);
  const v01 = get(iu0c, iv1w);
  const v11 = get(iu1c, iv1w);

  const top = v00 + (v10 - v00) * tu;
  const bottom = v01 + (v11 - v01) * tu;
  return top + (bottom - top) * tv;
}
