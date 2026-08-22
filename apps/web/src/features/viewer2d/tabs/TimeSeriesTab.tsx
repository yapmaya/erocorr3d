// apps/web/src/features/viewer2d/tabs/TimeSeriesTab.tsx
//
// Zaman Serisi — X: yıl, Y: minimum kalan kalınlık. t_min ile kesişim =
// tahmini arıza yılı. Belirsizlik bandı (P10-P90) gölgeli alan. Muayene
// aralığı önerisi.
//
// DOĞRUSALLIK NOTU: spatial/fields.ts'in hız×süre modeli DOĞRUSAL olduğundan
// (bkz. dataSource.ts dosya başı notu), en kötü noktadaki hasar her zaman
// AYNI (u,v) konumundadır ve zamanla DOĞRUSAL büyür — bu yüzden "minimum
// kalan kalınlık eğrisi" basitçe wt - fullLifeMaxValueMm×(yıl/tasarım_ömrü)
// olarak KAPALI FORMDA hesaplanır (ayrık zaman örneklemesi gerekmez).

import { useRef } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { applyMultiplicativeUncertaintyBand, getCoefficient, getPipeGrade, computeAsmeB318DesignWallThickness } from "@erocorr3d/engine";
import { useTranslation } from "../../../i18n/translations";
import type { Viewer2dDataSource } from "../dataSource";
import { DEFAULT_LOCATION_CLASS, DEFAULT_PIPE_GRADE_ID } from "../dataSource";
import { exportContainerSvgAsPng } from "../export/exportChartPng";
import { downloadCsv } from "../export/exportCsv";
import { formatMm, formatNumber } from "../chartFormat";

const YEAR_SAMPLE_COUNT = 40;

/**
 * Önerilen muayene aralığı — bu projenin kendi mühendislik kabulüdür (KDP
 * kapsamı dışı, bkz. corrosion/types.ts::classifyRiskScore'un AYNI türden
 * "projenin kendi raporlama kabulü" notu): RBI (Risk-Bazlı Muayene)
 * pratiğinde yaygın kullanılan "yarım-ömür kuralı" (API 510/570 felsefesiyle
 * tutarlı, ama TEK bir standart maddesine atıf VERİLMEZ) — bir sonraki
 * muayene, kalan ömrün YARISINDAN GEÇ olmamalıdır.
 */
const INSPECTION_INTERVAL_FRACTION_OF_REMAINING_LIFE = 0.5;

