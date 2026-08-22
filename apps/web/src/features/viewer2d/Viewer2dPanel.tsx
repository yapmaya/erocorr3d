// apps/web/src/features/viewer2d/Viewer2dPanel.tsx
//
// 2B tamamlayıcı görünümler — master görev: "3B güzel ama mühendis sayı
// ister." Alt çekmecede sekmeler: Radyal Kesit, Eksenel Profil, Açısal
// Profil, Zaman Serisi, Kalan Dayanım (ASME B31G).

import { useState } from "react";
import { useTranslation, type TranslationKey } from "../../i18n/translations";
import { useViewer2dDataSource } from "./dataSource";
import { RadialSectionTab } from "./tabs/RadialSectionTab";
import { AxialProfileTab } from "./tabs/AxialProfileTab";
import { AngularProfileTab } from "./tabs/AngularProfileTab";
import { TimeSeriesTab } from "./tabs/TimeSeriesTab";
import { RemainingStrengthTab } from "./tabs/RemainingStrengthTab";

type TabId = "RADIAL" | "AXIAL" | "ANGULAR" | "TIME_SERIES" | "REMAINING_STRENGTH";

const TAB_IDS: TabId[] = ["RADIAL", "AXIAL", "ANGULAR", "TIME_SERIES", "REMAINING_STRENGTH"];

export function Viewer2dPanel() {
  const { t } = useTranslation();
  const dataSource = useViewer2dDataSource();
  const [activeTab, setActiveTab] = useState<TabId>("RADIAL");

  const tabLabelKeys: Record<TabId, TranslationKey> = {
    RADIAL: "viewer2dTabRadial",
    AXIAL: "viewer2dTabAxial",
    ANGULAR: "viewer2dTabAngular",
    TIME_SERIES: "viewer2dTabTimeSeries",
    REMAINING_STRENGTH: "viewer2dTabRemainingStrength",
  };

  return (
    <div className="flex h-full flex-col text-neutral-900 dark:text-neutral-100">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {t("viewer2dTitle")}
        </span>
        <button
          type="button"
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            dataSource.isBotas
              ? "bg-emerald-700 text-white"
              : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          }`}
          onClick={() => dataSource.setDataSourceKind(dataSource.isBotas ? "DEMO" : "BOTAS")}
        >
          {dataSource.isBotas ? `✓ ${t("viewer3dRealDataToggle")}` : t("viewer3dRealDataToggle")}
        </button>
        <button
          type="button"
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            dataSource.dataSourceKind === "CUSTOM"
              ? "bg-sky-700 text-white"
              : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          }`}
          onClick={() => dataSource.setDataSourceKind(dataSource.dataSourceKind === "CUSTOM" ? "DEMO" : "CUSTOM")}
        >
          {dataSource.dataSourceKind === "CUSTOM" ? "✓ Özel Veri" : "Özel Veri"}
        </button>
        <select
          className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          value={dataSource.scenarioId}
          onChange={(e) => dataSource.setScenarioId(e.target.value)}
        >
          {dataSource.scenarioTabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.labelTr}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{dataSource.geometry.caseNameTr}</span>
        {dataSource.geometry.isRepresentative && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            {t("viewer2dRepresentativeBadge")}
          </span>
        )}
        {dataSource.dataSourceKind === "CUSTOM" && !dataSource.isCustomReady && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
            Özel veri henüz hesaplanmadı
          </span>
        )}
        <nav className="ml-auto flex gap-1">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded px-2 py-1 text-[11px] font-medium ${
                activeTab === id
                  ? "bg-sky-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {t(tabLabelKeys[id])}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {activeTab === "RADIAL" && <RadialSectionTab dataSource={dataSource} />}
        {activeTab === "AXIAL" && <AxialProfileTab dataSource={dataSource} />}
        {activeTab === "ANGULAR" && <AngularProfileTab dataSource={dataSource} />}
        {activeTab === "TIME_SERIES" && <TimeSeriesTab dataSource={dataSource} />}
        {activeTab === "REMAINING_STRENGTH" && <RemainingStrengthTab dataSource={dataSource} />}
      </div>
    </div>
  );
}
