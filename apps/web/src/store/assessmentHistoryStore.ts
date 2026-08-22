// apps/web/src/store/assessmentHistoryStore.ts
//
// Girdi sihirbazının "Hesapla" eyleminin ÇOKLU bileşen geçmişi — Sonuçlar
// özelliğinin tablosu (features/results/components/ResultsTable.tsx) ve 8
// grafiği buradan okur. `useAssessmentStore` (assessmentStore.ts) TEKİL
// kalır (PipeViewer/viewer2d ZATEN ona bağlı, bozulmasın) — bu store yalnızca
// GEÇMİŞİ biriktirir; bir satıra tıklamak `useAssessmentStore.setResult(...)`'ı
// TEKRAR çağırarak 3B/2B görünümün "Özel Veri" kaynağını GÜNCELLER (bkz.
// selectEntry).
//
// `uninhibitedAssessment`: motorun NORSOK M-506 yolu `corrosion/rules.ts::
// applyInhibitorFloor`'u KULLANMADIĞI için (kendi iç `applyInhibitor`
// kapanışı var) "inhibitörsüz olsaydı" karşılaştırması yalnızca motoru
// `mitigation.inhibitorUsed=false` ile GERÇEKTEN TEKRAR çalıştırarak elde
// edilebilir (bkz. computeAssessment.ts). Taslak zaten inhibitörsüzse bu
// alan `assessment` ile AYNIDIR (ikinci bir çağrıya gerek yok).

import { create } from "zustand";
import type { Geometry, Mitigation, OperatingProfile, ScenarioAssessment } from "@erocorr3d/engine";
import { useAssessmentStore } from "./assessmentStore";

export interface AssessmentHistoryEntry {
  id: string;
  componentLabel: string;
  geometry: Geometry;
  mitigation: Mitigation;
  operatingProfile: OperatingProfile;
  /** Taslakta AYARLANDIĞI HALİYLE (inhibitör açıksa inhibitörlü) sonuç. */
  assessment: ScenarioAssessment;
  /** inhibitorUsed=false ZORLANARAK yeniden hesaplanmış sonuç — inhibitör
   * zaten kapalıysa `assessment` ile AYNI nesnedir. */
  uninhibitedAssessment: ScenarioAssessment;
  computedAt: number;
}

interface AssessmentHistoryState {
  entries: AssessmentHistoryEntry[];
  selectedEntryId: string | null;
  addEntry: (entry: Omit<AssessmentHistoryEntry, "id" | "computedAt">) => string;
  removeEntry: (id: string) => void;
  clear: () => void;
  /** Seçili girdiyi işaretler VE useAssessmentStore'u günceller (PipeViewer'ın
   * "Özel Veri" modu bunu okur — kullanıcı sonra o sekmeye kendi geçer). */
  selectEntry: (id: string) => void;
}

export const useAssessmentHistoryStore = create<AssessmentHistoryState>((set, get) => ({
  entries: [],
  selectedEntryId: null,
  addEntry: (entry) => {
    const id = crypto.randomUUID();
    const newEntry: AssessmentHistoryEntry = { ...entry, id, computedAt: Date.now() };
    set((state) => ({ entries: [...state.entries, newEntry] }));
    get().selectEntry(id);
    return id;
  },
  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
    })),
  clear: () => set({ entries: [], selectedEntryId: null }),
  selectEntry: (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;
    set({ selectedEntryId: id });
    useAssessmentStore.getState().setResult({
      componentLabel: entry.componentLabel,
      geometry: entry.geometry,
      operatingProfile: entry.operatingProfile,
      assessment: entry.assessment,
    });
  },
}));
