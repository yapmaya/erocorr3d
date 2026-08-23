// apps/web/src/features/inspectionPlan/MitigationRecommendationsList.tsx
//
// Azaltma önerileri listesi — @erocorr3d/engine'in recommendMitigations()
// sonucunu OLDUĞU GİBİ gösterir (bkz. aggregate/mitigationRecommendations.ts).

import type { MitigationRecommendationsResult } from "@erocorr3d/engine";

export function MitigationRecommendationsList({ result }: { result: MitigationRecommendationsResult }) {
  if (result.recommendations.length === 0) {
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Belirleyici senaryoda eşik-üstü bir azaltma tetikleyicisi bulunamadı.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {result.recommendations.map((rec) => (
        <div key={rec.triggerTr} className="rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{rec.triggerTr}</span>
            {rec.alreadyAddressed && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                ZATEN ELE ALINDI
              </span>
            )}
          </div>
          <ul className="list-disc pl-4 text-neutral-600 dark:text-neutral-300">
            {rec.recommendationsTr.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {result.assumptionsTr.length > 0 && (
        <ul className="list-disc pl-4 text-[11px] text-neutral-500 dark:text-neutral-400">
          {result.assumptionsTr.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
