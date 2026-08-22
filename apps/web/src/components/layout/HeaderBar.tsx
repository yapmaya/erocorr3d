// apps/web/src/components/layout/HeaderBar.tsx

import { useState } from "react";
import { useTranslation } from "../../i18n/translations";
import { useUiStore, type Locale, type Page } from "../../store/uiStore";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function NavMenu() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const activePage = useUiStore((state) => state.activePage);
  const setActivePage = useUiStore((state) => state.setActivePage);

  const items: { page: Page; label: string }[] = [
    { page: "workspace", label: t("navWorkspace") },
    { page: "registry", label: t("navRegistry") },
    { page: "geometryLab", label: t("navGeometryLab") },
  ];

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
        aria-label={t("menu")}
        aria-expanded={isOpen}
      >
        <MenuIcon />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {items.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => {
                setActivePage(item.page);
                setIsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm ${
                activePage === item.page
                  ? "bg-sky-50 font-semibold text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                  : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderBar() {
  const { t, locale } = useTranslation();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const setLocale = useUiStore((state) => state.setLocale);

  const otherLocale: Locale = locale === "tr" ? "en" : "tr";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex items-center gap-3">
        <NavMenu />
        <span className="text-sm font-semibold tracking-wide">{t("appTitle")}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLocale(otherLocale)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          aria-label="Dil / Language"
        >
          {locale.toUpperCase()}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          aria-label={theme === "dark" ? t("themeToggleToLight") : t("themeToggleToDark")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
