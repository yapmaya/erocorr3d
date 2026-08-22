// apps/web/src/pages/GeometryLab.tsx
//
// Geometri Laboratuvarı: geometry/ altındaki 8 boru/fitting üreticisini VE
// (Faz 2 — bkz. features/valveViewer/) 10 vana montajını slider'larla canlı
// test edebileceğin sayfa. İki mod arasında üstteki sekmeden geçilir:
// FITTING modu (bu dosyanın kendi içeriği, henüz renksiz/gri metal —
// ısı haritası shader'ı sonraki bir adımda bağlanacak, bkz. shaders/
// heatmap.*.glsl) ve VALVE modu (features/valveViewer/ValveTab.tsx'e
// TAMAMEN devredilir — kendi kontrol paneli + Canvas'ı vardır, çünkü vana
// montajları kesit/animasyon/tıklama gibi FITTING modunun hiç ihtiyaç
// duymadığı ek denetimler gerektirir).

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { DoubleSide, type BufferGeometry } from "three";
import {
  createElbow,
  createFlangedSpool,
  createMiterBend,
  createOrificePlate,
  createReducer,
  createStraightPipe,
  createTee,
  createWeldJoint,
  type GeneratedGeometry,
  type LodLevel,
} from "../geometry";
import { useTranslation, type TranslationKey } from "../i18n/translations";
import { ValveTab } from "../features/valveViewer/ValveTab";
import {
  COLORMAP_NAMES,
  Colorbar,
  HEATMAP_VISUALIZATION_MODES,
  HeatmapMesh,
  computeDemoScalarField,
  isInvertedVisualizationMode,
  type ColorbarScaleMode,
  type ColormapName,
  type HeatmapVisualizationMode,
} from "../shaders";

type ShapeKind =
  | "STRAIGHT_PIPE"
  | "ELBOW"
  | "REDUCER"
  | "WELD_JOINT"
  | "ORIFICE_PLATE"
  | "MITER_BEND"
  | "FLANGED_SPOOL"
  | "TEE";

interface FieldDef {
  key: string;
  labelTr: string;
  min: number;
  max: number;
  step: number;
}

interface ShapeConfig {
  kind: ShapeKind;
  labelTr: string;
  fields: FieldDef[];
  defaults: Record<string, number>;
  /** Sayısal olmayan (enum) seçiciler — ör. redüksiyon tipi, basınç sınıfı. */
  enumField?: { key: string; labelTr: string; options: { value: string | number; labelTr: string }[] };
  build: (params: Record<string, number>, enumValue: string | number | undefined, lod: LodLevel) => GeneratedGeometry;
}

const MM = (v: number) => v; // okunabilirlik için — birim mm

