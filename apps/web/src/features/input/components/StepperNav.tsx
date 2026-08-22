// apps/web/src/features/input/components/StepperNav.tsx
//
// 8 adımlık kompakt sekme çubuğu. Panel dar olduğundan (WorkspaceLayout'ta
// ~%25 genişlik) her adımın tam adı yerine numaralandırılmış rozetler
// gösterilir; aktif adımın tam adı ayrıca büyük başlık olarak render edilir
// (bkz. InputWizard.tsx).

import { WIZARD_STEPS } from "../schema";

export interface StepperNavProps {
  activeStep: number;
  onSelect: (step: number) => void;
}

export function StepperNav({ activeStep, onSelect }: StepperNavProps) {
  return (
    <div className="mb-2 flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800">
      {WIZARD_STEPS.map((s) => (
        <button
          key={s.step}
          type="button"
          onClick={() => onSelect(s.step)}
          title={s.titleTr}
          aria-current={activeStep === s.step}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
            activeStep === s.step
              ? "bg-sky-600 text-white"
              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          }`}
        >
          {s.step}
        </button>
      ))}
    </div>
  );
}
