// apps/web/src/features/viewer2d/tabs/AxialProfileTab.tsx
//
// Eksenel Profil — X: eksenel konum, Y: kalan duvar kalınlığı. Saat 12/3/6/9
// için ayrı çizgiler + kritik eşik (t_min, CA sınırı) çizgileri.

import { useRef } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getPipeGrade, computeAsmeB318DesignWallThickness } from "@erocorr3d/engine";
import { useTranslation } from "../../../i18n/translations";
import type { Viewer2dDataSource } from "../dataSource";
import { DEFAULT_LOCATION_CLASS, DEFAULT_PIPE_GRADE_ID } from "../dataSource";
import { exportContainerSvgAsPng } from "../export/exportChartPng";
import { downloadCsv } from "../export/exportCsv";
import { formatMm, formatNumber } from "../chartFormat";

const AXIAL_SAMPLE_COUNT = 60;
const CLOCK_SERIES = [
  { key: "saat12", v: 0, color: "#0ea5e9", labelTr: "Saat 12 (üst)" },
  { key: "saat3", v: 0.25, color: "#22c55e", labelTr: "Saat 3" },
  { key: "saat6", v: 0.5, color: "#f59e0b", labelTr: "Saat 6 (alt)" },
  { key: "saat9", v: 0.75, color: "#a855f7", labelTr: "Saat 9" },
];

export function AxialProfileTab({ dataSource }: { dataSource: Viewer2dDataSource }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { geometry } = dataSource;
  const lengthM = geometry.lengthMm / 1000;

  const data = Array.from({ length: AXIAL_SAMPLE_COUNT + 1 }, (_, i) => {
    const u = i / AXIAL_SAMPLE_COUNT;
    const row: Record<string, number> = { axialPositionM: u * lengthM };
    for (const series of CLOCK_SERIES) {
      const damageMm = dataSource.sampleMm(u, series.v);
      row[series.key] = Math.max(geometry.wallThicknessMm - damageMm, 0);
    }
    return row;
  });

  const grade = getPipeGrade(DEFAULT_PIPE_GRADE_ID);
  const tMinResult = computeAsmeB318DesignWallThickness(
    geometry.designPressurePa,
    geometry.odMm / 1000,
    grade.smysPa,
    DEFAULT_LOCATION_CLASS,
    geometry.temperatureC,
    geometry.corrosionAllowanceMm / 1000,
  );
  const tMinMm = tMinResult.designWallThicknessM * 1000;
  const caThresholdMm = geometry.wallThicknessMm - geometry.corrosionAllowanceMm;

  const handleExportPng = () => exportContainerSvgAsPng(containerRef.current, "erocorr3d-eksenel-profil.png", "#0a0a0a");
  const handleExportCsv = () => {
    const rows: (string | number)[][] = [["eksenel_konum_m", "saat12_mm", "saat3_mm", "saat6_mm", "saat9_mm"]];
    for (const row of data) {
      rows.push([row.axialPositionM.toFixed(3), row.saat12.toFixed(4), row.saat3.toFixed(4), row.saat6.toFixed(4), row.saat9.toFixed(4)]);
    }
    downloadCsv("erocorr3d-eksenel-profil.csv", rows);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("viewer2dAxialProfileTitle")}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportPng} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportPngButton")}
          </button>
          <button type="button" onClick={handleExportCsv} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportCsvButton")}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="axialPositionM"
              type="number"
              domain={[0, lengthM]}
              tickFormatter={(v: number) => formatNumber(v)}
              stroke="#a1a1aa"
              label={{ value: t("viewer2dAxialPositionAxisLabel"), position: "insideBottom", offset: -4, fill: "#a1a1aa", fontSize: 11 }}
            />
            <YAxis
              stroke="#a1a1aa"
              label={{ value: t("viewer2dRemainingWallAxisLabel"), angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => formatMm(value)}
              labelFormatter={(v) => `${t("viewer2dAxialPositionAxisLabel")}: ${formatNumber(v, 2)} m`}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {CLOCK_SERIES.map((series) => (
              <Line key={series.key} type="monotone" dataKey={series.key} name={series.labelTr} stroke={series.color} dot={false} strokeWidth={2} />
            ))}
            <ReferenceLine y={tMinMm} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "t_min", fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }} />
            <ReferenceLine y={caThresholdMm} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: "CA", fill: "#f59e0b", fontSize: 10, position: "insideBottomLeft" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
