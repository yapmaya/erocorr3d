// apps/web/src/store/perfStore.ts
//
// Yalnızca geliştirici modu performans panelinin (`DevPerfOverlay.tsx`)
// okuduğu, kalıcı OLMAYAN küçük bir durum — yük süresi/son hesap süresi/
// FPS. `perfMetrics.ts`'in bütçe sabitleriyle karşılaştırılır.

import { create } from "zustand";

interface PerfState {
  loadMs: number | null;
  lastCalcMs: number | null;
  fps: number | null;
  setLoadMs: (ms: number) => void;
  setLastCalcMs: (ms: number) => void;
  setFps: (fps: number) => void;
}

export const usePerfStore = create<PerfState>((set) => ({
  loadMs: null,
  lastCalcMs: null,
  fps: null,
  setLoadMs: (ms) => set({ loadMs: ms }),
  setLastCalcMs: (ms) => set({ lastCalcMs: ms }),
  setFps: (fps) => set({ fps }),
}));
