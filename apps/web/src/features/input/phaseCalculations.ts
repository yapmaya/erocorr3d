// apps/web/src/features/input/phaseCalculations.ts
//
// Adım 3'ün "Faz özelliklerini hesapla" düğmesi — motorun KENDİ, ZATEN
// hesaplanmış fonksiyonlarını (fluids/mixtureProperties.ts,
// fluids/flowRegime.ts::computeBeggsBrillHoldup) kullanıcının girdiği
// kütlesel debi/yoğunluk/viskozite/boru iç çapı verisinden türetilen hız/
// tutulum/akış-deseni sonuçlarına bağlar. Hiçbir yeni katsayı/formül İCAT
// ETMEZ — bkz. her alt-fonksiyonun kendi dosya başı kaynak notu.
//
// Basitleştirme (açıkça belirtilir): `ProcessConditionsSchema`'da AYRI bir
// su yoğunluğu alanı yoktur (yalnızca `liquidDensityKgM3` — hidrokarbon
// sıvı fazı). Bu yüzden hız/tutulum hesabında su ve sıvı hidrokarbon debisi
// TEK bir "sıvı faz" olarak toplanıp `liquidDensityKgM3` ile hesaplanır —
// su oranı yüksek hatlarda bu bir yaklaşıklıktır (KDP kapsamı dışı, bir
// mühendislik BASİTLEŞTİRMESİdir, sonuç ekranında AÇIKÇA belirtilir).

import {
  computeBeggsBrillHoldup,
  computeMixtureVelocityMs,
  computeMixtureViscosityPaS,
  computeNoSlipLiquidHoldup,
  computeNoSlipMixtureDensityKgM3,
  type BeggsBrillHoldupResult,
  type Orientation,
  type ProcessConditions,
} from "@erocorr3d/engine";

/** Temsili karışım yüzey gerilimi (N/m) — yalnızca DANIŞMA amaçlı Beggs-Brill akış deseni haritası için kullanılır, hiçbir mm/yıl sonucunu ETKİLEMEZ. */
const REPRESENTATIVE_SURFACE_TENSION_N_PER_M = 0.03;

export interface PhaseCalcInput {
  process: Pick<
    ProcessConditions,
    "gasMassFlowKgS" | "liquidMassFlowKgS" | "waterMassFlowKgS" | "gasDensityKgM3" | "liquidDensityKgM3" | "gasViscosityPaS" | "liquidViscosityPaS"
  >;
  pipeInternalDiameterM: number;
  orientation: Orientation;
  inclinationDeg?: number;
}

export interface PhaseCalcResult {
  superficialGasVelocityMs: number;
  superficialLiquidVelocityMs: number;
  mixtureVelocityMs: number;
  mixtureDensityNoSlipKgM3: number;
  mixtureViscosityPaS: number;
  holdup: BeggsBrillHoldupResult;
}

function resolveInclinationDeg(orientation: Orientation, inclinationDeg?: number): number {
  switch (orientation) {
    case "VERTICAL_UP":
      return 90;
    case "VERTICAL_DOWN":
      return -90;
    case "INCLINED":
      return inclinationDeg ?? 0;
    default:
      return 0;
  }
}

export function computePhaseProperties(input: PhaseCalcInput): PhaseCalcResult {
  const { process, pipeInternalDiameterM } = input;
  if (pipeInternalDiameterM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır (önce Geometri adımını tamamlayın).");
  }
  const totalLiquidMassFlowKgS = process.liquidMassFlowKgS + process.waterMassFlowKgS;
  const areaM2 = (Math.PI / 4) * pipeInternalDiameterM ** 2;
  const superficialGasVelocityMs = process.gasMassFlowKgS / (process.gasDensityKgM3 * areaM2);
  const superficialLiquidVelocityMs = totalLiquidMassFlowKgS / (process.liquidDensityKgM3 * areaM2);

  const mixtureVelocityMs = computeMixtureVelocityMs(
    process.gasMassFlowKgS,
    totalLiquidMassFlowKgS,
    process.gasDensityKgM3,
    process.liquidDensityKgM3,
    pipeInternalDiameterM,
  );

  const noSlipLiquidHoldup = computeNoSlipLiquidHoldup(superficialLiquidVelocityMs, superficialGasVelocityMs);
  const mixtureDensityNoSlipKgM3 = computeNoSlipMixtureDensityKgM3(noSlipLiquidHoldup, process.liquidDensityKgM3, process.gasDensityKgM3);
  const mixtureViscosityPaS = computeMixtureViscosityPaS(noSlipLiquidHoldup, process.liquidViscosityPaS, process.gasViscosityPaS);

  const holdup = computeBeggsBrillHoldup({
    superficialLiquidVelocityMs,
    superficialGasVelocityMs,
    pipeInternalDiameterM,
    liquidDensityKgM3: process.liquidDensityKgM3,
    surfaceTensionNPerM: REPRESENTATIVE_SURFACE_TENSION_N_PER_M,
    inclinationDeg: resolveInclinationDeg(input.orientation, input.inclinationDeg),
  });

  return { superficialGasVelocityMs, superficialLiquidVelocityMs, mixtureVelocityMs, mixtureDensityNoSlipKgM3, mixtureViscosityPaS, holdup };
}