const SHAPE_CONFIGS: ShapeConfig[] = [
  {
    kind: "STRAIGHT_PIPE",
    labelTr: "Düz Boru",
    fields: [
      { key: "odMm", labelTr: "Dış Çap (mm)", min: 50, max: 600, step: 1 },
      { key: "wtMm", labelTr: "Et Kalınlığı (mm)", min: 2, max: 40, step: 0.1 },
      { key: "lengthMm", labelTr: "Uzunluk (mm)", min: 200, max: 6000, step: 10 },
    ],
    defaults: { odMm: MM(219.1), wtMm: MM(8.18), lengthMm: MM(3000) },
    build: (p, _e, lod) => createStraightPipe({ odMm: p.odMm, wtMm: p.wtMm, lengthMm: p.lengthMm, lod }),
  },
  {
    kind: "ELBOW",
    labelTr: "Dirsek / Bükme",
    fields: [
      { key: "odMm", labelTr: "Dış Çap (mm)", min: 50, max: 600, step: 1 },
      { key: "wtMm", labelTr: "Et Kalınlığı (mm)", min: 2, max: 40, step: 0.1 },
      { key: "bendRadiusMm", labelTr: "Bükme Yarıçapı (mm)", min: 100, max: 1500, step: 5 },
      { key: "angleDeg", labelTr: "Açı (°)", min: 5, max: 180, step: 1 },
    ],
    defaults: { odMm: MM(168.3), wtMm: MM(7.11), bendRadiusMm: MM(300), angleDeg: 90 },
    build: (p, _e, lod) =>
      createElbow({ odMm: p.odMm, wtMm: p.wtMm, bendRadiusMm: p.bendRadiusMm, angleDeg: p.angleDeg, lod }),
  },
  {
    kind: "REDUCER",
    labelTr: "Redüksiyon",
    fields: [
      { key: "od1Mm", labelTr: "Giriş Dış Çapı (mm)", min: 50, max: 600, step: 1 },
      { key: "od2Mm", labelTr: "Çıkış Dış Çapı (mm)", min: 30, max: 500, step: 1 },
      { key: "wt1Mm", labelTr: "Giriş Et Kalınlığı (mm)", min: 2, max: 30, step: 0.1 },
      { key: "wt2Mm", labelTr: "Çıkış Et Kalınlığı (mm)", min: 2, max: 30, step: 0.1 },
      { key: "lengthMm", labelTr: "Uzunluk (mm)", min: 50, max: 800, step: 5 },
    ],
    defaults: { od1Mm: MM(219.1), od2Mm: MM(114.3), wt1Mm: MM(8.18), wt2Mm: MM(6.02), lengthMm: MM(200) },
    enumField: {
      key: "type",
      labelTr: "Tip",
      options: [
        { value: "CONCENTRIC", labelTr: "Eş Merkezli (Concentric)" },
        { value: "ECCENTRIC", labelTr: "Dış Merkezli (Eccentric)" },
      ],
    },
    build: (p, e, lod) =>
      createReducer({
        od1Mm: p.od1Mm,
        od2Mm: p.od2Mm,
        wt1Mm: p.wt1Mm,
        wt2Mm: p.wt2Mm,
        lengthMm: p.lengthMm,
        type: (e as "CONCENTRIC" | "ECCENTRIC") ?? "CONCENTRIC",
        lod,
      }),
  },
  {
    kind: "WELD_JOINT",
    labelTr: "Kaynak Dikişi",
    fields: [
      { key: "odMm", labelTr: "Dış Çap (mm)", min: 50, max: 600, step: 1 },
      { key: "wtMm", labelTr: "Et Kalınlığı (mm)", min: 2, max: 40, step: 0.1 },
      { key: "lengthMm", labelTr: "Model Uzunluğu (mm)", min: 40, max: 400, step: 2 },
      { key: "capHeightMm", labelTr: "Kaynak Kapağı Yüksekliği (mm)", min: 0, max: 10, step: 0.2 },
      { key: "rootPenetrationMm", labelTr: "Kök Nüfuziyeti (mm)", min: 0, max: 5, step: 0.1 },
    ],
    defaults: { odMm: MM(168.3), wtMm: MM(7.11), lengthMm: MM(100), capHeightMm: 3, rootPenetrationMm: 1 },
    build: (p, _e, lod) =>
      createWeldJoint({
        odMm: p.odMm,
        wtMm: p.wtMm,
        lengthMm: p.lengthMm,
        capHeightMm: p.capHeightMm,
        rootPenetrationMm: p.rootPenetrationMm,
        lod,
      }),
  },
  {
    kind: "ORIFICE_PLATE",
    labelTr: "Kısıcı Orifis Plakası",
    fields: [
      { key: "pipeOdMm", labelTr: "Boru Dış Çapı (mm)", min: 50, max: 600, step: 1 },
      { key: "boreDiaMm", labelTr: "Delik Çapı (mm)", min: 5, max: 500, step: 1 },
      { key: "thicknessMm", labelTr: "Plaka Kalınlığı (mm)", min: 2, max: 30, step: 0.5 },
    ],
    defaults: { pipeOdMm: MM(168.3), boreDiaMm: MM(60), thicknessMm: MM(6) },
    build: (p, _e, lod) => createOrificePlate({ pipeOdMm: p.pipeOdMm, boreDiaMm: p.boreDiaMm, thicknessMm: p.thicknessMm, lod }),
  },
  {
    kind: "MITER_BEND",
    labelTr: "Gönye (Miter) Bükme",
    fields: [
      { key: "odMm", labelTr: "Dış Çap (mm)", min: 50, max: 600, step: 1 },
      { key: "wtMm", labelTr: "Et Kalınlığı (mm)", min: 2, max: 40, step: 0.1 },
      { key: "bendRadiusMm", labelTr: "Referans Bükme Yarıçapı (mm)", min: 100, max: 1500, step: 5 },
      { key: "angleDeg", labelTr: "Açı (°)", min: 5, max: 180, step: 1 },
      { key: "segments", labelTr: "Düz Parça Sayısı", min: 1, max: 12, step: 1 },
    ],
    defaults: { odMm: MM(168.3), wtMm: MM(7.11), bendRadiusMm: MM(300), angleDeg: 90, segments: 4 },
    build: (p, _e, lod) =>
      createMiterBend({
        odMm: p.odMm,
        wtMm: p.wtMm,
        bendRadiusMm: p.bendRadiusMm,
        angleDeg: p.angleDeg,
        segments: Math.round(p.segments),
        lod,
      }),
  },
  {
    kind: "FLANGED_SPOOL",
    labelTr: "Flanşlı Spool",
    fields: [
      { key: "odMm", labelTr: "Dış Çap (mm)", min: 50, max: 600, step: 1 },
      { key: "wtMm", labelTr: "Et Kalınlığı (mm)", min: 2, max: 40, step: 0.1 },
      { key: "lengthMm", labelTr: "Uzunluk (mm)", min: 200, max: 4000, step: 10 },
    ],
    defaults: { odMm: MM(168.3), wtMm: MM(7.11), lengthMm: MM(800) },
    enumField: {
      key: "flangeClass",
      labelTr: "Basınç Sınıfı",
      options: [150, 300, 600, 900, 1500, 2500].map((c) => ({ value: c, labelTr: `Class ${c}` })),
    },
    build: (p, e, lod) =>
      createFlangedSpool({
        odMm: p.odMm,
        wtMm: p.wtMm,
        lengthMm: p.lengthMm,
        flangeClass: (Number(e ?? 300) as 150 | 300 | 600 | 900 | 1500 | 2500),
        lod,
      }),
  },
  {
    kind: "TEE",
    labelTr: "Dallanma Te",
    fields: [
      { key: "runOdMm", labelTr: "Ana Hat Dış Çapı (mm)", min: 80, max: 600, step: 1 },
      { key: "runWtMm", labelTr: "Ana Hat Et Kalınlığı (mm)", min: 2, max: 30, step: 0.1 },
      { key: "runLengthMm", labelTr: "Ana Hat Uzunluğu (mm)", min: 300, max: 2000, step: 10 },
      { key: "branchOdMm", labelTr: "Dal Dış Çapı (mm)", min: 30, max: 400, step: 1 },
      { key: "branchWtMm", labelTr: "Dal Et Kalınlığı (mm)", min: 2, max: 20, step: 0.1 },
      { key: "branchLengthMm", labelTr: "Dal Uzunluğu (mm)", min: 100, max: 1000, step: 10 },
    ],
    defaults: {
      runOdMm: MM(219.1),
      runWtMm: MM(8.18),
      runLengthMm: MM(600),
      branchOdMm: MM(114.3),
      branchWtMm: MM(6.02),
      branchLengthMm: MM(250),
    },
    build: (p, _e, lod) =>
      createTee({
        runOdMm: p.runOdMm,
        runWtMm: p.runWtMm,
        runLengthMm: p.runLengthMm,
        branchOdMm: p.branchOdMm,
        branchWtMm: p.branchWtMm,
        branchLengthMm: p.branchLengthMm,
        lod,
      }),
  },
];

