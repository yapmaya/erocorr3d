// apps/web/tests/projects/ec3dNaNRoundTrip.test.ts
//
// REGRESYON: motorun GERÇEKTEN ürettiği NaN değerleri `.ec3d` gidiş-dönüşünden
// sağ çıkmalıdır. Bu test uydurma veri KULLANMAZ — `assessComponentScenario`'yu
// gerçek girdilerle çalıştırıp çıktısını olduğu gibi dışa/içe aktarır.
//
// Yakalanan hata: CO2 mekanizması erken sonlandığında (co2MolePercent = 0 veya
// waterCutPercent = 0) motor `governingParameters.phUsed = NaN` yazıyor (bkz.
// corrosion/norsokM506.ts::zeroResult). `ec3dSchema.ts` bu alanı katı
// `z.number()` ile doğruladığı için dosya GERİ OKUNAMIYORDU — kullanıcı kendi
// dışa aktardığı projeyi açamıyordu.

import { describe, expect, it } from "vitest";
import { assessComponentScenario, type Geometry, type Mitigation, type OperatingProfile } from "@erocorr3d/engine";
import { buildEc3dFile } from "../../src/features/projects/exportProject";
import { parseEc3dFile } from "../../src/features/projects/importProject";
import { ec3dJsonReplacer } from "../../src/features/projects/ec3dSerialization";
import type { AssessmentRunRecord, ProjectComponentRecord, ProjectRecord } from "../../src/features/projects/types";

const geometry: Geometry = {
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
  locationClass: 1,
  environmentalSensitivity: "MEDIUM",
};

const mitigation: Mitigation = {
  inhibitorUsed: false,
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  cathodicProtection: false,
};

/** CO2 mekanizmasının erken sonlanmasını sağlayan (tamamen olağan) bir senaryo. */
function buildProfile(co2MolePercent: number, waterCutPercent: number): OperatingProfile {
  return {
    designLifeYears: 30,
    corrosionAllowanceMm: 3,
    cases: [
      {
        name: "İşletme",
        description: "Regresyon senaryosu",
        durationDaysPerYear: 365,
        process: {
          pressureBara: 70,
          temperatureC: 40,
          gasMassFlowKgS: 5,
          liquidMassFlowKgS: 0.05,
          waterMassFlowKgS: 0.01,
          gasDensityKgM3: 60,
          liquidDensityKgM3: 900,
          mixtureDensityKgM3: 62,
          gasViscosityPaS: 1.4e-5,
          liquidViscosityPaS: 1e-3,
          superficialGasVelocityMs: 7,
          superficialLiquidVelocityMs: 0.1,
          mixtureVelocityMs: 8,
          liquidHoldupFraction: 0.02,
          flowRegime: "STRATIFIED_WAVY",
          waterCutPercent,
          waterDewpointC: 37,
          hydrocarbonDewpointC: 25,
          // KRİTİK: model yönlendirmesi (corrosion/modelRouter.ts::selectCo2Model)
          // bu alanı `process` içinden okur — NORSOK M-506 dalını seçtiren şey budur.
          isFreeWaterPresent: true,
          ambientTemperatureC: 12,
        },
        chemistry: {
          co2MolePercent,
          h2sPpmMole: 100,
          o2Ppb: 5,
          chlorideMgL: 20000,
          bicarbonateMgL: 200,
          totalDissolvedSolidsMgL: 35000,
          aceticAcidMgL: 0,
          glycolWeightPercent: 0,
          methanolWeightPercent: 0,
          isWaterFeSaturated: false,
          bacteriaPresent: false,
        },
        solids: { sandRateKgDay: 0, sandPpmw: 0 },
      },
    ],
  };
}

function buildPackage(profile: OperatingProfile) {
  const assessment = assessComponentScenario(geometry, mitigation, profile, {}, "L-101");

  const project: ProjectRecord = {
    id: "proj-1",
    name: "Regresyon Projesi",
    client: "Müşteri",
    facility: "Tesis",
    createdBy: "Kullanıcı",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: "0",
  };
  const component: ProjectComponentRecord = {
    id: "comp-1",
    projectId: project.id,
    componentLabel: "L-101",
    componentCategory: "PIPE_FITTING",
    geometry,
    valveGeometry: undefined,
    mitigation,
    operatingProfile: profile,
    activeStep: 1,
    activeCaseIndex: 0,
    uncertainNotes: [],
    updatedAt: Date.now(),
  };
  const run: AssessmentRunRecord = {
    id: "run-1",
    projectId: project.id,
    componentId: component.id,
    componentLabel: "L-101",
    computedAt: Date.now(),
    engineVersion: "0.1.0",
    geometry,
    mitigation,
    operatingProfile: profile,
    assessment,
    uninhibitedAssessment: assessment,
  };
  return buildEc3dFile(project, [component], [run]);
}

function roundTrip(file: ReturnType<typeof buildPackage>) {
  return parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));
}

describe(".ec3d gidiş-dönüşü — motorun ürettiği NaN değerleri", () => {
  it("motor, CO2 = 0 iken governingParameters.phUsed alanına GERÇEKTEN NaN yazar", () => {
    const assessment = assessComponentScenario(geometry, mitigation, buildProfile(0, 20), {}, "L-101");
    const co2 = assessment.perCase[0]!.mechanismResults.find((m) => m.mechanismId === "CO2_SWEET");

    expect(co2).toBeDefined();
    expect(Number.isNaN(co2!.governingParameters.phUsed)).toBe(true);
  });

  it("CO2 = 0 olan bir proje dışa aktarılıp GERİ OKUNABİLİR", () => {
    const result = roundTrip(buildPackage(buildProfile(0, 20)));

    expect(result.ok).toBe(true);
  });

  it("su kesri = 0 olan bir proje dışa aktarılıp GERİ OKUNABİLİR", () => {
    const result = roundTrip(buildPackage(buildProfile(3, 0)));

    expect(result.ok).toBe(true);
  });

  it("NaN, gidiş-dönüş sonrası hâlâ NaN'dır (sessizce 0'a/null'a dönüşmez)", () => {
    const result = roundTrip(buildPackage(buildProfile(0, 20)));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const co2 = result.data.assessmentRuns[0]!.assessment.perCase[0]!.mechanismResults.find(
      (m) => m.mechanismId === "CO2_SWEET",
    );
    expect(Number.isNaN(co2!.governingParameters.phUsed)).toBe(true);
  });

  it("olağan bir ekşi gaz senaryosu (CO2 = 3, su kesri = 20) da geri okunabilir", () => {
    const result = roundTrip(buildPackage(buildProfile(3, 20)));

    expect(result.ok).toBe(true);
  });
});
