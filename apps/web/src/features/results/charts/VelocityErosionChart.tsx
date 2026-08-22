// apps/web/src/features/results/charts/VelocityErosionChart.tsx
//
// Hız-Erozyon Eğrisi (G) — çalışma noktası + (uygulanabilirse) API 14E
// limiti işaretli.

import { useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildVelocityErosionData } from "./velocityErosionData";
import { ChartExportBar } from "../components/ChartExportBar";

const MODE_LABELS_TR: Record<string, string> = {
  DNV_O501_SAND: "DNV-RP-O501 (Kum Erozyonu)",
  DROPLET_EROSION: "Damlacık Erozyonu (Tarama)",
  SCREENING_ONLY: "API RP 14E (Yalnızca Tarama — Sürekli Bir Hız Modeli Yok)",
};

export function VelocityErosionChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [caseIndex, setCaseIndex] = useState(0);

  const activeCaseIndex = entry ? Math.min(caseIndex, entry.operatingProfile.cases.length - 1) : 0;

  const data = useMemo(() => {
    if (!entry) return null;
    return buildVelocityErosionData(entry.geometry, entry.operatingProfile.cases[activeCaseIndex], entry.mitigation);
  }, [entry, activeCaseIndex]);

  if (!entry || !data) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Hız-Erozyon Eğrisi</h3>
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
        <ChartExportBar
          containerRef={containerRef}
          baseFilename="hiz-erozyon-egrisi"
          buildCsvRows={() => [["Hız (m/s)", "Hız (mm/yıl)"], ...data.points.map((p) => [p.velocityMs.toFixed(3), p.rateMmPerYear.toFixed(4)])]}
        />
      </div>

      <div className="rounded border border-neutral-200 px-2 py-1 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Model: {MODE_LABELS_TR[data.mode]}
        {data.mode === "SCREENING_ONLY" && (
          <>
            {" "}— varsayılan sınıflandırma:{" "}
            <span className="font-mono">{data.fluidCategoryUsed}</span> / <span className="font-mono">{data.serviceTypeUsed}</span> (motor
            verisinden kesin olarak türetilemez, kaba bir sezgisel varsayım — bkz. ⓘ).
          </>
        )}
      </div>

      <div ref={containerRef} className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid {...RECHARTS_GRID_PROPS} />
            <XAxis
              dataKey="velocityMs"
              type="number"
              domain={["dataMin", "dataMax"]}
              {...RECHARTS_AXIS_PROPS}
              label={{ value: data.velocityAxisLabelTr, position: "insideBottom", offset: -4 }}
            />
            <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "mm/yıl", angle: -90, position: "insideLeft" }} />
            <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} formatter={(value) => (typeof value === "number" ? value.toFixed(4) : value)} />
            <Line dataKey="rateMmPerYear" stroke={CHART_HEX.sky} strokeWidth={2} dot={false} name="Erozyon Hızı" />
            <ReferenceDot
              x={data.operatingVelocityMs}
              y={data.operatingRateMmPerYear}
              r={5}
              fill={CHART_HEX.red}
              stroke="none"
              label={{ value: "Çalışma Noktası", fill: CHART_HEX.red, fontSize: 10, position: "top" }}
            />
            {data.api14eScreening && (
              <ReferenceLine
                x={data.api14eScreening.erosionalVelocityMs}
                stroke={CHART_HEX.amber}
                strokeDasharray="4 4"
                label={{ value: `API 14E Ve (${data.api14eScreening.warningLevel})`, fill: CHART_HEX.amber, fontSize: 10 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
