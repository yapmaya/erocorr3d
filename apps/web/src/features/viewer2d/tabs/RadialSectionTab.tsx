// apps/web/src/features/viewer2d/tabs/RadialSectionTab.tsx
//
// Radyal Kesit (saat kadranı görünümü) — seçilen eksenel konumda boru enine
// kesiti. Orijinal duvar (kesikli) + aşınmış duvar (dolu), saat pozisyonları
// (12/3/6/9) işaretli, minimum kalan et + konumu etiketli, korozyon payı
// sınırı (CA) ve minimum gerekli kalınlık (t_min) çizgileri.
//
// GEOMETRİK VARSAYIM: hasar İÇ yüzeyden (bore) metal kaybı olarak
// görselleştirilir (referans tesis senaryolarının ikisi de İÇ CO2 korozyonudur) —
// dış yüzey (OD) sabit kalır, iç sınır (aşınmış duvar) her açıda
// damage(θ) kadar DIŞA doğru (merkeze uzaklaşarak) büyür.

import { useRef, useState } from "react";
import { describeClockPositionTr, vToClockPosition, getPipeGrade, computeAsmeB318DesignWallThickness } from "@erocorr3d/engine";
import { NumberSlider } from "../../../components/NumberSlider";
import { useTranslation } from "../../../i18n/translations";
import type { Viewer2dDataSource } from "../dataSource";
import { DEFAULT_LOCATION_CLASS, DEFAULT_PIPE_GRADE_ID } from "../dataSource";
import { exportContainerSvgAsPng } from "../export/exportChartPng";
import { downloadCsv } from "../export/exportCsv";

const ANGULAR_SAMPLE_COUNT = 144;
const SVG_SIZE = 380;
const CENTER = SVG_SIZE / 2;
const MAX_DRAW_RADIUS = 155;

function polarToXY(radiusPx: number, v: number): { x: number; y: number } {
  const theta = v * 2 * Math.PI;
  return { x: CENTER + radiusPx * Math.sin(theta), y: CENTER - radiusPx * Math.cos(theta) };
}

function buildCirclePath(radiusPx: number): string {
  const r = Math.max(radiusPx, 0);
  return `M ${CENTER - r} ${CENTER} A ${r} ${r} 0 1 0 ${CENTER + r} ${CENTER} A ${r} ${r} 0 1 0 ${CENTER - r} ${CENTER} Z`;
}

