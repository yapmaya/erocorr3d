// packages/engine/tests/orchestrate/testFixtures.ts
//
// orchestrate/ testlerinin paylaştığı, gerçekçi ama TEMSİLİ (uydurma
// olmayan, yalnızca şema-geçerli) Geometry/Mitigation/OperatingCase
// oluşturucuları — fixtures/botas.ts::buildOperatingCase ile AYNI kalıp.

import type { Geometry } from "../../src/types/geometry";
import type { Mitigation } from "../../src/types/mitigation";
import type { OperatingCase } from "../../src/types/operating";
import type { FlowRegime } from "../../src/types/enums";

export function baseGeometry(overrides: Partial<Geometry> = {}): Geometry {
  return {
    componentType: "STRAIGHT_PIPE",
    npsInch: 6,
    schedule: "40",
    odMm: 168.3,
    wallThicknessMm: 7.11,
    idMm: 154.08,
    lengthMm: 6000,
    orientation: "HORIZONTAL",
    roughnessMm: 0.046,
    installation: "ABOVE_GROUND",
    isInsulated: false,
    ...overrides,
  };
}

export function baseMitigation(overrides: Partial<Mitigation> = {}): Mitigation {
  return {
    inhibitorUsed: false,
    biocideUsed: false,
    o2ScavengerUsed: false,
    internalLining: "NONE",
    cathodicProtection: false,
    ...overrides,
  };
}

interface OperatingCaseOverrides {
  name?: string;
  durationDaysPerYear?: number;
  temperatureC?: number;
  waterDewpointC?: number;
  ambientTemperatureC?: number;
  isFreeWaterPresent?: boolean;
  waterCutPercent?: number;
  flowRegime?: FlowRegime;
  co2MolePercent?: number;
  h2sPpmMole?: number;
  o2Ppb?: number;
  bicarbonateMgL?: number;
  chlorideMgL?: number;
  sandRateKgDay?: number;
  particleDiameterUm?: number;
  particleDensityKgM3?: number;
  particleShapeFactor?: number;
  mixtureVelocityMs?: number;
  superficialGasVelocityMs?: number;
  liquidHoldupFraction?: number;
}

/**
 * Islak, ekşi, stratifiye bir doğal gaz senaryosunun makul mertebede tutarlı
 * TÜM alanlarını doldurur — CO2/H2S/erozyon mekanizmalarının HEPSİNİN
 * çalıştırılabilmesi için (Zod şemasının kendi zorunluluklarını karşılayacak
 * şekilde).
 */
export function buildOperatingCase(overrides: OperatingCaseOverrides = {}): OperatingCase {
  const sandRateKgDay = overrides.sandRateKgDay ?? 0;
  const temperatureC = overrides.temperatureC ?? 40;
  // Varsayılan çiy noktası, sıcaklığa GÖRECELİ (ΔT=3°C < 10°C eşiği) — böylece
  // yalnızca temperatureC değiştirilip waterDewpointC unutulduğunda senaryo
  // YANLIŞLIKLA "kuru gaz" (bkz. corrosion/rules.ts::isDryGas) olmaz. Gerçek
  // kuru-gaz testleri waterDewpointC'yi AÇIKÇA çok daha düşük vermelidir (bkz.
  // fixtures/botas.ts'in enjeksiyon senaryosu, ΔT=52°C).
  const waterDewpointC = overrides.waterDewpointC ?? temperatureC - 3;
  return {
    name: overrides.name ?? "Test Senaryosu",
    description: "Test amaçlı temsili senaryo",
    durationDaysPerYear: overrides.durationDaysPerYear ?? 365,
    process: {
      pressureBara: 70,
      temperatureC,
      gasMassFlowKgS: 5,
      liquidMassFlowKgS: 0.05,
      waterMassFlowKgS: overrides.isFreeWaterPresent === false ? 0 : 0.01,
      gasDensityKgM3: 60,
      liquidDensityKgM3: 900,
      mixtureDensityKgM3: 62,
      gasViscosityPaS: 1.2e-5,
      liquidViscosityPaS: 5e-4,
      superficialGasVelocityMs: overrides.superficialGasVelocityMs ?? 8,
      superficialLiquidVelocityMs: 0.05,
      mixtureVelocityMs: overrides.mixtureVelocityMs ?? 8.05,
      liquidHoldupFraction: overrides.liquidHoldupFraction ?? 0.02,
      flowRegime: overrides.flowRegime ?? "STRATIFIED_WAVY",
      waterCutPercent: overrides.waterCutPercent ?? (overrides.isFreeWaterPresent === false ? 0 : 3),
      waterDewpointC,
      hydrocarbonDewpointC: -5,
      isFreeWaterPresent: overrides.isFreeWaterPresent ?? true,
      ambientTemperatureC: overrides.ambientTemperatureC ?? 12,
    },
    chemistry: {
      co2MolePercent: overrides.co2MolePercent ?? 1.2,
      h2sPpmMole: overrides.h2sPpmMole ?? 15,
      o2Ppb: overrides.o2Ppb ?? 5,
      chlorideMgL: overrides.chlorideMgL ?? 50,
      bicarbonateMgL: overrides.bicarbonateMgL ?? 200,
      totalDissolvedSolidsMgL: 500,
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
    },
    solids: {
      sandRateKgDay,
      sandPpmw: sandRateKgDay > 0 ? 10 : 0,
      particleDiameterUm: sandRateKgDay > 0 ? (overrides.particleDiameterUm ?? 150) : undefined,
      particleDensityKgM3: sandRateKgDay > 0 ? (overrides.particleDensityKgM3 ?? 2650) : undefined,
      particleShapeFactor: sandRateKgDay > 0 ? (overrides.particleShapeFactor ?? 0.5) : undefined,
    },
  };
}
