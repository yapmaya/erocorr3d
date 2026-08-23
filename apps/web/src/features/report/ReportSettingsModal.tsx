// apps/web/src/features/report/ReportSettingsModal.tsx
//
// "Rapor Ayarları" formu — kapak sayfası/doküman kimliği (master görev
// madde A.1: proje adı, doküman no, revizyon, tarih, hazırlayan/kontrol/
// onay kutuları, logo alanı) + revizyon geçmişi tablosu + rapor dili.
// `reportSettingsStore.ts`'i (persist edilir) doğrudan düzenler.

import { useRef } from "react";
import { useReportSettingsStore } from "../../store/reportSettingsStore";
import { useTranslation } from "../../i18n/translations";

const INPUT_CLASS =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const LABEL_CLASS = "mb-0.5 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300";

export interface ReportSettingsModalProps {
  onClose: () => void;
}

export function ReportSettingsModal({ onClose }: ReportSettingsModalProps) {
  const { t } = useTranslation();
  const settings = useReportSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        settings.setField("logoDataUrl", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    // z-[16777300]: 3B görüntüleyicinin HUD panelleri (CameraToolbar/MeasurementToolbar/
    // TimeSliderPanel) drei `<Html fullscreen>` içinde render edilir ve drei'nin VARSAYILAN
    // zIndexRange'i ([16777271, 0], bkz. node_modules/@react-three/drei/web/Html.js) bu
    // panellere z-40'ı AŞAN, çok daha yüksek sentetik bir z-index atar — ekran konumu
    // çakıştığında bu modal z-40 ile o panellerin ALTINDA kalır ve tıklamalar HUD'a
    // sızar (gerçek testte "Hazırlayan" alanının hiç odaklanamadığı gözlemlendi).
    <div className="fixed inset-0 z-[16777300] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded bg-white p-4 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("reportSettingsTitle")}</h2>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className={LABEL_CLASS}>{t("reportSettingsCompanyName")}</label>
            <input className={INPUT_CLASS} value={settings.companyName} onChange={(e) => settings.setField("companyName", e.target.value)} />
          </div>

          <div>
            <label className={LABEL_CLASS}>{t("reportSettingsLogo")}</label>
            <div className="flex items-center gap-2">
              {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="Logo" className="h-8 w-8 rounded border border-neutral-200 object-contain dark:border-neutral-700" />}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {settings.logoDataUrl ? t("reportSettingsLogoChange") : t("reportSettingsLogoUpload")}
              </button>
              {settings.logoDataUrl && (
                <button type="button" onClick={() => settings.setField("logoDataUrl", null)} className="text-[11px] text-neutral-400 hover:text-red-500">
                  {t("reportSettingsLogoRemove")}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsProjectName")}</label>
              <input className={INPUT_CLASS} value={settings.projectName} onChange={(e) => settings.setField("projectName", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsDocumentNo")}</label>
              <input className={INPUT_CLASS} value={settings.documentNo} onChange={(e) => settings.setField("documentNo", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsRevision")}</label>
              <input className={INPUT_CLASS} value={settings.revision} onChange={(e) => settings.setField("revision", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsLanguage")}</label>
              <select
                className={INPUT_CLASS}
                value={settings.reportLanguage}
                onChange={(e) => settings.setField("reportLanguage", e.target.value as "tr" | "en")}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsPreparedBy")}</label>
              <input className={INPUT_CLASS} value={settings.preparedBy} onChange={(e) => settings.setField("preparedBy", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsCheckedBy")}</label>
              <input className={INPUT_CLASS} value={settings.checkedBy} onChange={(e) => settings.setField("checkedBy", e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t("reportSettingsApprovedBy")}</label>
              <input className={INPUT_CLASS} value={settings.approvedBy} onChange={(e) => settings.setField("approvedBy", e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={LABEL_CLASS}>{t("reportSettingsRevisionHistory")}</label>
              <button type="button" onClick={settings.addRevisionRow} className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
                {t("reportSettingsAddRow")}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {settings.revisionHistory.length === 0 && (
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{t("reportSettingsNoRevisionRows")}</p>
              )}
              {settings.revisionHistory.map((row) => (
                <div key={row.id} className="grid grid-cols-[3rem_5.5rem_1fr_5rem_auto] gap-1">
                  <input className={INPUT_CLASS} value={row.rev} onChange={(e) => settings.updateRevisionRow(row.id, { rev: e.target.value })} placeholder="Rev" />
                  <input className={INPUT_CLASS} type="date" value={row.date} onChange={(e) => settings.updateRevisionRow(row.id, { date: e.target.value })} />
                  <input
                    className={INPUT_CLASS}
                    value={row.descriptionTr}
                    onChange={(e) => settings.updateRevisionRow(row.id, { descriptionTr: e.target.value })}
                    placeholder="Açıklama"
                  />
                  <input className={INPUT_CLASS} value={row.by} onChange={(e) => settings.updateRevisionRow(row.id, { by: e.target.value })} placeholder="Kim" />
                  <button type="button" onClick={() => settings.removeRevisionRow(row.id)} className="text-xs text-neutral-400 hover:text-red-500">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
