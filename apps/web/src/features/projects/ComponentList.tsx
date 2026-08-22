// apps/web/src/features/projects/ComponentList.tsx
//
// Seçili projenin bileşen listesi — her satırda son çalıştırmanın özeti
// (CTL/ATL, malzeme önerisi — `deriveMaterialRecommendation` ile AYNI
// türetme, `customMaterials`'ı da geçirerek, bkz. resultsDerivation.ts) ve
// motor sürümü rozeti (`run.engineVersion !== ENGINE_VERSION` ise "Eski
// Sürüm" + yeniden hesapla).

import { useMemo, useState } from "react";
import { ENGINE_VERSION } from "@erocorr3d/engine";
import { useProjectsStore } from "../../store/projectsStore";
import { deriveCtlAtl, deriveMaterialRecommendation } from "../results/resultsDerivation";
import { CTL_ATL_COLOR_STYLES } from "../results/chartPalette";
import { ComponentForm } from "./ComponentForm";
import { persistAssessmentRun } from "./persistAssessmentRun";
import type { AssessmentRunRecord, ProjectComponentRecord } from "./types";

function latestRunFor(runs: AssessmentRunRecord[], componentId: string): AssessmentRunRecord | null {
  const componentRuns = runs.filter((r) => r.componentId === componentId);
  if (componentRuns.length === 0) return null;
  return componentRuns.reduce((latest, r) => (r.computedAt > latest.computedAt ? r : latest));
}

interface ComponentRowProps {
  component: ProjectComponentRecord;
  latestRun: AssessmentRunRecord | null;
  onEdit: () => void;
  onDelete: () => void;
}

function ComponentRow({ component, latestRun, onEdit, onDelete }: ComponentRowProps) {
  const customMaterials = useProjectsStore((s) => s.customMaterials);
  const [isRecomputing, setIsRecomputing] = useState(false);

  const ctlAtl = latestRun ? deriveCtlAtl({ assessment: latestRun.assessment, operatingProfile: latestRun.operatingProfile }) : null;
  const material = latestRun ? deriveMaterialRecommendation({ assessment: latestRun.assessment }, false, customMaterials) : null;
  const isStale = latestRun !== null && latestRun.engineVersion !== ENGINE_VERSION;

  const handleRecompute = async () => {
    setIsRecomputing(true);
    await persistAssessmentRun(component.projectId, component.id, component);
    setIsRecomputing(false);
  };

  return (
    <tr className="border-t border-neutral-100 dark:border-neutral-800">
      <td className="px-2 py-1.5">
        <div className="font-medium text-neutral-800 dark:text-neutral-100">{component.componentLabel}</div>
        <div className="text-[10px] text-neutral-400 dark:text-neutral-500">{component.componentCategory === "VALVE" ? "Vana" : "Boru/Fitting"}</div>
      </td>
      <td className="px-2 py-1.5 text-[11px]">
        {!latestRun && <span className="text-neutral-400 dark:text-neutral-500">Henüz hesaplanmadı</span>}
        {latestRun && (
          <div className="flex flex-col gap-0.5">
            <span>{new Date(latestRun.computedAt).toLocaleString("tr-TR")}</span>
            {isStale && (
              <span className="inline-flex w-fit items-center gap-1 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-300">
                Eski Sürüm ({latestRun.engineVersion} → {ENGINE_VERSION})
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5 text-[11px]">
        {ctlAtl ? (
          <span className={`rounded px-1.5 py-0.5 font-semibold ${CTL_ATL_COLOR_STYLES[ctlAtl.colorTr].bgClass} ${CTL_ATL_COLOR_STYLES[ctlAtl.colorTr].textClass}`}>
            {ctlAtl.ratio.toFixed(2)} · {ctlAtl.categoryLabelTr}
          </span>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">—</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-neutral-700 dark:text-neutral-200">{material?.primaryMaterialTr ?? "—"}</td>
      <td className="px-2 py-1.5 text-right">
        <div className="flex justify-end gap-1">
          {isStale && (
            <button type="button" onClick={() => void handleRecompute()} disabled={isRecomputing} className="rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
              Yeniden Hesapla
            </button>
          )}
          <button type="button" onClick={onEdit} className="rounded bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
            Düzenle
          </button>
          <button type="button" onClick={onDelete} className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400">
            Sil
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ComponentList({ projectId }: { projectId: string }) {
  const components = useProjectsStore((s) => s.components);
  const assessmentRuns = useProjectsStore((s) => s.assessmentRuns);
  const deleteComponent = useProjectsStore((s) => s.deleteComponent);
  const [editingComponentId, setEditingComponentId] = useState<string | null | "new">(null);

  const editingComponent = useMemo(
    () => (editingComponentId && editingComponentId !== "new" ? (components.find((c) => c.id === editingComponentId) ?? null) : null),
    [editingComponentId, components],
  );

  if (editingComponentId !== null) {
    return <ComponentForm projectId={projectId} existing={editingComponent} onClose={() => setEditingComponentId(null)} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Bileşenler ({components.length})</h3>
        <button type="button" onClick={() => setEditingComponentId("new")} className="rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700">
          + Bileşen Ekle
        </button>
      </div>

      {components.length === 0 ? (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">Bu projede henüz bileşen yok. &quot;Bileşen Ekle&quot; ile başlayın veya bir hat listesi içe aktarın.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                <th className="px-2 py-1">Bileşen</th>
                <th className="px-2 py-1">Son Çalıştırma</th>
                <th className="px-2 py-1">CTL/ATL</th>
                <th className="px-2 py-1">Malzeme</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {components.map((component) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  latestRun={latestRunFor(assessmentRuns, component.id)}
                  onEdit={() => setEditingComponentId(component.id)}
                  onDelete={() => void deleteComponent(component.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
