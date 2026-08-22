// apps/web/src/store/uiStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";
export type Locale = "tr" | "en";
export type Page = "workspace" | "registry" | "geometryLab" | "projects";
export type UnitSystemPreference = "SI" | "IMPERIAL";

interface UiState {
  theme: Theme;
  locale: Locale;
  isBottomDrawerOpen: boolean;
  activePage: Page;
  unitSystem: UnitSystemPreference;
  toggleTheme: () => void;
  setLocale: (locale: Locale) => void;
  toggleBottomDrawer: () => void;
  setBottomDrawerOpen: (open: boolean) => void;
  setActivePage: (page: Page) => void;
  setUnitSystem: (unitSystem: UnitSystemPreference) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark",
      locale: "tr",
      isBottomDrawerOpen: false,
      activePage: "workspace",
      unitSystem: "SI",
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setLocale: (locale) => set({ locale }),
      toggleBottomDrawer: () =>
        set((state) => ({ isBottomDrawerOpen: !state.isBottomDrawerOpen })),
      setBottomDrawerOpen: (open) => set({ isBottomDrawerOpen: open }),
      setActivePage: (page) => set({ activePage: page }),
      setUnitSystem: (unitSystem) => set({ unitSystem }),
    }),
    { name: "erocorr3d-ui-preferences" },
  ),
);
