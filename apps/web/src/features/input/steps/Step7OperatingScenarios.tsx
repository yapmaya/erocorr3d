// apps/web/src/features/input/steps/Step7OperatingScenarios.tsx
//
// Adım 7 — İşletme Senaryoları: `OperatingProfile.cases` dizisinin kendisi
// (bkz. schema.ts'in mimari notu — Adım 3-5, `activeCaseIndex`'in işaret
// ettiği satırı düzenler). "Toplam gün ≤365" kuralı motorun kendi
// `OperatingProfileSchema.superRefine`'ından gelir (bkz. formState.errors);
// burada AYRICA canlı bir toplam gösterilir.

import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { createDefaultOperatingCase } from "../defaultDraft";
import { getNestedErrorMessage } from "../components/formHelpers";
import type { StepProps } from "./Step1ComponentSelect";

export interface Step7Props extends StepProps {
  onEditCase: (caseIndex: number) => void;
  onImportClick: () => void;
}

export function Step7OperatingScenarios({ onNext, onPrev, onEditCase, onImportClick }: Step7Props) {
  const { control, setValue, formState } = useFormContext<WizardDraft>();
  const { fields, append, remove } = useFieldArray({ control, name: "operatingProfile.cases" });
  const cases = useWatch({ control, name: "operatingProfile.cases" });
  const activeCaseIndex = useWatch({ control, name: "activeCaseIndex" });
  const [clipboard, setClipboard] = useState<WizardDraft["operatingProfile"]["cases"][number] | null>(null);

  const totalDays = cases.reduce((sum, c) => sum + (Number.isFinite(c.durationDaysPerYear) ? c.durationDaysPerYear : 0), 0);
  const totalError = getNestedErrorMessage(formState.errors, "operatingProfile.cases");

  const addCase = () => {
    append(createDefaultOperatingCase(`Senaryo ${fields.length + 1}`));
    setValue("activeCaseIndex", fields.length, { shouldDirty: true });
  };

  const copyCase = (index: number) => setClipboard(cases[index]);

  const pasteCase = () => {
    if (!clipboard) return;
    append({ ...clipboard, name: `${clipboard.name} (kopya)` });
    setValue("activeCaseIndex", fields.length, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`text-xs ${totalDays > 365 ? "font-semibold text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}>
          Toplam: {totalDays} / 365 gün
        </div>
        <button type="button" onClick={onImportClick} className="text-[11px] text-sky-600 underline hover:text-sky-700 dark:text-sky-400">
          Excel/CSV&apos;den İçe Aktar
        </button>
      </div>
      {totalError && <div className="text-[11px] text-red-600 dark:text-red-400">{totalError}</div>}

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={`rounded border p-2 ${
              activeCaseIndex === index
                ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
                : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
            }`}
          >
            <input
              type="text"
              defaultValue={cases[index]?.name}
              onChange={(e) => setValue(`operatingProfile.cases.${index}.name`, e.target.value, { shouldDirty: true })}
              className="mb-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
            <input
              type="text"
              placeholder="Açıklama"
              defaultValue={cases[index]?.description}
              onChange={(e) => setValue(`operatingProfile.cases.${index}.description`, e.target.value, { shouldDirty: true })}
              className="mb-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                Yıllık gün
                <input
                  type="number"
                  min={0}
                  max={365}
                  defaultValue={cases[index]?.durationDaysPerYear}
                  onChange={(e) =>
                    setValue(`operatingProfile.cases.${index}.durationDaysPerYear`, Number(e.target.value), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className="w-16 rounded border border-neutral-300 bg-white px-1 py-0.5 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </label>
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => onEditCase(index)} className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-sky-700">
                  Düzenle
                </button>
                <button type="button" onClick={() => copyCase(index)} className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                  Kopyala
                </button>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} className="rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
                    Sil
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={addCase} className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
          + Yeni Senaryo
        </button>
        <button
          type="button"
          onClick={pasteCase}
          disabled={!clipboard}
          className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          Yapıştır
        </button>
      </div>

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Devam Et: Belirsizlik →
          </button>
        )}
      </div>
    </div>
  );
}
