// apps/web/src/features/results/charts/MetalLossTimeSeriesChart.tsx
//
// Zaman Serisi (D) — kümülatif metal kaybı, CA tükenme çizgisi, P10-P90
// bandı. Bant, `viewer2d/tabs/TimeSeriesTab.tsx`nin AYNI "görünmez taban +
// görünür delta" yığılmış-alan tekniğiyle çizilir (bkz. o dosyanın kendi
// yorumu: Tailwind/arka-plan maskeleme yerine tema-bağımsız tek doğru yol).

import { useMemo, useRef } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildMetalLossTimeSeriesData } from "./metalLossTimeSeriesData";
import { ChartExportBar } from "../components/ChartExportBar";

export function MetalLossTimeSeriesChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => (entry ? buildMetalLossTimeSeriesData(entry.operatingProfile, entry.assessment) : null), [entry]);

  const rechartsRows = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => ({ year: p.year, p10: p.p10, p50: p.p50, bandDelta: p.p90 - p.p10 }));
  }, [data]);

  if (!entry || !data) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          {entry.componentLabel} — Kümülatif Metal Kaybı (mm)
          {data.depletionYearP50 !== null && data.depletionYearP50 <= data.designLifeYears && (
            <span className="ml-2 text-red-600 dark:text-red-400">Tükenme yılı: {data.depletionYearP50.toFixed(1)}</span>
          )}
        </h3>
        <ChartExportBar
          containerRef={containerRef}
          baseFilename="zaman-serisi"
          buildCsvRows={() => [
            ["Yıl", "P10 (mm)", "P50 (mm)", "P90 (mm)"],
            ...data.points.map((p) => [p.year.toFixed(2), p.p10.toFixed(4), p.p50.toFixed(4), p.p90.toFixed(4)]),
          ]}
        />
      </div>
      <div ref={containerRef} className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rechartsRows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid {...RECHARTS_GRID_PROPS} />
            <XAxis dataKey="year" {...RECHARTS_AXIS_PROPS} label={{ value: "Yıl", position: "insideBottom", offset: -4, fill: CHART_HEX.axisText }} />
            <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "mm", angle: -90, position: "insideLeft" }} />
            <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={(year) => `Yıl ${Number(year).toFixed(1)}`} />
            <Area dataKey="p10" stackId="band" stroke="none" fill="transparent" />
            <Area dataKey="bandDelta" stackId="band" stroke="none" fill={CHART_HEX.sky} fillOpacity={0.18} name="P10-P90 Bandı" />
            <Line dataKey="p50" stroke={CHART_HEX.sky} strokeWidth={2} dot={false} name="P50" />
            <ReferenceLine y={data.corrosionAllowanceMm} stroke={CHART_HEX.red} strokeDasharray="4 4" label={{ value: "Korozyon Payı (CA)", fill: CHART_HEX.red, fontSize: 11, position: "insideTopLeft" }} />
            {data.depletionYearP50 !== null && data.depletionYearP50 <= data.designLifeYears && (
              <ReferenceLine x={data.depletionYearP50} stroke={CHART_HEX.red} strokeDasharray="2 2" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
