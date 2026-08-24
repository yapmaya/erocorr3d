// apps/web/src/App.tsx

import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useUiStore } from "./store/uiStore";
import { usePerfStore } from "./store/perfStore";
import { installDiagnosticsCapture } from "./lib/diagnostics";

export function App() {
  const theme = useUiStore((state) => state.theme);
  const locale = useUiStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    // <html lang> yanlış kalırsa CSS `uppercase` İngilizce metinlerde Türkçe
    // büyük harf kurallarını uygular (ör. "VIEWER" yerine "VİEWER").
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    installDiagnosticsCapture();
    const [navEntry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navEntry) usePerfStore.getState().setLoadMs(navEntry.loadEventEnd - navEntry.startTime);
  }, []);

  return (
    <div className="h-full">
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </div>
  );
}
