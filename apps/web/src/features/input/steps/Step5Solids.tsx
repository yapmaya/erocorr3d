// apps/web/src/features/input/steps/Step5Solids.tsx
//
// Adım 5 — Katı Partikül: kum debisi sıfırsa parçacık ayrıntıları
// (`SolidsDataSchema`'nın superRefine kuralı gereği) gerekmez — "Kum yok"
// hızlı seçeneği bunu tek tıkla uygular.

import { useFormContext, useWatch } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { PlainNumberField } from "../components/PlainNumberField";
import { caseFieldPath } from "./caseFieldPath";
import type { StepProps } from "./Step1ComponentSelect";

export function Step5Solids({ onNext, onPrev }: StepProps) {
  const { control, setValue } = useFormContext<WizardDraft>();
  const activeCaseIndex = useWatch({ control, name: "activeCaseIndex" });
  const sandRateKgDay = useWatch({ control, name: caseFieldPath(activeCaseIndex, "solids.sandRateKgDay") });

  function s<S extends string>(suffix: S) {
    return caseFieldPath(activeCaseIndex, `solids.${suffix}`);
  }

  const setNoSand = () => {
    setValue(s("sandRateKgDay"), 0, { shouldValidate: true, shouldDirty: true });
    setValue(s("sandPpmw"), 0, { shouldValidate: true, shouldDirty: true });
    setValue(s("particleDiameterUm"), undefined, { shouldValidate: true, shouldDirty: true });
    setValue(s("particleDensityKgM3"), undefined, { shouldValidate: true, shouldDirty: true });
    setValue(s("particleShapeFactor"), undefined, { shouldValidate: true, shouldDirty: true });
  };

  const hasSand = typeof sandRateKgDay === "number" && sandRateKgDay > 0;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={setNoSand}
        className={`self-start rounded-full border px-3 py-1 text-xs font-medium ${
          !hasSand
            ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
            : "border-neutral-300 bg-white text-neutral-600 hover:border-sky-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
        }`}
      >
        Kum Yok
      </button>

      <PlainNumberField name={s("sandRateKgDay")} labelTr="Kum Debisi" unitLabel="kg/gün" helpKey="solids.sandRateKgDay" warningKey="solids.sandRateKgDay" />
      <PlainNumberField name={s("sandPpmw")} labelTr="Kum Derişimi" unitLabel="ppmw" />

      {hasSand && (
        <>
          <PlainNumberField name={s("particleDiameterUm")} labelTr="Parçacık Çapı" unitLabel="μm" helpKey="solids.particleDiameterUm" />
          <PlainNumberField name={s("particleDensityKgM3")} labelTr="Parçacık Yoğunluğu" unitLabel="kg/m³" />
          <PlainNumberField name={s("particleShapeFactor")} labelTr="Parçacık Şekil Faktörü" helpKey="solids.particleShapeFactor" step={0.05} />
        </>
      )}

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: Koruma ve İşletme →
          </button>
        )}
      </div>
    </div>
  );
}
