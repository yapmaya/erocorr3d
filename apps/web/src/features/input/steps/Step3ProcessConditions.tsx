// apps/web/src/features/input/steps/Step3ProcessConditions.tsx
//
// Adım 3 — Proses Koşulları: aktif senaryonun (`operatingProfile.cases[
// activeCaseIndex]`) `ProcessConditions` alanları. "Faz özelliklerini
// hesapla" düğmesi `phaseCalculations.ts::computePhaseProperties`'i
// çağırır (motorun KENDİ mixtureProperties/flowRegime fonksiyonları) ve
// yüzeysel hızlar/karışım hızı/tutulumu doldurur; akış rejimi (flowRegime)
// motor tarafından OTOMATİK ayarlanmaz (bkz. FlowRegimeIndicator.tsx'in
// başlık notu — iki taksonomi arasında kaynaklı bir eşleme yok), yalnızca
// danışma amaçlı gösterilir.

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FLOW_REGIME_LABELS, isDryGas } from "@erocorr3d/engine";
import type { WizardDraft } from "../schema";
import { UnitField } from "../components/UnitField";
import { SelectField } from "../components/SelectField";
import { ToggleField } from "../components/ToggleField";
import { PlainNumberField } from "../components/PlainNumberField";
import { FlowRegimeIndicator } from "../components/FlowRegimeIndicator";
import { computePhaseProperties, type PhaseCalcResult } from "../phaseCalculations";
import { caseFieldPath } from "./caseFieldPath";
import type { StepProps } from "./Step1ComponentSelect";

const FLOW_REGIME_OPTIONS = Object.entries(FLOW_REGIME_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));

