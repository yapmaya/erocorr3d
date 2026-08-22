// apps/web/src/features/projects/RunComparisonPanel.tsx
//
// İki çalıştırmayı (aynı bileşenin farklı zamanları OLABİLİR ama zorunlu
// değil) yan yana karşılaştırır — `compareRuns.ts::compareAssessmentRuns`
// (SAF) çağrısının ince UI katmanı.

import { useState } from "react";
import { useProjectsStore } from "../../store/projectsStore";
import { compareAssessmentRuns } from "./compareRuns";

export function RunComparisonPanel() {
  const assessmentRuns = useProjectsStore((s) => s.assessmentRuns);
  const [runAId, setRunAId] = useState<string>("");
  const [runBId, setRunBId] = useState<string>("");

  const runA = assessmentRuns.find((r) => r.id === runAId);
  const runB = assessmentRuns.find((r) => r.id === runBId);
  const comparison = runA && runB ? compareAssessmentRuns(runA, runB) : null;

  const runLabel = (r: (typeof assessmentRuns)[number]) => `${r.componentLabel} — ${new Date(r.computedAt).toLocaleString("tr-TR")} (v${r.engineVersion})`;

  if (assessmentRuns.length < 2) {
    return (
      <div className="rounded border border-neutral-200 p-3 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        Karşılaştırma için en az 2 çalıştırma kaydı gerekir (Toplu Analiz veya bileşen formunda &quot;Hesapla&quot; ile üretilir).
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Çalıştırma Karşılaştırması</h3>
      <div className="flex gap-2">
        <select value={runAId} onChange={(e) => setRunAId(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">— A: bir çalıştırma seçin —</option>
          {assessmentRuns.map((r) => (
            <option key={r.id} value={r.id}>
              {runLabel(r)}
            </option>
          ))}
        </select>
        <select value={runBId} onChange={(e) => setRunBId(e.target.value)} className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">— B: bir çalıştırma seçin —</option>
          {assessmentRuns.map((r) => (
            <option key={r.id} value={r.id}>
              {runLabel(r)}
            </option>
          ))}
        </select>
      </div>

      {comparison && (
        <div className="flex flex-col gap-3 text-xs">
          {comparison.summaryTr.length === 0 ? (
            <p className="text-neutral-400 dark:text-neutral-500">İki çalıştırma arasında fark yok.</p>
          ) : (
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Ne Değişti</h4>
              <ul className="list-disc pl-4">
                {comparison.summaryTr.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-left text-neutral-400 dark:text-neutral-500">
                <th className="py-0.5">Alan</th>
                <th className="py-0.5">A</th>
                <th className="py-0.5">B</th>
              </tr>
            </thead>
            <tbody>
              {[...comparison.inputDeltas, ...comparison.resultDeltas].map((d) => (
                <tr key={d.labelTr} className={`border-t border-neutral-100 dark:border-neutral-800 ${d.changed ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}>
                  <td className="py-0.5">{d.labelTr}</td>
                  <td className="py-0.5 font-mono">{d.before}</td>
                  <td className="py-0.5 font-mono">{d.after}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {comparison.mechanismDeltas.length > 0 && (
            <div>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Mekanizma P50 Farkları</h4>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-left text-neutral-400 dark:text-neutral-500">
                    <th className="py-0.5">Mekanizma</th>
                    <th className="py-0.5 text-right">A (mm/yıl)</th>
                    <th className="py-0.5 text-right">B (mm/yıl)</th>
                    <th className="py-0.5 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.mechanismDeltas.map((m) => (
                    <tr key={m.mechanismId} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-0.5">{m.nameTr}</td>
                      <td className="py-0.5 text-right font-mono">{m.beforeP50?.toFixed(3) ?? "—"}</td>
                      <td className="py-0.5 text-right font-mono">{m.afterP50?.toFixed(3) ?? "—"}</td>
                      <td className="py-0.5 text-right font-mono">{m.deltaP50 !== null ? m.deltaP50.toFixed(3) : "—"}</td>
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
