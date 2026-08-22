// apps/web/src/features/input/components/UnitField.tsx
//
// Sayısal bir motor alanı için tek satırlık form kontrolü: birim gösterimi
// (SI⇄Imperial, yalnızca GÖSTERİM — bkz. units.ts dosya başı yorumu),
// ⓘ tooltip, kırmızı (Zod hatası) / sarı (yumuşak uyarı) doğrulama rengi.

import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import { useUiStore } from "../../../store/uiStore";
import { displayDecimals, fromDisplayValue, toDisplayValue, unitLabel, type UnitQuantity } from "../units";
import { getSoftWarning } from "../validationWarnings";
import type { WizardDraft } from "../schema";
import { InfoTooltip } from "./InfoTooltip";
import { getNestedErrorMessage, roundTo } from "./formHelpers";

export interface UnitFieldProps {
  name: FieldPath<WizardDraft>;
  labelTr: string;
  quantity: UnitQuantity;
  /** fieldHelp.ts anahtarı — verilmezse ⓘ gösterilmez. */
  helpKey?: string;
  /** validationWarnings.ts anahtarı — verilmezse yumuşak uyarı kontrol edilmez. */
  warningKey?: string;
  step?: number;
  disabled?: boolean;
}

export function UnitField({ name, labelTr, quantity, helpKey, warningKey, step, disabled }: UnitFieldProps) {
  const { control, formState } = useFormContext<WizardDraft>();
  const unitSystem = useUiStore((s) => s.unitSystem);
  const errorMessage = getNestedErrorMessage(formState.errors, name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const siValue = typeof field.value === "number" ? field.value : 0;
        const displayVal = toDisplayValue(quantity, siValue, unitSystem);
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
                value={Number.isFinite(displayVal) ? roundTo(displayVal, displayDecimals(quantity)) : ""}
                onChange={(e) => {
                  const raw = e.target.value === "" ? 0 : Number(e.target.value);
                  field.onChange(fromDisplayValue(quantity, raw, unitSystem));
                }}
                onBlur={field.onBlur}
                className={`w-full rounded border bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 ${borderClass}`}
              />
              <span className="w-14 shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">
                {unitLabel(quantity, unitSystem)}
              </span>
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
