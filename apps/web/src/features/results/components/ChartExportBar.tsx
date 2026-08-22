// apps/web/src/features/results/components/ChartExportBar.tsx
//
// 8 grafiğin PAYLAŞTIĞI PNG/SVG/CSV dışa aktarma düğme çubuğu — her grafiğin
// kendi 3 düğmeyi TEKRAR TEKRAR yazmasını önler (bkz. onaylı plan'ın
// dışa aktarma kararı). `containerRef`, Recharts'ın kök `div`'ini işaret
// eder (içindeki İLK `&lt;svg&gt;` bulunur — bkz. exportChartPng.ts/
// exportSvgFile.ts'in AYNI deseni).

import type { RefObject } from "react";
import { exportContainerSvgAsPng } from "../../viewer2d/export/exportChartPng";
import { downloadCsv } from "../../viewer2d/export/exportCsv";
import { exportContainerSvgAsSvgFile } from "../export/exportSvgFile";

const EXPORT_BACKGROUND_COLOR = "#0a0a0a";

export interface ChartExportBarProps {
  containerRef: RefObject<HTMLElement>;
  /** Uzantısız temel dosya adı (ör. "mekanizma-dokumu") — her buton kendi uzantısını ekler. */
  baseFilename: string;
  /** CSV satırlarını (başlık satırı DAHİL) tembel üretir — yalnızca kullanıcı CSV'ye basınca çağrılır. */
  buildCsvRows?: () => (string | number)[][];
}

export function ChartExportBar({ containerRef, baseFilename, buildCsvRows }: ChartExportBarProps) {
  const buttonClass =
    "rounded bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";

  return (
    <div className="flex gap-1.5">
      <button type="button" className={buttonClass} onClick={() => exportContainerSvgAsPng(containerRef.current, `${baseFilename}.png`, EXPORT_BACKGROUND_COLOR)}>
        PNG
      </button>
      <button type="button" className={buttonClass} onClick={() => exportContainerSvgAsSvgFile(containerRef.current, `${baseFilename}.svg`)}>
        SVG
      </button>
      {buildCsvRows && (
        <button type="button" className={buttonClass} onClick={() => downloadCsv(`${baseFilename}.csv`, buildCsvRows())}>
          CSV
        </button>
      )}
    </div>
  );
}
