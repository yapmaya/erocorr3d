// apps/web/src/features/shortcuts/ShortcutsHelpModal.tsx
//
// "?" kısayolu/düğmesiyle açılan klavye kısayolları yardımı. Aynı zamanda
// tanıtım turunu yeniden başlatan bir bağlantı taşır (onboarding'e ikinci
// bir giriş noktası — bkz. HeaderBar'daki tek "?" düğmesi).

import { useEffect, useRef } from "react";
import { useTranslation } from "../../i18n/translations";

export interface ShortcutsHelpModalProps {
  onClose: () => void;
  onRestartTour: () => void;
}

const ROWS: { key: string; labelKey: "shortcutsCalculate" | "shortcutsSection" | "shortcutsPlayPause" | "shortcutsScreenshot" | "shortcutsHelp" }[] = [
  { key: "Ctrl/Cmd + Enter", labelKey: "shortcutsCalculate" },
  { key: "C", labelKey: "shortcutsSection" },
  { key: "Space", labelKey: "shortcutsPlayPause" },
  { key: "S", labelKey: "shortcutsScreenshot" },
  { key: "?", labelKey: "shortcutsHelp" },
];

export function ShortcutsHelpModal({ onClose, onRestartTour }: ShortcutsHelpModalProps) {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[16777300] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        className="flex w-full max-w-sm flex-col rounded bg-white p-4 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="shortcuts-help-title" className="text-sm font-semibold">
            {t("shortcutsHelpTitle")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("shortcutsCloseButton")}
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <table className="w-full text-xs">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1.5 pr-3 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{row.key}</td>
                <td className="py-1.5 text-neutral-800 dark:text-neutral-100">{t(row.labelKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => {
            onRestartTour();
            onClose();
          }}
          className="mt-3 rounded bg-neutral-100 px-2 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          {t("onboardingRestartButton")}
        </button>
      </div>
    </div>
  );
}
