// apps/web/src/features/results/charts/velocityErosionData.ts
//
// Hız-Erozyon Eğrisi (G). Motorda GERÇEK bir sürekli "hız→erozyon hızı"
// fonksiyonu YALNIZCA katı parçacık (DNV-RP-O501, kum varsa) ve damlacık
// erozyonu (MIST/ANNULAR + sürüklenen sıvı varsa) için mevcuttur — API
// RP 14E (erosion/api14e.ts) yalnızca TEK bir eşik hızı (Ve) döndüren bir
// TARAMA aracıdır, sürekli bir hız eğrisi ÜRETMEZ (dosyanın kendi başlığı:
// "WITH_SOLIDS kategorisi... DNV-O501'e yönlendirir"). Bu yüzden:
//   - Kum varsa (sandRateKgDay>0): DNV-O501 eğrisi (mixtureVelocityMs taranır,
//     `runSandErosionMechanism`in KENDİSİ tekrar tekrar çağrılır — geometri
//     yönlendirmesi TEKRARLANMAZ, bkz. orchestrate/mechanismRunners.ts).
//   - Kum yok AMA damlacık erozyonu koşulları sağlanıyorsa (MIST/ANNULAR +
//     serbest su — mechanismRunners.ts'in AYNI koşulu): `runDropletErosionMechanism`
//     eğrisi (superficialGasVelocityMs taranır).
//   - İkisi de yoksa: gerçek bir hız eğrisi YOK (hız 0'dır — "tek fazlı,
//     durgun olmayan sıvı hatlarında mekanizma yoksa hız 0'dır" kuralı) —
//     yalnızca API 14E'nin TEK eşik hızı (Ve) + çalışma noktası gösterilir,
//     düz bir sıfır çizgisiyle birlikte.
//
// `fluidCategory`/`serviceType` motorun KENDİ verisinden TÜRETİLEMEYECEK
// kadar az bilgiye sahip (Geometry/Mitigation'da malzeme ailesi veya
// "sürekli/aralıklı servis" alanı YOK) — bu yüzden KABA bir sezgisel kural
// (disclosed, UI'da AÇIKÇA gösterilir) kullanılır; CRA malzeme kategorisi
// hiçbir zaman seçilmez (uygulama malzeme ailesini izlemiyor).

import {
  assessApi14eScreening,
  computeParameterSweep,
  runDropletErosionMechanism,
  runSandErosionMechanism,
  type Api14eFluidCategory,
  type Api14eScreeningResult,
  type Api14eServiceType,
  type Geometry,
  type Mitigation,
  type OperatingCase,
} from "@erocorr3d/engine";

export interface VelocityErosionPoint {
  velocityMs: number;
  rateMmPerYear: number;
}

export type VelocityErosionMode = "DNV_O501_SAND" | "DROPLET_EROSION" | "SCREENING_ONLY";

export interface VelocityErosionData {
  mode: VelocityErosionMode;
  points: VelocityErosionPoint[];
  velocityAxisLabelTr: string;
  operatingVelocityMs: number;
  operatingRateMmPerYear: number;
  api14eScreening: Api14eScreeningResult | null;
  fluidCategoryUsed: Api14eFluidCategory | null;
  serviceTypeUsed: Api14eServiceType | null;
}

const SWEEP_MAX_VELOCITY_MULTIPLIER = 2.5;
const SWEEP_MIN_VELOCITY_MULTIPLIER = 2.5;
const SWEEP_POINT_COUNT = 30;

function inferFluidCategory(operatingCase: OperatingCase, mitigation: Mitigation): Api14eFluidCategory {
  const isCorrosive = operatingCase.chemistry.co2MolePercent > 0 || operatingCase.chemistry.h2sPpmMole > 0;
  if (!isCorrosive) return "SOLIDS_FREE_NON_CORROSIVE";
  return mitigation.inhibitorUsed ? "SOLIDS_FREE_CORROSIVE_INHIBITED" : "SOLIDS_FREE_CORROSIVE_NO_MITIGATION";
}

function inferServiceType(operatingCase: OperatingCase): Api14eServiceType {
  return operatingCase.durationDaysPerYear >= 350 ? "CONTINUOUS" : "INTERMITTENT";
}

