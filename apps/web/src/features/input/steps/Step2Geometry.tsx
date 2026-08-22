// apps/web/src/features/input/steps/Step2Geometry.tsx
//
// Adım 2 — Geometri: NPS+Schedule seçince OD/WT/ID otomatik dolar (bkz.
// `getPipe`/`listSchedulesForNps`, @erocorr3d/engine — ASME B36.10/19
// tablosu), sağda canlı 3B önizleme. Vana kategorisinde canlı önizleme
// `ValveTab`'ın (features/valveViewer/) KENDİSİ yeniden kullanılır — bu
// bileşen kendi NPS/basınç sınıfı/açıklık% kontrollerini taşır (bkz. bu
// dosyanın altındaki not); sayısal vana verisi YİNE DE yukarıdaki formdan
// girilir, ValveTab yalnızca GÖRSEL bir önizlemedir.

import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  getPipe,
  listPipesForSchedule,
  listSchedulesForNps,
  INSTALLATION_LABELS,
  ORIENTATION_LABELS,
  TRIM_TYPE_LABELS,
  FLOW_DIRECTION_LABELS,
  PRESSURE_CLASS_VALUES,
} from "@erocorr3d/engine";
import type { WizardDraft } from "../schema";
import { UnitField } from "../components/UnitField";
import { SelectField } from "../components/SelectField";
import { ToggleField } from "../components/ToggleField";
import { PlainNumberField } from "../components/PlainNumberField";
import { PreviewCanvas } from "../components/PreviewCanvas";
import { buildComponentPreviewGeometry } from "../componentPreview";
import { ValveTab } from "../../valveViewer/ValveTab";
import type { StepProps } from "./Step1ComponentSelect";

const NPS_OPTIONS = listPipesForSchedule("STD").map((p) => ({ value: p.nps, labelTr: `NPS ${p.npsLabel}"` }));
const ORIENTATION_OPTIONS = Object.entries(ORIENTATION_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));
const INSTALLATION_OPTIONS = Object.entries(INSTALLATION_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));
const TRIM_TYPE_OPTIONS = Object.entries(TRIM_TYPE_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));
const FLOW_DIRECTION_OPTIONS = Object.entries(FLOW_DIRECTION_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));
const PRESSURE_CLASS_OPTIONS = PRESSURE_CLASS_VALUES.map((c) => ({ value: c, labelTr: `Class ${c}` }));

const BEND_TYPES = new Set(["ELBOW_90", "ELBOW_45", "BEND_LONG_RADIUS", "BEND_SHORT_RADIUS", "MITER_BEND"]);
const TEE_TYPES = new Set(["TEE_BLIND", "TEE_SWEEPING", "TEE_BRANCH"]);
const REDUCER_TYPES = new Set(["REDUCER_CONCENTRIC", "REDUCER_ECCENTRIC"]);

