// apps/web/src/features/input/components/InfoTooltip.tsx
//
// ⓘ tooltip düğmesi — `UnverifiedBadge.tsx`'in aynı "tıkla, popover aç"
// desenini izler (bkz. components/UnverifiedBadge.tsx).

import { useState } from "react";
import { getFieldHelp } from "../fieldHelp";

export function InfoTooltip({ fieldKey }: { fieldKey: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const entry = getFieldHelp(fieldKey);
  if (!entry) return null;

  return (
    <span
      className="relative inline-block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={entry.titleTr}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-500 hover:border-sky-500 hover:text-sky-600 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-sky-400 dark:hover:text-sky-400"
      >
        ⓘ
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded border border-neutral-200 bg-white p-2 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mb-1 font-semibold text-neutral-800 dark:text-neutral-100">{entry.titleTr}</div>
          <div className="text-neutral-600 dark:text-neutral-300">{entry.bodyTr}</div>
          {entry.typicalRangeTr && (
            <div className="mt-1 border-t border-neutral-200 pt-1 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {entry.typicalRangeTr}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
