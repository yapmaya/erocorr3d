// apps/web/src/features/results/chartPalette.ts
//
// 8 grafiğin PAYLAŞTIĞI renk sabitleri. Recharts/SVG `stroke`/`fill`
// props'ları Tailwind sınıfı KABUL ETMEZ (ham renk dizesi ister) — bu proje
// genelinde (viewer2d/tabs/*.tsx) her dosya kendi hex sabitlerini
// tekrarlıyordu; burada TEK bir yerde toplanır (bkz. onaylı plan'ın "renk
// paleti" notu). Görsel tasarım seçimidir — KDP kapsamı dışı (bkz.
// shaders/colormaps.ts'in aynı gerekçeli başlığı).

import type { CtlAtlResult } from "@erocorr3d/engine";

export const CHART_HEX = {
  sky: "#0ea5e9",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  rose: "#f43f5e",
  emerald: "#22c55e",
  purple: "#a855f7",
  teal: "#14b8a6",
  yellow: "#eab308",
  gridLine: "#3f3f46",
  axisText: "#a1a1aa",
  tooltipBg: "#18181b",
  tooltipBorder: "#3f3f46",
} as const;

/** Yığılmış/gruplu çubuk grafiklerde her seri (mekanizma/senaryo) için sırayla kullanılacak renkler. */
export const CATEGORICAL_SERIES_COLORS: string[] = [
  CHART_HEX.sky,
  CHART_HEX.amber,
  CHART_HEX.purple,
  CHART_HEX.rose,
  CHART_HEX.emerald,
  CHART_HEX.orange,
  CHART_HEX.teal,
  CHART_HEX.yellow,
];

export function seriesColorAt(index: number): string {
  return CATEGORICAL_SERIES_COLORS[index % CATEGORICAL_SERIES_COLORS.length];
}

/** Motorun KENDİ `CtlAtlResult.colorTr` alanına göre — kategori eşiklerini burada TEKRARLAMAZ. */
export const CTL_ATL_COLOR_STYLES: Record<CtlAtlResult["colorTr"], { bgClass: string; textClass: string; hex: string }> = {
  yeşil: { bgClass: "bg-emerald-100 dark:bg-emerald-500/20", textClass: "text-emerald-800 dark:text-emerald-300", hex: CHART_HEX.emerald },
  sarı: { bgClass: "bg-amber-100 dark:bg-amber-500/20", textClass: "text-amber-800 dark:text-amber-300", hex: CHART_HEX.amber },
  turuncu: { bgClass: "bg-orange-100 dark:bg-orange-500/20", textClass: "text-orange-800 dark:text-orange-300", hex: CHART_HEX.orange },
  kırmızı: { bgClass: "bg-red-100 dark:bg-red-500/20", textClass: "text-red-800 dark:text-red-300", hex: CHART_HEX.red },
};

export const CONFIDENCE_BADGE_STYLES: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  MEDIUM: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
  LOW: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  UNVERIFIED: "border border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-300",
};

export const RECHARTS_GRID_PROPS = {
  stroke: CHART_HEX.gridLine,
  strokeDasharray: "3 3",
} as const;

export const RECHARTS_AXIS_PROPS = {
  stroke: CHART_HEX.axisText,
  tick: { fill: CHART_HEX.axisText, fontSize: 11 },
} as const;

export const RECHARTS_TOOLTIP_STYLE = {
  background: CHART_HEX.tooltipBg,
  border: `1px solid ${CHART_HEX.tooltipBorder}`,
  borderRadius: 4,
  fontSize: 12,
} as const;
