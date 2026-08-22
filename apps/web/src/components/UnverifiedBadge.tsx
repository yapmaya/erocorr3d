// apps/web/src/components/UnverifiedBadge.tsx

import { useState } from "react";
import type { Coefficient } from "@erocorr3d/engine";
import { translateUnverifiedBadgeLabel, useTranslation } from "../i18n/translations";

export interface UnverifiedBadgeProps {
  /** Bu sonuçta kullanılan, confidence="UNVERIFIED" olan katsayılar. */
  unverifiedCoefficients: Coefficient[];
}

/**
 * Bir hesap sonucunun kaç doğrulanmamış (UNVERIFIED) katsayı kullandığını
 * gösteren sarı uyarı rozeti. Tıklanınca hangi katsayılar olduğunu listeleyen
 * bir açılır pencere gösterir. unverifiedCoefficients boşsa hiçbir şey
 * render etmez (uyarılacak bir şey yoksa rozet görünmemelidir).
 */
export function UnverifiedBadge({ unverifiedCoefficients }: UnverifiedBadgeProps) {
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (unverifiedCoefficients.length === 0) {
    return null;
  }

  return (
    <div
      className="relative inline-block"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1 rounded border border-amber-400 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
        aria-expanded={isOpen}
      >
        {translateUnverifiedBadgeLabel(unverifiedCoefficients.length, locale)}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {t("unverifiedBadgePopoverTitle")}
          </h3>
          <ul className="flex flex-col gap-2">
            {unverifiedCoefficients.map((coefficient) => (
              <li key={coefficient.id} className="text-xs">
                <div className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                  {coefficient.id}
                </div>
                <div className="text-neutral-600 dark:text-neutral-300">{coefficient.description}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
