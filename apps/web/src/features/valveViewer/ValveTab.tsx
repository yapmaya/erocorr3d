// apps/web/src/features/valveViewer/ValveTab.tsx
//
// GeometryLab.tsx'in VALVE modu — kendi kontrol paneli + Canvas'ı.
// FITTING modundan (bkz. o dosya — tek mesh, kesit/animasyon/tıklama yok)
// KASITLI olarak AYRI tutulur: vana montajları NPS/basınç sınıfı/opening%/
// vana-tipine-özgü alanlar, kesit düzlemi (stencil-kapaklı), akış gösterimi
// ve tıklanan parçanın hasar-bölgesi bilgi paneli gibi FITTING modunun HİÇ
// ihtiyaç duymadığı denetimler gerektirir.
//
// `gl={{ stencil: true }}` + `onCreated`'da `localClippingEnabled = true` —
// bkz. SectionCapPlane.tsx/ValvePartMesh.tsx başlıkları: gerçek stencil-
// buffer kesit-kapağı tekniği İKİSİ de olmadan ÇALIŞMAZ.

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import type { PressureClass } from "@erocorr3d/engine";
import type { LodLevel, ValveAssembly } from "../../geometry";
import { NPS_FIELD, PRESSURE_CLASS_OPTIONS, VALVE_SHAPE_CONFIGS, type ValveKind } from "./valveShapeConfigs";
import { ValveScene } from "./ValveScene";
import { NumberSlider } from "../../components/NumberSlider";
import { useTranslation } from "../../i18n/translations";

const LOD_OPTIONS: LodLevel[] = ["low", "medium", "high"];
const FLOOR_Y = -1.2;
const DEFAULT_PRESSURE_CLASS: PressureClass = 300;

function selectClassName(active: boolean): string {
  return `flex-1 rounded px-2 py-1 text-xs font-medium ${
    active ? "bg-sky-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
  }`;
}