export function Step3ProcessConditions({ onNext, onPrev }: StepProps) {
  const { control, setValue, getValues } = useFormContext<WizardDraft>();
  const activeCaseIndex = useWatch({ control, name: "activeCaseIndex" });
  const idMm = useWatch({ control, name: "geometry.idMm" });
  const orientation = useWatch({ control, name: "geometry.orientation" });
  const inclinationDeg = useWatch({ control, name: "geometry.inclinationDeg" });
  const isFreeWaterPresent = useWatch({ control, name: caseFieldPath(activeCaseIndex, "process.isFreeWaterPresent") });
  const temperatureC = useWatch({ control, name: caseFieldPath(activeCaseIndex, "process.temperatureC") });
  const waterDewpointC = useWatch({ control, name: caseFieldPath(activeCaseIndex, "process.waterDewpointC") });

  const [calcResult, setCalcResult] = useState<PhaseCalcResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  function p<S extends string>(suffix: S) {
    return caseFieldPath(activeCaseIndex, `process.${suffix}`);
  }

  const handleCalculate = () => {
    setCalcError(null);
    try {
      const process = getValues(caseFieldPath(activeCaseIndex, "process")) as unknown as WizardDraft["operatingProfile"]["cases"][number]["process"];
      const result = computePhaseProperties({
        process,
        pipeInternalDiameterM: idMm / 1000,
        orientation,
        inclinationDeg,
      });
      setValue(p("superficialGasVelocityMs"), result.superficialGasVelocityMs, { shouldValidate: true, shouldDirty: true });
      setValue(p("superficialLiquidVelocityMs"), result.superficialLiquidVelocityMs, { shouldValidate: true, shouldDirty: true });
      setValue(p("mixtureVelocityMs"), result.mixtureVelocityMs, { shouldValidate: true, shouldDirty: true });
      setValue(p("mixtureDensityKgM3"), result.mixtureDensityNoSlipKgM3, { shouldValidate: true, shouldDirty: true });
      setValue(p("liquidHoldupFraction"), result.holdup.liquidHoldupFraction, { shouldValidate: true, shouldDirty: true });
      setCalcResult(result);
    } catch (error) {
      setCalcError(error instanceof Error ? error.message : "Hesaplama sırasında bilinmeyen bir hata oluştu.");
      setCalcResult(null);
    }
  };

  const dryGas = Number.isFinite(temperatureC) && Number.isFinite(waterDewpointC) ? isDryGas(temperatureC, waterDewpointC) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <UnitField name={p("pressureBara")} labelTr="Basınç" quantity="PRESSURE" helpKey="process.pressureBara" warningKey="process.pressureBara" />
        <UnitField name={p("temperatureC")} labelTr="Akışkan Sıcaklığı" quantity="TEMPERATURE" helpKey="process.temperatureC" warningKey="process.temperatureC" />
      </div>
      <UnitField name={p("ambientTemperatureC")} labelTr="Ortam Sıcaklığı" quantity="TEMPERATURE" helpKey="process.ambientTemperatureC" />

      <div className="grid grid-cols-3 gap-2">
        <UnitField name={p("gasMassFlowKgS")} labelTr="Gaz Debisi" quantity="MASS_FLOW" />
        <UnitField name={p("liquidMassFlowKgS")} labelTr="Sıvı Debisi" quantity="MASS_FLOW" />
        <UnitField name={p("waterMassFlowKgS")} labelTr="Su Debisi" quantity="MASS_FLOW" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <UnitField name={p("gasDensityKgM3")} labelTr="Gaz Yoğunluğu" quantity="DENSITY" />
        <UnitField name={p("liquidDensityKgM3")} labelTr="Sıvı Yoğunluğu" quantity="DENSITY" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <UnitField name={p("gasViscosityPaS")} labelTr="Gaz Viskozitesi" quantity="VISCOSITY" step={1e-6} />
        <UnitField name={p("liquidViscosityPaS")} labelTr="Sıvı Viskozitesi" quantity="VISCOSITY" step={1e-5} />
      </div>

      <ToggleField name={p("isFreeWaterPresent")} labelTr="Serbest Su Var" helpKey="process.isFreeWaterPresent" />
      <PlainNumberField
        name={p("waterCutPercent")}
        labelTr="Su Kesri"
        unitLabel="%"
        helpKey="process.waterCutPercent"
        disabled={!isFreeWaterPresent}
      />
      <div className="grid grid-cols-2 gap-2">
        <UnitField name={p("waterDewpointC")} labelTr="Su Çiy Noktası" quantity="TEMPERATURE" helpKey="process.waterDewpointC" />
        <UnitField name={p("hydrocarbonDewpointC")} labelTr="HC Çiy Noktası" quantity="TEMPERATURE" helpKey="process.hydrocarbonDewpointC" />
      </div>
      {dryGas !== null && (
        <div
          className={`rounded px-2 py-1 text-[11px] ${
            dryGas
              ? "border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {dryGas
            ? "Kuru gaz kuralı: sıcaklık, su çiy noktasının ≥10°C üzerinde — korozyon hızı 0 kabul edilir."
            : "Kuru gaz kuralı sağlanmıyor — ıslak/korozif akış olabilir."}
        </div>
      )}

      <button
        type="button"
        onClick={handleCalculate}
        className="rounded bg-neutral-800 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
      >
        Faz Özelliklerini Hesapla (yüzeysel hız / tutulum / akış deseni)
      </button>
      {calcError && <div className="text-[11px] text-red-600 dark:text-red-400">{calcError}</div>}
      {calcResult && (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <div>Karışım viskozitesi (Dukler 1964, danışma amaçlı): {(calcResult.mixtureViscosityPaS * 1000).toFixed(3)} cP</div>
          <div className="mt-1 text-neutral-400 dark:text-neutral-500">
            Not: hız/tutulum hesabında su ve sıvı hidrokarbon debisi tek bir sıvı faz olarak, sıvı yoğunluğuyla
            birleştirildi (şemada ayrı su yoğunluğu alanı yok — bkz. ⓘ).
          </div>
          <FlowRegimeIndicator
            noSlipLiquidHoldup={calcResult.holdup.noSlipLiquidHoldup}
            froudeNumber={calcResult.holdup.froudeNumber}
            pattern={calcResult.holdup.flowPattern}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <UnitField name={p("superficialGasVelocityMs")} labelTr="Yüzeysel Gaz Hızı" quantity="VELOCITY" />
        <UnitField name={p("superficialLiquidVelocityMs")} labelTr="Yüzeysel Sıvı Hızı" quantity="VELOCITY" />
        <UnitField name={p("mixtureVelocityMs")} labelTr="Karışım Hızı" quantity="VELOCITY" warningKey="process.mixtureVelocityMs" />
      </div>
      <UnitField name={p("mixtureDensityKgM3")} labelTr="Karışım Yoğunluğu" quantity="DENSITY" />
      <PlainNumberField name={p("liquidHoldupFraction")} labelTr="Sıvı Tutulum Oranı" step={0.01} />
      <SelectField name={p("flowRegime")} labelTr="Akış Rejimi" helpKey="process.flowRegime" options={FLOW_REGIME_OPTIONS} />

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: Akışkan Kimyası →
          </button>
        )}
      </div>
    </div>
  );
}
