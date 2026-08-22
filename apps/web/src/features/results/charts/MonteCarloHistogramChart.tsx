// apps/web/src/features/results/charts/MonteCarloHistogramChart.tsx
//
// Monte Carlo Histogramı (F) — P10/P50/P90 işaretli. Hesaplama (~0,5-1,5s,
// bkz. monteCarloData.ts'in performans notu) OTOMATİK değil, düğmeyle
// tetiklenir — sekmeye her geçişte istemsizce ana iş parçacığını
// kilitlememesi için.

import { useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonteCarloResult } from "@erocorr3d/engine";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildMonteCarloResult } from "./monteCarloData";
import { ChartExportBar } from "../components/ChartExportBar";

export function MonteCarloHistogramChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [caseIndex, setCaseIndex] = useState(0);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "unavailable">("idle");

  const activeCaseIndex = entry ? Math.min(caseIndex, entry.operatingProfile.cases.length - 1) : 0;

  const runSimulation = () => {
    if (!entry) return;
    setStatus("running");
    setResult(null);
    // Ana iş parçacığı ~0,5-1,5s meşgul olacak (bkz. monteCarloData.ts) — "Çalışıyor" durumunun
    // boyanabilmesi için ağır senkron işi bir sonraki task'a ertelenir.
    setTimeout(() => {
      const simulation = buildMonteCarloResult({
        geometry: entry.geometry,
        mitigation: entry.mitigation,
        operatingCase: entry.operatingProfile.cases[activeCaseIndex],
        operatingProfile: entry.operatingProfile,
      });
      setResult(simulation);
      setStatus(simulation ? "idle" : "unavailable");
    }, 0);
  };

  if (!entry) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  const rows = result
    ? result.histogram.map((bin) => ({
        rangeLabel: `${bin.binStartMmPerYear.toFixed(2)}–${bin.binEndMmPerYear.toFixed(2)}`,
        midpoint: (bin.binStartMmPerYear + bin.binEndMmPerYear) / 2,
        count: bin.count,
      }))
    : [];

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Monte Carlo</h3>
        <select
          value={activeCaseIndex}
          onChange={(e) => {
            setCaseIndex(Number(e.target.value));
            setResult(null);
            setStatus("idle");
          }}
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {entry.operatingProfile.cases.map((c, i) => (
            <option key={c.name} value={i}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={runSimulation}
          disabled={status === "running"}
          className="rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {status === "running" ? "Çalışıyor..." : "Simülasyonu Çalıştır"}
        </button>
        {result && (
          <ChartExportBar
            containerRef={containerRef}
            baseFilename="monte-carlo"
            buildCsvRows={() => [
              ["Aralık Başlangıcı (mm/yıl)", "Aralık Bitişi (mm/yıl)", "Sayaç"],
              ...result.histogram.map((b) => [b.binStartMmPerYear.toFixed(4), b.binEndMmPerYear.toFixed(4), b.count]),
            ]}
          />
        )}
      </div>

      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
        Yalnızca CO2 (tatlı) korozyonu / NORSOK M-506 için — sonuç tablosundaki P10/P50/P90&apos;dan FARKLI, ayrı bir girdi-belirsizliği simülasyonudur (bkz. ⓘ).
      </p>

      {status === "unavailable" && (
        <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Bu senaryoda CO2 mol yüzdesi 0 — Monte Carlo anlamsız.</div>
      )}

      {result && (
        <>
          <div className="flex gap-4 text-[11px] text-neutral-600 dark:text-neutral-300">
            <span>P10: <span className="font-mono">{result.p10MmPerYear.toFixed(3)}</span></span>
            <span>P50: <span className="font-mono font-semibold">{result.p50MmPerYear.toFixed(3)}</span></span>
            <span>P90: <span className="font-mono">{result.p90MmPerYear.toFixed(3)}</span></span>
            {result.probabilityOfExceedingAllowancePercent !== null && (
              <span>CA aşılma olasılığı: <span className="font-mono">%{result.probabilityOfExceedingAllowancePercent.toFixed(1)}</span></span>
            )}
          </div>
          <div ref={containerRef} className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid {...RECHARTS_GRID_PROPS} />
                <XAxis
                  dataKey="midpoint"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  {...RECHARTS_AXIS_PROPS}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  label={{ value: "mm/yıl", position: "insideBottom", offset: -4 }}
                />
                <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "Sayaç", angle: -90, position: "insideLeft" }} />
                <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={(v) => (typeof v === "number" ? `${v.toFixed(3)} mm/yıl` : v)} />
                <Bar dataKey="count" fill={CHART_HEX.sky} barSize={14} />
                <ReferenceLine x={result.p10MmPerYear} stroke={CHART_HEX.emerald} label={{ value: "P10", fill: CHART_HEX.emerald, fontSize: 10 }} />
                <ReferenceLine x={result.p50MmPerYear} stroke={CHART_HEX.amber} label={{ value: "P50", fill: CHART_HEX.amber, fontSize: 10 }} />
                <ReferenceLine x={result.p90MmPerYear} stroke={CHART_HEX.red} label={{ value: "P90", fill: CHART_HEX.red, fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