export function ValveTab() {
  const { t } = useTranslation();
  const [valveKind, setValveKind] = useState<ValveKind>("GATE");
  const [lod, setLod] = useState<LodLevel>("medium");
  const [npsByKind, setNpsByKind] = useState<Record<ValveKind, number>>(
    () => Object.fromEntries(VALVE_SHAPE_CONFIGS.map((c) => [c.kind, NPS_FIELD.default])) as Record<ValveKind, number>,
  );
  const [classByKind, setClassByKind] = useState<Record<ValveKind, PressureClass>>(
    () => Object.fromEntries(VALVE_SHAPE_CONFIGS.map((c) => [c.kind, DEFAULT_PRESSURE_CLASS])) as Record<ValveKind, PressureClass>,
  );
  const [openingByKind, setOpeningByKind] = useState<Record<ValveKind, number>>(
    () => Object.fromEntries(VALVE_SHAPE_CONFIGS.map((c) => [c.kind, c.openingDefault])) as Record<ValveKind, number>,
  );
  const [enumByKind, setEnumByKind] = useState<Record<string, string>>({});
  const [extraByKind, setExtraByKind] = useState<Record<string, number>>({});
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionOffsetM, setSectionOffsetM] = useState(0);
  const [flowVisible, setFlowVisible] = useState(true);
  const [selectedPartName, setSelectedPartName] = useState<string | null>(null);

  const config = VALVE_SHAPE_CONFIGS.find((c) => c.kind === valveKind)!;
  const npsIn = npsByKind[valveKind];
  const pressureClass = classByKind[valveKind];
  const openingPercent = openingByKind[valveKind];
  const enumValue = enumByKind[valveKind] ?? config.enumField?.options[0]?.value;
  const extraValue = extraByKind[valveKind] ?? config.extraDefault;

  const assembly = useMemo<ValveAssembly | null>(() => {
    try {
      return config.build(npsIn, pressureClass, openingPercent, enumValue, extraValue, lod);
    } catch (error) {
      console.error("Vana geometri üretim hatası:", error);
      return null;
    }
  }, [config, npsIn, pressureClass, openingPercent, enumValue, extraValue, lod]);

  useEffect(() => {
    setSelectedPartName(null);
  }, [valveKind]);

  const selectedPart = assembly?.parts.find((p) => p.name === selectedPartName) ?? null;
  const bodyRadiusM = assembly?.parts.find((p) => p.name === "BODY")?.geometry.boundingSphere?.radius ?? 0.3;
  const sectionOffsetRangeM = bodyRadiusM * 1.4;

  return (
    <div className="flex h-full">
      <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mb-4">
          <div className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("valveTabTypeLabel")}</div>
          <select
            value={valveKind}
            onChange={(e) => setValveKind(e.target.value as ValveKind)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {VALVE_SHAPE_CONFIGS.map((c) => (
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
              <button key={level} type="button" onClick={() => setLod(level)} className={selectClassName(lod === level)}>
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <NumberSlider
            label={t("valveTabNpsLabel")}
            value={npsIn}
            min={NPS_FIELD.min}
            max={NPS_FIELD.max}
            step={NPS_FIELD.step}
            onChange={(v) => setNpsByKind((prev) => ({ ...prev, [valveKind]: v }))}
          />

          <div className="mb-3">
            <div className="mb-1 text-xs text-neutral-600 dark:text-neutral-300">{t("valveTabClassLabel")}</div>
            <select
              value={pressureClass}
              onChange={(e) => setClassByKind((prev) => ({ ...prev, [valveKind]: Number(e.target.value) as PressureClass }))}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {PRESSURE_CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          <NumberSlider
            label={config.openingIsOperatorSetting ? t("valveTabOpeningLabel") : `${t("valveTabOpeningLabel")} (gösterim amaçlı)`}
            value={openingPercent}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setOpeningByKind((prev) => ({ ...prev, [valveKind]: v }))}
          />

          {config.enumField && (
            <div className="mb-3">
              <div className="mb-1 text-xs text-neutral-600 dark:text-neutral-300">{config.enumField.labelTr}</div>
              <select
                value={String(enumValue)}
                onChange={(e) => setEnumByKind((prev) => ({ ...prev, [valveKind]: e.target.value }))}
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {config.enumField.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.labelTr}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.extraField && (
            <NumberSlider
              label={config.extraField.labelTr}
              value={extraValue ?? 0}
              min={config.extraField.min}
              max={config.extraField.max}
              step={config.extraField.step}
              onChange={(v) => setExtraByKind((prev) => ({ ...prev, [valveKind]: v }))}
            />
          )}
        </div>

        <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <label className="mb-2 flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={sectionEnabled} onChange={(e) => setSectionEnabled(e.target.checked)} />
            {t("valveTabSectionToggle")}
          </label>
          {sectionEnabled && (
            <NumberSlider
              label={t("valveTabSectionOffset")}
              value={sectionOffsetM}
              min={-sectionOffsetRangeM}
              max={sectionOffsetRangeM}
              step={sectionOffsetRangeM / 50 || 0.001}
              onChange={setSectionOffsetM}
              valueFormatter={(v) => `${Math.round(v * 1000)} mm`}
            />
          )}
          <label className="mt-1 flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
            <input type="checkbox" checked={flowVisible} onChange={(e) => setFlowVisible(e.target.checked)} />
            {t("valveTabFlowToggle")}
          </label>
        </div>

        <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <div className="flex justify-between">
            <span>{t("valveTabPartCountLabel")}</span>
            <span className="font-mono">{assembly?.parts.length ?? 0}</span>
          </div>
          <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
            <div className="mb-1 font-medium text-neutral-900 dark:text-neutral-100">{t("valveTabPartInfoTitle")}</div>
            {selectedPart ? (
              <>
                <div className="font-mono">{selectedPart.name}</div>
                <div className="mt-2 font-medium text-neutral-900 dark:text-neutral-100">{t("valveTabDamageZonesTitle")}</div>
                {selectedPart.damageZones.length === 0 ? (
                  <div>{t("valveTabDamageZonesNone")}</div>
                ) : (
                  <ul className="list-disc pl-4">
                    {selectedPart.damageZones.map((z) => (
                      <li key={z.id}>
                        <span className="font-mono">{z.id}</span> — u={z.centerUV.u.toFixed(2)}, v={z.centerUV.v.toFixed(2)}, r={z.radius.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div>{t("valveTabPartInfoNone")}</div>
            )}
          </div>
        </div>
      </div>

      <div className="relative min-w-0 flex-1 bg-neutral-950">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          gl={{ stencil: true }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
          camera={{ position: [1.5, 1, 1.5], fov: 45 }}
        >
          <color attach="background" args={["#0a0a0a"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
          <Environment preset="warehouse" />
          {assembly && (
            <ValveScene
              assembly={assembly}
              targetOpeningPercent={openingPercent}
              sectionEnabled={sectionEnabled}
              sectionOffsetM={sectionOffsetM}
              flowVisible={flowVisible}
              selectedPartName={selectedPartName}
              onSelectPart={setSelectedPartName}
            />
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
      </div>
    </div>
  );
}
