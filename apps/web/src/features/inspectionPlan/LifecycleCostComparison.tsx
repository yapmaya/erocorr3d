// apps/web/src/features/inspectionPlan/LifecycleCostComparison.tsx
//
// Yaşam döngüsü maliyet karşılaştırması grafiği — @erocorr3d/engine'in
// compareLifecycleCost() sonucunu OLDUĞU GİBİ çizer (bkz. aggregate/
// lifecycleCost.ts). Göreli birimdedir (CS=1,0), PARA BİRİMİ DEĞİLDİR —
// bkz. o modülün dosya başı notu.

import { useMemo, useRef } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LifecycleCostComparisonResult } from "@erocorr3d/engine";
import { CHART_HEX, RECHARTS_AXIS_PROPS, RECHARTS_GRID_PROPS, RECHARTS_TOOLTIP_STYLE, seriesColorAt } from "../results/chartPalette";
import { ChartExportBar } from "../results/components/ChartExportBar";
import { NumberInput } from "./components/NumberInput";

export interface LifecycleCostComparisonProps {
  result: LifecycleCostComparisonResult;
  discountRatePercent: number | undefined;
  inhibitorAnnualCostFactor: number | undefined;
  monitoringAnnualCostFactor: number | undefined;
  onDiscountRateChange: (value: number) => void;
  onInhibitorFactorChange: (value: number) => void;
  onMonitoringFactorChange: (value: number) => void;
}

export function LifecycleCostComparison({
  result,
  discountRatePercent,
  inhibitorAnnualCostFactor,
  monitoringAnnualCostFactor,
  onDiscountRateChange,
  onInhibitorFactorChange,
  onMonitoringFactorChange,
}: LifecycleCostComparisonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const years = result.options[0]?.cumulativeByYear.map((p) => p.year) ?? [];
    return years.map((year, i) => {
      const row: Record<string, number> = { year };
      for (const option of result.options) {
        row[option.labelTr] = option.cumulativeByYear[i].cumulativeDiscountedRelative;
      }
      return row;
    });
  }, [result]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label>
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">İskonto Oranı (%/yıl)</span>
          <NumberInput
            value={discountRatePercent ?? result.assumptions.discountRatePercent}
            onChange={onDiscountRateChange}
            min={0}
            max={50}
            step={0.5}
            className="w-24"
          />
        </label>
        <label>
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">İnhibitör Yıllık OPEX (göreli birim)</span>
          <NumberInput
            value={inhibitorAnnualCostFactor ?? result.assumptions.inhibitorAnnualCostFactor}
            onChange={onInhibitorFactorChange}
            min={0}
            step={0.01}
            className="w-24"
          />
        </label>
        <label>
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">İzleme Yıllık OPEX (göreli birim)</span>
          <NumberInput
            value={monitoringAnnualCostFactor ?? result.assumptions.monitoringAnnualCostFactor}
            onChange={onMonitoringFactorChange}
            min={0}
            step={0.01}
            className="w-24"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs">
          {result.assumptions.horizonYears} yıl ufukta daha düşük NPV: <span className="font-semibold">{result.cheaperOptionLabelTr}</span>
          {result.breakEvenYear !== null && <span> · Başabaş yılı: ~{result.breakEvenYear}</span>}
        </p>
        <ChartExportBar
          containerRef={containerRef}
          baseFilename="yasam-donguesu-maliyeti"
          buildCsvRows={() => [
            ["Yıl", ...result.options.map((o) => o.labelTr)],
            ...rows.map((row) => [row.year, ...result.options.map((o) => row[o.labelTr].toFixed(3))]),
          ]}
        />
      </div>

      <div ref={containerRef} className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid {...RECHARTS_GRID_PROPS} />
            <XAxis dataKey="year" {...RECHARTS_AXIS_PROPS} label={{ value: "Yıl", position: "insideBottom", offset: -4, fill: CHART_HEX.axisText }} />
            <YAxis {...RECHARTS_AXIS_PROPS} label={{ value: "Göreli Maliyet (CS CAPEX=1,0)", angle: -90, position: "insideLeft" }} />
            <Tooltip contentStyle={RECHARTS_TOOLTIP_STYLE} labelFormatter={(year) => `Yıl ${year}`} formatter={(value) => Number(value).toFixed(2)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {result.options.map((option, i) => (
              <Line key={option.labelTr} dataKey={option.labelTr} stroke={seriesColorAt(i)} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="list-disc pl-4 text-[11px] text-neutral-500 dark:text-neutral-400">
        {result.notesTr.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
