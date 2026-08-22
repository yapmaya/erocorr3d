// apps/web/src/features/projects/ec3dSerialization.ts
//
// `.ec3d` (düz JSON) iki değeri NATIF TAŞIYAMAZ:
//  1) `SpatialDamageField.valuesMm` bir `Float32Array`'dir — `JSON.stringify`
//     bunu bir DİZİ değil, sayısal-anahtarlı bir NESNEYE çevirir (`{"0":1}`).
//  2) Motorun bazı hesap izi (calculationTrace) adımları GERÇEK ÇIKTI olarak
//     `NaN` taşıyabilir (ör. glikol oranı sıfırken bir bölme adımı) — JSON
//     `NaN`'ı DA taşıyamaz, `JSON.stringify(NaN)` sessizce `null` üretir ve
//     bu, motorun KENDİ `z.number()` şemasını (`null` bir sayı DEĞİLDİR)
//     geri okumada BOZAR.
//
// Bu iki JSON sınırlamasını `JSON.stringify`/`JSON.parse`'ın `replacer`/
// `reviver` parametreleriyle İZOLE EDER — hesap mantığına DOKUNMAZ, yalnızca
// "bu değer JSON'da nasıl temsil edilir" sorusuna cevap verir.

const NAN_SENTINEL = "__EC3D_NAN__";

export function ec3dJsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "number" && Number.isNaN(value)) return NAN_SENTINEL;
  if (value instanceof Float32Array) return Array.from(value);
  return value;
}

export function ec3dJsonReviver(key: string, value: unknown): unknown {
  if (value === NAN_SENTINEL) return Number.NaN;
  if (key === "valuesMm" && Array.isArray(value)) return new Float32Array(value as number[]);
  return value;
}
