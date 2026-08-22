// apps/web/src/features/viewer3d/sectionPlane/SectionPlaneControls.tsx
//
// Kesit düzlemi kontrol paneli — Canvas'ın üzerine (absolute) yerleşen
// kompakt, sol-üst yerleşimli bir HUD paneli. `useSectionPlane.ts`'in
// döndürdüğü state+action'ları doğrudan bağlar.

import { SECTION_AXES, type SectionAxis } from "./sectionPlaneMath";
import { NumberSlider } from "../../../components/NumberSlider";
import { useTranslation } from "../../../i18n/translations";
import type { TranslationKey } from "../../../i18n/translations";

const AXIS_LABEL_KEYS: Record<SectionAxis, TranslationKey> = {
  X: "viewer3dSectionAxisX",
  Y: "viewer3dSectionAxisY",
  Z: "viewer3dSectionAxisZ",
  FREE: "viewer3dSectionAxisFree",
};

const BUTTON_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white";
const BUTTON_CLASS_ACTIVE = "rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white";

export interface SectionPlaneControlsProps {
  enabled: boolean;
  onToggleEnabled: () => void;
  axis: SectionAxis;
  onSetAxis: (axis: SectionAxis) => void;
  offsetM: number;
  offsetRangeM: [number, number];
  onSetOffsetM: (offsetM: number) => void;
  thetaDeg: number;
  phiDeg: number;
  onSetThetaDeg: (thetaDeg: number) => void;
  onSetPhiDeg: (phiDeg: number) => void;
  halfSectionEnabled: boolean;
  onToggleHalfSection: () => void;
}

export function SectionPlaneControls({
  enabled,
  onToggleEnabled,
  axis,
  onSetAxis,
  offsetM,
  offsetRangeM,
  onSetOffsetM,
  thetaDeg,
  phiDeg,
  onSetThetaDeg,
  onSetPhiDeg,
  halfSectionEnabled,
  onToggleHalfSection,
}: SectionPlaneControlsProps) {
  const { t } = useTranslation();
  const [minOffsetM, maxOffsetM] = offsetRangeM;

  return (
    <div className="pointer-events-auto absolute left-2 top-10 z-10 w-56 rounded-md bg-neutral-900/80 p-2.5 text-neutral-200 backdrop-blur-sm">
      <label className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span>{t("viewer3dSectionTitle")}</span>
        <input type="checkbox" checked={enabled} onChange={onToggleEnabled} className="accent-emerald-600" />
      </label>

      {enabled && (
        <>
          {!halfSectionEnabled && (
            <>
              <div className="mb-2 flex gap-1">
                {SECTION_AXES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={a === axis ? BUTTON_CLASS_ACTIVE : BUTTON_CLASS}
                    onClick={() => onSetAxis(a)}
                  >
                    {t(AXIS_LABEL_KEYS[a])}
                  </button>
                ))}
              </div>

              {axis === "FREE" && (
                <>
                  <NumberSlider
                    label={t("viewer3dSectionTheta")}
                    value={thetaDeg}
                    min={0}
                    max={180}
                    step={1}
                    onChange={onSetThetaDeg}
                    valueFormatter={(v) => `${v.toFixed(0)}°`}
                  />
                  <NumberSlider
                    label={t("viewer3dSectionPhi")}
                    value={phiDeg}
                    min={0}
                    max={360}
                    step={1}
                    onChange={onSetPhiDeg}
                    valueFormatter={(v) => `${v.toFixed(0)}°`}
                  />
                </>
              )}

              <NumberSlider
                label={t("viewer3dSectionOffset")}
                value={offsetM}
                min={minOffsetM}
                max={maxOffsetM}
                step={(maxOffsetM - minOffsetM) / 200}
                onChange={onSetOffsetM}
                valueFormatter={(v) => `${(v * 1000).toFixed(0)} mm`}
              />
            </>
          )}

          <label className="mt-1 flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={halfSectionEnabled} onChange={onToggleHalfSection} className="accent-emerald-600" />
            <span>{t("viewer3dHalfSection")}</span>
          </label>
        </>
      )}
    </div>
  );
}