export function RadialSectionTab({ dataSource }: { dataSource: Viewer2dDataSource }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [axialU, setAxialU] = useState(0.5);
  const { geometry } = dataSource;

  const outerRadiusMm = geometry.odMm / 2;
  const innerRadiusMm = outerRadiusMm - geometry.wallThicknessMm;
  const pxPerMm = MAX_DRAW_RADIUS / outerRadiusMm;

  const samples = Array.from({ length: ANGULAR_SAMPLE_COUNT }, (_, i) => {
    const v = i / ANGULAR_SAMPLE_COUNT;
    const damageMm = dataSource.sampleMm(axialU, v);
    const remainingMm = Math.max(geometry.wallThicknessMm - damageMm, 0);
    const wornInnerRadiusMm = innerRadiusMm + damageMm;
    return { v, damageMm, remainingMm, wornInnerRadiusMm };
  });

  const outerRadiusPx = outerRadiusMm * pxPerMm;
  const innerRadiusPx = innerRadiusMm * pxPerMm;

  const wornPath =
    "M " +
    samples
      .map((s) => {
        const { x, y } = polarToXY(s.wornInnerRadiusMm * pxPerMm, s.v);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" L ") +
    " Z";

  const minSample = samples.reduce((min, s) => (s.remainingMm < min.remainingMm ? s : min), samples[0]);
  const minClockPosition = vToClockPosition(minSample.v);

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
  const caLimitRadiusMm = innerRadiusMm + geometry.corrosionAllowanceMm;
  const tMinRadiusMm = outerRadiusMm - tMinMm;

  const clockLabels = [
    { label: "12", v: 0 },
    { label: "3", v: 0.25 },
    { label: "6", v: 0.5 },
    { label: "9", v: 0.75 },
  ];

  const handleExportPng = () => exportContainerSvgAsPng(containerRef.current, "erocorr3d-radyal-kesit.png", "#0a0a0a");
  const handleExportCsv = () => {
    const rows: (string | number)[][] = [["saat_pozisyonu", "hasar_mm", "kalan_kalinlik_mm"]];
    for (const s of samples) {
      rows.push([vToClockPosition(s.v).toFixed(2), s.damageMm.toFixed(4), s.remainingMm.toFixed(4)]);
    }
    downloadCsv("erocorr3d-radyal-kesit.csv", rows);
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="shrink-0" ref={containerRef}>
        <svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} className="mx-auto">
          {/* Orijinal duvar — kesikli */}
          <path d={buildCirclePath(outerRadiusPx)} fill="none" stroke="#71717a" strokeWidth={1.5} />
          <path d={buildCirclePath(innerRadiusPx)} fill="none" stroke="#71717a" strokeWidth={1.5} strokeDasharray="5 4" />
          {/* CA sınırı / t_min — kesikli referans çizgileri */}
          <path d={buildCirclePath(caLimitRadiusMm * pxPerMm)} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" />
          <path d={buildCirclePath(tMinRadiusMm * pxPerMm)} fill="none" stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" />
          {/* Aşınmış duvar — dolu */}
          <path d={wornPath} fill="#0ea5e9" fillOpacity={0.25} stroke="#0ea5e9" strokeWidth={2} />
          {/* Saat pozisyonu işaretleri */}
          {clockLabels.map(({ label, v }) => {
            const { x, y } = polarToXY(outerRadiusPx + 16, v);
            return (
              <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-neutral-400 text-[11px]">
                {label}
              </text>
            );
          })}
          {/* Minimum kalan et noktası */}
          {(() => {
            const { x, y } = polarToXY(minSample.wornInnerRadiusMm * pxPerMm, minSample.v);
            return <circle cx={x} cy={y} r={4} fill="#f43f5e" />;
          })()}
        </svg>
        <div className="mt-1 flex justify-center gap-2">
          <button type="button" onClick={handleExportPng} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportPngButton")}
          </button>
          <button type="button" onClick={handleExportCsv} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportCsvButton")}
          </button>
        </div>
      </div>

      <div className="flex min-w-[220px] flex-1 flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("viewer2dRadialTitle")}</h3>
        <NumberSlider
          label={`${t("viewer2dAxialPositionLabel")} (m)`}
          value={axialU * (geometry.lengthMm / 1000)}
          min={0}
          max={geometry.lengthMm / 1000}
          step={geometry.lengthMm / 1000 / 100}
          onChange={(v) => setAxialU(geometry.lengthMm > 0 ? v / (geometry.lengthMm / 1000) : 0)}
          valueFormatter={(v) => `${v.toFixed(2)} m`}
        />
        <div className="rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            <span>{t("viewer2dWornWallLabel")}</span>
            <span className="ml-auto text-neutral-400">— {t("viewer2dOriginalWallLabel")} (⋯)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <span>{t("viewer2dCorrosionAllowanceLineLabel")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span>{t("viewer2dTMinLineLabel")}</span>
          </div>
        </div>
        <div className="rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <div className="font-semibold">{t("viewer2dMinRemainingWallLabel")}</div>
          <div className="font-mono text-base">{minSample.remainingMm.toFixed(2)} mm</div>
          <div className="text-neutral-500">
            {t("viewer2dMinRemainingWallLocationLabel")}: {describeClockPositionTr(minClockPosition)}
          </div>
        </div>
        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
          t_min ≈ {tMinMm.toFixed(2)} mm ({grade.designationX}, Class {DEFAULT_LOCATION_CLASS}) · CA = {geometry.corrosionAllowanceMm.toFixed(1)} mm
        </div>
      </div>
    </div>
  );
}
