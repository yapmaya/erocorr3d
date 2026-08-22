// apps/web/src/features/viewer3d/comparison/ComparisonViewer.tsx
//
// Karşılaştırma modu (master görev madde 6): iki senaryo (ör. inhibitörlü
// vs inhibitörsüz), YAN YANA iki BAĞIMSIZ `<Canvas>` + kamera senkronizasyonu
// (bkz. useSyncedCamera.ts), ya da tek bir FARK (delta) haritası görünümü.
// PipeViewer.tsx'in tam donanımlı tekli görüntüleyicisinin YERİNE (o anda)
// geçer — kesit/hotspot/ölçüm YOK, kapsam kasıtlı olarak dar tutuldu.

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { DEFAULT_LENGTH_MM, DEFAULT_OUTER_DIAMETER_MM, DEFAULT_WALL_THICKNESS_MM } from "../PipeMesh";
import { usePipeGeometry } from "../usePipeGeometry";
import { DEMO_SCENARIOS, computeDemoTimeDependentField, type DemoScenario } from "../timeSlider/demoTimeDependentField";
import { NumberSlider } from "../../../components/NumberSlider";
import { useTranslation } from "../../../i18n/translations";
import { useUiStore } from "../../../store/uiStore";
import type { ColormapName } from "../../../shaders";
import { ComparisonScene } from "./ComparisonScene";
import { useSyncedCameraState } from "./useSyncedCamera";
import { computeDeltaField, computeDeltaRange } from "./comparisonMath";

const DESIGN_LIFE_YEARS = 20;
const SIDE_BY_SIDE_COLORMAP: ColormapName = "corrosion";
// Fark haritası SIFIR-MERKEZLİ (negatif=A daha kötü, pozitif=B daha kötü) —
// kırmızı-yeşil ayrımına dayanmayan, diverging bir skala gerekir; bu proje
// zaten `colorblindSafe`i TAM OLARAK bu amaç için (RdYlBu-ters) barındırıyor
// (bkz. shaders/colormaps.ts).
const DELTA_COLORMAP: ColormapName = "colorblindSafe";

type ComparisonViewMode = "SIDE_BY_SIDE" | "DELTA";

const TAB_CLASS =
  "rounded px-2 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white";
const TAB_CLASS_ACTIVE = "rounded bg-sky-600 px-2 py-1 text-[11px] font-medium text-white";

export interface ComparisonViewerProps {
  onClose: () => void;
}

