// apps/web/src/store/assessmentStore.ts
//
// Girdi sihirbazının "Hesapla" eyleminin sonucu — viewer3d/PipeViewer.tsx,
// viewer2d/dataSource.ts ve features/results/ResultsPanel.tsx bu store'u
// OKUR (üçü de WorkspaceLayout'ta kardeş panellerdir, aralarında local
// hook state paylaşılamaz — bkz. mevcut `referenceFacilityScenarios.ts` deseninin
// AKSİNE, referans tesis verisi sabit/statik olduğu için lazy+cache yeterliydi; burada
// kullanıcı girdisi DEĞİŞKEN olduğundan global bir store gerekiyor).
//
// Yalnızca `computeAssessment.ts` tarafından YAZILIR (bkz. o dosya).

import { create } from "zustand";
import type { Geometry, OperatingProfile, ScenarioAssessment } from "@erocorr3d/engine";

export type AssessmentStatus = "EMPTY" | "COMPUTED" | "ERROR";

interface AssessmentState {
  status: AssessmentStatus;
  componentLabel: string | null;
  /** Görüntüleyicilerin ihtiyaç duyduğu ortak boyutlar (od/wt/id/uzunluk) — vana dahil HER kategoride dolu. */
  geometry: Geometry | null;
  operatingProfile: OperatingProfile | null;
  assessment: ScenarioAssessment | null;
  errorMessageTr: string | null;
  setResult: (input: {
    componentLabel: string;
    geometry: Geometry;
    operatingProfile: OperatingProfile;
    assessment: ScenarioAssessment;
  }) => void;
  setError: (messageTr: string) => void;
  clear: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  status: "EMPTY",
  componentLabel: null,
  geometry: null,
  operatingProfile: null,
  assessment: null,
  errorMessageTr: null,
  setResult: ({ componentLabel, geometry, operatingProfile, assessment }) =>
    set({
      status: "COMPUTED",
      componentLabel,
      geometry,
      operatingProfile,
      assessment,
      errorMessageTr: null,
    }),
  setError: (messageTr) => set({ status: "ERROR", errorMessageTr: messageTr }),
  clear: () =>
    set({ status: "EMPTY", componentLabel: null, geometry: null, operatingProfile: null, assessment: null, errorMessageTr: null }),
}));
