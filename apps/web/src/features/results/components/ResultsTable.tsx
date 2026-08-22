// apps/web/src/features/results/components/ResultsTable.tsx
//
// Sonuç Tablosu (A) — girdi sihirbazının "Hesapla" geçmişindeki (bkz.
// store/assessmentHistoryStore.ts) TÜM bileşenleri satır satır listeler.
// `@tanstack/react-table` v9'un "legacy" alt-yolu (`useLegacyTable`) —
// KLASİK (v8-tanıdık) API yüzeyi (`getHeaderGroups`/`getRowModel`/
// `toggleVisibility`) — kütüphanenin KENDİSİNİN "v8'den geçiş için" resmi
// olarak sağladığı, hâlâ tam işlevsel bir uyumluluk katmanıdır (bkz.
// node_modules/@tanstack/react-table/dist/legacy.d.ts'in kendi JSDoc'u).
//
// SIRALAMA BİLEREK kütüphanenin `rowSortingFeature`si YERİNE düz JS ile
// yapılır: `columnHelper.accessor(field, {...})` farklı sütunlarda farklı
// TValue'lar ürettiğinde TypeScript'in ÇELİŞEN (contravariant `footer`/
// `cell` şablon parametreleri nedeniyle) bir heterojen `ColumnDef[]` union'ı
// tek bir `ColumnDef<F,D,unknown>[]`e daraltamaması KÖKLÜ, iyi bilinen bir
// TanStack Table sınırlamasıdır (resmi çözümleri `ColumnDef<T, any>[]`
// APAÇIK `any` kullanır — bu projede YASAK). Bunun yerine TÜM sütunlar
// `columnHelper.display(...)` (TValue taşımaz, homojen) ile tanımlanır ve
// sıralama `ResultsTableRow`ın KENDİ (bu dosyanın sahip olduğu, `any`
// gerektirmeyen) alanları üzerinden elle yapılır — sütun GÖRÜNÜRLÜĞÜ
// (`column.toggleVisibility`) yine kütüphanenin KENDİ (stok/her zaman açık)
// özelliğidir, `display` sütunlarında da sorunsuz çalışır.

import { useMemo, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import { legacyCreateColumnHelper, useLegacyTable } from "@tanstack/react-table/legacy";
import { useAssessmentHistoryStore } from "../../../store/assessmentHistoryStore";
import { UnverifiedBadge } from "../../../components/UnverifiedBadge";
import { CONFIDENCE_BADGE_STYLES, CTL_ATL_COLOR_STYLES } from "../chartPalette";
import { deriveTableRow, type ResultsTableRow } from "../resultsDerivation";
import { downloadCsv } from "../../viewer2d/export/exportCsv";

const columnHelper = legacyCreateColumnHelper<ResultsTableRow>();

function formatMm(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(2)} mm`;
}

function CtlAtlCell({ row }: { row: ResultsTableRow }) {
  if (!row.ctlAtl) {
    return <span className="text-neutral-400 dark:text-neutral-500">— (CA=0)</span>;
  }
  const styles = CTL_ATL_COLOR_STYLES[row.ctlAtl.colorTr];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${styles.bgClass} ${styles.textClass}`} title={row.ctlAtl.impactOnSystemLifeTr}>
      {row.ctlAtl.ratio.toFixed(2)} · {row.ctlAtl.categoryLabelTr}
    </span>
  );
}

/** Sıralanabilir sütunlar için sıralama anahtarı çıkarıcı — yalnızca `ResultsTableRow`ın KENDİ alanlarını okur. */
const SORT_KEY_EXTRACTORS: Record<string, (row: ResultsTableRow) => string | number> = {
  componentLabel: (r) => r.componentLabel.toLocaleLowerCase("tr"),
  slcUninhibitedMm: (r) => r.slcUninhibitedMm,
  slcInhibitedMm: (r) => r.slcInhibitedMm ?? -1,
  primaryMaterialTr: (r) => r.primaryMaterialTr.toLocaleLowerCase("tr"),
  ctlAtl: (r) => r.ctlAtl?.ratio ?? -1,
  confidence: (r) => r.confidence,
};

