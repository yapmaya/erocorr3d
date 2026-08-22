// apps/web/src/features/results/components/SummaryCards.tsx
//
// Sağ panelin özet kartları — girdi sihirbazının "Hesapla" geçmişinden
// (assessmentHistoryStore) SEÇİLİ bileşenin özetini gösterir. `deriveTableRow`
// (resultsDerivation.ts) İLE AYNI, TEK türetme kaynağını kullanır — Sonuç
// Tablosu'yla (A) tutarsız bir ikinci hesap İCAT ETMEZ.

import { MECHANISM_CONFIDENCE_LABELS } from "@erocorr3d/engine";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { UnverifiedBadge } from "../../../components/UnverifiedBadge";
import { CONFIDENCE_BADGE_STYLES, CTL_ATL_COLOR_STYLES } from "../chartPalette";
import { deriveTableRow } from "../resultsDerivation";

export function SummaryCards() {
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entry = entries.find((e) => e.id === selectedEntryId);

  if (!entry) {
    return <p className="text-sm text-neutral-400 dark:text-neutral-500">Girdi panelinden bir bileşen tanımlayıp &quot;Hesapla&quot;ya basın.</p>;
  }

  const row = deriveTableRow(entry, { inServiceInspectionPossible: false });
  const { assessment } = entry;
  const ctlAtlStyles = row.ctlAtl ? CTL_ATL_COLOR_STYLES[row.ctlAtl.colorTr] : null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{entry.componentLabel}</div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Belirleyici senaryo: {assessment.governingCaseName}</div>
        {entries.length > 1 && (
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
            {entries.length} bileşen hesaplandı — alt çekmecedeki Sonuç Tablosu&apos;ndan diğerlerini seçebilirsiniz.
          </div>
        )}
      </div>

      <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Toplam Metal Kaybı (Tasarım Ömrü Sonu)
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES[assessment.metalLoss.confidence] ?? ""}`}>
            {assessment.metalLoss.confidence === "UNVERIFIED" ? "DOĞRULANMAMIŞ" : assessment.metalLoss.confidence}
          </span>
        </div>
        <div className="flex gap-3 text-xs">
          <span>
            P10: <span className="font-mono">{assessment.metalLoss.totalServiceLifeCorrosionMm.p10.toFixed(2)} mm</span>
          </span>
          <span>
            P50: <span className="font-mono font-semibold">{assessment.metalLoss.totalServiceLifeCorrosionMm.p50.toFixed(2)} mm</span>
          </span>
          <span>
            P90: <span className="font-mono">{assessment.metalLoss.totalServiceLifeCorrosionMm.p90.toFixed(2)} mm</span>
          </span>
        </div>
        <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          Yıllık: P50 {assessment.metalLoss.totalAnnualLossMmPerYear.p50.toFixed(3)} mm/yıl
        </div>
      </div>

      <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">CTL / ATL</span>
          <UnverifiedBadge unverifiedCoefficients={row.unverifiedCoefficients} />
        </div>
        {row.ctlAtl && ctlAtlStyles ? (
          <>
            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${ctlAtlStyles.bgClass} ${ctlAtlStyles.textClass}`}>
              {row.ctlAtl.ratio.toFixed(2)} · {row.ctlAtl.categoryLabelTr}
            </span>
            <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">{row.ctlAtl.impactOnSystemLifeTr}</p>
          </>
        ) : (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">— (korozyon payı girilmedi)</span>
        )}
      </div>

      <div className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Malzeme Önerisi</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES[row.confidence] ?? ""}`}>{row.confidence}</span>
        </div>
        <p className="text-xs text-neutral-800 dark:text-neutral-100">{row.primaryMaterialTr}</p>
        {row.alternativeMaterialTr && <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">Alternatif: {row.alternativeMaterialTr}</p>}
      </div>

      {assessment.perCase.map((caseAssessment) => (
        <div key={caseAssessment.caseName} className="rounded border border-neutral-200 p-2 dark:border-neutral-800">
          <div className="mb-1 text-xs font-semibold text-neutral-800 dark:text-neutral-100">{caseAssessment.caseName}</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-neutral-400 dark:text-neutral-500">
                <th className="font-normal">Mekanizma</th>
                <th className="font-normal text-right">P50 (mm/yıl)</th>
                <th className="font-normal text-right">Güven</th>
              </tr>
            </thead>
            <tbody>
              {caseAssessment.mechanismResults
                .filter((m) => m.isApplicable)
                .map((mechanism) => (
                  <tr key={mechanism.mechanismId} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-0.5 text-neutral-700 dark:text-neutral-200">{mechanism.nameTr}</td>
                    <td className="py-0.5 text-right font-mono">{mechanism.rateP50.toFixed(3)}</td>
                    <td className="py-0.5 text-right">{MECHANISM_CONFIDENCE_LABELS[mechanism.confidence].tr}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {caseAssessment.qualitativeRiskFindings.length > 0 && (
            <div className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              Nitel risk bulguları: {caseAssessment.qualitativeRiskFindings.map((f) => `${f.nameTr} (${f.riskLevel})`).join(", ")}
            </div>
          )}
          {caseAssessment.assumptionsTr.length > 0 && (
            <details className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
              <summary className="cursor-pointer">Varsayımlar ({caseAssessment.assumptionsTr.length})</summary>
              <ul className="ml-3 list-disc">
                {caseAssessment.assumptionsTr.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {assessment.metalLoss.validityWarnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {assessment.metalLoss.validityWarnings.map((w) => w.message).join(" ")}
        </div>
      )}

      <p className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {assessment.metalLoss.disclaimer}
      </p>
    </div>
  );
}
