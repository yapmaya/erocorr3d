// apps/web/src/features/input/steps/Step4FluidChemistry.tsx
//
// Adım 4 — Akışkan Kimyası. "Hesapla" düğmesi motorun kendi
// `computeNorsokInSituPh`'ını (NORSOK M-506 Bölüm 8.2) çağırır.
//
// BASİTLEŞTİRME (açıkça belirtilir): `computeNorsokInSituPh` CO2
// FUGASİTESİ ister, bu form yalnızca CO2 mol yüzdesini toplar — burada
// fugasite katsayısı 1 (ideal gaz) varsayılarak fugasite≈kısmi basınç
// olarak yaklaşıklanır. Yüksek basınçta gerçek fugasite bundan farklı
// olabilir; bu KDP açısından bir "uydurma katsayı" DEĞİL, açıkça
// etiketlenmiş bir mühendislik yaklaşıklamasıdır.

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { computeNorsokInSituPh, type NorsokPhResult } from "@erocorr3d/engine";
import type { WizardDraft } from "../schema";
import { ToggleField } from "../components/ToggleField";
import { PlainNumberField } from "../components/PlainNumberField";
import { caseFieldPath } from "./caseFieldPath";
import type { StepProps } from "./Step1ComponentSelect";

const PA_PER_BAR = 100_000;
const KELVIN_OFFSET = 273.15;

export function Step4FluidChemistry({ onNext, onPrev }: StepProps) {
  const { control, setValue, getValues } = useFormContext<WizardDraft>();
  const activeCaseIndex = useWatch({ control, name: "activeCaseIndex" });

  const [phResult, setPhResult] = useState<NorsokPhResult | null>(null);
  const [phError, setPhError] = useState<string | null>(null);

  function c<S extends string>(suffix: S) {
    return caseFieldPath(activeCaseIndex, `chemistry.${suffix}`);
  }

  const handleComputePh = () => {
    setPhError(null);
    try {
      const chemistry = getValues(caseFieldPath(activeCaseIndex, "chemistry")) as unknown as WizardDraft["operatingProfile"]["cases"][number]["chemistry"];
      const process = getValues(caseFieldPath(activeCaseIndex, "process")) as unknown as WizardDraft["operatingProfile"]["cases"][number]["process"];
      if (chemistry.co2MolePercent <= 0) {
        throw new Error("CO2 yoksa in-situ pH hesabı anlamsızdır — önce CO2 mol yüzdesini girin.");
      }
      const totalPressurePa = process.pressureBara * PA_PER_BAR;
      const co2FugacityPa = (chemistry.co2MolePercent / 100) * totalPressurePa; // yaklaşıklama, bkz. dosya başı notu
      const result = computeNorsokInSituPh({
        temperatureK: process.temperatureC + KELVIN_OFFSET,
        totalPressurePa,
        co2FugacityPa,
        bicarbonateMgL: chemistry.bicarbonateMgL,
        organicAcidMgL: chemistry.aceticAcidMgL,
        chlorideMgL: chemistry.chlorideMgL,
        isWaterFeSaturated: chemistry.isWaterFeSaturated,
      });
      setValue(c("phMeasured"), result.pH, { shouldValidate: true, shouldDirty: true });
      setPhResult(result);
    } catch (error) {
      setPhError(error instanceof Error ? error.message : "pH hesaplanırken bilinmeyen bir hata oluştu.");
      setPhResult(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <PlainNumberField name={c("co2MolePercent")} labelTr="CO2 Mol Yüzdesi" unitLabel="%" helpKey="chemistry.co2MolePercent" warningKey="chemistry.co2MolePercent" step={0.01} />
      <PlainNumberField name={c("h2sPpmMole")} labelTr="H2S Derişimi" unitLabel="ppm" helpKey="chemistry.h2sPpmMole" warningKey="chemistry.h2sPpmMole" />
      <PlainNumberField name={c("o2Ppb")} labelTr="Çözünmüş Oksijen" unitLabel="ppb" helpKey="chemistry.o2Ppb" />

      <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-2">
          <PlainNumberField name={c("phMeasured")} labelTr="pH" helpKey="chemistry.phMeasured" warningKey="chemistry.phMeasured" step={0.01} />
          <ToggleField name={c("isWaterFeSaturated")} labelTr="Su, FeCO3 ile doygun" />
        </div>
        <button
          type="button"
          onClick={handleComputePh}
          className="mt-1 rounded bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
        >
          pH Hesapla (NORSOK M-506)
        </button>
        {phError && <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">{phError}</div>}
        {phResult && (
          <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            Güven: {phResult.confidence} — kaynak: {phResult.sourcesUsed.join(", ")}
            {phResult.validityWarnings.length > 0 && (
              <div className="mt-0.5 text-amber-600 dark:text-amber-400">
                {phResult.validityWarnings.map((w) => w.message).join(" ")}
              </div>
            )}
          </div>
        )}
      </div>

      <PlainNumberField name={c("chlorideMgL")} labelTr="Klorür Derişimi" unitLabel="mg/L" helpKey="chemistry.chlorideMgL" warningKey="chemistry.chlorideMgL" />
      <PlainNumberField name={c("bicarbonateMgL")} labelTr="Bikarbonat Derişimi" unitLabel="mg/L" helpKey="chemistry.bicarbonateMgL" />
      <PlainNumberField name={c("totalDissolvedSolidsMgL")} labelTr="Toplam Çözünmüş Katı (TDS)" unitLabel="mg/L" />
      <PlainNumberField name={c("aceticAcidMgL")} labelTr="Asetik Asit (HAc)" unitLabel="mg/L" helpKey="chemistry.aceticAcidMgL" />
      <div className="grid grid-cols-2 gap-2">
        <PlainNumberField name={c("glycolWeightPercent")} labelTr="Glikol Ağırlık Yüzdesi" unitLabel="%" helpKey="chemistry.glycolWeightPercent" />
        <PlainNumberField name={c("methanolWeightPercent")} labelTr="Metanol Ağırlık Yüzdesi" unitLabel="%" />
      </div>
      <ToggleField name={c("bacteriaPresent")} labelTr="Korozyona sebep olabilecek bakteri var" helpKey="chemistry.bacteriaPresent" />

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: Katı Partikül →
          </button>
        )}
      </div>
    </div>
  );
}
