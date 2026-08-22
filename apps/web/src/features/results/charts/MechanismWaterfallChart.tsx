// apps/web/src/features/results/charts/MechanismWaterfallChart.tsx
//
// Şelale (B, alt yarı) — bkz. mechanismWaterfallData.ts'in dosya başı notu
// (kapsam BİLEREK yalnızca gerçekten toplamsal 3 adımla sınırlı; baskın
// mekanizmanın KENDİ hesaplama izi VARSA ayrı bir liste olarak, şelale
// çubuklarına KARIŞTIRILMADAN gösterilir).
//
// Recharts'ın yerleşik bir "waterfall" tipi yok — TimeSeriesTab.tsx'in
// (viewer2d) "görünmez taban + görünür delta" yığılmış-alan tekniğinin
// çubuk (Bar) karşılığı kullanılır: her adım için görünmez bir `base`
// (min(başlangıç,bitiş)) + görünür bir `delta` (|değer|) çubuğu, `stackId`
// ile üst üste yığılır.

import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE } from "../chartPalette";
import { buildMechanismWaterfallData } from "./mechanismWaterfallData";
import { ChartExportBar } from "../components/ChartExportBar";

interface WaterfallRow {
  labelTr: string;
  base: number;
  delta: number;
  color: string;
}

export function MechanismWaterfallChart() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [caseIndex, setCaseIndex] = useState(0);

  const activeCaseIndex = entry ? Math.min(caseIndex, entry.assessment.perCase.length - 1) : 0;

  const waterfall = useMemo(() => {
    if (!entry) return null;
    const caseAssessment = entry.assessment.perCase[activeCaseIndex];
    const annualLossP50 = entry.assessment.metalLoss.scenarioAnnualLosses[activeCaseIndex]?.annualLossMmPerYear.p50 ?? 0;
    return buildMechanismWaterfallData(caseAssessment, annualLossP50);
  }, [entry, activeCaseIndex]);

  const rows: WaterfallRow[] = useMemo(() => {
    if (!waterfall) return [];
    return waterfall.steps.map((step) => ({
      labelTr: step.labelTr,
      base: step.isTotal ? 0 : Math.min(step.cumulativeStart, step.cumulativeEnd),
      delta: step.isTotal ? step.cumulativeEnd : Math.abs(step.value),
      color: step.isTotal ? CHART_HEX.sky : step.value < 0 ? CHART_HEX.red : CHART_HEX.emerald,
    }));
  }, [waterfall]);

  if (!entry) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Şelale (mm/yıl)</h3>
        <select
          value={activeCaseIndex}
          onChange={(e) => setCaseIndex(Number(e.target.value))}
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        >
          {entry.assessment.perCase.map((c, i) => (
            <option key={c.caseName} value={i}>
              {c.caseName}
            </option>
          ))}
        </select>
        {waterfall && (
          <ChartExportBar
            containerRef={containerRef}
            baseFilename="sekale"
            buildCsvRows={() => [["Adım", "Değer (mm/yıl)"], ...waterfall.steps.map((s) => [s.labelTr, s.value.toFixed(4)])]}
          />
        )}
      </div>

      {!waterfall ? (
        <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Bu senaryoda uygulanan bir mekanizma yok.</div>
      ) : (
        <>
          <div ref={containerRef} className="h-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                <CartesianGrid {...RECHARTS_GRID_PROPS} />
                <XAxis dataKey="labelTr" {...RECHARTS_AXIS_PROPS} angle={-20} textAnchor="end" height={60} interval={0} />
                <YAxis {...RECHARTS_AXIS_PROPS} />
                <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} formatter={(value) => (typeof value === "number" ? value.toFixed(4) : value)} />
                <Bar dataKey="base" stackId="wf" fill="transparent" />
                <Bar dataKey="delta" stackId="wf">
                  {rows.map((row, index) => (
                    <Cell key={index} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {waterfall.hasTrace ? (
              <>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {waterfall.mechanismNameTr} — Hesaplama İzi (kaynak atıflarıyla, birimler farklı olabilir — toplamsal DEĞİLDİR)
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-neutral-400 dark:text-neutral-500">
                      <th className="font-normal">Adım</th>
                      <th className="font-normal">Formül</th>
                      <th className="font-normal text-right">Çıktı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waterfall.traceRows.map((step, i) => (
                      <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                        <td className="py-0.5 text-neutral-700 dark:text-neutral-200">{step.stepName}</td>
                        <td className="py-0.5 text-neutral-500 dark:text-neutral-400" title={step.coefficientIds.join(", ")}>
                          {step.formula}
                        </td>
                        <td className="py-0.5 text-right font-mono">
                          {step.output.toFixed(4)} {step.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {waterfall.mechanismNameTr} için adım adım hesaplama izi mevcut değil.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