export function buildVelocityErosionData(geometry: Geometry, operatingCase: OperatingCase, mitigation: Mitigation): VelocityErosionData {
  const { solids, process } = operatingCase;
  const entrainedLiquidPresent = process.isFreeWaterPresent && (process.flowRegime === "MIST" || process.flowRegime === "ANNULAR");

  if (solids.sandRateKgDay > 0) {
    const baseVelocity = process.mixtureVelocityMs;
    const modelFn = (inputs: Readonly<Record<string, number>>): number => {
      const modifiedCase: OperatingCase = { ...operatingCase, process: { ...process, mixtureVelocityMs: inputs.velocityMs } };
      return runSandErosionMechanism(geometry, modifiedCase).rateP50;
    };
    const sweep = computeParameterSweep({
      baseInputs: { velocityMs: baseVelocity },
      parameter: "velocityMs",
      minValue: 0,
      maxValue: Math.max(baseVelocity * SWEEP_MAX_VELOCITY_MULTIPLIER, 1),
      modelFn,
      pointCount: SWEEP_POINT_COUNT,
    });
    return {
      mode: "DNV_O501_SAND",
      points: sweep.map((p) => ({ velocityMs: p.parameterValue, rateMmPerYear: p.outputMmPerYear })),
      velocityAxisLabelTr: "Karışım Hızı (m/s)",
      operatingVelocityMs: baseVelocity,
      operatingRateMmPerYear: modelFn({ velocityMs: baseVelocity }),
      api14eScreening: null,
      fluidCategoryUsed: null,
      serviceTypeUsed: null,
    };
  }

  if (entrainedLiquidPresent) {
    const baseVelocity = process.superficialGasVelocityMs;
    const modelFn = (inputs: Readonly<Record<string, number>>): number => {
      const modifiedCase: OperatingCase = { ...operatingCase, process: { ...process, superficialGasVelocityMs: inputs.velocityMs } };
      return runDropletErosionMechanism(geometry, modifiedCase).rateP50;
    };
    const sweep = computeParameterSweep({
      baseInputs: { velocityMs: baseVelocity },
      parameter: "velocityMs",
      minValue: 0,
      maxValue: Math.max(baseVelocity * SWEEP_MAX_VELOCITY_MULTIPLIER, 1),
      modelFn,
      pointCount: SWEEP_POINT_COUNT,
    });
    return {
      mode: "DROPLET_EROSION",
      points: sweep.map((p) => ({ velocityMs: p.parameterValue, rateMmPerYear: p.outputMmPerYear })),
      velocityAxisLabelTr: "Yüzeysel Gaz Hızı (m/s)",
      operatingVelocityMs: baseVelocity,
      operatingRateMmPerYear: modelFn({ velocityMs: baseVelocity }),
      api14eScreening: null,
      fluidCategoryUsed: null,
      serviceTypeUsed: null,
    };
  }

  const fluidCategoryUsed = inferFluidCategory(operatingCase, mitigation);
  const serviceTypeUsed = inferServiceType(operatingCase);
  const api14eScreening = assessApi14eScreening({
    mixtureDensityKgM3: process.mixtureDensityKgM3,
    actualVelocityMs: process.mixtureVelocityMs,
    fluidCategory: fluidCategoryUsed,
    serviceType: serviceTypeUsed,
  });

  const maxVelocity = Math.max(process.mixtureVelocityMs, api14eScreening.erosionalVelocityMs) * SWEEP_MIN_VELOCITY_MULTIPLIER;
  const points: VelocityErosionPoint[] = Array.from({ length: SWEEP_POINT_COUNT }, (_, i) => ({
    velocityMs: (maxVelocity * i) / (SWEEP_POINT_COUNT - 1),
    rateMmPerYear: 0, // bkz. dosya başı notu — bu bölgede sürekli bir hız modeli yok, gerçek hız 0'dır.
  }));

  return {
    mode: "SCREENING_ONLY",
    points,
    velocityAxisLabelTr: "Karışım Hızı (m/s)",
    operatingVelocityMs: process.mixtureVelocityMs,
    operatingRateMmPerYear: 0,
    api14eScreening,
    fluidCategoryUsed,
    serviceTypeUsed,
  };
}
