// apps/web/src/features/results/MaterialComparisonMatrix.tsx
//
// Malzeme Karşılaştırma Matrisi (H) — motorun 20 malzemelik kataloğunun
// (data/materials.ts) tamamını, YALNIZCA gerçekten hesaplanabilen alanlarla
// listeler (bkz. materialMatrixData.ts başlığındaki KDP notu). Diğer 7
// grafik gibi bir SVG/Recharts grafiği DEĞİL, ResultsTable.tsx (A) ile AYNI
// nedenle (HTML tablo, mevcut SVG-rasterleştirme aracı uygulanamaz) yalnızca
// CSV dışa aktarır.

import { useMemo, useState } from "react";
import { useAssessmentHistoryStore } from "../../store/assessmentHistoryStore";
import { CONFIDENCE_BADGE_STYLES } from "./chartPalette";
import { buildMaterialMatrixData, type MaterialMatrixRow } from "./materialMatrixData";
import { deriveMaterialRecommendation } from "./resultsDerivation";
import { downloadCsv } from "../viewer2d/export/exportCsv";

function formatLifeYears(row: MaterialMatrixRow): string {
  if (row.lifeYearsModeled === null) return "Modellenmedi";
  return `${row.lifeYearsModeled.toFixed(1)} yıl`;
}

export function MaterialComparisonMatrix() {
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const entry = entries.find((e) => e.id === selectedEntryId);
  const [inServiceInspectionPossible, setInServiceInspectionPossible] = useState(false);

  const data = useMemo(() => {
    if (!entry) return null;
    return buildMaterialMatrixData(entry, { inServiceInspectionPossible });
  }, [entry, inServiceInspectionPossible]);

  const materialConfidence = useMemo(() => {
    if (!entry) return null;
    return deriveMaterialRecommendation(entry, inServiceInspectionPossible).confidence;
  }, [entry, inServiceInspectionPossible]);

  if (!entry || !data) {
    return <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">Sonuç tablosundan bir bileşen seçin.</div>;
  }

  const handleExportCsv = () => {
    const header = ["Malzeme", "Aile", "PREN", "Sıcaklık Uygun mu?", "Bağıl Maliyet (CS=1,0)", "Ömür (Modellenen)", "Sour Servis Notu"];
    const rows: (string | number)[][] = [header];
    for (const row of data.rows) {
      rows.push([
        row.material.displayNameTr,
        row.material.family,
        row.material.pren ?? "",
        row.temperatureSuitable ? "Evet" : "Hayır",
        row.material.relativeCostIndex.toFixed(2),
        row.lifeYearsModeled === null ? "Modellenmedi" : row.lifeYearsModeled.toFixed(2),
        row.sourServiceNoteTr ?? "",
      ]);
    }
    downloadCsv("malzeme-karsilastirma-matrisi.csv", rows);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{entry.componentLabel} — Malzeme Karşılaştırma Matrisi</h3>
        <label className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
          <input type="checkbox" checked={inServiceInspectionPossible} onChange={(e) => setInServiceInspectionPossible(e.target.checked)} />
          Servis içi et kalınlığı muayenesi mümkün
        </label>
        <button
          type="button"
          onClick={handleExportCsv}
          className="ml-auto rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
        >
          CSV
        </button>
      </div>

      <div className="rounded border border-sky-200 bg-sky-50 px-2 py-1.5 text-[11px] text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
        <span className="font-semibold">Motorun önerisi (§10.3.2 merdiveni):</span> {data.recommendedMaterialTr}
        {materialConfidence && (
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BADGE_STYLES[materialConfidence] ?? ""}`}>{materialConfidence}</span>
        )}
      </div>

      {data.sourServiceApplicable && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Sour servis (ISO 15156-2 {data.sourServiceRegionTr}) — aşağıdaki PREN/sour servis notları buna göre değerlendirilmiştir.
        </div>
      )}

      <div className="rounded border border-neutral-200 px-2 py-1 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        Motor yalnızca karbon çelik (CS, A106 Gr.B) için gerçek bir korozyon hızı modelliyor — bu yüzden &quot;Ömür&quot; sütunu YALNIZCA o satır için
        gerçek bir sayı taşır, diğer 19 aday için &quot;Modellenmedi&quot; işaretlenir (sahte bir sayı üretilmez).
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-white dark:bg-neutral-900">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              {["Malzeme", "Aile", "PREN", "Sıcaklık Uygun mu?", "Bağıl Maliyet", "Ömür (Modellenen)", "Sour Servis"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.material.materialId}
                className={`border-b border-neutral-100 dark:border-neutral-900 ${
                  row.isModeledMaterial ? "bg-sky-50 dark:bg-sky-950/30" : ""
                }`}
              >
                <td className="px-2 py-1.5 font-medium text-neutral-800 dark:text-neutral-200" title={row.material.notesTr}>
                  {row.material.displayNameTr}
                </td>
                <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-300">{row.material.family}</td>
                <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-300">{row.material.pren ?? "—"}</td>
                <td className="px-2 py-1.5">
                  <span className={row.temperatureSuitable ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {row.temperatureSuitable ? "Evet" : "Hayır"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-300">{row.material.relativeCostIndex.toFixed(2)}×</td>
                <td className="px-2 py-1.5">
                  <span className={row.isModeledMaterial ? "font-semibold text-neutral-800 dark:text-neutral-100" : "text-neutral-400 dark:text-neutral-500"}>
                    {formatLifeYears(row)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">{row.sourServiceNoteTr ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
