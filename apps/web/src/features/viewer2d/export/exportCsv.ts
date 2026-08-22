// apps/web/src/features/viewer2d/export/exportCsv.ts
//
// Grafik verisini CSV olarak dışa aktarır — features/registry/RegistryPage.tsx'in
// downloadTextFile deseniyle AYNI.

function csvEscapeCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const content = rows.map((row) => row.map(csvEscapeCell).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
