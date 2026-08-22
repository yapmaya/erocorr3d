// apps/web/src/features/viewer2d/chartFormat.ts
//
// Recharts'ın Tooltip formatter/labelFormatter prop'ları çok geniş bir
// birleşim tipi (ValueType = number|string|Array<...>, label = ReactNode)
// kabul eder — bu yardımcılar herhangi bir çalışma zamanı değerini GÜVENLE
// (ve `any` KULLANMADAN) okunabilir bir metne çevirir.

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatMm(value: unknown, decimals = 2): string {
  const num = toFiniteNumber(value);
  return num === null ? String(value) : `${num.toFixed(decimals)} mm`;
}

export function formatDegrees(value: unknown): string {
  const num = toFiniteNumber(value);
  return num === null ? String(value) : `${num.toFixed(0)}°`;
}

export function formatNumber(value: unknown, decimals = 1): string {
  const num = toFiniteNumber(value);
  return num === null ? String(value) : num.toFixed(decimals);
}
