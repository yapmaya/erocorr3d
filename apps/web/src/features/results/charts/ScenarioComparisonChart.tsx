// apps/web/src/features/results/charts/ScenarioComparisonChart.tsx
//
// Senaryo Karşılaştırma (C) — yan yana çubuk, belirleyici senaryo vurgulu.

import { useMemo, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildScenarioComparisonData } from "./scenarioComparisonData";
import { ChartExportBar } from "../components/ChartExportBar";

export function ScenarioComparisonChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => (entry ? buildScenarioComparisonData(entry.assessment) : []), [entry]);

  if (!entry) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
          {entry.componentLabel} — Senaryo Karşılaştırması (belirleyici: <span className="text-sky-600 dark:text-sky-400">{entry.assessment.governingCaseName}</span>)
        </h3>
        <ChartExportBar
          containerRef={containerRef}
          baseFilename="senaryo-karsilastirma"
          buildCsvRows={() => [
            ["Senaryo", "P10 (mm/yıl)", "P50 (mm/yıl)", "P90 (mm/yıl)", "Yıllık Katkı (mm/yıl)", "Belirleyici"],
            ...rows.map((r) => [r.caseName, r.rateP10.toFixed(4), r.rateP50.toFixed(4), r.rateP90.toFixed(4), r.annualLossP50.toFixed(4), r.isGoverning ? "Evet" : "Hayır"]),
          ]}
        />
      </div>
      <div ref={containerRef} className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid {...RECHARTS_GRID_PROPS} />
            <XAxis dataKey="caseName" {...RECHARTS_AXIS_PROPS} />
            <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "mm/yıl", angle: -90, position: "insideLeft" }} />
            <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="rateP10" name="P10 (tam yıl)" fill={CHART_HEX.emerald} />
            <Bar dataKey="rateP50" name="P50 (tam yıl)" fill={CHART_HEX.sky}>
              {rows.map((row, index) => (
                <Cell key={index} stroke={row.isGoverning ? CHART_HEX.red : "none"} strokeWidth={row.isGoverning ? 2 : 0} />
              ))}
            </Bar>
            <Bar dataKey="rateP90" name="P90 (tam yıl)" fill={CHART_HEX.amber} />
            <Bar dataKey="annualLossP50" name="Yıllık Katkı (kısmi çalışma dahil)" fill={CHART_HEX.purple} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
