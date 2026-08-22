// apps/web/src/features/results/charts/monteCarloData.ts
//
// Monte Carlo Histogramı (F) — motorun `uncertainty/monteCarlo.ts::
// runMonteCarloSimulation`ını (bugüne kadar hiçbir çağıranı olmayan, tam
// işlevsel jenerik bir Monte Carlo motoru) GERÇEK NORSOK M-506 hesabına
// bağlar; girdi dağılımları `uncertainty/defaultDistributions.ts`in KENDİ
// (KDP'ye kayıtlı) varsayılan dağılımlarıdır — burada YENİ bir belirsizlik
// sabiti İCAT EDİLMEZ.
//
// ÖNEMLİ AYRIM (UI'da açıkça belirtilir): bu, sonuç tablosunda/grafiklerde
// gösterilen P10/P50/P90'DAN (motorun kendi sabit çarpımsal belirsizlik
// bandından, bkz. uncertainty/percentiles.ts) FARKLI, AYRI bir simülasyondur
// — burada kullanıcının/varsayılan GİRDİ dağılımları (sıcaklık, basınç, CO2
// vb.) örneklenip NORSOK modeli TEKRAR TEKRAR çalıştırılır.
//
// KAPSAM (bkz. onaylı plan'ın kapsam kararı #5): yalnızca CO2 (tatlı)
// korozyonu/NORSOK M-506 için — CO2 mol yüzdesi 0 ise `null` döner.
//
// PERFORMANS NOTU: motorun kendi dosya başı yorumu bunun bir Web Worker
// (comlink) içinde SARILMASINI ÖNERİR; bu sürümde iterasyon sayısı (5.000)
// motorun ölçtüğü <100ms/10.000-iterasyon mertebesinin altında kalacak
// şekilde BİLEREK düşürülüp ana iş parçacığında senkron çalıştırıldı —
// worker sarmalama, iterasyon sayısı artarsa yapılacak bir gelecek iyileştirmedir.

import {
  buildDefaultCo2Distribution,
  buildDefaultInhibitorEfficiencyDistribution,
  buildDefaultPhDistribution,
  buildDefaultPressureDistribution,
  buildDefaultTemperatureDistribution,
  buildNorsokM506InputFromCase,
  computeNorsokM506Rate,
  computeSharedWallShearStressPa,
  runMonteCarloSimulation,
  type Geometry,
  type Mitigation,
  type MonteCarloResult,
  type MonteCarloVariable,
  type OperatingCase,
  type OperatingProfile,
} from "@erocorr3d/engine";

export const MONTE_CARLO_ITERATIONS = 5000;

export interface MonteCarloBuildInput {
  geometry: Geometry;
  mitigation: Mitigation;
  operatingCase: OperatingCase;
  operatingProfile: Pick<OperatingProfile, "designLifeYears" | "corrosionAllowanceMm">;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function buildMonteCarloResult(input: MonteCarloBuildInput): MonteCarloResult | null {
  const { operatingCase, mitigation } = input;
  if (operatingCase.chemistry.co2MolePercent <= 0) return null;

  const wallShearStressPa = computeSharedWallShearStressPa(input.geometry, operatingCase.process);
  const hasMeasuredPh = operatingCase.chemistry.phMeasured !== undefined;
  const hasInhibitor = mitigation.inhibitorUsed && Boolean(mitigation.inhibitorEfficiencyPercent);

  const variables: MonteCarloVariable[] = [
    { name: "temperatureC", distribution: buildDefaultTemperatureDistribution(operatingCase.process.temperatureC).distribution },
    { name: "pressureBara", distribution: buildDefaultPressureDistribution(operatingCase.process.pressureBara).distribution },
    { name: "co2MolePercent", distribution: buildDefaultCo2Distribution(operatingCase.chemistry.co2MolePercent).distribution },
  ];
  if (hasMeasuredPh) {
    variables.push({ name: "phMeasured", distribution: buildDefaultPhDistribution(operatingCase.chemistry.phMeasured!).distribution });
  }
  if (hasInhibitor) {
    variables.push({
      name: "inhibitorEfficiencyFraction",
      distribution: buildDefaultInhibitorEfficiencyDistribution(mitigation.inhibitorEfficiencyPercent! / 100).distribution,
    });
  }

  const modelFn = (sample: Readonly<Record<string, number>>): number => {
    const modifiedCase: OperatingCase = {
      ...operatingCase,
      process: { ...operatingCase.process, temperatureC: sample.temperatureC, pressureBara: Math.max(sample.pressureBara, 0.01) },
      chemistry: {
        ...operatingCase.chemistry,
        co2MolePercent: Math.max(sample.co2MolePercent, 1e-4),
        phMeasured: hasMeasuredPh ? clamp(sample.phMeasured, 0, 14) : operatingCase.chemistry.phMeasured,
      },
    };
    const modifiedMitigation: Mitigation = hasInhibitor
      ? { ...mitigation, inhibitorEfficiencyPercent: clamp(sample.inhibitorEfficiencyFraction, 0, 1) * 100 }
      : mitigation;
    const norsokInput = buildNorsokM506InputFromCase(modifiedMitigation, modifiedCase, wallShearStressPa);
    return computeNorsokM506Rate(norsokInput).rateMmPerYear.p50;
  };

  return runMonteCarloSimulation({
    variables,
    modelFn,
    iterations: MONTE_CARLO_ITERATIONS,
    designLifeAllowanceCheck: {
      designLifeYears: input.operatingProfile.designLifeYears,
      corrosionAllowanceMm: input.operatingProfile.corrosionAllowanceMm,
    },
  });
}