const LOD_OPTIONS: LodLevel[] = ["low", "medium", "high"];

const HEATMAP_MODE_LABEL_KEY: Record<HeatmapVisualizationMode, TranslationKey> = {
  DAMAGE: "heatmapModeDamage",
  REMAINING_WALL: "heatmapModeRemainingWall",
  RATE: "heatmapModeRate",
  REMAINING_LIFE: "heatmapModeRemainingLife",
  MECHANISM_MAP: "heatmapModeMechanismMap",
  VELOCITY_FIELD: "heatmapModeVelocityField",
  UNCERTAINTY: "heatmapModeUncertainty",
};

const HEATMAP_UNIT_LABEL: Record<HeatmapVisualizationMode, string> = {
  DAMAGE: "mm",
  REMAINING_WALL: "mm",
  RATE: "mm/yıl",
  REMAINING_LIFE: "yıl",
  MECHANISM_MAP: "kategori",
  VELOCITY_FIELD: "×",
  UNCERTAINTY: "mm",
};

/** Görsel tasarım seçimi — KDP kapsamı dışı, bkz. shaders/colormaps.ts başlığı. */
const COLORMAP_LABEL_TR: Record<ColormapName, string> = {
  corrosion: "Korozyon (özel)",
  viridis: "Viridis",
  turbo: "Turbo",
  plasma: "Plasma",
  discrete4: "Kategorik (4 seviye)",
  colorblindSafe: "Renk Körlüğü Dostu",
};

