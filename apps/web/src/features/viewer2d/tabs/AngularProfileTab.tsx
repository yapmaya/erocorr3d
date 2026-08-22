// apps/web/src/features/viewer2d/tabs/AngularProfileTab.tsx
//
// Açısal Profil (polar grafik) — 0-360° vs hasar (mm), seçilen eksenel
// konumda. 0°≡saat12 (üst), açı SAAT YÖNÜNDE artar (bkz. spatial/fields.ts::
// vToClockPosition sözleşimi) — BLC (alt, ~180°) ve TLC (üst, ~0°) tepeleri
// tipik olarak zıt konumlarda belirgin olur.

import { useRef, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { NumberSlider } from "../../../components/NumberSlider";
import { useTranslation } from "../../../i18n/translations";
import type { Viewer2dDataSource } from "../dataSource";
import { exportContainerSvgAsPng } from "../export/exportChartPng";
import { downloadCsv } from "../export/exportCsv";
import { formatDegrees, formatMm } from "../chartFormat";

const ANGULAR_SAMPLE_COUNT = 72;

export function AngularProfileTab({ dataSource }: { dataSource: Viewer2dDataSource }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [axialU, setAxialU] = useState(0.5);
  const { geometry } = dataSource;
  const lengthM = geometry.lengthMm / 1000;

  const data = Array.from({ length: ANGULAR_SAMPLE_COUNT + 1 }, (_, i) => {
    const v = (i % ANGULAR_SAMPLE_COUNT) / ANGULAR_SAMPLE_COUNT;
    const angleDeg = (i / ANGULAR_SAMPLE_COUNT) * 360;
    return { angleDeg, hasarMm: dataSource.sampleMm(axialU, v) };
  });

  const maxDamage = Math.max(...data.map((d) => d.hasarMm), 0.01);

  const handleExportPng = () => exportContainerSvgAsPng(containerRef.current, "erocorr3d-acisal-profil.png", "#0a0a0a");
  const handleExportCsv = () => {
    const rows: (string | number)[][] = [["aci_derece", "hasar_mm"]];
    for (const d of data) rows.push([d.angleDeg.toFixed(1), d.hasarMm.toFixed(4)]);
    downloadCsv("erocorr3d-acisal-profil.csv", rows);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("viewer2dAngularProfileTitle")}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportPng} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportPngButton")}
          </button>
          <button type="button" onClick={handleExportCsv} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportCsvButton")}
          </button>
        </div>
      </div>
      <div className="max-w-sm">
        <NumberSlider
          label={`${t("viewer2dAxialPositionLabel")} (m)`}
          value={axialU * lengthM}
          min={0}
          max={lengthM}
          step={lengthM / 100}
          onChange={(v) => setAxialU(lengthM > 0 ? v / lengthM : 0)}
          valueFormatter={(v) => `${v.toFixed(2)} m`}
        />
      </div>
      <div ref={containerRef} className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#3f3f46" />
            <PolarAngleAxis dataKey="angleDeg" tickFormatter={formatDegrees} stroke="#a1a1aa" tick={{ fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, maxDamage * 1.1]} stroke="#a1a1aa" tick={{ fontSize: 9 }} label={{ value: t("viewer2dDamageAxisLabel"), fontSize: 10, fill: "#a1a1aa" }} />
            <Radar dataKey="hasarMm" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.35} isAnimationActive={false} />
            <Tooltip
              formatter={(value) => formatMm(value, 3)}
              labelFormatter={formatDegrees}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">0°=saat 12 (üst), 90°=saat 3, 180°=saat 6 (alt), 270°=saat 9 — açı saat yönünde artar.</p>
    </div>
  );
}
