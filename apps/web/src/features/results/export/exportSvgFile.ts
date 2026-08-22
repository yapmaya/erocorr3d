// apps/web/src/features/results/export/exportSvgFile.ts
//
// Ham .svg dosyası indirme — `viewer2d/export/exportChartPng.ts` yalnızca
// SVG'yi RASTERLEŞTİRİP PNG olarak indiriyor (bu repoda henüz gerçek bir
// .svg dosya indirme yolu YOKTU). Blob→anchor deseni `viewer2d/export/
// exportCsv.ts::downloadCsv` ile AYNI, DOM'a bağımlı (SAF DEĞİL, test
// edilmez — bkz. o dosyaların aynı gerekçesi).

export function exportSvgElementAsSvgFile(svgElement: SVGSVGElement, filename: string): void {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Verilen kapsayıcı elemanın İÇİNDEKİ ilk <svg>'yi bulup .svg dosyası olarak indirir — Recharts'ın kök `div` sarmalayıcısıyla kullanmak için. */
export function exportContainerSvgAsSvgFile(container: HTMLElement | null, filename: string): void {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) {
    console.warn("[EroCorr3D] SVG dışa aktarımı için kapsayıcı içinde <svg> bulunamadı.");
    return;
  }
  exportSvgElementAsSvgFile(svg, filename);
}
