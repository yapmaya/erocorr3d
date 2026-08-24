// apps/web/src/lib/diagnostics.ts
//
// Küçük bellek-içi tanı (diagnostic) toplayıcısı. `console.error`/
// `console.warn` çağrılarını ve yakalanmamış hata/promise reddi
// olaylarını bir halka tampona (son N kayıt) yazar. Yalnızca
// `ErrorBoundary`'nin "Hata Bildir" indirmesi tüketir — başka hiçbir
// yerde okunmaz, sunucuya GÖNDERİLMEZ (backend yok).

export interface DiagnosticLogEntry {
  level: "error" | "warn" | "window-error" | "unhandled-rejection";
  message: string;
  timestamp: string;
}

const MAX_ENTRIES = 50;
const buffer: DiagnosticLogEntry[] = [];

function push(entry: DiagnosticLogEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

function stringifyArgs(args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? `${a.message}\n${a.stack ?? ""}` : typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
}

let installed = false;

/** `App.tsx` mount olduğunda bir kez çağrılır. Konsolu SARMALAR (orijinal davranışı bozmaz, ek olarak tamponlar). */
export function installDiagnosticsCapture(): void {
  if (installed) return;
  installed = true;

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    push({ level: "error", message: stringifyArgs(args), timestamp: new Date().toISOString() });
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push({ level: "warn", message: stringifyArgs(args), timestamp: new Date().toISOString() });
    originalWarn(...args);
  };

  window.addEventListener("error", (e) => {
    push({ level: "window-error", message: `${e.message} (${e.filename}:${e.lineno}:${e.colno})`, timestamp: new Date().toISOString() });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack ?? ""}` : String(e.reason);
    push({ level: "unhandled-rejection", message: reason, timestamp: new Date().toISOString() });
  });
}

export function getRecentDiagnosticLogs(): DiagnosticLogEntry[] {
  return [...buffer];
}

export interface DiagnosticBundle {
  timestamp: string;
  errorMessage: string;
  errorStack: string | null;
  componentStack: string | null;
  userAgent: string;
  locale: string;
  theme: string;
  url: string;
  recentLogs: DiagnosticLogEntry[];
}

export function buildDiagnosticBundle(input: {
  error: Error;
  componentStack: string | null;
  locale: string;
  theme: string;
}): DiagnosticBundle {
  return {
    timestamp: new Date().toISOString(),
    errorMessage: input.error.message,
    errorStack: input.error.stack ?? null,
    componentStack: input.componentStack,
    userAgent: navigator.userAgent,
    locale: input.locale,
    theme: input.theme,
    url: window.location.href,
    recentLogs: getRecentDiagnosticLogs(),
  };
}

export function downloadDiagnosticBundle(bundle: DiagnosticBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `erocorr3d-tani-${bundle.timestamp.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
