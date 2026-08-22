import { create } from "zustand";

interface AppState {
  selectedSegmentId: string | null;
  selectSegment: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSegmentId: null,
  selectSegment: (id) => set({ selectedSegmentId: id }),
}));
