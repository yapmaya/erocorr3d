// apps/web/src/features/results/charts/metalLossTimeSeriesData.ts
//
// Zaman Serisi (D) — kümülatif metal kaybı, motorun KENDİ doğrusal
// (hız×süre) modeli kullanılarak (bkz. spatial/timeScaling.ts'in aynı
// gerekçesi: "hız×süre modeli DOĞRUSAL olduğundan ara bir yıldaki hasar =
// tasarım-ömrü-sonu hasar × (t/tasarım_ömrü)"). `totalAnnualLossMmPerYear`
// (P10/P50/P90) TÜM senaryoların (kısmi-çalışma düzeltmesi uygulanmış,
// bkz. aggregate/metalLoss.ts) BİRLEŞİK yıllık katkısıdır — burada t ile
// çarpılarak kümülatif eğri üretilir, yeni bir model İCAT EDİLMEZ.

import type { OperatingProfile, ScenarioAssessment } from "@erocorr3d/engine";

export interface TimeSeriesPoint {
  year: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MetalLossTimeSeriesData {
  points: TimeSeriesPoint[];
  corrosionAllowanceMm: number;
  designLifeYears: number;
  /** Kümülatif kayıp (P50) korozyon payına ULAŞTIĞI yıl — hız 0 ise `null` (asla tükenmez). */
  depletionYearP50: number | null;
}

export function buildMetalLossTimeSeriesData(
  operatingProfile: Pick<OperatingProfile, "designLifeYears" | "corrosionAllowanceMm">,
  assessment: Pick<ScenarioAssessment, "metalLoss">,
  pointCount = 21,
): MetalLossTimeSeriesData {
  const { designLifeYears, corrosionAllowanceMm } = operatingProfile;
  const { p10, p50, p90 } = assessment.metalLoss.totalAnnualLossMmPerYear;

  const points: TimeSeriesPoint[] = [];
  const steps = Math.max(pointCount - 1, 1);
  for (let i = 0; i <= steps; i++) {
    const year = (designLifeYears * i) / steps;
    points.push({ year, p10: p10 * year, p50: p50 * year, p90: p90 * year });
  }

  const depletionYearP50 = p50 > 0 ? corrosionAllowanceMm / p50 : null;

  return { points, corrosionAllowanceMm, designLifeYears, depletionYearP50 };
}
