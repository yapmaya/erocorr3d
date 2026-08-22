// apps/web/src/features/projects/BatchAnalysisPanel.tsx
//
// "Toplu Analiz" — projedeki tüm bileşenleri Web Worker'da sırayla
// değerlendirir (bkz. batchAnalysis.ts::runBatchAnalysis), ilerleme
// çubuğunu gösterir, sonunda proje özeti + en riskli 10 bileşeni listeler.

import { useState } from "react";
import { useProjectsStore } from "../../store/projectsStore";
import { runBatchAnalysis, type BatchAnalysisProgress, type BatchAnalysisSummary } from "./batchAnalysis";

export function BatchAnalysisPanel({ projectId }: { projectId: string }) {
  const components = useProjectsStore((s) => s.components);
  const [progress, setProgress] = useState<BatchAnalysisProgress | null>(null);
  const [summary, setSummary] = useState<BatchAnalysisSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleStart = async () => {
    setIsRunning(true);
    setSummary(null);
    const result = await runBatchAnalysis(projectId, components, setProgress);
    setSummary(result);
    setIsRunning(false);
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Toplu Analiz</h3>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={isRunning || components.length === 0}
          className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Toplu Analiz Başlat ({components.length} bileşen)
        </button>
      </div>

      {isRunning && progress && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full bg-sky-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {progress.completed}/{progress.total} — {progress.currentComponentLabel ?? "Tamamlandı"}
          </span>
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex gap-4">
            <span>
              Toplam: <span className="font-semibold">{summary.totalComponents}</span>
            </span>
            <span>
              Hesaplandı: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{summary.computedCount}</span>
            </span>
            <span>
              Atlandı: <span className="font-semibold text-amber-600 dark:text-amber-400">{summary.skippedCount}</span>
            </span>
          </div>

          {summary.skippedReasonsTr.length > 0 && (
            <details className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <summary className="cursor-pointer">Atlanan bileşenler ({summary.skippedReasonsTr.length})</summary>
              <ul className="ml-3 list-disc">
                {summary.skippedReasonsTr.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </details>
          )}

          {summary.riskRanking.length > 0 && (
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">En Riskli {summary.riskRanking.length} Bileşen</h4>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-left text-neutral-400 dark:text-neutral-500">
                    <th className="py-0.5">#</th>
                    <th className="py-0.5">Bileşen</th>
                    <th className="py-0.5 text-right">CTL/ATL</th>
                    <th className="py-0.5 text-right">SLC P50 (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.riskRanking.map((r) => (
                    <tr key={r.componentId} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-0.5">{r.rank}</td>
                      <td className="py-0.5">{r.componentLabel}</td>
                      <td className="py-0.5 text-right font-mono">{r.ctlAtl ? `${r.ctlAtl.ratio.toFixed(2)} · ${r.ctlAtl.categoryLabelTr}` : "—"}</td>
                      <td className="py-0.5 text-right font-mono">{r.slcP50Mm.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
