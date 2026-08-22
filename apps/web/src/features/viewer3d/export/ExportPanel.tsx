// apps/web/src/features/viewer3d/export/ExportPanel.tsx
//
// Dışa aktarma HUD paneli — sağ altta (TimeSliderPanel'in ÜSTÜNDE,
// MeasurementToolbar'ın simetriği). Gerçek dosya üretimi/indirme
// PipeViewer.tsx::SceneRoot'ta yapılır (Canvas'ın `gl`/`scene`/`camera`sına
// erişim gerektirir) — bu dosya SADECE düğmeler/kısa geri bildirimdir.

import { useState } from "react";
import { useTranslation } from "../../../i18n/translations";

const BUTTON_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-neutral-700 hover:text-white";

const COPY_FEEDBACK_DURATION_MS = 2000;

export interface ExportPanelProps {
  onExportPng: (transparentBackground: boolean) => void;
  onExportGlb: () => void;
  onCopyShareLink: () => void;
}

export function ExportPanel({ onExportPng, onExportGlb, onCopyShareLink }: ExportPanelProps) {
  const { t } = useTranslation();
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyShareLink();
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
  };

  return (
    <div className="pointer-events-auto absolute bottom-24 right-2 z-10 flex flex-col gap-1.5 rounded-md bg-neutral-900/80 p-2 text-neutral-200 backdrop-blur-sm">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">{t("viewer3dExportTitle")}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={BUTTON_CLASS} onClick={() => onExportPng(transparentBackground)}>
          {t("viewer3dExportPng")}
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={onExportGlb}>
          {t("viewer3dExportGlb")}
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={transparentBackground}
          onChange={() => setTransparentBackground((v) => !v)}
          className="accent-sky-600"
        />
        <span>{t("viewer3dExportTransparent")}</span>
      </label>
      <button type="button" className={BUTTON_CLASS} onClick={handleCopy}>
        {copied ? t("viewer3dExportLinkCopied") : t("viewer3dExportCopyLink")}
      </button>
    </div>
  );
}
