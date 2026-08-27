// apps/web/src/features/viewer2d/export/exportCsv.ts
//
// Grafik verisini CSV olarak dışa aktarır — features/registry/RegistryPage.tsx'in
// downloadTextFile deseniyle AYNI.

/**
 * Excel/LibreOffice, bir CSV hücresi `=`, `+`, `-`, `@`, TAB veya CR ile
 * başlıyorsa onu FORMÜL olarak yorumlar (CSV enjeksiyonu / DDE). Senaryo adı,
 * bileşen etiketi gibi hücreler KULLANICI (veya içe aktarılan bir hat listesi)
 * tarafından belirlendiğinden, `=cmd|'/c calc'!A1` gibi bir değer dosyayı açan
 * kişide komut çalıştırabilir.
 *
 * ÖNEMLİ: hücreyi tırnak içine almak bunu ENGELLEMEZ — Excel tırnakları
 * soyduktan sonra içeriğe bakar. Bu yüzden tek çare, değeri formül olmaktan
 * çıkaran bir tek-tırnak öneki eklemektir (OWASP'ın önerdiği yöntem);
 * hücre Excel'de yine okunabilir metin olarak görünür.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function csvEscapeCell(value: string | number): string {
  // Sayılar KULLANICI METNİ DEĞİLDİR — negatif sayıların başına tırnak
  // koymak (-5 -> '-5) veriyi bozardı, bu yüzden yalnızca metinler korunur.
  if (typeof value === "number") {
    return String(value);
  }

  const text = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(text)) {
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