export function ComparisonViewer({ onClose }: ComparisonViewerProps) {
  const { t } = useTranslation();
  const isDark = useUiStore((s) => s.theme) === "dark";

  const geometryInfo = usePipeGeometry({
    componentType: "STRAIGHT_PIPE",
    odMm: DEFAULT_OUTER_DIAMETER_MM,
    wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
    idMm: DEFAULT_OUTER_DIAMETER_MM - 2 * DEFAULT_WALL_THICKNESS_MM,
    lengthMm: DEFAULT_LENGTH_MM,
    schedule: "STD",
  });

  const [scenarioAId, setScenarioAId] = useState(DEMO_SCENARIOS[0].id);
  const [scenarioBId, setScenarioBId] = useState(DEMO_SCENARIOS[1].id);
  const scenarioA: DemoScenario = DEMO_SCENARIOS.find((s) => s.id === scenarioAId) ?? DEMO_SCENARIOS[0];
  const scenarioB: DemoScenario = DEMO_SCENARIOS.find((s) => s.id === scenarioBId) ?? DEMO_SCENARIOS[1];
  const [elapsedYears, setElapsedYears] = useState(DESIGN_LIFE_YEARS / 2);
  const [viewMode, setViewMode] = useState<ComparisonViewMode>("SIDE_BY_SIDE");

  const valuesA = useMemo(
    () => computeDemoTimeDependentField(geometryInfo.geometry, elapsedYears, scenarioA),
    [geometryInfo.geometry, elapsedYears, scenarioA],
  );
  const valuesB = useMemo(
    () => computeDemoTimeDependentField(geometryInfo.geometry, elapsedYears, scenarioB),
    [geometryInfo.geometry, elapsedYears, scenarioB],
  );

  // İki tarafın renk skalasını ORTAK bir tepe değere göre kalibre eder —
  // her taraf KENDİ tepe değerine göre otomatik ölçeklenseydi, "daha az
  // hasarlı" senaryo da eşit derecede kırmızı görünebilirdi, karşılaştırmayı
  // anlamsızlaştırırdı.
  const sharedMaxValue = Math.max(
    scenarioA.peakRateMmPerYear * DESIGN_LIFE_YEARS * 0.6,
    scenarioB.peakRateMmPerYear * DESIGN_LIFE_YEARS * 0.6,
    0.5,
  );

  const deltaValues = useMemo(() => computeDeltaField(valuesA, valuesB), [valuesA, valuesB]);
  const deltaRange = useMemo(() => computeDeltaRange(deltaValues), [deltaValues]);

  const boundingRadiusM = Math.sqrt((geometryInfo.lengthM / 2) ** 2 + geometryInfo.outerRadiusM ** 2);
  const syncedState = useSyncedCameraState(
    [boundingRadiusM * 1.6, boundingRadiusM, boundingRadiusM * 1.6],
    [geometryInfo.lengthM / 2, 0, 0],
  );

  return (
    <div className="relative flex h-full w-full flex-col bg-neutral-950">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-neutral-800 bg-neutral-900 p-2 text-neutral-200">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">{t("viewer3dComparisonScenarioA")}</span>
          {DEMO_SCENARIOS.map((s) => (
            <button key={s.id} type="button" className={s.id === scenarioAId ? TAB_CLASS_ACTIVE : TAB_CLASS} onClick={() => setScenarioAId(s.id)}>
              {s.id}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">{t("viewer3dComparisonScenarioB")}</span>
          {DEMO_SCENARIOS.map((s) => (
            <button key={s.id} type="button" className={s.id === scenarioBId ? TAB_CLASS_ACTIVE : TAB_CLASS} onClick={() => setScenarioBId(s.id)}>
              {s.id}
            </button>
          ))}
        </div>
        <div className="w-40">
          <NumberSlider
            label={t("viewer3dComparisonElapsedYears")}
            value={elapsedYears}
            min={0}
            max={DESIGN_LIFE_YEARS}
            step={DESIGN_LIFE_YEARS / 200}
            onChange={setElapsedYears}
            valueFormatter={(v) => `${v.toFixed(1)} yıl`}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={viewMode === "SIDE_BY_SIDE" ? TAB_CLASS_ACTIVE : TAB_CLASS}
            onClick={() => setViewMode("SIDE_BY_SIDE")}
          >
            {t("viewer3dComparisonSideBySide")}
          </button>
          <button type="button" className={viewMode === "DELTA" ? TAB_CLASS_ACTIVE : TAB_CLASS} onClick={() => setViewMode("DELTA")}>
            {t("viewer3dComparisonDelta")}
          </button>
        </div>
        <button type="button" className="ml-auto rounded bg-neutral-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-neutral-600" onClick={onClose}>
          {t("viewer3dComparisonClose")}
        </button>
      </div>

      <div className="relative flex-1">
        {viewMode === "SIDE_BY_SIDE" ? (
          <div className="flex h-full w-full">
            <div className="relative h-full w-1/2 border-r border-neutral-800">
              <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-neutral-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
                A — {scenarioA.id}
              </span>
              <Canvas shadows="percentage" dpr={[1, 2]}>
                <ComparisonScene
                  geometryInfo={geometryInfo}
                  heatmapValues={valuesA}
                  minValue={0}
                  maxValue={sharedMaxValue}
                  colormap={SIDE_BY_SIDE_COLORMAP}
                  invertColormap={false}
                  wallThicknessMm={DEFAULT_WALL_THICKNESS_MM}
                  syncedState={syncedState}
                  master
                  isDark={isDark}
                />
              </Canvas>
            </div>
            <div className="relative h-full w-1/2">
              <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-neutral-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
                B — {scenarioB.id}
              </span>
              <Canvas shadows="percentage" dpr={[1, 2]}>
                <ComparisonScene
                  geometryInfo={geometryInfo}
                  heatmapValues={valuesB}
                  minValue={0}
                  maxValue={sharedMaxValue}
                  colormap={SIDE_BY_SIDE_COLORMAP}
                  invertColormap={false}
                  wallThicknessMm={DEFAULT_WALL_THICKNESS_MM}
                  syncedState={syncedState}
                  master={false}
                  isDark={isDark}
                />
              </Canvas>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-neutral-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
              Δ = B − A ({scenarioB.id} − {scenarioA.id})
            </span>
            <Canvas shadows="percentage" dpr={[1, 2]}>
              <ComparisonScene
                geometryInfo={geometryInfo}
                heatmapValues={deltaValues}
                minValue={deltaRange.minValue}
                maxValue={deltaRange.maxValue}
                colormap={DELTA_COLORMAP}
                invertColormap={false}
                wallThicknessMm={0}
                syncedState={syncedState}
                master
                isDark={isDark}
              />
            </Canvas>
          </div>
        )}
      </div>
    </div>
  );
}
