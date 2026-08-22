// apps/web/src/features/viewer3d/timeSlider/TimeSliderPanel.tsx
//
// Canvas'ın ALTINA sabitlenen, tam genişlikli zaman kaydırıcısı HUD paneli:
// senaryo sekmeleri + oynat/duraklat + hız + yıl kaydırıcısı (üzerinde
// "duvar delinme yılı" otomatik işareti). Tüm hesap mantığı
// `useTimePlaybackState.ts`/`demoTimeDependentField.ts`e ait — bu dosya
// SADECE görüntüler/olay bağlar.

import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "./useTimePlaybackState";
import { useTranslation } from "../../../i18n/translations";

/** Sekme olarak gösterilebilecek her şeyin ortak şekli — DemoScenario VE ReferenceFacilityScenarioTab bu şekli sağlar (bkz. referenceFacility/referenceFacilityScenarios.ts). */
export interface ScenarioTab {
  id: string;
  labelTr: string;
}

const TAB_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white";
const TAB_CLASS_ACTIVE = "rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white";
const ICON_BUTTON_CLASS =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded bg-neutral-700 text-sm text-white transition-colors hover:bg-neutral-600";
const SPEED_BUTTON_CLASS =
  "rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white";
const SPEED_BUTTON_CLASS_ACTIVE = "rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-medium text-white";

export interface TimeSliderPanelProps {
  elapsedYears: number;
  designLifeYears: number;
  onSetElapsedYears: (years: number) => void;
  playing: boolean;
  onTogglePlaying: () => void;
  speed: PlaybackSpeed;
  onSetSpeed: (speed: PlaybackSpeed) => void;
  /** `Infinity` ise tasarım ömrü içinde delinme YOKTUR, işaret gösterilmez. */
  breachYears: number;
  scenarios: ScenarioTab[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  heatmapEnabled: boolean;
  onToggleHeatmap: () => void;
}

export function TimeSliderPanel({
  elapsedYears,
  designLifeYears,
  onSetElapsedYears,
  playing,
  onTogglePlaying,
  speed,
  onSetSpeed,
  breachYears,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  heatmapEnabled,
  onToggleHeatmap,
}: TimeSliderPanelProps) {
  const { t } = useTranslation();
  const breachPercent = Number.isFinite(breachYears) ? Math.min(100, Math.max(0, (breachYears / designLifeYears) * 100)) : null;
  const breached = elapsedYears >= breachYears;

  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-10 rounded-t-md bg-neutral-900/85 p-2 backdrop-blur-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] uppercase tracking-wide text-neutral-500">{t("viewer3dScenario")}</span>
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className={scenario.id === selectedScenarioId ? TAB_CLASS_ACTIVE : TAB_CLASS}
            onClick={() => onSelectScenario(scenario.id)}
            title={scenario.labelTr}
          >
            {scenario.id}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-neutral-700" aria-hidden />
        <button
          type="button"
          className={heatmapEnabled ? TAB_CLASS_ACTIVE : TAB_CLASS}
          onClick={onToggleHeatmap}
        >
          {t("viewer3dHeatmapToggle")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className={ICON_BUTTON_CLASS} onClick={onTogglePlaying} aria-label={playing ? t("viewer3dPause") : t("viewer3dPlay")}>
          {playing ? "⏸" : "▶"}
        </button>

        <div className="flex gap-0.5">
          {PLAYBACK_SPEEDS.map((s) => (
            <button key={s} type="button" className={s === speed ? SPEED_BUTTON_CLASS_ACTIVE : SPEED_BUTTON_CLASS} onClick={() => onSetSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={designLifeYears}
            step={designLifeYears / 400}
            value={elapsedYears}
            onChange={(e) => onSetElapsedYears(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          {breachPercent !== null && (
            <div
              className="pointer-events-none absolute top-0 h-full w-0.5 bg-red-500"
              style={{ left: `${breachPercent}%` }}
              title={`${t("viewer3dBreachYear")}: ${breachYears.toFixed(1)}`}
            />
          )}
        </div>

        <span className={`w-28 shrink-0 text-right font-mono text-[11px] ${breached ? "text-red-400" : "text-neutral-300"}`}>
          {elapsedYears.toFixed(1)} / {designLifeYears.toFixed(0)} {t("viewer3dYearsUnit")}
        </span>
      </div>
    </div>
  );
}
