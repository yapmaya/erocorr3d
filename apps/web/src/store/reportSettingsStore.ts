// apps/web/src/store/reportSettingsStore.ts
//
// PDF/Excel raporunun kapak sayfası + doküman kimliği için kullanıcının
// düzenlediği marka/proje bilgisi. `uiStore.ts`'in `persist` desenini izler
// (tarayıcı localStorage'ında kalıcı — kullanıcı her raporda yeniden
// girmesin diye). Bu, bir mühendislik sabiti/katsayısı DEĞİLDİR — KDP
// kapsamı dışıdır (dokümantasyon/kimlik verisi).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReportSettings, RevisionHistoryRow } from "../features/report/reportSettingsTypes";

interface ReportSettingsState extends ReportSettings {
  setField: <K extends keyof Omit<ReportSettingsState, "revisionHistory" | "setField" | "addRevisionRow" | "updateRevisionRow" | "removeRevisionRow">>(
    key: K,
    value: ReportSettingsState[K],
  ) => void;
  addRevisionRow: () => void;
  updateRevisionRow: (id: string, patch: Partial<Omit<RevisionHistoryRow, "id">>) => void;
  removeRevisionRow: (id: string) => void;
}

export const useReportSettingsStore = create<ReportSettingsState>()(
  persist(
    (set) => ({
      companyName: "",
      logoDataUrl: null,
      projectName: "",
      documentNo: "",
      revision: "0",
      revisionHistory: [],
      preparedBy: "",
      checkedBy: "",
      approvedBy: "",
      reportLanguage: "tr",
      setField: (key, value) => set({ [key]: value } as Partial<ReportSettingsState>),
      addRevisionRow: () =>
        set((state) => ({
          revisionHistory: [
            ...state.revisionHistory,
            { id: crypto.randomUUID(), rev: state.revision, date: new Date().toISOString().slice(0, 10), descriptionTr: "", descriptionEn: "", by: "" },
          ],
        })),
      updateRevisionRow: (id, patch) =>
        set((state) => ({
          revisionHistory: state.revisionHistory.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        })),
      removeRevisionRow: (id) => set((state) => ({ revisionHistory: state.revisionHistory.filter((row) => row.id !== id) })),
    }),
    { name: "erocorr3d-report-settings" },
  ),
);
