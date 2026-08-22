// apps/web/src/features/input/components/FlowRegimeIndicator.tsx
//
// Beggs-Brill (1973) akış rejimi haritasında hesaplanan noktayı gösteren
// küçük bir SVG grafiği — `fluids/flowRegime.ts::computeFlowPatternMapCurves`
// çağrısının (motorun KENDİ ürettiği L1-L4 sınır eğrileri) doğrudan
// görselleştirmesidir, yeni bir eğri/katsayı İCAT ETMEZ.
//
// ÖNEMLİ: Beggs-Brill sınıflandırması (SEGREGATED/INTERMITTENT/DISTRIBUTED)
// motorun `ProcessConditions.flowRegime` alanının beklediği taksonomiyle
// (Taitel-Dukler tarzı: STRATIFIED_SMOOTH/WAVY/SLUG/ANNULAR/MIST/BUBBLE/
// CHURN) BİREBİR aynı değildir — motorda bu iki sınıflandırma arasında
// kaynaklı bir eşleme YOKTUR. Bu bileşen bu yüzden Beggs-Brill sonucunu
// yalnızca DANIŞMA amaçlı gösterir; `flowRegime` seçimi kullanıcının kendi
// mühendislik kararıdır (bkz. fieldHelp.ts'in process.flowRegime notu).

import { useMemo } from "react";
import { computeFlowPatternMapCurves, type FlowPatternClassification } from "@erocorr3d/engine";

const WIDTH = 220;
const HEIGHT = 130;
const MARGIN = { top: 8, right: 8, bottom: 18, left: 30 };
const LOG_LAMBDA_MIN = -3;
const LOG_LAMBDA_MAX = 0;
const LOG_FROUDE_MIN = -2;
const LOG_FROUDE_MAX = 3;

function xPix(lambda: number): number {
  const t = (Math.log10(lambda) - LOG_LAMBDA_MIN) / (LOG_LAMBDA_MAX - LOG_LAMBDA_MIN);
  return MARGIN.left + t * (WIDTH - MARGIN.left - MARGIN.right);
}

function yPix(froude: number): number {
  const clamped = Math.max(froude, 10 ** LOG_FROUDE_MIN);
  const t = (Math.log10(clamped) - LOG_FROUDE_MIN) / (LOG_FROUDE_MAX - LOG_FROUDE_MIN);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  return MARGIN.top + innerHeight - t * innerHeight;
}

function toPath(curveKey: "l1" | "l2" | "l3", points: ReturnType<typeof computeFlowPatternMapCurves>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xPix(p.noSlipLiquidHoldup).toFixed(1)},${yPix(p[curveKey]).toFixed(1)}`)
    .join(" ");
}

const PATTERN_LABEL_TR: Record<FlowPatternClassification, string> = {
  SEGREGATED: "Ayrışmış (Segregated)",
  INTERMITTENT: "Aralıklı (Intermittent)",
  DISTRIBUTED: "Dağılmış (Distributed)",
  TRANSITION: "Geçiş (Transition)",
};

export interface FlowRegimeIndicatorProps {
  noSlipLiquidHoldup: number;
  froudeNumber: number;
  pattern: FlowPatternClassification;
}

export function FlowRegimeIndicator({ noSlipLiquidHoldup, froudeNumber, pattern }: FlowRegimeIndicatorProps) {
  const curvePoints = useMemo(() => computeFlowPatternMapCurves(60), []);

  const pointX = xPix(Math.min(Math.max(noSlipLiquidHoldup, 10 ** LOG_LAMBDA_MIN), 1));
  const pointY = yPix(froudeNumber);

  return (
    <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-neutral-500 dark:text-neutral-400">Beggs-Brill akış deseni (danışma amaçlı)</span>
        <span className="font-semibold text-sky-700 dark:text-sky-400">{PATTERN_LABEL_TR[pattern]}</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Beggs-Brill akış rejimi haritası">
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="fill-transparent" />
        <path d={toPath("l1", curvePoints)} className="fill-none stroke-amber-500" strokeWidth={1} />
        <path d={toPath("l2", curvePoints)} className="fill-none stroke-sky-500" strokeWidth={1} />
        <path d={toPath("l3", curvePoints)} className="fill-none stroke-emerald-500" strokeWidth={1} />
        <circle cx={pointX} cy={pointY} r={4} className="fill-red-500 stroke-white" strokeWidth={1} />
        <text x={MARGIN.left} y={HEIGHT - 4} className="fill-neutral-400 text-[9px]">
          λL (no-slip tutulum, log)
        </text>
        <text x={2} y={MARGIN.top + 8} className="fill-neutral-400 text-[9px]" transform={`rotate(-90 10 ${HEIGHT / 2})`}>
          NFR (Froude, log)
        </text>
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />L1</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />L2</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />L3</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Hesaplanan nokta</span>
      </div>
    </div>
  );
}
