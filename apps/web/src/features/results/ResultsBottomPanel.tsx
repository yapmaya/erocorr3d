// apps/web/src/features/results/ResultsBottomPanel.tsx
//
// Alt çekmecenin "Sonuçlar" içeriği — `viewer2d/Viewer2dPanel.tsx`'in KENDİ
// sekme çubuğu desenini (buton stilleri, tek `activeTab` state'i) BİREBİR
// izleyen 9 sekme: Sonuç Tablosu (A) + 8 grafik (B'nin 2 alt-sekmesi
// dahil: Yığılmış/Şelale).

import { useState } from "react";
import { useTranslation, type TranslationKey } from "../../i18n/translations";
import { ResultsTable } from "./components/ResultsTable";
import { MechanismBreakdownChart } from "./charts/MechanismBreakdownChart";
import { MechanismWaterfallChart } from "./charts/MechanismWaterfallChart";
import { ScenarioComparisonChart } from "./charts/ScenarioComparisonChart";
import { MetalLossTimeSeriesChart } from "./charts/MetalLossTimeSeriesChart";
import { TornadoChart } from "./charts/TornadoChart";
import { MonteCarloHistogramChart } from "./charts/MonteCarloHistogramChart";
import { VelocityErosionChart } from "./charts/VelocityErosionChart";
import { MaterialComparisonMatrix } from "./MaterialComparisonMatrix";

type TabId =
  | "TABLE"
  | "MECHANISM_STACKED"
  | "MECHANISM_WATERFALL"
  | "SCENARIO_COMPARISON"
  | "TIME_SERIES"
  | "TORNADO"
  | "MONTE_CARLO"
  | "VELOCITY_EROSION"
  | "MATERIAL_MATRIX";

const TAB_IDS: TabId[] = [
  "TABLE",
  "MECHANISM_STACKED",
  "MECHANISM_WATERFALL",
  "SCENARIO_COMPARISON",
  "TIME_SERIES",
  "TORNADO",
  "MONTE_CARLO",
  "VELOCITY_EROSION",
  "MATERIAL_MATRIX",
];

const TAB_LABEL_KEYS: Record<TabId, TranslationKey> = {
  TABLE: "resultsTabTable",
  MECHANISM_STACKED: "resultsTabMechanismStacked",
  MECHANISM_WATERFALL: "resultsTabMechanismWaterfall",
  SCENARIO_COMPARISON: "resultsTabScenarioComparison",
  TIME_SERIES: "resultsTabTimeSeries",
  TORNADO: "resultsTabTornado",
  MONTE_CARLO: "resultsTabMonteCarlo",
  VELOCITY_EROSION: "resultsTabVelocityErosion",
  MATERIAL_MATRIX: "resultsTabMaterialMatrix",
};

export function ResultsBottomPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("TABLE");

  return (
    <div className="flex h-full flex-col text-neutral-900 dark:text-neutral-100">
      <nav className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              activeTab === id ? "bg-sky-600 text-white" : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {t(TAB_LABEL_KEYS[id])}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "TABLE" && <ResultsTable />}
        {activeTab === "MECHANISM_STACKED" && <MechanismBreakdownChart />}
        {activeTab === "MECHANISM_WATERFALL" && <MechanismWaterfallChart />}
        {activeTab === "SCENARIO_COMPARISON" && <ScenarioComparisonChart />}
        {activeTab === "TIME_SERIES" && <MetalLossTimeSeriesChart />}
        {activeTab === "TORNADO" && <TornadoChart />}
        {activeTab === "MONTE_CARLO" && <MonteCarloHistogramChart />}
        {activeTab === "VELOCITY_EROSION" && <VelocityErosionChart />}
        {activeTab === "MATERIAL_MATRIX" && <MaterialComparisonMatrix />}
      </div>
    </div>
  );
}