export function Step2Geometry({ onNext, onPrev }: StepProps) {
  const { control, setValue } = useFormContext<WizardDraft>();
  const category = useWatch({ control, name: "componentCategory" });
  const geometry = useWatch({ control, name: "geometry" });
  const isInsulated = useWatch({ control, name: "geometry.isInsulated" });
  const componentType = geometry.componentType;

  const scheduleOptions = useMemo(
    () => listSchedulesForNps(geometry.npsInch).map((s) => ({ value: s, labelTr: s })),
    [geometry.npsInch],
  );

  const applyPipeDimensions = (npsInch: number, schedule: string) => {
    try {
      const pipe = getPipe(npsInch, schedule as Parameters<typeof getPipe>[1]);
      setValue("geometry.npsInch", pipe.nps, { shouldDirty: true });
      setValue("geometry.schedule", pipe.schedule, { shouldDirty: true });
      setValue("geometry.odMm", pipe.odMm, { shouldDirty: true, shouldValidate: true });
      setValue("geometry.wallThicknessMm", pipe.wallThicknessMm, { shouldDirty: true, shouldValidate: true });
      setValue("geometry.idMm", pipe.idMm, { shouldDirty: true, shouldValidate: true });
      if (category === "VALVE") {
        setValue("valveGeometry.odMm", pipe.odMm, { shouldDirty: true });
        setValue("valveGeometry.wallThicknessMm", pipe.wallThicknessMm, { shouldDirty: true });
        setValue("valveGeometry.idMm", pipe.idMm, { shouldDirty: true });
      }
    } catch {
      // seçili NPS/schedule kombinasyonu ASME tablosunda yok — kullanıcı OD/WT/ID'yi elle girer.
    }
  };

  const previewGeometry = useMemo(() => {
    if (category === "VALVE") return null;
    try {
      return buildComponentPreviewGeometry(componentType, geometry, "medium");
    } catch (error) {
      console.error("Önizleme geometrisi üretilemedi:", error);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, componentType, geometry.odMm, geometry.wallThicknessMm, geometry.idMm, geometry.lengthMm, geometry.bendRadiusRatio, geometry.bendAngleDeg, geometry.branchNps, geometry.outletNps, geometry.schedule]);

  useEffect(() => {
    return () => previewGeometry?.geometry.dispose();
  }, [previewGeometry]);

  // NPS veya Schedule değiştiğinde OD/WT/ID'yi otomatik doldurur (spec:
  // "NPS + Schedule seçince OD/WT/ID OTOMATİK dolsun"). effect (onChange
  // capture yerine) kullanılır ki her zaman GÜNCEL npsInch/schedule
  // değerleriyle çalışsın — bir capture-phase handler'da bu değerler henüz
  // React state'ine yansımamış (stale) olurdu.
  useEffect(() => {
    applyPipeDimensions(geometry.npsInch, geometry.schedule);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry.npsInch, geometry.schedule]);

  return (
    <div className="flex flex-col gap-3">
      {category === "PIPE_FITTING" && <PreviewCanvas geometry={previewGeometry?.geometry ?? null} />}
      {category === "VALVE" && (
        <div>
          <p className="mb-1 text-[10px] text-neutral-400 dark:text-neutral-500">
            Aşağıdaki 3B önizleme kendi NPS/basınç sınıfı/açıklık% kontrollerini taşır (görsel amaçlıdır); sayısal
            vana verisi bu adımdaki formdan girilir.
          </p>
          <div className="h-72 overflow-x-auto overflow-y-hidden rounded border border-neutral-200 dark:border-neutral-800">
            <div className="h-full min-w-[560px]">
              <ValveTab />
            </div>
          </div>
        </div>
      )}

      <SelectField name="geometry.npsInch" labelTr="NPS" valueType="number" helpKey="geometry.npsInch" options={NPS_OPTIONS} />
      <SelectField name="geometry.schedule" labelTr="Boru Cetveli (Schedule)" helpKey="geometry.schedule" options={scheduleOptions} />
      <button
        type="button"
        onClick={() => applyPipeDimensions(geometry.npsInch, geometry.schedule)}
        className="-mt-2 self-start text-[11px] text-sky-600 underline hover:text-sky-700 dark:text-sky-400"
      >
        OD/WT/ID&apos;yi ASME tablosundan yeniden doldur
      </button>

      <div className="grid grid-cols-3 gap-2">
        <UnitField name="geometry.odMm" labelTr="Dış Çap" quantity="LENGTH_MM" />
        <UnitField name="geometry.wallThicknessMm" labelTr="Et Kalınlığı" quantity="LENGTH_MM" />
        <UnitField name="geometry.idMm" labelTr="İç Çap" quantity="LENGTH_MM" />
      </div>
      <UnitField name="geometry.lengthMm" labelTr="Uzunluk" quantity="LENGTH_MM" />
      <UnitField name="geometry.roughnessMm" labelTr="Pürüzlülük" quantity="SMALL_LENGTH_MM" helpKey="geometry.roughnessMm" warningKey="geometry.roughnessMm" />

      {(BEND_TYPES.has(componentType)) && (
        <div className="grid grid-cols-2 gap-2">
          <label className="mb-3 block text-xs">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Bükme Yarıçapı Oranı (R/D)</span>
            <input
              type="number"
              step="0.1"
              defaultValue={geometry.bendRadiusRatio ?? 1.5}
              onChange={(e) => setValue("geometry.bendRadiusRatio", Number(e.target.value), { shouldValidate: true })}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
          <label className="mb-3 block text-xs">
            <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Bükme Açısı (°)</span>
            <input
              type="number"
              defaultValue={geometry.bendAngleDeg ?? 90}
              onChange={(e) => setValue("geometry.bendAngleDeg", Number(e.target.value), { shouldValidate: true })}
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>
      )}

      {TEE_TYPES.has(componentType) && (
        <SelectField name="geometry.branchNps" labelTr="Dallanma (Branch) NPS" valueType="number" options={NPS_OPTIONS} />
      )}
      {REDUCER_TYPES.has(componentType) && (
        <SelectField name="geometry.outletNps" labelTr="Çıkış NPS" valueType="number" options={NPS_OPTIONS} />
      )}

      <SelectField name="geometry.orientation" labelTr="Yönelim" options={ORIENTATION_OPTIONS} />
      <SelectField name="geometry.installation" labelTr="Tesis Yöntemi" helpKey="geometry.installation" options={INSTALLATION_OPTIONS} />
      <ToggleField name="geometry.isInsulated" labelTr="İzolasyonlu" helpKey="geometry.isInsulated" />
      {isInsulated && (
        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-neutral-600 dark:text-neutral-300">İzolasyon Malzemesi Tipi</span>
          <input
            type="text"
            defaultValue={geometry.insulationType ?? ""}
            onChange={(e) => setValue("geometry.insulationType", e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
      )}

      {category === "VALVE" && (
        <div className="mt-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Vana Verileri
          </div>
          <SelectField name="valveGeometry.pressureClass" labelTr="Basınç Sınıfı" valueType="number" options={PRESSURE_CLASS_OPTIONS} />
          <SelectField name="valveGeometry.trimType" labelTr="Trim Tipi" options={TRIM_TYPE_OPTIONS} />
          <SelectField name="valveGeometry.flowDirection" labelTr="Akış Yönü" options={FLOW_DIRECTION_OPTIONS} />
          <PlainNumberField name="valveGeometry.cvRated" labelTr="Anma Akış Katsayısı (Cv)" helpKey="valveGeometry.cvRated" />
          <PlainNumberField name="valveGeometry.openingPercent" labelTr="Açıklık Oranı" unitLabel="%" helpKey="valveGeometry.openingPercent" warningKey="valveGeometry.openingPercent" />
          <PlainNumberField name="valveGeometry.flFactor" labelTr="Basınç Geri Kazanım (FL)" helpKey="valveGeometry.flFactor" />
          <PlainNumberField name="valveGeometry.xtFactor" labelTr="Kritik Basınç Düşümü (xT)" helpKey="valveGeometry.xtFactor" />
          <PlainNumberField name="valveGeometry.kcFactor" labelTr="Kavitasyon Katsayısı (Kc)" helpKey="valveGeometry.kcFactor" />
        </div>
      )}

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: Proses Koşulları →
          </button>
        )}
      </div>
    </div>
  );
}
