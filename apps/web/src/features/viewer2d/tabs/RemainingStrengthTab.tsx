// apps/web/src/features/viewer2d/tabs/RemainingStrengthTab.tsx
//
// Kalan Dayanım (ASME B31G / Modified B31G) — aşınmış bölge için kalan
// basınç dayanımı ve güvenli çalışma basıncı tahmini.

import { useMemo, useState } from "react";
import {
  PIPE_GRADES,
  computeModifiedB31gSafePressurePa,
  computeOriginalB31gSafePressurePa,
  findAxialDefectExtentM,
  getCoefficient,
  getPipeGrade,
  type B31gSafePressureResult,
  type LocationClass,
} from "@erocorr3d/engine";
import { UnverifiedBadge } from "../../../components/UnverifiedBadge";
import { useTranslation, type TranslationKey } from "../../../i18n/translations";
import type { Viewer2dDataSource } from "../dataSource";
import { DEFAULT_LOCATION_CLASS, DEFAULT_PIPE_GRADE_ID, buildSampledField } from "../dataSource";

const LOCATION_CLASSES: LocationClass[] = [1, 2, 3, 4];
const PA_PER_BAR = 1e5;

function confidenceColor(confidence: string): string {
  if (confidence === "HIGH") return "bg-emerald-700 text-white";
  if (confidence === "MEDIUM") return "bg-amber-600 text-white";
  return "bg-red-700 text-white";
}

function ResultCard({ titleKey, result }: { titleKey: TranslationKey; result: B31gSafePressureResult }) {
  const { t } = useTranslation();
  const unverifiedCoefficients = result.sourcesUsed
    .map((id) => {
      try {
        return getCoefficient(id);
      } catch {
        return null;
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.confidence === "UNVERIFIED");

  const safePressureBar = result.safePressurePa / PA_PER_BAR;
  const governingPressureBar = result.governingPressurePa / PA_PER_BAR;
  const marginRatio = result.governingPressurePa > 0 ? result.safePressurePa / result.governingPressurePa : 0;

  return (
    <div className="flex flex-col gap-1.5 rounded border border-neutral-200 p-3 text-xs dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t(titleKey)}</h4>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${confidenceColor(result.confidence)}`}>
          {result.confidence}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-neutral-500">{t("viewer2dSafePressureLabel")}</span>
        <span className="text-right font-mono">{safePressureBar.toFixed(1)} bar</span>
        <span className="text-neutral-500">{t("viewer2dGoverningPressureLabel")}</span>
        <span className="text-right font-mono">{governingPressureBar.toFixed(1)} bar</span>
        <span className="text-neutral-500">{t("viewer2dSafetyMarginLabel")}</span>
        <span className={`text-right font-mono ${marginRatio < 1 ? "text-red-500" : "text-emerald-500"}`}>
          {marginRatio.toFixed(2)}×
        </span>
        <span className="text-neutral-500">{t("viewer2dBranchLabel")}</span>
        <span className="text-right">{result.branch}</span>
      </div>
      {result.validityWarnings.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">
          {result.validityWarnings.map((w, i) => (
            <li key={i}>{w.message}</li>
          ))}
        </ul>
      )}
      {unverifiedCoefficients.length > 0 && (
        <div className="mt-1">
          <UnverifiedBadge unverifiedCoefficients={unverifiedCoefficients} />
        </div>
      )}
    </div>
  );
}

export function RemainingStrengthTab({ dataSource }: { dataSource: Viewer2dDataSource }) {
  const { t } = useTranslation();
  const [gradeId, setGradeId] = useState(DEFAULT_PIPE_GRADE_ID);
  const [locationClass, setLocationClass] = useState<LocationClass>(DEFAULT_LOCATION_CLASS);

  const { geometry } = dataSource;
  const grade = getPipeGrade(gradeId);

  const field = useMemo(() => buildSampledField(dataSource), [dataSource]);
  const defect = useMemo(
    () => findAxialDefectExtentM(field, geometry.lengthMm / 1000, geometry.wallThicknessMm),
    [field, geometry.lengthMm, geometry.wallThicknessMm],
  );

  const b31gInput = defect
    ? {
        odM: geometry.odMm / 1000,
        wallThicknessM: geometry.wallThicknessMm / 1000,
        defectDepthM: defect.maxDepthMm / 1000,
        defectLengthM: defect.lengthM,
        smysPa: grade.smysPa,
        locationClass,
        temperatureC: geometry.temperatureC,
        establishedMaopPa: geometry.designPressurePa,
      }
    : null;

  const originalResult = b31gInput ? computeOriginalB31gSafePressurePa(b31gInput) : null;
  const modifiedResult = b31gInput ? computeModifiedB31gSafePressurePa(b31gInput) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="text-sm font-semibold">{t("viewer2dRemainingStrengthTitle")}</h3>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">{t("viewer2dPipeGradeLabel")}</span>
          <select
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
          >
            {PIPE_GRADES.map((g) => (
              <option key={g.gradeId} value={g.gradeId}>
                {g.displayNameTr} — {g.smysMpaForDisplay} MPa
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">{t("viewer2dLocationClassLabel")}</span>
          <select
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            value={locationClass}
            onChange={(e) => setLocationClass(Number(e.target.value) as LocationClass)}
          >
            {LOCATION_CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!defect ? (
        <p className="rounded border border-neutral-200 p-3 text-xs text-neutral-500 dark:border-neutral-800">
          {t("viewer2dNoQualifyingDefectMessage")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800 sm:grid-cols-4">
            <span className="text-neutral-500">{t("viewer2dDefectDepthLabel")}</span>
            <span className="font-mono">{defect.maxDepthMm.toFixed(2)} mm</span>
            <span className="text-neutral-500">{t("viewer2dDefectLengthLabel")}</span>
            <span className="font-mono">{defect.lengthM.toFixed(3)} m</span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {originalResult && <ResultCard titleKey="viewer2dOriginalB31gLabel" result={originalResult} />}
            {modifiedResult && <ResultCard titleKey="viewer2dModifiedB31gLabel" result={modifiedResult} />}
          </div>
        </>
      )}

      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        {t("viewer2dUncertaintyDisclaimer")}
      </p>
    </div>
  );
}
