// apps/web/src/features/projects/LineListImportWizard.tsx
//
// Excel/CSV hat listesi içe aktarma sihirbazı — `features/input/importExcel/
// ColumnMappingWizard.tsx`'in AYNI "dosya seç → sütun eşle → önizle → içe
// aktar" UX desenini izler, ama her SATIRI bir SENARYO değil, AYRI bir
// BİLEŞEN yapar (bkz. importLineList.ts dosya başı notu).

import { useState } from "react";
import { parseWorkbookFile, type ParsedSheet } from "../input/importExcel/parseLineList";
import { buildComponentsFromLineListRows, LINE_LIST_TARGETS, type LineListColumnMapping } from "./importLineList";
import { useProjectsStore } from "../../store/projectsStore";

export interface LineListImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LineListImportWizard({ isOpen, onClose }: LineListImportWizardProps) {
  const addComponent = useProjectsStore((s) => s.addComponent);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<LineListColumnMapping>({});
  const [error, setError] = useState<string | null>(null);
  const [skippedRowsTr, setSkippedRowsTr] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    setImportedCount(null);
    try {
      const parsed = await parseWorkbookFile(file);
      setSheet(parsed);
      const auto: LineListColumnMapping = {};
      LINE_LIST_TARGETS.forEach((target) => {
        const idx = parsed.headers.findIndex((h) => h.toLocaleLowerCase("tr").includes(target.labelTr.toLocaleLowerCase("tr").split(" ")[0]));
        if (idx >= 0) auto[target.field] = idx;
      });
      setMapping(auto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      setSheet(null);
    }
  };

  const missingRequired = LINE_LIST_TARGETS.filter((t) => t.required && mapping[t.field] === undefined);
  const canImport = sheet !== null && missingRequired.length === 0;

  const handleImport = async () => {
    if (!sheet) return;
    const { drafts, skippedRowsTr: skipped } = buildComponentsFromLineListRows(sheet, mapping);
    for (const draft of drafts) {
      await addComponent(draft);
    }
    setSkippedRowsTr(skipped);
    setImportedCount(drafts.length);
    if (skipped.length === 0) onClose();
  };

  return (
    // z-[16777300]: bkz. ReportSettingsModal.tsx'in aynı notu — drei Html'in sentetik
    // z-index'i (varsayılan max 16777271) 3B görüntüleyici HUD'unu z-50'nin üstünde bırakır.
    <div className="fixed inset-0 z-[16777300] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Hat Listesi İçe Aktar</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
            ✕
          </button>
        </div>

        {!sheet && (
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="w-full text-xs text-neutral-600 dark:text-neutral-300"
          />
        )}
        {error && <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</div>}

        {sheet && (
          <>
            <p className="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              {sheet.rows.length} satır bulundu. Her satır AYRI bir bileşen olarak eklenecek. Eşlenmeyen alanlar temsili varsayılan değerleri korur.
            </p>
            <div className="mb-3 flex flex-col gap-1.5">
              {LINE_LIST_TARGETS.map((target) => (
                <label key={target.field} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {target.labelTr}
                    {target.required && <span className="text-red-500"> *</span>}
                  </span>
                  <select
                    value={mapping[target.field] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [target.field]: e.target.value === "" ? undefined : Number(e.target.value) }))
                    }
                    className="rounded border border-neutral-300 bg-white px-1.5 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  >
                    <option value="">— Eşleme yok —</option>
                    {sheet.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h || `Sütun ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <div className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">Zorunlu alan(lar) eşlenmedi: {missingRequired.map((t) => t.labelTr).join(", ")}</div>
            )}

            {importedCount !== null && (
              <div className="mb-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                {importedCount} bileşen içe aktarıldı.
                {skippedRowsTr.length > 0 && ` ${skippedRowsTr.length} satır atlandı: ${skippedRowsTr.join(" ")}`}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                Kapat
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={!canImport}
                className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                İçe Aktar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
