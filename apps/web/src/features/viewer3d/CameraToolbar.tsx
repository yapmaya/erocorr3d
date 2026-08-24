// apps/web/src/features/viewer3d/CameraToolbar.tsx
//
// Sahnenin ÜZERİNE (Canvas dışında, absolute konumlu) yerleşen kompakt
// kamera araç çubuğu — hızlı görünüm butonları, sığdır/sıfırla,
// perspektif↔ortografik geçiş. `useCameraController.ts`'in döndürdüğü
// eylemleri doğrudan çağırır, kendi kamera mantığı İÇERMEZ.

import { QUICK_VIEW_PRESETS, type QuickViewPreset } from "./cameraViews";
import { useTranslation } from "../../i18n/translations";
import type { TranslationKey } from "../../i18n/translations";

const VIEW_LABEL_KEYS: Record<QuickViewPreset, TranslationKey> = {
  FRONT: "viewer3dViewFront",
  TOP: "viewer3dViewTop",
  SIDE: "viewer3dViewSide",
  ISO: "viewer3dViewIso",
};

const BUTTON_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white";
const BUTTON_CLASS_ACTIVE = "rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white";

export interface CameraToolbarProps {
  currentView: QuickViewPreset;
  orthographic: boolean;
  onGoToView: (preset: QuickViewPreset) => void;
  onFit: () => void;
  onReset: () => void;
  onTogglePerspective: () => void;
}

export function CameraToolbar({ currentView, orthographic, onGoToView, onFit, onReset, onTogglePerspective }: CameraToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="no-print pointer-events-auto absolute right-2 top-2 z-10 flex flex-wrap items-center gap-1 rounded-md bg-neutral-900/80 p-1.5 backdrop-blur-sm">
      {QUICK_VIEW_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={preset === currentView}
          className={preset === currentView ? BUTTON_CLASS_ACTIVE : BUTTON_CLASS}
          onClick={() => onGoToView(preset)}
        >
          {t(VIEW_LABEL_KEYS[preset])}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-neutral-700" aria-hidden />
      <button type="button" className={BUTTON_CLASS} onClick={onFit}>
        {t("viewer3dFitToObject")}
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={onReset}>
        {t("viewer3dResetView")}
      </button>
      <span className="mx-0.5 h-4 w-px bg-neutral-700" aria-hidden />
      <button type="button" aria-pressed={orthographic} className={orthographic ? BUTTON_CLASS_ACTIVE : BUTTON_CLASS} onClick={onTogglePerspective}>
        {orthographic ? t("viewer3dOrthographic") : t("viewer3dPerspective")}
      </button>
    </div>
  );
}
