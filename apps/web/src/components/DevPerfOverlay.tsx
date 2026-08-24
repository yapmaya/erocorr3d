// apps/web/src/components/DevPerfOverlay.tsx
//
// Yalnızca `import.meta.env.DEV` iken (Vite geliştirme modu) görünen küçük
// bir performans paneli — yük süresi/son hesap süresi/3B FPS'i
// `perfMetrics.ts`'in bütçelerine göre yeşil/kırmızı gösterir. Prod
// build'de Vite bu bloğu derleme zamanında eler (bundle'a girmez).

import { useTranslation } from "../i18n/translations";
import { usePerfStore } from "../store/perfStore";
import { isWithinBudget, PERF_BUDGETS } from "../lib/perfMetrics";

function MetricRow({ label, value, unit, kind }: { label: string; value: number | null; unit: string; kind: "loadMs" | "calcMs" | "fps" }) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-neutral-400">{label}</span>
        <span className="text-neutral-500">—</span>
      </div>
    );
  }
  const ok = isWithinBudget(kind, value);
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-400">{label}</span>
      <span className={ok ? "text-emerald-400" : "text-red-400"}>
        {value.toFixed(kind === "fps" ? 0 : 0)} {unit}
      </span>
    </div>
  );
}

export function DevPerfOverlay() {
  if (!import.meta.env.DEV) return null;
  return <DevPerfOverlayInner />;
}

function DevPerfOverlayInner() {
  const { t } = useTranslation();
  const loadMs = usePerfStore((s) => s.loadMs);
  const lastCalcMs = usePerfStore((s) => s.lastCalcMs);
  const fps = usePerfStore((s) => s.fps);

  return (
    <div className="no-print pointer-events-none fixed bottom-2 right-2 z-[16777200] w-40 rounded border border-neutral-700 bg-neutral-950/90 p-2 font-mono text-[10px] text-neutral-200 shadow-lg">
      <div className="mb-1 font-semibold text-neutral-300">{t("perfOverlayTitle")}</div>
      <MetricRow label={t("perfLoadLabel")} value={loadMs} unit="ms" kind="loadMs" />
      <MetricRow label={t("perfCalcLabel")} value={lastCalcMs} unit="ms" kind="calcMs" />
      <MetricRow label={t("perfFpsLabel")} value={fps} unit="fps" kind="fps" />
      <div className="mt-1 text-neutral-500">
        {PERF_BUDGETS.loadMs}ms / {PERF_BUDGETS.calcMs}ms / {PERF_BUDGETS.fps}fps
      </div>
    </div>
  );
}
