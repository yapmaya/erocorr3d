// packages/engine/tests/types/process.test.ts

import { describe, expect, it } from "vitest";
import { FluidChemistrySchema, ProcessConditionsSchema, SolidsDataSchema } from "../../src/types/process";

const validProcess = {
  pressureBara: 70,
  temperatureC: 15,
  gasMassFlowKgS: 5,
  liquidMassFlowKgS: 0.05,
  waterMassFlowKgS: 0.0015,
  gasDensityKgM3: 60,
  liquidDensityKgM3: 900,
  mixtureDensityKgM3: 62,
  gasViscosityPaS: 1.2e-5,
  liquidViscosityPaS: 5e-4,
  superficialGasVelocityMs: 8,
  superficialLiquidVelocityMs: 0.05,
  mixtureVelocityMs: 8.05,
  liquidHoldupFraction: 0.02,
  flowRegime: "STRATIFIED_WAVY" as const,
  waterCutPercent: 3,
  waterDewpointC: 12,
  hydrocarbonDewpointC: -5,
  isFreeWaterPresent: true,
  ambientTemperatureC: 12,
};

describe("ProcessConditionsSchema", () => {
  it("geçerli bir proses koşulunu kabul eder", () => {
    expect(ProcessConditionsSchema.safeParse(validProcess).success).toBe(true);
  });

  it("isFreeWaterPresent=false iken waterCutPercent>0 reddedilir", () => {
    const result = ProcessConditionsSchema.safeParse({
      ...validProcess,
      isFreeWaterPresent: false,
      waterCutPercent: 5,
    });
    expect(result.success).toBe(false);
  });

  it("isFreeWaterPresent=false ve waterCutPercent=0 kabul edilir (kuru gaz)", () => {
    const result = ProcessConditionsSchema.safeParse({
      ...validProcess,
      isFreeWaterPresent: false,
      waterCutPercent: 0,
    });
    expect(result.success).toBe(true);
  });

  it("fiziksel aralık dışı basıncı reddeder", () => {
    expect(ProcessConditionsSchema.safeParse({ ...validProcess, pressureBara: -1 }).success).toBe(false);
  });
});

describe("FluidChemistrySchema", () => {
  const validChemistry = {
    co2MolePercent: 1.2171,
    h2sPpmMole: 15,
    o2Ppb: 5,
    chlorideMgL: 50,
    bicarbonateMgL: 200,
    totalDissolvedSolidsMgL: 500,
    aceticAcidMgL: 0,
    glycolWeightPercent: 0,
    methanolWeightPercent: 0,
    isWaterFeSaturated: false,
    bacteriaPresent: false,
  };

  it("geçerli bir akışkan kimyasını kabul eder", () => {
    expect(FluidChemistrySchema.safeParse(validChemistry).success).toBe(true);
  });

  it("phMeasured olmadan da geçerlidir (opsiyonel)", () => {
    expect(FluidChemistrySchema.safeParse(validChemistry).success).toBe(true);
  });

  it("14'ü aşan pH değerini reddeder", () => {
    const result = FluidChemistrySchema.safeParse({ ...validChemistry, phMeasured: 15 });
    expect(result.success).toBe(false);
  });
});

describe("SolidsDataSchema", () => {
  it("kum oranı sıfırken parçacık ayrıntıları olmadan geçerlidir", () => {
    const result = SolidsDataSchema.safeParse({ sandRateKgDay: 0, sandPpmw: 0 });
    expect(result.success).toBe(true);
  });

  it("kum oranı sıfırdan büyükken parçacık ayrıntıları zorunludur", () => {
    const result = SolidsDataSchema.safeParse({ sandRateKgDay: 5, sandPpmw: 10 });
    expect(result.success).toBe(false);
  });

  it("kum oranı sıfırdan büyük ve tüm parçacık ayrıntıları verilmişse geçerlidir", () => {
    const result = SolidsDataSchema.safeParse({
      sandRateKgDay: 5,
      sandPpmw: 10,
      particleDiameterUm: 150,
      particleDensityKgM3: 2650,
      particleShapeFactor: 0.5,
    });
    expect(result.success).toBe(true);
  });
});
