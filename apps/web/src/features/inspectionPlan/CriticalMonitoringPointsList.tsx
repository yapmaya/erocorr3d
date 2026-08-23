// apps/web/src/features/inspectionPlan/CriticalMonitoringPointsList.tsx
//
// Kritik İzleme Noktaları (CMP) listesi — @erocorr3d/engine'in
// selectCriticalMonitoringPoints() sonucunu OLDUĞU GİBİ gösterir (bkz.
// aggregate/criticalMonitoringPoints.ts).

import type { CriticalMonitoringPointsResult } from "@erocorr3d/engine";

export function CriticalMonitoringPointsList({ result }: { result: CriticalMonitoringPointsResult }) {
  if (result.points.length === 0) {
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Belirgin bir hasar hotspot'u bulunamadı.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {result.dominantMechanismNameTr && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Baskın mekanizma: <span className="font-medium text-neutral-700 dark:text-neutral-200">{result.dominantMechanismNameTr}</span>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Konum</th>
              <th className="py-1 pr-2">Hasar (mm)</th>
              <th className="py-1 pr-2">Önerilen Teknik</th>
              <th className="py-1 pr-2">Erişilebilirlik Uyarısı</th>
            </tr>
          </thead>
          <tbody>
            {result.points.map((point) => (
              <tr key={point.rank} className="border-b border-neutral-100 align-top dark:border-neutral-900">
                <td className="py-1.5 pr-2 font-mono">{point.rank}</td>
                <td className="py-1.5 pr-2">{point.locationDescriptionTr}</td>
                <td className="py-1.5 pr-2 font-mono">{point.hotspot.valueMm.toFixed(2)}</td>
                <td className="py-1.5 pr-2">
                  <ul className="list-disc pl-3">
                    {point.recommendedTechniquesTr.map((technique) => (
                      <li key={technique}>{technique}</li>
                    ))}
                  </ul>
                </td>
                <td className="py-1.5 pr-2 text-amber-700 dark:text-amber-400">{point.accessibilityWarningTr ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
