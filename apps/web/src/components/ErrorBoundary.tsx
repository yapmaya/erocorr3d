// apps/web/src/components/ErrorBoundary.tsx
//
// React render hatalarını yakalayan kök sınır (React error boundary'ler
// yalnızca class component olarak yazılabilir). Türkçe/İngilizce kullanıcı
// dostu bir düşme ekranı gösterir + "Hata Bildir" ile bir tanı (diagnostic)
// JSON dosyası indirir (backend YOK — kullanıcı bunu destek talebine ekler).

import { Component, type ErrorInfo, type ReactNode } from "react";
import { translate } from "../i18n/translations";
import { useUiStore } from "../store/uiStore";
import { buildDiagnosticBundle, downloadDiagnosticBundle } from "../lib/diagnostics";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
  showDetails: boolean;
  reported: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null, showDetails: false, reported: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary yakaladı:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReport = (): void => {
    const { error, componentStack } = this.state;
    if (!error) return;
    const { locale, theme } = useUiStore.getState();
    const bundle = buildDiagnosticBundle({ error, componentStack, locale, theme });
    downloadDiagnosticBundle(bundle);
    this.setState({ reported: true });
  };

  render() {
    const { error, componentStack, showDetails, reported } = this.state;
    if (!error) return this.props.children;

    const locale = useUiStore.getState().locale;
    const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white p-6 text-center text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <h1 className="text-lg font-semibold">{t("errorBoundaryTitle")}</h1>
        <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-400">{t("errorBoundaryBody")}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            {t("errorBoundaryReloadButton")}
          </button>
          <button
            type="button"
            onClick={this.handleReport}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            {t("errorBoundaryReportButton")}
          </button>
        </div>

        {reported && <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("errorBoundaryReportedHint")}</p>}

        <button
          type="button"
          onClick={() => this.setState({ showDetails: !showDetails })}
          className="mt-2 text-xs text-neutral-400 underline hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          {t("errorBoundaryDetailsToggle")}
        </button>
        {showDetails && (
          <pre className="max-h-48 w-full max-w-lg overflow-auto rounded bg-neutral-100 p-2 text-left text-[10px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            {error.message}
            {"\n"}
            {error.stack}
            {componentStack ? `\n${componentStack}` : ""}
          </pre>
        )}
      </div>
    );
  }
}
