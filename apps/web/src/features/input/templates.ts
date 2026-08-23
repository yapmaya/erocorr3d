// apps/web/src/features/input/templates.ts
//
// Adım 1'in "hazır şablonlar" özelliği. ÖNEMLİ (KDP ile ilişkisi): buradaki
// sayılar motor sabiti/katsayısı DEĞİLDİR — yalnızca kullanıcının hızlı
// başlayabilmesi için seçilmiş, kaba mertebede TEMSİLİ başlangıç
// değerleridir (tıpkı `fixtures/referenceFacility.ts`'in "Temsili" olarak işaretlediği
// alanlar gibi). Şablon uygulandıktan sonra her alan formda görünür ve
// kullanıcı SAHAYA ÖZGÜ gerçek verisiyle değiştirmesi beklenir; motor
// hesaplaması yalnızca formdaki (kullanıcı onayından geçmiş) son değerleri
// kullanır.

import { getPipe } from "@erocorr3d/engine";
import type { Geometry, Mitigation, OperatingCase } from "@erocorr3d/engine";
import type { WizardDraft } from "./schema";
import { createDefaultOperatingCase } from "./defaultDraft";

export interface WizardTemplate {
  id: string;
  nameTr: string;
  descriptionTr: string;
  apply: () => Pick<WizardDraft, "componentLabel" | "geometry" | "mitigation" | "operatingProfile">;
}

function pipeGeometry(npsIn: number, schedule: string, overrides: Partial<Geometry>): Geometry {
  const pipe = getPipe(npsIn, schedule as Parameters<typeof getPipe>[1]);
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
    locationClass: 1,
    environmentalSensitivity: "MEDIUM",
    ...overrides,
  };
}

interface CaseOverrides {
  name?: string;
  description?: string;
  durationDaysPerYear?: number;
  process?: Partial<OperatingCase["process"]>;
  chemistry?: Partial<OperatingCase["chemistry"]>;
  solids?: Partial<OperatingCase["solids"]>;
}

function withCase(overrides: CaseOverrides): OperatingCase {
  const base = createDefaultOperatingCase(overrides.name ?? "Senaryo 1");
  return {
    ...base,
    ...overrides,
    process: { ...base.process, ...overrides.process },
    chemistry: { ...base.chemistry, ...overrides.chemistry },
    solids: { ...base.solids, ...overrides.solids },
  };
}

const DEFAULT_MITIGATION: Mitigation = {
  inhibitorUsed: false,
  biocideUsed: false,
  o2ScavengerUsed: false,
  internalLining: "NONE",
  cathodicProtection: false,
};

