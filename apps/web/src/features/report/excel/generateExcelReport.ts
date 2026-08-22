// apps/web/src/features/report/excel/generateExcelReport.ts
//
// Excel dosya üretimi/indirme orkestratörü. SAF DEĞİL (dosya indirme yan
// etkisi) — `pdf/generatePdfReport.ts` ile AYNI gerekçeyle test edilmez.

import * as XLSX from "xlsx";
import type { ReportData } from "../reportData";
import { buildExcelWorkbook } from "./buildExcelWorkbook";

export function generateExcelReport(data: ReportData): void {
  const workbook = buildExcelWorkbook(data);
  const filename = `${data.settings.documentNo || "erocorr3d-rapor"}-rev${data.settings.revision || "0"}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
