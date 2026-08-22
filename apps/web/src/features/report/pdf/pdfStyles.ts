// apps/web/src/features/report/pdf/pdfStyles.ts
//
// PDF'in ortak stil sözlüğü + her sayfada tekrar eden üstbilgi (doküman no/
// rev/sayfa X/Y) ve altbilgi (belirsizlik uyarısı) üreticileri (master görev
// madde A.16). Görsel tasarım kararıdır — KDP kapsamı dışı (chartPalette.ts
// ile AYNI gerekçe).

import type { Content, StyleDictionary } from "pdfmake/interfaces";
import { CHART_HEX } from "../../results/chartPalette";
import { ENGINEERING_DISCLAIMER, pick } from "./pdfText";
import type { ReportLanguage } from "../reportSettingsTypes";
import type { ReportSettings } from "../reportSettingsTypes";

export const PDF_STYLES: StyleDictionary = {
  coverTitle: { fontSize: 22, bold: true, margin: [0, 4, 0, 4] },
  coverSubtitle: { fontSize: 14, color: "#404040", margin: [0, 0, 0, 20] },
  h1: { fontSize: 15, bold: true, margin: [0, 16, 0, 8] },
  h2: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
  body: { fontSize: 9.5, lineHeight: 1.25 },
  small: { fontSize: 8, color: "#606060" },
  tableHeader: { fontSize: 8.5, bold: true, fillColor: "#f0f0f0" },
  tableCell: { fontSize: 8.5 },
  disclaimerBanner: { fontSize: 7.5, color: "#7a5300", italics: true },
};

export function buildHeader(settings: ReportSettings, lang: ReportLanguage): (currentPage: number, pageCount: number) => Content {
  return (currentPage, pageCount) => ({
    margin: [40, 16, 40, 0],
    columns: [
      { text: settings.documentNo || "—", fontSize: 7.5, color: "#808080" },
      { text: `${lang === "tr" ? "Rev" : "Rev"} ${settings.revision || "0"}`, fontSize: 7.5, color: "#808080", alignment: "center" },
      { text: `${currentPage} / ${pageCount}`, fontSize: 7.5, color: "#808080", alignment: "right" },
    ],
  });
}

export function buildFooter(lang: ReportLanguage): () => Content {
  return () => ({
    margin: [40, 4, 40, 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: CHART_HEX.gridLine }] },
      { text: pick(ENGINEERING_DISCLAIMER, lang), style: "disclaimerBanner", margin: [0, 2, 0, 0] },
    ],
  });
}