export function TimeSeriesTab({ dataSource }: { dataSource: Viewer2dDataSource }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { geometry, designLifeYears, fullLifeMaxValueMm } = dataSource;

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

  const bandFactor = getCoefficient<number>("uncertainty.defaultMultiplicativeBandFactor").value;

  const data = Array.from({ length: YEAR_SAMPLE_COUNT + 1 }, (_, i) => {
    const year = (i / YEAR_SAMPLE_COUNT) * designLifeYears;
    const fraction = designLifeYears > 0 ? year / designLifeYears : 0;
    const centralLossMm = fullLifeMaxValueMm * fraction;
    const band = applyMultiplicativeUncertaintyBand(Math.max(centralLossMm, 1e-9), bandFactor);
    const kalanIyimser = Math.max(geometry.wallThicknessMm - band.p10, 0);
    const kalanKoruyucu = Math.max(geometry.wallThicknessMm - band.p90, 0);
    return {
      year,
      kalanP50: Math.max(geometry.wallThicknessMm - band.p50, 0),
      kalanIyimser,
      kalanKoruyucu,
      // Recharts'ta tema-bağımsız bir "min-max bant" çizmenin standart yolu: görünmez bir
      // taban (kalanKoruyucu, stackId ile) + üzerine yığılmış (stacked) yalnızca FARKI
      // gösteren bir alan — arka plan rengiyle "boyayarak maskeleme" hilesine (açık/koyu
      // temada farklı davranırdı) gerek KALMAZ.
      bandDeltaMm: Math.max(kalanIyimser - kalanKoruyucu, 0),
    };
  });

  // t_min kesişimi: wt - fullLifeMaxValueMm×(yıl/tasarım_ömrü) = tMin → yıl = tasarım_ömrü×(wt-tMin)/fullLifeMaxValueMm
  const failureYear =
    fullLifeMaxValueMm > 0 ? (designLifeYears * (geometry.wallThicknessMm - tMinMm)) / fullLifeMaxValueMm : Infinity;
  const reachesThreshold = Number.isFinite(failureYear) && failureYear <= designLifeYears && failureYear >= 0;

  const remainingLifeFromNowYears = reachesThreshold ? Math.max(failureYear - dataSource.elapsedYears, 0) : null;
  const suggestedIntervalYears =
    remainingLifeFromNowYears !== null ? remainingLifeFromNowYears * INSPECTION_INTERVAL_FRACTION_OF_REMAINING_LIFE : null;

  const handleExportPng = () => exportContainerSvgAsPng(containerRef.current, "erocorr3d-zaman-serisi.png", "#0a0a0a");
  const handleExportCsv = () => {
    const rows: (string | number)[][] = [["yil", "kalan_kalinlik_p50_mm", "kalan_kalinlik_p10_mm", "kalan_kalinlik_p90_mm"]];
    for (const row of data) {
      rows.push([row.year.toFixed(2), row.kalanP50.toFixed(4), row.kalanIyimser.toFixed(4), row.kalanKoruyucu.toFixed(4)]);
    }
    downloadCsv("erocorr3d-zaman-serisi.csv", rows);
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("viewer2dTimeSeriesTitle")}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleExportPng} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportPngButton")}
          </button>
          <button type="button" onClick={handleExportCsv} className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-200 hover:bg-neutral-700">
            {t("viewer2dExportCsvButton")}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="year"
              type="number"
              domain={[0, designLifeYears]}
              tickFormatter={(v: number) => formatNumber(v, 0)}
              stroke="#a1a1aa"
              label={{ value: t("viewer2dYearAxisLabel"), position: "insideBottom", offset: -4, fill: "#a1a1aa", fontSize: 11 }}
            />
            <YAxis stroke="#a1a1aa" label={{ value: t("viewer2dRemainingWallAxisLabel"), angle: -90, position: "insideLeft", fill: "#a1a1aa", fontSize: 11 }} />
            <Tooltip
              formatter={(value) => formatMm(value)}
              labelFormatter={(v) => `${t("viewer2dYearAxisLabel")}: ${formatNumber(v, 1)}`}
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="kalanKoruyucu" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" />
            <Area
              type="monotone"
              dataKey="bandDeltaMm"
              stackId="band"
              name={t("viewer2dUncertaintyBandLabel")}
              stroke="none"
              fill="#0ea5e9"
              fillOpacity={0.18}
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="kalanP50" name={t("viewer2dRemainingWallAxisLabel")} stroke="#0ea5e9" dot={false} strokeWidth={2} isAnimationActive={false} />
            <ReferenceLine y={tMinMm} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "t_min", fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }} />
            {reachesThreshold && (
              <ReferenceLine
                x={failureYear}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{ value: `~${failureYear.toFixed(1)} yıl`, fill: "#f43f5e", fontSize: 10, position: "top" }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="font-semibold">{t("viewer2dEstimatedFailureYearLabel")}</div>
          {reachesThreshold ? (
            <div className="font-mono text-base">{failureYear.toFixed(1)} yıl</div>
          ) : (
            <div className="text-neutral-500">{t("viewer2dNeverReachesThresholdMessage")}</div>
          )}
        </div>
        <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="font-semibold">{t("viewer2dInspectionIntervalLabel")}</div>
          {suggestedIntervalYears !== null ? (
            <div className="font-mono text-base">≈ {suggestedIntervalYears.toFixed(1)} yıl</div>
          ) : (
            <div className="text-neutral-500">—</div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
        Muayene aralığı önerisi, kalan ömrün yarısı (RBI pratiğinde yaygın "yarım-ömür kuralı") esas alınarak bu projenin
        kendi mühendislik kabulüyle üretilmiştir — tek bir standart maddesine atıf verilmez, KDP kapsamı dışıdır.
      </p>
    </div>
  );
}
