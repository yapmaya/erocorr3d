// apps/web/src/features/results/charts/TornadoChart.tsx
//
// Tornado (E) — duyarlılık sıralaması. Yatay çubuk (Recharts
// `layout="vertical"`), en kritik parametre üstte.

import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildTornadoData, TORNADO_PARAMETER_LABELS_TR } from "./tornadoData";
import { ChartExportBar } from "../components/ChartExportBar";

export function TornadoChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [caseIndex, setCaseIndex] = useState(0);

  const activeCaseIndex = entry ? Math.min(caseIndex, entry.operatingProfile.cases.length - 1) : 0;

  const tornado = useMemo(() => {
    if (!entry) return null;
    return buildTornadoData({ geometry: entry.geometry, mitigation: entry.mitigation, operatingCase: entry.operatingProfile.cases[activeCaseIndex] });
  }, [entry, activeCaseIndex]);

  const rows = useMemo(() => {
    if (!tornado) return [];
    return tornado.results.map((r) => ({
      parameter: TORNADO_PARAMETER_LABELS_TR[r.parameter] ?? r.parameter,
      base: Math.min(r.lowOutputMmPerYear, r.highOutputMmPerYear),
      range: r.impactRangeMmPerYear,
    }));
  }, [tornado]);

  if (!entry) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Duyarlılık (Tornado)</h3>
        <select
          value={activeCaseIndex}
          onChange={(e) => setCaseIndex(Number(e.target.value))}
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {entry.operatingProfile.cases.map((c, i) => (
            <option key={c.name} value={i}>
              {c.name}
            </option>
          ))}
        </select>
        {tornado && (
          <ChartExportBar
            containerRef={containerRef}
            baseFilename="tornado"
            buildCsvRows={() => [
              ["Parametre", "Taban Değer", "Düşük Çıktı (mm/yıl)", "Yüksek Çıktı (mm/yıl)", "Etki Aralığı (mm/yıl)"],
              ...tornado.results.map((r) => [
                TORNADO_PARAMETER_LABELS_TR[r.parameter] ?? r.parameter,
                r.baseValue.toFixed(3),
                r.lowOutputMmPerYear.toFixed(4),
                r.highOutputMmPerYear.toFixed(4),
                r.impactRangeMmPerYear.toFixed(4),
              ]),
            ]}
          />
        )}
      </div>

      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
        Yalnızca CO2 (tatlı) korozyonu / NORSOK M-506 mekanizması için — her parametre ayrı ayrı ±%20 değiştirilir (bkz. uncertainty/tornado.ts).
      </p>

      {!tornado ? (
        <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">
          Bu senaryoda CO2 mol yüzdesi 0 — CO2 korozyon mekanizması yapısal olarak devre dışı, tornado analizi anlamsız.
        </div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid {...RECHARTS_GRID_PROPS} />
              <XAxis type="number" {...RECHARTS_AXIS_PROPS} label={{ value: "mm/yıl", position: "insideBottom", offset: -4 }} />
              <YAxis type="category" dataKey="parameter" {...RECHARTS_AXIS_PROPS} width={140} />
              <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} formatter={(value) => (typeof value === "number" ? value.toFixed(4) : value)} />
              <Bar dataKey="base" stackId="tornado" fill="transparent" />
              <Bar dataKey="range" stackId="tornado" fill={CHART_HEX.amber} name="Etki Aralığı (±%20)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
