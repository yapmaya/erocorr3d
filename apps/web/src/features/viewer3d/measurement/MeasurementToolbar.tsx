// apps/web/src/features/viewer3d/measurement/MeasurementToolbar.tsx
//
// Ölçüm modu seçici — TimeSliderPanel'in HEMEN ÜSTÜNDE, sol altta yerleşen
// kompakt HUD şeridi. Etkin mod, tıklamaları `PipeMesh.onSurfaceClick`
// üzerinden `useMeasurementState.ts`e yönlendirir (bkz. PipeViewer.tsx).

import { MEASUREMENT_MODES, type MeasurementMode } from "./useMeasurementState";
import { useTranslation } from "../../../i18n/translations";
import type { TranslationKey } from "../../../i18n/translations";

const MODE_LABEL_KEYS: Record<MeasurementMode, TranslationKey> = {
  NONE: "viewer3dMeasureNone",
  DISTANCE: "viewer3dMeasureDistance",
  WALL_PROBE: "viewer3dMeasureWallProbe",
  CLOCK: "viewer3dMeasureClock",
};

const BUTTON_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white";
const BUTTON_CLASS_ACTIVE = "rounded bg-violet-600 px-2 py-1 text-[11px] font-medium text-white";

export interface MeasurementToolbarProps {
  mode: MeasurementMode;
  onSetMode: (mode: MeasurementMode) => void;
}

export function MeasurementToolbar({ mode, onSetMode }: MeasurementToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-auto absolute bottom-24 left-2 z-10 flex items-center gap-1 rounded-md bg-neutral-900/80 p-1.5 backdrop-blur-sm">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-neutral-500">{t("viewer3dMeasureTitle")}</span>
      {MEASUREMENT_MODES.map((m) => (
        <button key={m} type="button" className={m === mode ? BUTTON_CLASS_ACTIVE : BUTTON_CLASS} onClick={() => onSetMode(m)}>
          {t(MODE_LABEL_KEYS[m])}
        </button>
      ))}
    </div>
  );
}
