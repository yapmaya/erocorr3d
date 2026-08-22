// apps/web/src/features/input/defaultDraft.ts
//
// Boş/başlangıç sihirbaz taslağı. Buradaki sayılar motor sabiti/katsayısı
// DEĞİLDİR (KDP kapsamı dışı) — yalnızca formun geçerli bir başlangıç
// durumuyla açılması için seçilmiş, kaba mertebede TEMSİLİ form
// varsayılanlarıdır; kullanıcı her alanı kendi verisiyle değiştirir.

import { getPipe } from "@erocorr3d/engine";
import type { Geometry, Mitigation, OperatingCase, OperatingProfile, ValveGeometry } from "@erocorr3d/engine";
import type { WizardDraft } from "./schema";

const DEFAULT_NPS_INCH = 6;
const DEFAULT_SCHEDULE = "STD";

export function createDefaultGeometry(): Geometry {
  const pipe = getPipe(DEFAULT_NPS_INCH, DEFAULT_SCHEDULE);
  return {
    componentType: "STRAIGHT_PIPE",
    npsInch: pipe.nps,
    schedule: pipe.schedule,
    odMm: pipe.odMm,
    wallThicknessMm: pipe.wallThicknessMm,
    idMm: pipe.idMm,
    lengthMm: 3000,
    orientation: "HORIZONTAL",
    roughnessMm: 0.045,
    installation: "ABOVE_GROUND",
    isInsulated: false,
  };
}

/** valveGeometry başlangıç değerleri — kcFactor/flFactor/xtFactor gibi alanlar KABA form
 * varsayılanlarıdır, üretici test verisiyle güncellenmelidir (bkz. bu alanların ⓘ metni). */
export function createDefaultValveGeometry(): ValveGeometry {
  return {
    ...createDefaultGeometry(),
    componentType: "GATE_VALVE",
    pressureClass: 300,
    bodyStyle: "Standart",
    trimType: "STANDARD",
    seatMaterial: "Karbon Çeliği",
    trimMaterial: "316 Paslanmaz Çelik",
    cvRated: 100,
    flFactor: 0.9,
    xtFactor: 0.7,
    kcFactor: 0.3,
    openingPercent: 100,
    flowDirection: "OVER_SEAT",
    stemType: "Standart",
    packingType: "PTFE",
    bodyCavityVolumeMl: 500,
  };
}

export function createDefaultMitigation(): Mitigation {
  return {
    inhibitorUsed: false,
    biocideUsed: false,
    o2ScavengerUsed: false,
    internalLining: "NONE",
    cathodicProtection: false,
  };
}

export function createDefaultOperatingCase(name: string): OperatingCase {
  return {
    name,
    description: "",
    durationDaysPerYear: 365,
    process: {
      pressureBara: 50,
      temperatureC: 40,
      gasMassFlowKgS: 2,
      liquidMassFlowKgS: 0.5,
      waterMassFlowKgS: 0,
      gasDensityKgM3: 45,
      liquidDensityKgM3: 750,
      mixtureDensityKgM3: 50,
      gasViscosityPaS: 1.2e-5,
      liquidViscosityPaS: 3e-4,
      superficialGasVelocityMs: 5,
      superficialLiquidVelocityMs: 0.3,
      mixtureVelocityMs: 5.3,
      liquidHoldupFraction: 0.05,
      flowRegime: "STRATIFIED_WAVY",
      waterCutPercent: 0,
      waterDewpointC: -10,
      hydrocarbonDewpointC: -5,
      isFreeWaterPresent: false,
      ambientTemperatureC: 20,
    },
    chemistry: {
      co2MolePercent: 0,
      h2sPpmMole: 0,
      o2Ppb: 0,
      chlorideMgL: 0,
      bicarbonateMgL: 0,
      totalDissolvedSolidsMgL: 0,
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
    },
    solids: {
      sandRateKgDay: 0,
      sandPpmw: 0,
    },
  };
}

export function createDefaultOperatingProfile(): OperatingProfile {
  return {
    designLifeYears: 20,
    corrosionAllowanceMm: 3,
    cases: [createDefaultOperatingCase("Senaryo 1")],
  };
}

export function createBlankDraft(): WizardDraft {
  return {
    id: crypto.randomUUID(),
    componentLabel: "Yeni Bileşen",
    componentCategory: "PIPE_FITTING",
    geometry: createDefaultGeometry(),
    valveGeometry: undefined,
    mitigation: createDefaultMitigation(),
    operatingProfile: createDefaultOperatingProfile(),
    activeStep: 1,
    activeCaseIndex: 0,
    uncertainNotes: [],
    updatedAt: Date.now(),
  };
}
