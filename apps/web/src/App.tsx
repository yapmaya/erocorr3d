// apps/web/src/App.tsx

import { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { useUiStore } from "./store/uiStore";

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

  return (
    <div className="h-full">
      <AppShell />
    </div>
  );
}
