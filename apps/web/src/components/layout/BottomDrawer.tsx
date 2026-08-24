// apps/web/src/components/layout/BottomDrawer.tsx
//
// Alt çekmece üstünde bir "2B Görünüm"/"Sonuçlar" anahtarı taşır (bkz.
// onaylı plan'ın "yerleşim" notu) — "2B Görünüm" var olan `Viewer2dPanel`'i
// DEĞİŞTİRMEDEN gösterir, "Sonuçlar" yeni `ResultsBottomPanel`'i gösterir.

import { useState } from "react";
import { useTranslation } from "../../i18n/translations";
import { useUiStore } from "../../store/uiStore";
import { Viewer2dPanel } from "../../features/viewer2d";
import { ResultsBottomPanel } from "../../features/results";

type DrawerMode = "VIEWER2D" | "RESULTS";

export function BottomDrawer() {
  const { t } = useTranslation();
  const isOpen = useUiStore((state) => state.isBottomDrawerOpen);
  const toggle = useUiStore((state) => state.toggleBottomDrawer);
  const [mode, setMode] = useState<DrawerMode>("VIEWER2D");

  return (
    <div data-tour="bottom-drawer" className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <button
        type="button"
        onClick={toggle}
        className="no-print flex h-6 shrink-0 items-center justify-between border-t border-neutral-200 px-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white"
        aria-label={isOpen ? t("bottomDrawerToggleClose") : t("bottomDrawerToggleOpen")}
      >
        <span>{t("bottomDrawerTitle")}</span>
        <span>{isOpen ? "▾" : "▴"}</span>
      </button>
      {isOpen && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b border-neutral-200 px-3 py-1 dark:border-neutral-800">
            {(["VIEWER2D", "RESULTS"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  mode === m ? "bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {t(m === "VIEWER2D" ? "bottomDrawerSwitchViewer2d" : "bottomDrawerSwitchResults")}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">{mode === "VIEWER2D" ? <Viewer2dPanel /> : <ResultsBottomPanel />}</div>
        </div>
      )}
    </div>
  );
}
