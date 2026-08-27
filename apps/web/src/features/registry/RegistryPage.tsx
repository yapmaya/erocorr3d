// apps/web/src/features/registry/RegistryPage.tsx

import { useMemo, useState } from "react";
import {
  exportRegistry,
  listCoefficients,
  registryStats,
  type Coefficient,
  type ConfidenceLevel,
} from "@erocorr3d/engine";
import { useTranslation } from "../../i18n/translations";
import { downloadBlob } from "../../lib/downloadBlob";

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"];

const CONFIDENCE_ROW_BORDER: Record<ConfidenceLevel, string> = {
  HIGH: "border-l-4 border-l-emerald-500",
  MEDIUM: "border-l-4 border-l-blue-500",
  LOW: "border-l-4 border-l-amber-500",
  UNVERIFIED: "border-l-4 border-l-red-500",
};

const CONFIDENCE_BADGE_CLASS: Record<ConfidenceLevel, string> = {
  HIGH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  LOW: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  UNVERIFIED: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
};

const CONFIDENCE_LABEL_KEY: Record<ConfidenceLevel, "confidenceHigh" | "confidenceMedium" | "confidenceLow" | "confidenceUnverified"> = {
  HIGH: "confidenceHigh",
  MEDIUM: "confidenceMedium",
  LOW: "confidenceLow",
  UNVERIFIED: "confidenceUnverified",
};

function formatValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.length} öğe]`;
  if (value && typeof value === "object") return "{…}";
  return String(value);
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`text-2xl font-semibold ${className ?? "text-neutral-900 dark:text-neutral-100"}`}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  );
}

export function RegistryPage() {
  const { t, locale } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceLevel | "ALL">("ALL");

  const allCoefficients = useMemo(() => listCoefficients(), []);
  const stats = useMemo(() => registryStats(), []);
  const modules = useMemo(
    () => [...new Set(allCoefficients.map((c) => c.module))].sort(),
    [allCoefficients],
  );

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allCoefficients.filter((c) => {
      if (moduleFilter !== "ALL" && c.module !== moduleFilter) return false;
      if (confidenceFilter !== "ALL" && c.confidence !== confidenceFilter) return false;
      if (query && !c.id.toLowerCase().includes(query) && !c.description.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [allCoefficients, moduleFilter, confidenceFilter, searchQuery]);

  const handleExportCsv = () => {
    downloadTextFile("erocorr3d-katsayi-kayit-defteri.csv", exportRegistry("csv"), "text/csv;charset=utf-8");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <h1 className="mb-4 text-lg font-semibold">{t("registryPageTitle")}</h1>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t("registryStatTotal")} value={stats.total} />
        <StatCard
          label={t("confidenceHigh")}
          value={stats.byConfidence.HIGH}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t("confidenceMedium")}
          value={stats.byConfidence.MEDIUM}
          className="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          label={t("confidenceLow")}
          value={stats.byConfidence.LOW}
          className="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label={t("confidenceUnverified")}
          value={stats.byConfidence.UNVERIFIED}
          className="text-red-600 dark:text-red-400"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("registrySearchPlaceholder")}
          className="min-w-[220px] flex-1 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <option value="ALL">{t("registryFilterModuleAll")}</option>
          {modules.map((moduleName) => (
            <option key={moduleName} value={moduleName}>
              {moduleName}
            </option>
          ))}
        </select>
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceLevel | "ALL")}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        >
          <option value="ALL">{t("registryFilterConfidenceAll")}</option>
          {CONFIDENCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(CONFIDENCE_LABEL_KEY[level])}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
        >
          {t("registryExportCsv")}
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <th className="px-3 py-2">{t("registryColumnId")}</th>
              <th className="px-3 py-2">{t("registryColumnValue")}</th>
              <th className="px-3 py-2">{t("registryColumnUnit")}</th>
              <th className="px-3 py-2">{t("registryColumnDescription")}</th>
              <th className="px-3 py-2">{t("registryColumnSource")}</th>
              <th className="px-3 py-2">{t("registryColumnCrossCheck")}</th>
              <th className="px-3 py-2">{t("registryColumnConfidence")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500 dark:text-neutral-400">
                  {t("registryEmpty")}
                </td>
              </tr>
            )}
            {filtered.map((coefficient: Coefficient) => (
              <tr
                key={coefficient.id}
                className={`${CONFIDENCE_ROW_BORDER[coefficient.confidence]} border-b border-neutral-100 dark:border-neutral-900`}
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{coefficient.id}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {formatValue(coefficient.value)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500 dark:text-neutral-400">
                  {coefficient.unit}
                </td>
                <td className="px-3 py-2">{coefficient.description}</td>
                <td className="max-w-xs px-3 py-2">
                  {coefficient.source.url ? (
                    <a
                      href={coefficient.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 underline hover:text-sky-500 dark:text-sky-400"
                      title={coefficient.source.citation}
                    >
                      {coefficient.source.type}
                    </a>
                  ) : (
                    <span title={coefficient.source.citation}>{coefficient.source.type}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {coefficient.crossChecked ? t("registryCrossCheckYes") : t("registryCrossCheckNo")}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_BADGE_CLASS[coefficient.confidence]}`}
                  >
                    {t(CONFIDENCE_LABEL_KEY[coefficient.confidence])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{locale === "tr" ? `${filtered.length} / ${allCoefficients.length} kayıt gösteriliyor` : `Showing ${filtered.length} / ${allCoefficients.length} records`}</p>
    </div>
  );
}
