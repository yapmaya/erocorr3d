// apps/web/src/features/input/steps/Step8Uncertainty.tsx
//
// Adım 8 — Belirsizlik (opsiyonel/gelişmiş). KAPSAM (bkz. onaylı plan'ın
// kapsam kararı #3): burada yalnızca "hangi girdi belirsiz + hangi dağılım"
// bilgisi YAKALANIR ve taslakla birlikte saklanır — motorun
// `uncertainty/monteCarlo.ts` modülüne BAĞLANMAZ. Sonuç ekranındaki
// P10/P50/P90 bandı HER ZAMAN registry'nin kendi katsayı belirsizliğinden
// gelir (bkz. `uncertainty/percentiles.ts::applyMultiplicativeUncertaintyBand`),
// bu adımın girdisinden ETKİLENMEZ — bu UI'da açıkça belirtilir.

import { useFieldArray, useFormContext } from "react-hook-form";
import type { UncertaintyDistribution } from "../schema";
import type { StepProps } from "./Step1ComponentSelect";
import type { WizardDraft } from "../schema";

const DISTRIBUTION_OPTIONS: { value: UncertaintyDistribution; labelTr: string }[] = [
  { value: "NORMAL", labelTr: "Normal (Gauss)" },
  { value: "UNIFORM", labelTr: "Düzgün (Uniform)" },
  { value: "TRIANGULAR", labelTr: "Üçgen (Triangular)" },
  { value: "LOGNORMAL", labelTr: "Log-normal" },
];

export function Step8Uncertainty({ onPrev }: StepProps) {
  const { control, register } = useFormContext<WizardDraft>();
  const { fields, append, remove } = useFieldArray({ control, name: "uncertainNotes" });

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Bu adımda girilen bilgi yalnızca kaydedilir — gelecekteki bir Monte Carlo entegrasyonu içindir. Sonuçlardaki
        P10/P50/P90 bandı her zaman motorun kendi katsayı belirsizliğinden gelir, bu adımdan ETKİLENMEZ.
      </p>

      {fields.map((field, index) => (
        <div key={field.id} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
          <input
            type="text"
            placeholder="Belirsiz girdi adı (ör. CO2 mol yüzdesi)"
            {...register(`uncertainNotes.${index}.fieldLabelTr` as const)}
            className="mb-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <select
            {...register(`uncertainNotes.${index}.distribution` as const)}
            className="mb-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {DISTRIBUTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelTr}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Not (tahmin kaynağı, aralık vb.)"
            {...register(`uncertainNotes.${index}.notesTr` as const)}
            rows={2}
            className="mb-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button type="button" onClick={() => remove(index)} className="rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400">
            Kaldır
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => append({ id: crypto.randomUUID(), fieldLabelTr: "", distribution: "NORMAL", notesTr: "" })}
        className="self-start rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        + Belirsiz Girdi Ekle
      </button>

      <div className="mt-2 flex justify-between">
        {onPrev && (
          <button type="button" onClick={onPrev} className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
            ← Geri
          </button>
        )}
        <span className="self-center text-[11px] text-neutral-400 dark:text-neutral-500">
          Son adım — panelin altındaki &quot;Hesapla&quot; ile sonuçları üretin.
        </span>
      </div>
    </div>
  );
}
