// apps/web/src/features/report/ReportButtons.tsx
//
// Sonuçlar panelinin başlığındaki "PDF Rapor" / "Excel Rapor" / "Rapor
// Ayarları" düğmeleri (master görev madde A/B). Geçmişteki TÜM hesaplanmış
// bileşenleri kapsar (bkz. reportData.ts dosya başı notu, onaylı plan'ın
// kapsam kararı).
//
// NOT (bilinçli v1 kapsam sınırı): grafik PNG'leri şu an YAKALANMIYOR
// (`chartPngs={}`) — 8 grafiğin DOM'da her zaman mount olması garanti değil
// (alt çekmece kapalı olabilir). Isı haritası (3B görüntüleyicinin o anki
// açısı) `viewer3dCaptureStore` üzerinden YAKALANIR. Excel'in "Grafikler"
// sayfası zaten grafiklerin ham sayısal verisini taşıdığı için bilgi
// KAYBOLMAZ — yalnızca PDF'e resim olarak gömme bu ilk sürümde yok.

import { useState } from "react";
import { useAssessmentHistoryStore } from "../../store/assessmentHistoryStore";
import { useReportSettingsStore } from "../../store/reportSettingsStore";
import { captureCurrentViewPng } from "../../store/viewer3dCaptureStore";
import { useTranslation } from "../../i18n/translations";
import { buildReportData } from "./reportData";
import { ReportSettingsModal } from "./ReportSettingsModal";

const BUTTON_CLASS =
  "rounded bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";

export function ReportButtons() {
  const { t } = useTranslation();
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const settings = useReportSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // PDF (pdfmake) ve Excel (xlsx) üretim kodu artık dinamik import() ile
  // yükleniyor (bkz. P10 — bu iki ağır bağımlılık, rapor almayan bir
  // kullanıcının ilk yüklemesine hiç girmesin diye ayrı chunk'a taşındı).
  // `generatingReport` yalnızca aynı anda ikinci bir tıklamayı (ikinci bir
  // chunk indirmesini/indirmeyi) önlemek için — asıl üretim SAF DEĞİL, test
  // edilmez (bkz. generatePdfReport.ts/generateExcelReport.ts dosya başı notları).
  const [generatingReport, setGeneratingReport] = useState<"pdf" | "excel" | null>(null);
  const [reportErrorTr, setReportErrorTr] = useState<string | null>(null);

  const disabled = entries.length === 0 || generatingReport !== null;

  const buildData = () =>
    buildReportData({
      entries,
      settings: {
        companyName: settings.companyName,
        logoDataUrl: settings.logoDataUrl,
        projectName: settings.projectName,
        documentNo: settings.documentNo,
        revision: settings.revision,
        revisionHistory: settings.revisionHistory,
        preparedBy: settings.preparedBy,
        checkedBy: settings.checkedBy,
        approvedBy: settings.approvedBy,
        reportLanguage: settings.reportLanguage,
      },
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: captureCurrentViewPng(),
      chartPngs: {},
    });

  const handlePdfClick = async () => {
    setReportErrorTr(null);
    setGeneratingReport("pdf");
    try {
      const { generatePdfReport } = await import("./pdf/generatePdfReport");
      generatePdfReport(buildData());
    } catch {
      setReportErrorTr("PDF rapor bileşeni yüklenemedi — internet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setGeneratingReport(null);
    }
  };

  const handleExcelClick = async () => {
    setReportErrorTr(null);
    setGeneratingReport("excel");
    try {
      const { generateExcelReport } = await import("./excel/generateExcelReport");
      generateExcelReport(buildData());
    } catch {
      setReportErrorTr("Excel rapor bileşeni yüklenemedi — internet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={() => void handlePdfClick()} className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}>
        {t("reportPdfButton")}
      </button>
      <button type="button" disabled={disabled} onClick={() => void handleExcelClick()} className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}>
        {t("reportExcelButton")}
      </button>
      <button type="button" onClick={() => setSettingsOpen(true)} className={BUTTON_CLASS} title={t("reportSettingsButton")}>
        ⚙
      </button>
      {reportErrorTr && <span className="text-[10px] text-red-600 dark:text-red-400">{reportErrorTr}</span>}
      {settingsOpen && <ReportSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
