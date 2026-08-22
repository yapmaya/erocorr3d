// apps/web/src/features/report/reportSettingsTypes.ts
//
// `reportSettingsStore.ts` (zustand state + actions) ile rapor üretim
// katmanının (reportData.ts, pdf/*, excel/*) ihtiyaç duyduğu SALT VERİ
// şeklini ayırır — üreticiler zustand'a değil, bu düz veri sözleşmesine
// bağımlı olsun diye (test edilebilirlik: store olmadan da bir ReportSettings
// nesnesi elle kurulup buildReportData'ya verilebilir).

export interface RevisionHistoryRow {
  id: string;
  rev: string;
  date: string;
  descriptionTr: string;
  descriptionEn: string;
  by: string;
}

export type ReportLanguage = "tr" | "en";

export interface ReportSettings {
  companyName: string;
  logoDataUrl: string | null;
  projectName: string;
  documentNo: string;
  revision: string;
  revisionHistory: RevisionHistoryRow[];
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
  reportLanguage: ReportLanguage;
}
