// apps/web/src/features/inspectionPlan/components/NumberInput.tsx
//
// Muayene Planı sekmesinin kendi ayarlanabilir sayısal girdileri (işletme
// süresi, iskonto oranı, OPEX çarpanları) için küçük, react-hook-form'a
// BAĞLI OLMAYAN (girdi sihirbazının `PlainNumberField`inden farklı, saf
// `useState` ile çalışan) bir sayı kutusu.

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberInput({ value, onChange, min, max, step, className }: NumberInputProps) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const parsed = Number(e.target.value);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      className={`rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${className ?? ""}`}
    />
  );
}
