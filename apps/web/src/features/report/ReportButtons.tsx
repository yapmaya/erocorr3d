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
import { generatePdfReport } from "./pdf/generatePdfReport";
import { generateExcelReport } from "./excel/generateExcelReport";
import { ReportSettingsModal } from "./ReportSettingsModal";

const BUTTON_CLASS =
  "rounded bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";

export function ReportButtons() {
  const { t } = useTranslation();
  const entries = useAssessmentHistoryStore((s) => s.entries);
  const settings = useReportSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const disabled = entries.length === 0;

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

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={() => generatePdfReport(buildData())} className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}>
        {t("reportPdfButton")}
      </button>
      <button type="button" disabled={disabled} onClick={() => generateExcelReport(buildData())} className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}>
        {t("reportExcelButton")}
      </button>
      <button type="button" onClick={() => setSettingsOpen(true)} className={BUTTON_CLASS} title={t("reportSettingsButton")}>
        ⚙
      </button>
      {settingsOpen && <ReportSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
