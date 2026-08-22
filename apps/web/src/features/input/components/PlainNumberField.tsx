// apps/web/src/features/input/components/PlainNumberField.tsx
//
// UnitField'ın birim-DÖNÜŞÜMSÜZ karşılığı — yüzde (%), ppm, mg/L, boyutsuz
// katsayı (Cv, FL, xT, Kc) gibi SI⇄Imperial dönüşümü ANLAMSIZ olan alanlar
// için (bu birimler mühendislik pratiğinde evrensel/ortaktır, "gösterim
// birimi" seçimi gerektirmez).

import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { InfoTooltip } from "./InfoTooltip";
import { getNestedErrorMessage } from "./formHelpers";
import { getSoftWarning } from "../validationWarnings";

export interface PlainNumberFieldProps {
  name: FieldPath<WizardDraft>;
  labelTr: string;
  unitLabel?: string;
  helpKey?: string;
  warningKey?: string;
  step?: number;
  disabled?: boolean;
}

export function PlainNumberField({ name, labelTr, unitLabel, helpKey, warningKey, step, disabled }: PlainNumberFieldProps) {
  const { control, formState } = useFormContext<WizardDraft>();
  const errorMessage = getNestedErrorMessage(formState.errors, name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const siValue = typeof field.value === "number" ? field.value : 0;
        const warning = warningKey ? getSoftWarning(warningKey, siValue) : null;
        const borderClass = errorMessage
          ? "border-red-500"
          : warning
            ? "border-amber-400"
            : "border-neutral-300 dark:border-neutral-700";

        return (
          <label className="mb-3 block text-xs">
            <span className="mb-1 flex items-center text-neutral-600 dark:text-neutral-300">
              {labelTr}
              {helpKey && <InfoTooltip fieldKey={helpKey} />}
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step={step ?? "any"}
                disabled={disabled}
                value={Number.isFinite(siValue) ? siValue : ""}
                onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                onBlur={field.onBlur}
                className={`w-full rounded border bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 ${borderClass}`}
              />
              {unitLabel && <span className="w-14 shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">{unitLabel}</span>}
            </div>
            {errorMessage && <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{errorMessage}</div>}
            {!errorMessage && warning && (
              <div className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">{warning}</div>
            )}
          </label>
        );
      }}
    />
  );
}
