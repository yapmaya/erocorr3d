// apps/web/src/features/input/components/ToggleField.tsx

import { Controller, useFormContext, type FieldPath } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { InfoTooltip } from "./InfoTooltip";

export interface ToggleFieldProps {
  name: FieldPath<WizardDraft>;
  labelTr: string;
  helpKey?: string;
  disabled?: boolean;
}

export function ToggleField({ name, labelTr, helpKey, disabled }: ToggleFieldProps) {
  const { control } = useFormContext<WizardDraft>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <label className="mb-3 flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(field.value)}
            onChange={(e) => field.onChange(e.target.checked)}
            onBlur={field.onBlur}
            className="accent-sky-600"
          />
          {labelTr}
          {helpKey && <InfoTooltip fieldKey={helpKey} />}
        </label>
      )}
    />
  );
}
