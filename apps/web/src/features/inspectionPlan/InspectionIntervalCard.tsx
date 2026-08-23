// apps/web/src/features/inspectionPlan/InspectionIntervalCard.tsx
//
// Muayene aralığı kartı — @erocorr3d/engine'in computeInspectionInterval()
// sonucunu OLDUĞU GİBİ gösterir (bkz. aggregate/inspectionInterval.ts).

import type { InspectionIntervalResult } from "@erocorr3d/engine";
import { CONFIDENCE_BADGE_STYLES } from "../results/chartPalette";

function formatYears(value: number | null): string {
  return value === null ? "hiç ulaşmaz" : `${value.toFixed(1)} yıl`;
}

export function InspectionIntervalCard({ result }: { result: InspectionIntervalResult }) {
  return (
    <div className="rounded border border-neutral-200 p-3 text-xs dark:border-neutral-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Önerilen Muayene Aralığı</span>
          <div className="text-lg font-semibold">{result.recommendedIntervalYears.toFixed(1)} yıl</div>
        </div>
        <div>
          <span className="text-neutral-500 dark:text-neutral-400">Bir Sonraki Muayene Tarihi</span>
          <div className="font-mono text-base">{result.nextInspectionDate}</div>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES[result.confidence] ?? ""}`}>
          {result.confidence === "UNVERIFIED" ? "DOĞRULANMAMIŞ" : result.confidence}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div>
          <div className="text-neutral-500 dark:text-neutral-400">Kalan Ömür (P50)</div>
          <div className="font-mono">{formatYears(result.remainingLifeFromNowYearsP50)}</div>
        </div>
        <div>
          <div className="text-neutral-500 dark:text-neutral-400">Kalan Ömür (P90, koruyucu)</div>
          <div className="font-mono">{formatYears(result.remainingLifeFromNowYearsP90)}</div>
        </div>
        <div>
          <div className="text-neutral-500 dark:text-neutral-400">API 570 Piping Class Tavanı</div>
          <div className="font-mono">{result.api570PipingClassMaxIntervalYears} yıl</div>
        </div>
        <div>
          <div className="text-neutral-500 dark:text-neutral-400">Risk Çarpanı</div>
          <div className="font-mono">×{result.riskCategoryMultiplier}</div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">{result.rationaleTr}</p>

      {result.validityWarnings.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-amber-700 dark:text-amber-400">
          {result.validityWarnings.map((warning) => (
            <li key={warning.message}>{warning.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
