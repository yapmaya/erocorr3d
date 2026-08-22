// apps/web/src/components/NumberSlider.tsx
//
// GeometryLab.tsx'in FITTING modunda YEREL bir bileşen olarak tanımlanmış
// slider'ın PAYLAŞILAN hâli — ValveTab.tsx da AYNI bileşeni kullanır
// (bkz. UnverifiedBadge.tsx emsali, bu klasördeki tek diğer paylaşılan
// bileşen).

export interface NumberSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  valueFormatter?: (value: number) => string;
}

export function NumberSlider({ label, value, min, max, step, onChange, valueFormatter }: NumberSliderProps) {
  return (
    <label className="mb-3 block text-xs">
      <div className="mb-1 flex items-center justify-between text-neutral-600 dark:text-neutral-300">
        <span>{label}</span>
        <span className="font-mono text-neutral-900 dark:text-neutral-100">{valueFormatter ? valueFormatter(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sky-600"
      />
    </label>
  );
}
