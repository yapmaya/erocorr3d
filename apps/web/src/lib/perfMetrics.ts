// apps/web/src/lib/perfMetrics.ts
//
// Performans bütçesi sabitleri + saf karşılaştırma yardımcıları. Sayılar
// mühendislik katsayısı DEĞİLDİR (KDP kapsamı dışı) — master görevin
// belirttiği ürün hedefleridir: ilk yükleme < 3 sn, hesap < 500 ms, 3B 60 FPS.

export const PERF_BUDGETS = {
  loadMs: 3000,
  calcMs: 500,
  fps: 60,
} as const;

export type PerfMetricKind = "loadMs" | "calcMs" | "fps";

/** FPS için "büyük=iyi", diğerleri için "küçük=iyi" — bütçeye göre durum. */
export function isWithinBudget(kind: PerfMetricKind, value: number): boolean {
  if (kind === "fps") return value >= PERF_BUDGETS.fps;
  return value <= PERF_BUDGETS[kind];
}
