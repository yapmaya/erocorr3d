// apps/web/src/lib/downloadBlob.ts
//
// Blob indirmek için paylaşılan yardımcı — depodaki 6 ayrı indirme yerinin
// (exportProject.ts, exportGltf.ts, exportSvgFile.ts, exportCsv.ts,
// RegistryPage.tsx, diagnostics.ts) tekrarlanan blob→anchor deseni yerine.
//
// `<a>` elemanı DOM'a eklenip tıklanır, sonra kaldırılır — tarayıcılar
// arasında tutarlı davranış için. `URL.revokeObjectURL`, `click()`in
// HEMEN ardından senkron çağrılırsa bazı tarayıcılar blob'u okumaya
// başlamadan URL'yi geçersiz kılabilir ve indirme sessizce iptal olur;
// bu yüzden bir sonraki tick'e ertelenir.
//
// SAF DEĞİL (DOM yan etkisi) — `exportProject.ts::downloadEc3dFile` ile
// AYNI gerekçeyle test edilmez.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
