// apps/web/src/shaders/Colorbar.tsx
//
// Isı haritası lejantı: dikey renk çubuğu + mm etiketleri, opsiyonel
// "kalan duvar kalınlığı" ikinci ekseni (yalnızca HASAR modunda anlamlı —
// çağıran taraf `wallThicknessMm` vermezse gösterilmez), opsiyonel korozyon
// payı (CA) çizgi işareti (üstündeyse kırmızı alarm), skala modu
// (LİNEER/LOGARİTMİK/YÜZDELİK) toggle'ı ve senaryolar arası karşılaştırma
// için manuel min/max kilitleme.

import { useEffect, useState } from "react";
import { colormapToCssGradient, type ColormapName } from "./colormaps";
import { COLORBAR_SCALE_MODES, mapValueToBarPosition, type ColorbarScaleMode } from "./colorbarScale";

export interface ColorbarProps {
  colormap: ColormapName;
  minValue: number;
  maxValue: number;
  unitLabel: string;
  /** `demoScalarField.ts::isInvertedVisualizationMode` ile aynı anlamda — mesh'te GERÇEKTEN görünen renklerle tutarlı kalması için. */
  invert?: boolean;
  wallThicknessMm?: number;
  corrosionAllowanceMm?: number;
  scaleMode: ColorbarScaleMode;
  onScaleModeChange: (mode: ColorbarScaleMode) => void;
  locked: boolean;
  onLockedChange: (locked: boolean) => void;
  onRangeChange: (minValue: number, maxValue: number) => void;
}

const SCALE_MODE_LABELS_TR: Record<ColorbarScaleMode, string> = {
  LINEAR: "Lineer",
  LOG: "Logaritmik",
  PERCENT: "Yüzdelik",
};

const TICK_COUNT = 5;

export function Colorbar({
  colormap,
  minValue,
  maxValue,
  unitLabel,
  invert = false,
  wallThicknessMm,
  corrosionAllowanceMm,
  scaleMode,
  onScaleModeChange,
  locked,
  onLockedChange,
  onRangeChange,
}: ColorbarProps) {
  const [draftMin, setDraftMin] = useState(minValue);
  const [draftMax, setDraftMax] = useState(maxValue);

  useEffect(() => {
    if (!locked) {
      setDraftMin(minValue);
      setDraftMax(maxValue);
    }
  }, [locked, minValue, maxValue]);

  const gradient = colormapToCssGradient(colormap, 32, invert);
  const range = Math.max(maxValue - minValue, 1e-9);

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const value = minValue + (range * i) / (TICK_COUNT - 1);
    return { value, position: mapValueToBarPosition(value, minValue, maxValue, scaleMode) };
  });

  const caPosition =
    corrosionAllowanceMm !== undefined && corrosionAllowanceMm >= minValue && corrosionAllowanceMm <= maxValue
      ? mapValueToBarPosition(corrosionAllowanceMm, minValue, maxValue, scaleMode)
      : null;

  const formatValue = (value: number): string => {
    if (scaleMode === "PERCENT") {
      const pct = maxValue !== 0 ? (value / maxValue) * 100 : 0;
      return `%${pct.toFixed(0)}`;
    }
    return value.toFixed(2);
  };

  return (
    <div className="flex select-none items-stretch gap-3 rounded border border-neutral-200 bg-white/90 p-2 text-[11px] text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-200">
      <div className="relative mt-2 mb-6 h-40 w-4 rounded" style={{ background: gradient }}>
        {ticks.map((tick, i) => (
          <div
            key={i}
            className="absolute left-full ml-1 -translate-y-1/2 whitespace-nowrap font-mono"
            style={{ bottom: `${tick.position * 100}%` }}
          >
            {formatValue(tick.value)}
          </div>
        ))}
        {caPosition !== null && (
          <div
            className="absolute inset-x-[-3px] h-[2px] -translate-y-1/2 bg-red-600"
            style={{ bottom: `${caPosition * 100}%` }}
            title={`Korozyon payı (CA): ${corrosionAllowanceMm} ${unitLabel}`}
          />
        )}
      </div>

      {wallThicknessMm !== undefined && (
        <div className="relative mt-2 mb-6 h-40 w-4 rounded border border-dashed border-neutral-300 dark:border-neutral-700">
          {ticks.map((tick, i) => {
            const remaining = Math.max(wallThicknessMm - tick.value, 0);
            return (
              <div
                key={i}
                className="absolute right-full mr-1 -translate-y-1/2 whitespace-nowrap font-mono text-neutral-400"
                style={{ bottom: `${tick.position * 100}%` }}
              >
                {remaining.toFixed(1)}
              </div>
            );
          })}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-neutral-400">
            kalan (mm)
          </div>
        </div>
      )}

      <div className="flex w-32 flex-col justify-between">
        <div>
          <div className="mb-1 font-medium">{unitLabel}</div>
          <div className="flex gap-1">
            {COLORBAR_SCALE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onScaleModeChange(mode)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${
                  scaleMode === mode
                    ? "bg-sky-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {SCALE_MODE_LABELS_TR[mode]}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-2 flex items-center gap-1">
          <input type="checkbox" checked={locked} onChange={(e) => onLockedChange(e.target.checked)} />
          <span>Min/Max kilitle</span>
        </label>

        {locked && (
          <div className="mt-1 flex flex-col gap-1">
            <input
              type="number"
              value={draftMin}
              onChange={(e) => setDraftMin(Number(e.target.value))}
              onBlur={() => onRangeChange(draftMin, draftMax)}
              className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 font-mono dark:border-neutral-700 dark:bg-neutral-900"
            />
            <input
              type="number"
              value={draftMax}
              onChange={(e) => setDraftMax(Number(e.target.value))}
              onBlur={() => onRangeChange(draftMin, draftMax)}
              className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 font-mono dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        )}
      </div>
    </div>
  );
}
