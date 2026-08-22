// apps/web/src/features/input/importExcel/ColumnMappingWizard.tsx
//
// Excel/CSV içe aktarma sihirbazı: dosya seç → sütun eşle → önizle →
// içe aktar. Adım 7'nin senaryo tablosuna satır ekler (bkz.
// parseLineList.ts dosya başı notu — kapsam MVP: tek bileşenin senaryo
// listesi).

import { useState } from "react";
import type { OperatingCase } from "@erocorr3d/engine";
import {
  buildOperatingCasesFromRows,
  IMPORT_TARGETS,
  parseWorkbookFile,
  type ColumnMapping,
  type ParsedSheet,
} from "./parseLineList";

export interface ColumnMappingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (cases: OperatingCase[], mode: "APPEND" | "REPLACE") => void;
  baseCase: OperatingCase;
}

export function ColumnMappingWizard({ isOpen, onClose, onImport, baseCase }: ColumnMappingWizardProps) {
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<"APPEND" | "REPLACE">("APPEND");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const parsed = await parseWorkbookFile(file);
      setSheet(parsed);
      // Başlık metnine göre otomatik ön-eşleme (kaba, tam eşleşme değilse boş bırakılır — kullanıcı elle düzeltir).
      const auto: ColumnMapping = {};
      IMPORT_TARGETS.forEach((target) => {
        const idx = parsed.headers.findIndex((h) => h.toLocaleLowerCase("tr").includes(target.labelTr.toLocaleLowerCase("tr").split(" ")[0]));
        if (idx >= 0) auto[target.field] = idx;
      });
      setMapping(auto);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya okunamadı.");
      setSheet(null);
    }
  };

  const missingRequired = IMPORT_TARGETS.filter((t) => t.required && mapping[t.field] === undefined);
  const canImport = sheet !== null && missingRequired.length === 0;

  const handleImport = () => {
    if (!sheet) return;
    const cases = buildOperatingCasesFromRows(sheet, mapping, baseCase);
    onImport(cases, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Excel/CSV&apos;den İçe Aktar</h2>
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
              {sheet.rows.length} satır bulundu. Her satır bir işletme senaryosu olarak eklenecek. Eşlenmeyen alanlar
              geçerli senaryonun değerlerini korur.
            </p>
            <div className="mb-3 flex flex-col gap-1.5">
              {IMPORT_TARGETS.map((target) => (
                <label key={target.field} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {target.labelTr}
                    {target.required && <span className="text-red-500"> *</span>}
                  </span>
                  <select
                    value={mapping[target.field] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [target.field]: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
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

            <div className="mb-3 flex gap-3 text-[11px]">
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === "APPEND"} onChange={() => setMode("APPEND")} /> Mevcut senaryolara ekle
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" checked={mode === "REPLACE"} onChange={() => setMode("REPLACE")} /> Mevcut senaryoların yerine geç
              </label>
            </div>

            {missingRequired.length > 0 && (
              <div className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
                Zorunlu alan(lar) eşlenmedi: {missingRequired.map((t) => t.labelTr).join(", ")}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                İptal
              </button>
              <button
                type="button"
                onClick={handleImport}
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
