// apps/web/src/features/viewer2d/export/exportChartPng.ts
//
// Herhangi bir SVG grafiği (Recharts'ın kendi ürettiği <svg> veya bu
// panelin elle çizdiği RadialSection/AngularProfile SVG'si) PNG olarak dışa
// aktarır. DOM'a bağımlı — SAF DEĞİL, test edilmez (bkz. viewer3d/export/
// exportPng.ts'in AYNI gerekçesi).

import { downloadDataUrl } from "../../viewer3d/export/exportPng";

const EXPORT_SCALE = 2; // yüksek çözünürlük için 2× süperörnekleme

export function exportSvgElementAsPng(svgElement: SVGSVGElement, filename: string, backgroundColor: string): void {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const image = new Image();
  image.onload = () => {
    const rect = svgElement.getBoundingClientRect();
    const viewBoxWidth = svgElement.viewBox?.baseVal?.width;
    const viewBoxHeight = svgElement.viewBox?.baseVal?.height;
    const width = rect.width || viewBoxWidth || 800;
    const height = rect.height || viewBoxHeight || 400;

    const canvas = document.createElement("canvas");
    canvas.width = width * EXPORT_SCALE;
    canvas.height = height * EXPORT_SCALE;
    const ctx = canvas.getContext("2d");
    URL.revokeObjectURL(url);
    if (!ctx) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
    ctx.drawImage(image, 0, 0, width, height);

    downloadDataUrl(canvas.toDataURL("image/png"), filename);
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

/** Verilen kapsayıcı elemanın İÇİNDEKİ ilk <svg>'yi bulup PNG olarak indirir — Recharts'ın kök `div` sarmalayıcısıyla kullanmak için. */
export function exportContainerSvgAsPng(container: HTMLElement | null, filename: string, backgroundColor: string): void {
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) {
    console.warn("[EroCorr3D] PNG dışa aktarımı için kapsayıcı içinde <svg> bulunamadı.");
    return;
  }
  exportSvgElementAsPng(svg, filename, backgroundColor);
}