export const WIZARD_TEMPLATES: WizardTemplate[] = [
  {
    id: "wet-gas-gathering",
    nameTr: "Islak Gaz Toplama Hattı",
    descriptionTr: "Serbest su, CO2 ve iz H2S içeren tipik bir gömülü toplama hattı — tatlı (CO2) korozyonu birincil mekanizma.",
    apply: () => ({
      componentLabel: "Islak Gaz Toplama Hattı",
      geometry: pipeGeometry(12, "STD", { installation: "BURIED" }),
      mitigation: { ...DEFAULT_MITIGATION, inhibitorUsed: true, inhibitorAvailabilityPercent: 90, inhibitorEfficiencyPercent: 60, cathodicProtection: true, externalCoating: "3LPE" },
      operatingProfile: {
        designLifeYears: 20,
        corrosionAllowanceMm: 3,
        cases: [
          withCase({
            name: "Normal İşletme",
            durationDaysPerYear: 365,
            process: { pressureBara: 40, temperatureC: 45, isFreeWaterPresent: true, waterCutPercent: 5, waterDewpointC: 40, flowRegime: "STRATIFIED_WAVY" },
            chemistry: { co2MolePercent: 2, h2sPpmMole: 20, chlorideMgL: 500, bicarbonateMgL: 300 },
          }),
        ],
      },
    }),
  },
  {
    id: "dry-sales-gas",
    nameTr: "Kuru Satış Gazı",
    descriptionTr: "Kurutulmuş, çiy noktasının çok altında sıcaklıkla taşınan satış gazı hattı — kuru gaz kuralınca korozif değildir.",
    apply: () => ({
      componentLabel: "Kuru Satış Gazı Hattı",
      geometry: pipeGeometry(16, "STD", { installation: "ABOVE_GROUND" }),
      mitigation: DEFAULT_MITIGATION,
      operatingProfile: {
        designLifeYears: 25,
        corrosionAllowanceMm: 1.5,
        cases: [
          withCase({
            name: "Normal İşletme",
            durationDaysPerYear: 365,
            process: { pressureBara: 70, temperatureC: 25, isFreeWaterPresent: false, waterCutPercent: 0, waterDewpointC: -20, flowRegime: "MIST" },
            chemistry: { co2MolePercent: 0.5, h2sPpmMole: 0 },
          }),
        ],
      },
    }),
  },
  {
    id: "condensing-water",
    nameTr: "Yoğuşan Su Hattı",
    descriptionTr: "Akışkan sıcaklığının su çiy noktasına yakın/altında olduğu, boru üstünde yoğuşan su filminin oluştuğu hat (TLC riski).",
    apply: () => ({
      componentLabel: "Yoğuşan Su Hattı",
      geometry: pipeGeometry(8, "STD", {}),
      mitigation: DEFAULT_MITIGATION,
      operatingProfile: {
        designLifeYears: 20,
        corrosionAllowanceMm: 3,
        cases: [
          withCase({
            name: "Normal İşletme",
            durationDaysPerYear: 365,
            process: { pressureBara: 20, temperatureC: 30, isFreeWaterPresent: true, waterCutPercent: 2, waterDewpointC: 32, flowRegime: "STRATIFIED_SMOOTH" },
            chemistry: { co2MolePercent: 3, aceticAcidMgL: 50, bicarbonateMgL: 100 },
          }),
        ],
      },
    }),
  },
  {
    id: "seawater",
    nameTr: "Deniz Suyu Hattı",
    descriptionTr: "Tek fazlı (sıvı) havalandırılmış deniz suyu hattı — yüksek klorür ve çözünmüş oksijen, katodik koruma + dış kaplama tipiktir.",
    apply: () => ({
      componentLabel: "Deniz Suyu Hattı",
      geometry: pipeGeometry(10, "STD", { installation: "BURIED" }),
      mitigation: { ...DEFAULT_MITIGATION, biocideUsed: true, cathodicProtection: true, externalCoating: "3LPE" },
      operatingProfile: {
        designLifeYears: 20,
        corrosionAllowanceMm: 3,
        cases: [
          withCase({
            name: "Normal İşletme",
            durationDaysPerYear: 365,
            process: {
              pressureBara: 10,
              temperatureC: 20,
              isFreeWaterPresent: true,
              waterCutPercent: 100,
              waterDewpointC: 20,
              gasMassFlowKgS: 0,
              liquidMassFlowKgS: 0,
              waterMassFlowKgS: 50,
              // Not: bu hat tek fazlıdır (yalnızca deniz suyu) — FlowRegimeEnum çok-fazlı akış
              // için tanımlıdır, tek fazlı sıvı için en yakın (ama tam karşılığı olmayan) seçenek "BUBBLE"dır.
              flowRegime: "BUBBLE",
            },
            chemistry: { chlorideMgL: 19000, o2Ppb: 8000, totalDissolvedSolidsMgL: 35000 },
          }),
        ],
      },
    }),
  },
  {
    id: "firewater",
    nameTr: "Yangın Suyu Hattı",
    descriptionTr: "Çoğu zaman durgun/yedekte bekleyen, periyodik test edilen sistem — havalandırılmış su ve MIC (mikrobiyolojik korozyon) riski tipiktir.",
    apply: () => ({
      componentLabel: "Yangın Suyu Hattı",
      geometry: pipeGeometry(8, "STD", {}),
      mitigation: { ...DEFAULT_MITIGATION, biocideUsed: true },
      operatingProfile: {
        designLifeYears: 25,
        corrosionAllowanceMm: 3,
        cases: [
          withCase({
            name: "Bekleme (Durgun)",
            durationDaysPerYear: 350,
            process: {
              pressureBara: 8,
              temperatureC: 20,
              isFreeWaterPresent: true,
              waterCutPercent: 100,
              waterDewpointC: 20,
              gasMassFlowKgS: 0,
              liquidMassFlowKgS: 0,
              waterMassFlowKgS: 0.01,
              superficialGasVelocityMs: 0,
              superficialLiquidVelocityMs: 0.01,
              mixtureVelocityMs: 0.01,
              flowRegime: "BUBBLE",
            },
            chemistry: { o2Ppb: 8000, bacteriaPresent: true },
          }),
          withCase({
            name: "Test Çalışması",
            durationDaysPerYear: 15,
            process: {
              pressureBara: 10,
              temperatureC: 20,
              isFreeWaterPresent: true,
              waterCutPercent: 100,
              waterDewpointC: 20,
              gasMassFlowKgS: 0,
              liquidMassFlowKgS: 0,
              waterMassFlowKgS: 30,
              flowRegime: "BUBBLE",
            },
            chemistry: { o2Ppb: 8000, bacteriaPresent: true },
          }),
        ],
      },
    }),
  },
  {
    id: "sandy-wellhead",
    nameTr: "Kum İçeren Kuyu Başı Hattı",
    descriptionTr: "Kuyu başından gelen kumlu, yüksek hızlı çok-fazlı akış — erozyon ve erozyon-korozyon sinerjisi birincil risktir.",
    apply: () => ({
      componentLabel: "Kumlu Kuyu Başı Hattı",
      geometry: pipeGeometry(6, "XS", {}),
      mitigation: { ...DEFAULT_MITIGATION, inhibitorUsed: true, inhibitorAvailabilityPercent: 85, inhibitorEfficiencyPercent: 50 },
      operatingProfile: {
        designLifeYears: 15,
        corrosionAllowanceMm: 4,
        cases: [
          withCase({
            name: "Normal Üretim",
            durationDaysPerYear: 365,
            process: {
              pressureBara: 100,
              temperatureC: 60,
              isFreeWaterPresent: true,
              waterCutPercent: 20,
              waterDewpointC: 55,
              superficialGasVelocityMs: 15,
              superficialLiquidVelocityMs: 1.5,
              mixtureVelocityMs: 16.5,
              flowRegime: "ANNULAR",
            },
            chemistry: { co2MolePercent: 3, h2sPpmMole: 50, chlorideMgL: 2000, bicarbonateMgL: 400 },
            solids: { sandRateKgDay: 50, sandPpmw: 20, particleDiameterUm: 150, particleDensityKgM3: 2650, particleShapeFactor: 0.7 },
          }),
        ],
      },
    }),
  },
];

export function getTemplate(id: string): WizardTemplate | undefined {
  return WIZARD_TEMPLATES.find((t) => t.id === id);
}