const columns = [
  columnHelper.display({ id: "componentLabel", header: "Bileşen", cell: (info) => <span className="font-medium">{info.row.original.componentLabel}</span> }),
  columnHelper.display({ id: "slcUninhibitedMm", header: "SLC İnhibitörsüz", cell: (info) => formatMm(info.row.original.slcUninhibitedMm) }),
  columnHelper.display({ id: "slcInhibitedMm", header: "SLC İnhibitörlü", cell: (info) => formatMm(info.row.original.slcInhibitedMm) }),
  columnHelper.display({
    id: "primaryMaterialTr",
    header: "Birincil Malzeme",
    cell: (info) => <span title={info.row.original.primaryMaterialTr}>{info.row.original.primaryMaterialTr}</span>,
  }),
  columnHelper.display({ id: "ctlAtl", header: "CTL/ATL", cell: (info) => <CtlAtlCell row={info.row.original} /> }),
  columnHelper.display({
    id: "alternativeMaterialTr",
    header: "Alternatif",
    cell: (info) => info.row.original.alternativeMaterialTr ?? <span className="text-neutral-400 dark:text-neutral-500">—</span>,
  }),
  columnHelper.display({
    id: "ctlAtlAlternative",
    header: "CTL/ATL (Alt.)",
    cell: () => (
      <span
        className="text-neutral-400 dark:text-neutral-500"
        title="Motor, CRA/alternatif malzemeler için ayrı bir korozyon hızı modeli taşımıyor — yalnızca karbon çelik modellenmiştir."
      >
        Uygulanamaz
      </span>
    ),
  }),
  columnHelper.display({
    id: "confidence",
    header: "Güven",
    cell: (info) => (
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${CONFIDENCE_BADGE_STYLES[info.row.original.confidence] ?? ""}`}>
        {info.row.original.confidence}
      </span>
    ),
  }),
  columnHelper.display({
    id: "commentTr",
    header: "Yorum",
    cell: (info) => (
      <span className="line-clamp-2 max-w-xs text-[11px] text-neutral-500 dark:text-neutral-400" title={info.row.original.commentTr}>
        {info.row.original.commentTr}
      </span>
    ),
  }),
  columnHelper.display({
    id: "unverified",
    header: "",
    cell: (info) => <UnverifiedBadge unverifiedCoefficients={info.row.original.unverifiedCoefficients} />,
  }),
];

const CSV_HEADER_BY_COLUMN_ID: Record<string, string> = {
  componentLabel: "Bileşen",
  slcUninhibitedMm: "SLC İnhibitörsüz (mm)",
  slcInhibitedMm: "SLC İnhibitörlü (mm)",
  primaryMaterialTr: "Birincil Malzeme",
  ctlAtl: "CTL/ATL",
  alternativeMaterialTr: "Alternatif",
  ctlAtlAlternative: "CTL/ATL (Alt.)",
  confidence: "Güven",
  commentTr: "Yorum",
  unverified: "Doğrulanmamış Katsayı Sayısı",
};

function csvValueForColumn(columnId: string, row: ResultsTableRow): string | number {
  switch (columnId) {
    case "componentLabel":
      return row.componentLabel;
    case "slcUninhibitedMm":
      return row.slcUninhibitedMm.toFixed(3);
    case "slcInhibitedMm":
      return row.slcInhibitedMm === null ? "" : row.slcInhibitedMm.toFixed(3);
    case "primaryMaterialTr":
      return row.primaryMaterialTr;
    case "ctlAtl":
      return row.ctlAtl ? row.ctlAtl.ratio.toFixed(3) : "";
    case "alternativeMaterialTr":
      return row.alternativeMaterialTr ?? "";
    case "ctlAtlAlternative":
      return "Uygulanamaz";
    case "confidence":
      return row.confidence;
    case "commentTr":
      return row.commentTr;
    case "unverified":
      return row.unverifiedCoefficients.length;
    default:
      return "";
  }
}

export function ResultsTable() {
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const selectedEntryId = useAssessmentHistoryStore((s) => s.selectedEntryId);
  const selectEntry = useAssessmentHistoryStore((s) => s.selectEntry);
  const [searchQuery, setSearchQuery] = useState("");
  const [inServiceInspectionPossible, setInServiceInspectionPossible] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [sortState, setSortState] = useState<{ id: string; desc: boolean } | null>(null);

  const rows = useMemo<ResultsTableRow[]>(
    () => entries.map((entry) => deriveTableRow(entry, { inServiceInspectionPossible })),
    [entries, inServiceInspectionPossible],
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("tr");
    if (!query) return rows;
    return rows.filter((row) => row.componentLabel.toLocaleLowerCase("tr").includes(query));
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const keyFn = SORT_KEY_EXTRACTORS[sortState.id];
    if (!keyFn) return filteredRows;
    const copy = [...filteredRows].sort((a, b) => {
      const ka = keyFn(a);
      const kb = keyFn(b);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return 0;
    });
    if (sortState.desc) copy.reverse();
    return copy;
  }, [filteredRows, sortState]);

  const table = useLegacyTable({ data: sortedRows, columns });

  const toggleSort = (columnId: string) => {
    if (!SORT_KEY_EXTRACTORS[columnId]) return;
    setSortState((prev) => {
      if (!prev || prev.id !== columnId) return { id: columnId, desc: false };
      if (!prev.desc) return { id: columnId, desc: true };
      return null;
    });
  };

  const handleExportCsv = () => {
    const visibleLeafColumns = table.getVisibleLeafColumns();
    const header = visibleLeafColumns.map((c) => CSV_HEADER_BY_COLUMN_ID[c.id] ?? c.id);
    const csvRows: (string | number)[][] = [header];
    for (const row of table.getRowModel().rows) {
      csvRows.push(visibleLeafColumns.map((c) => csvValueForColumn(c.id, row.original)));
    }
    downloadCsv("sonuc-tablosu.csv", csvRows);
  };

  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-400 dark:text-neutral-500">
        Henüz hesaplanmış bir bileşen yok — Girdi Sihirbazı&apos;nda &quot;Hesapla&quot;ya basın.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Bileşen ara..."
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <label className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
          <input type="checkbox" checked={inServiceInspectionPossible} onChange={(e) => setInServiceInspectionPossible(e.target.checked)} />
          Servis içi et kalınlığı muayenesi mümkün
        </label>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setColumnPickerOpen((v) => !v)}
            className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          >
            Sütunlar
          </button>
          {columnPickerOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {table.getAllLeafColumns().map((column) => (
                <label key={column.id} className="flex items-center gap-1.5 py-0.5 text-[11px] text-neutral-700 dark:text-neutral-200">
                  <input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} />
                  {CSV_HEADER_BY_COLUMN_ID[column.id] ?? column.id}
                </label>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={handleExportCsv} className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
          CSV
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-white dark:bg-neutral-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-neutral-200 dark:border-neutral-800">
                {headerGroup.headers.map((header) => {
                  const sortable = Boolean(SORT_KEY_EXTRACTORS[header.column.id]);
                  const sortMark = sortState?.id === header.column.id ? (sortState.desc ? " ▼" : " ▲") : "";
                  return (
                    <th
                      key={header.id}
                      onClick={sortable ? () => toggleSort(header.column.id) : undefined}
                      className={`px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 ${
                        sortable ? "cursor-pointer select-none" : ""
                      }`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortMark}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => selectEntry(row.original.entryId)}
                className={`cursor-pointer border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-800/50 ${
                  selectedEntryId === row.original.entryId ? "bg-sky-50 dark:bg-sky-950" : ""
                }`}
                title="3B/2B görünümü bu bileşene günceller — 'Özel Veri' sekmesine geçerek görüntüleyin"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1.5 text-neutral-800 dark:text-neutral-200">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