function computeMinMax(values: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { min: 0, max: Math.max(max, 1) };
  }
  return { min, max };
}

function Slider({ def, value, onChange }: { def: FieldDef; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-3 block text-xs">
      <div className="mb-1 flex items-center justify-between text-neutral-600 dark:text-neutral-300">
        <span>{def.labelTr}</span>
        <span className="font-mono text-neutral-900 dark:text-neutral-100">{value}</span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
    </label>
  );
}

function GeometryMesh({ geometry }: { geometry: BufferGeometry }) {
  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#a1a1aa" metalness={0.85} roughness={0.32} side={DoubleSide} />
    </mesh>
  );
}

const FLOOR_Y = -1.2;

export function GeometryLab() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"FITTING" | "VALVE">("FITTING");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("STRAIGHT_PIPE");
  const [lod, setLod] = useState<LodLevel>("medium");
  const [paramsByShape, setParamsByShape] = useState<Record<ShapeKind, Record<string, number>>>(() =>
    Object.fromEntries(SHAPE_CONFIGS.map((c) => [c.kind, { ...c.defaults }])) as Record<ShapeKind, Record<string, number>>,
  );
  const [enumByShape, setEnumByShape] = useState<Record<string, string | number>>({});

  // Isı haritası (bkz. shaders/) — GeometryLab burada gerçek bir spatial/ hesap
  // zincirine değil, SENTETİK bir demo alanına bağlıdır (shaders/demoScalarField.ts).
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapVisualizationMode>("DAMAGE");
  const [heatmapColormap, setHeatmapColormap] = useState<ColormapName>("corrosion");
  const [demoWtMm, setDemoWtMm] = useState(10);
  const [demoMaxDamageMm, setDemoMaxDamageMm] = useState(6);
  const [demoElapsedYears, setDemoElapsedYears] = useState(10);
  const [thresholdWarnMm, setThresholdWarnMm] = useState(3);
  const [thresholdCriticalMm, setThresholdCriticalMm] = useState(5);
  const [isoStepMm, setIsoStepMm] = useState(0.5);
  const [heatmapOpacity, setHeatmapOpacity] = useState(1);
  const [deformEnabled, setDeformEnabled] = useState(false);
  const [deformExaggeration, setDeformExaggeration] = useState(5);
  const [scaleMode, setScaleMode] = useState<ColorbarScaleMode>("LINEAR");
  const [rangeLocked, setRangeLocked] = useState(false);
  const [manualRange, setManualRange] = useState({ min: 0, max: demoMaxDamageMm });

  const config = SHAPE_CONFIGS.find((c) => c.kind === shapeKind)!;
  const params = paramsByShape[shapeKind];

  const result = useMemo<GeneratedGeometry | null>(() => {
    try {
      return config.build(params, enumByShape[shapeKind] ?? config.enumField?.options[0]?.value, lod);
    } catch (error) {
      console.error("Geometri üretim hatası:", error);
      return null;
    }
  }, [config, params, enumByShape, shapeKind, lod]);

  const heatmapValues = useMemo<Float32Array | null>(() => {
    if (!heatmapEnabled || !result) return null;
    try {
      return computeDemoScalarField(result.geometry, heatmapMode, {
        wtMm: demoWtMm,
        maxDamageMm: demoMaxDamageMm,
        elapsedYears: demoElapsedYears,
      });
    } catch (error) {
      console.error("Sentetik hasar alanı üretim hatası:", error);
      return null;
    }
  }, [heatmapEnabled, result, heatmapMode, demoWtMm, demoMaxDamageMm, demoElapsedYears]);

  const autoRange = useMemo(() => (heatmapValues ? computeMinMax(heatmapValues) : { min: 0, max: 1 }), [heatmapValues]);
  const effectiveRange = rangeLocked ? manualRange : autoRange;
  const effectiveColormap = heatmapMode === "MECHANISM_MAP" ? "discrete4" : heatmapColormap;
  const isInverted = isInvertedVisualizationMode(heatmapMode);

  useEffect(() => {
    return () => {
      result?.geometry.dispose();
    };
  }, [result]);

  const setField = (key: string, value: number) => {
    setParamsByShape((prev) => ({ ...prev, [shapeKind]: { ...prev[shapeKind], [key]: value } }));
  };

  const modeButtonClass = (active: boolean) =>
    `rounded px-3 py-1 text-xs font-medium ${
      active
        ? "bg-sky-600 text-white"
        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
    }`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
        <button type="button" onClick={() => setMode("FITTING")} className={modeButtonClass(mode === "FITTING")}>
          {t("geometryLabModeFitting")}
        </button>
        <button type="button" onClick={() => setMode("VALVE")} className={modeButtonClass(mode === "VALVE")}>
          {t("geometryLabModeValve")}
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {mode === "VALVE" ? (
          <ValveTab />
        ) : (
          <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("geometryLabTitle")}</h1>

        <div className="mb-4">
          <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("geometryLabShapeLabel")}</div>
          <select
            value={shapeKind}
            onChange={(e) => setShapeKind(e.target.value as ShapeKind)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {SHAPE_CONFIGS.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.labelTr}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("geometryLabLodLabel")}</div>
          <div className="flex gap-1">
            {LOD_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLod(level)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                  lod === level
                    ? "bg-sky-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {config.enumField && (
          <div className="mb-4">
            <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{config.enumField.labelTr}</div>
            <select
              value={String(enumByShape[shapeKind] ?? config.enumField.options[0]?.value)}
              onChange={(e) => {
                const raw = config.enumField!.options.find((o) => String(o.value) === e.target.value)!.value;
                setEnumByShape((prev) => ({ ...prev, [shapeKind]: raw }));
              }}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {config.enumField.options.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.labelTr}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
          {config.fields.map((def) => (
            <Slider key={def.key} def={def} value={params[def.key]} onChange={(v) => setField(def.key, v)} />
          ))}
        </div>

        {result && (
          <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <div className="flex justify-between">
              <span>{t("geometryLabInfoVertices")}</span>
              <span className="font-mono">{result.metadata.vertexCount}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("geometryLabInfoTriangles")}</span>
              <span className="font-mono">{result.metadata.triangleCount}</span>
            </div>
            <div className="mt-1 border-t border-neutral-200 pt-1 dark:border-neutral-800">
              <div className="flex justify-between">
                <span>{t("geometryLabInfoOuter")}</span>
                <span className="font-mono">{result.metadata.regionVertexCounts.OUTER_WALL}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("geometryLabInfoInner")}</span>
                <span className="font-mono">{result.metadata.regionVertexCounts.INNER_WALL}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("geometryLabInfoCap")}</span>
                <span className="font-mono">{result.metadata.regionVertexCounts.END_CAP}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <label className="mb-3 flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
            <input type="checkbox" checked={heatmapEnabled} onChange={(e) => setHeatmapEnabled(e.target.checked)} />
            {t("heatmapPanelTitle")} — {t("heatmapEnableToggle")}
          </label>

          {heatmapEnabled && (
            <div className="space-y-3">
              <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
                {t("heatmapDemoWarning")}
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("heatmapModeLabel")}</div>
                <select
                  value={heatmapMode}
                  onChange={(e) => setHeatmapMode(e.target.value as HeatmapVisualizationMode)}
                  className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {HEATMAP_VISUALIZATION_MODES.map((m) => (
                    <option key={m} value={m}>
                      {t(HEATMAP_MODE_LABEL_KEY[m])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("heatmapColormapLabel")}</div>
                <select
                  value={effectiveColormap}
                  disabled={heatmapMode === "MECHANISM_MAP"}
                  onChange={(e) => setHeatmapColormap(e.target.value as ColormapName)}
                  className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {COLORMAP_NAMES.map((c) => (
                    <option key={c} value={c}>
                      {COLORMAP_LABEL_TR[c]}
                    </option>
                  ))}
                </select>
              </div>

              <Slider def={{ key: "demoWtMm", labelTr: t("heatmapWtLabel"), min: 2, max: 60, step: 0.5 }} value={demoWtMm} onChange={setDemoWtMm} />
              <Slider
                def={{ key: "demoMaxDamageMm", labelTr: t("heatmapMaxDamageLabel"), min: 0.5, max: 30, step: 0.5 }}
                value={demoMaxDamageMm}
                onChange={setDemoMaxDamageMm}
              />
              <Slider
                def={{ key: "demoElapsedYears", labelTr: t("heatmapElapsedYearsLabel"), min: 1, max: 50, step: 1 }}
                value={demoElapsedYears}
                onChange={setDemoElapsedYears}
              />
              <Slider
                def={{ key: "thresholdWarnMm", labelTr: t("heatmapThresholdWarnLabel"), min: 0, max: 30, step: 0.1 }}
                value={thresholdWarnMm}
                onChange={setThresholdWarnMm}
              />
              <Slider
                def={{ key: "thresholdCriticalMm", labelTr: t("heatmapThresholdCriticalLabel"), min: 0, max: 30, step: 0.1 }}
                value={thresholdCriticalMm}
                onChange={setThresholdCriticalMm}
              />
              <Slider
                def={{ key: "isoStepMm", labelTr: t("heatmapIsoStepLabel"), min: 0.05, max: 5, step: 0.05 }}
                value={isoStepMm}
                onChange={setIsoStepMm}
              />
              <Slider
                def={{ key: "heatmapOpacity", labelTr: t("heatmapOpacityLabel"), min: 0.1, max: 1, step: 0.05 }}
                value={heatmapOpacity}
                onChange={setHeatmapOpacity}
              />

              <label className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
                <input type="checkbox" checked={deformEnabled} onChange={(e) => setDeformEnabled(e.target.checked)} />
                {t("heatmapDeformToggle")}
              </label>
              {deformEnabled && (
                <Slider
                  def={{ key: "deformExaggeration", labelTr: t("heatmapDeformExaggerationLabel"), min: 1, max: 50, step: 1 }}
                  value={deformExaggeration}
                  onChange={setDeformExaggeration}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative min-w-0 flex-1 bg-neutral-950">
        <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [1.5, 1, 1.5], fov: 45 }}>
          <color attach="background" args={["#0a0a0a"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
          <Environment preset="warehouse" />
          {result && heatmapEnabled && heatmapValues ? (
            <HeatmapMesh
              geometry={result.geometry}
              values={heatmapValues}
              colormap={effectiveColormap}
              minValue={effectiveRange.min}
              maxValue={effectiveRange.max}
              opacity={heatmapOpacity}
              thresholdWarn={thresholdWarnMm}
              thresholdCritical={thresholdCriticalMm}
              wallThicknessMm={heatmapMode === "DAMAGE" ? demoWtMm : 0}
              isoStepMm={isoStepMm}
              deformEnabled={deformEnabled}
              deformExaggeration={deformExaggeration}
              invertColormap={isInverted}
            />
          ) : (
            result && <GeometryMesh geometry={result.geometry} />
          )}
          <Grid
            args={[20, 20]}
            position={[0, FLOOR_Y, 0]}
            cellSize={0.1}
            cellThickness={0.4}
            cellColor="#3f3f46"
            sectionSize={1}
            sectionThickness={1}
            sectionColor="#52525b"
            fadeDistance={15}
            infiniteGrid
          />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.2} maxDistance={20} />
        </Canvas>

        {heatmapEnabled && heatmapValues && (
          <div className="absolute bottom-4 right-4">
            <Colorbar
              colormap={effectiveColormap}
              minValue={effectiveRange.min}
              maxValue={effectiveRange.max}
              unitLabel={HEATMAP_UNIT_LABEL[heatmapMode]}
              invert={isInverted}
              wallThicknessMm={heatmapMode === "DAMAGE" ? demoWtMm : undefined}
              corrosionAllowanceMm={heatmapMode === "DAMAGE" ? thresholdCriticalMm : undefined}
              scaleMode={scaleMode}
              onScaleModeChange={setScaleMode}
              locked={rangeLocked}
              onLockedChange={setRangeLocked}
              onRangeChange={(min, max) => setManualRange({ min, max })}
            />
          </div>
        )}
      </div>
          </div>
        )}
      </div>
    </div>
  );
}
