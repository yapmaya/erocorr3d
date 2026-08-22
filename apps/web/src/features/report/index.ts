// apps/web/src/features/report/index.ts

export { ReportButtons } from "./ReportButtons";
export { ReportSettingsModal } from "./ReportSettingsModal";
export { buildReportData, type ReportData, type ReportComponentSection } from "./reportData";
export type { ReportSettings, ReportLanguage, RevisionHistoryRow } from "./reportSettingsTypes";
export { generatePdfReport } from "./pdf/generatePdfReport";
export { buildPdfDocDefinition } from "./pdf/buildPdfDocDefinition";
export { generateExcelReport } from "./excel/generateExcelReport";
export { buildExcelWorkbook, EXCEL_SHEET_NAMES } from "./excel/buildExcelWorkbook";
export { CalculationTraceDrawer } from "./traceability/CalculationTraceDrawer";
