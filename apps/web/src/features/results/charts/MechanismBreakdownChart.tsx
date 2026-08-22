// apps/web/src/features/results/charts/MechanismBreakdownChart.tsx
//
// Yığılmış çubuk (B, üst yarı) — senaryo bazında mekanizma katkıları.

import { useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CATEGORICAL_SERIES_COLORS, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE, seriesColorAt } from "../chartPalette";
import { buildMechanismBreakdownData, toRechartsRows } from "./mechanismBreakdownData";
import { ChartExportBar } from "../components/ChartExportBar";

export function MechanismBreakdownChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => (entry ? buildMechanismBreakdownData(entry.assessment) : null), [entry]);
  const rows = useMemo(() => (data ? toRechartsRows(data) : []), [data]);

  if (!entry || !data) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  if (data.mechanismKeys.length === 0) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">{entry.componentLabel} için uygulanan (sıfırdan büyük) bir mekanizma yok.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Mekanizma Katkıları (mm/yıl)</h3>
        <ChartExportBar
          containerRef={containerRef}
          baseFilename="mekanizma-katkilari"
          buildCsvRows={() => [
            ["Senaryo", ...data.mechanismKeys],
            ...rows.map((row) => [String(row.caseName), ...data.mechanismKeys.map((k) => row[k] ?? 0)]),
          ]}
        />
      </div>
      <div ref={containerRef} className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid {...RECHARTS_GRID_PROPS} />
            <XAxis dataKey="caseName" {...RECHARTS_AXIS_PROPS} />
            <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "mm/yıl", angle: -90, position: "insideLeft", fill: CATEGORICAL_SERIES_COLORS[0] }} />
            <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {data.mechanismKeys.map((key, index) => (
              <Bar key={key} dataKey={key} stackId="mechanisms" fill={seriesColorAt(index)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
