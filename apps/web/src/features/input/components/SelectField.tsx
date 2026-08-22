// apps/web/src/features/input/components/SelectField.tsx

import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { InfoTooltip } from "./InfoTooltip";
import { getNestedErrorMessage } from "./formHelpers";

export interface SelectFieldOption {
  value: string | number;
  labelTr: string;
}

export interface SelectFieldProps {
  name: FieldPath<WizardDraft>;
  labelTr: string;
  options: SelectFieldOption[];
  helpKey?: string;
  disabled?: boolean;
  /** "number" ise değişiklikte Number() ile geri çevrilir (ör. pressureClass). */
  valueType?: "string" | "number";
}

export function SelectField({ name, labelTr, options, helpKey, disabled, valueType = "string" }: SelectFieldProps) {
  const { control, formState } = useFormContext<WizardDraft>();
  const errorMessage = getNestedErrorMessage(formState.errors, name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="mb-3 block text-xs">
          <span className="mb-1 flex items-center text-neutral-600 dark:text-neutral-300">
            {labelTr}
            {helpKey && <InfoTooltip fieldKey={helpKey} />}
          </span>
          <select
            value={typeof field.value === "string" || typeof field.value === "number" ? String(field.value) : ""}
            disabled={disabled}
            onChange={(e) => field.onChange(valueType === "number" ? Number(e.target.value) : e.target.value)}
            onBlur={field.onBlur}
            className={`w-full rounded border bg-white px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-100 ${
              errorMessage ? "border-red-500" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.labelTr}
              </option>
            ))}
          </select>
          {errorMessage && <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">{errorMessage}</div>}
        </label>
      )}
    />
  );
}
