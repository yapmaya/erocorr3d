// apps/web/src/store/traceabilityStore.ts
//
// "Hesap İzlenebilirliği" panelinin (features/report/traceability/
// CalculationTraceDrawer.tsx) açık/kapalı durumu. Motor ZATEN her
// MechanismResult'ta calculationTrace (adım adı → formül → girdiler → çıktı
// → kullanılan katsayı ID'leri) üretiyor (bkz. types/results.ts::TraceStep)
// — bu store yalnızca "hangi mekanizma için panel açık" durumunu tutar,
// yeni bir hesap İCAT ETMEZ.

import { create } from "zustand";
import type { MechanismResult } from "@erocorr3d/engine";

interface TraceabilityState {
  openMechanism: MechanismResult | null;
  open: (mechanism: MechanismResult) => void;
  close: () => void;
}

export const useTraceabilityStore = create<TraceabilityState>((set) => ({
  openMechanism: null,
  open: (mechanism) => set({ openMechanism: mechanism }),
  close: () => set({ openMechanism: null }),
}));
