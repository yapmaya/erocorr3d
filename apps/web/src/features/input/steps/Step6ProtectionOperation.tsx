// apps/web/src/features/input/steps/Step6ProtectionOperation.tsx
//
// Adım 6 — Koruma ve İşletme: `Mitigation` (bileşen düzeyinde, TÜM
// senaryolarda ortak) + `OperatingProfile`'ın tasarım ömrü/korozyon payı
// alanları.

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { INTERNAL_LINING_LABELS } from "@erocorr3d/engine";
import type { WizardDraft } from "../schema";
import { UnitField } from "../components/UnitField";
import { SelectField } from "../components/SelectField";
import { ToggleField } from "../components/ToggleField";
import { PlainNumberField } from "../components/PlainNumberField";
import type { StepProps } from "./Step1ComponentSelect";

const INTERNAL_LINING_OPTIONS = Object.entries(INTERNAL_LINING_LABELS).map(([value, label]) => ({ value, labelTr: label.tr }));

export function Step6ProtectionOperation({ onNext, onPrev }: StepProps) {
  const { control, setValue } = useFormContext<WizardDraft>();
  const inhibitorUsed = useWatch({ control, name: "mitigation.inhibitorUsed" });
  const isInsulated = useWatch({ control, name: "geometry.isInsulated" });

  // MitigationSchema'nın superRefine kuralı: inhibitorUsed=false iken
  // inhibitorAvailabilityPercent/inhibitorEfficiencyPercent BELİRTİLEMEZ —
  // düğme kapatıldığında bu alanları otomatik temizler.
  useEffect(() => {
    if (!inhibitorUsed) {
      setValue("mitigation.inhibitorAvailabilityPercent", undefined, { shouldValidate: true });
      setValue("mitigation.inhibitorEfficiencyPercent", undefined, { shouldValidate: true });
    }
  }, [inhibitorUsed, setValue]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
        <ToggleField name="mitigation.inhibitorUsed" labelTr="Kimyasal Korozyon İnhibitörü Kullanılıyor" />
        {inhibitorUsed && (
          <div className="grid grid-cols-2 gap-2">
            <PlainNumberField name="mitigation.inhibitorAvailabilityPercent" labelTr="Kullanılabilirlik" unitLabel="%" helpKey="mitigation.inhibitorAvailabilityPercent" />
            <PlainNumberField name="mitigation.inhibitorEfficiencyPercent" labelTr="Verimlilik" unitLabel="%" helpKey="mitigation.inhibitorEfficiencyPercent" warningKey="mitigation.inhibitorEfficiencyPercent" />
          </div>
        )}
      </div>

      <ToggleField name="mitigation.biocideUsed" labelTr="Biyosit Kullanılıyor (MIC önlemi)" />
      <ToggleField name="mitigation.o2ScavengerUsed" labelTr="Oksijen Tutucu Kullanılıyor" />
      <SelectField name="mitigation.internalLining" labelTr="İç Kaplama/Astar" helpKey="mitigation.internalLining" options={INTERNAL_LINING_OPTIONS} />
      <ToggleField name="mitigation.cathodicProtection" labelTr="Katodik Koruma Mevcut" />

      {isInsulated && <ToggleField name="mitigation.insulationChlorideLeachable" labelTr="İzolasyon malzemesi klorür sızdırabilir (CUI riski)" />}

      <div className="mt-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <PlainNumberField name="operatingProfile.designLifeYears" labelTr="Tasarım Ömrü" unitLabel="yıl" helpKey="operatingProfile.designLifeYears" warningKey="operatingProfile.designLifeYears" />
        <UnitField name="operatingProfile.corrosionAllowanceMm" labelTr="Korozyon Payı" quantity="LENGTH_MM" helpKey="operatingProfile.corrosionAllowanceMm" warningKey="operatingProfile.corrosionAllowanceMm" />
      </div>

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: İşletme Senaryoları →
          </button>
        )}
      </div>
    </div>
  );
}
