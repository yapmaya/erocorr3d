// apps/web/src/features/results/charts/tornadoData.ts
//
// Tornado (E) — motorun `uncertainty/tornado.ts::computeTornadoAnalysis`
// fonksiyonunu (bugüne kadar HİÇBİR çağıranı olmayan, ama tam işlevsel
// jenerik bir "one-at-a-time duyarlılık" motoru) GERÇEK NORSOK M-506
// hesabına bağlar. `modelFn`, her çağrıda `buildNorsokM506InputFromCase`
// (bkz. corrosion/norsokM506.ts — mechanismRunners.ts'in NORSOK dalıyla TEK
// doğruluk kaynağı) + `computeNorsokM506Rate`'i YENİDEN çalıştırır — sahte/
// basitleştirilmiş bir "gölge model" İCAT EDİLMEZ.
//
// KAPSAM (bkz. onaylı plan'ın kapsam kararı #5): yalnızca CO2 (tatlı)
// korozyonu/NORSOK M-506 için çalışır — uygulamanın birincil, en iyi
// desteklenen mekanizması. CO2 mol yüzdesi 0 ise (mekanizma yapısal olarak
// devre dışı) `null` döner.

import {
  buildNorsokM506InputFromCase,
  computeNorsokM506Rate,
  computeSharedWallShearStressPa,
  computeTornadoAnalysis,
  type Geometry,
  type Mitigation,
  type OperatingCase,
  type TornadoAnalysisResult,
} from "@erocorr3d/engine";

export const TORNADO_PARAMETER_LABELS_TR: Record<string, string> = {
  temperatureC: "Sıcaklık (°C)",
  pressureBara: "Basınç (bara)",
  co2MolePercent: "CO2 Mol Yüzdesi (%)",
  wallShearStressPa: "Duvar Kayma Gerilmesi (Pa)",
  chlorideMgL: "Klorür (mg/L)",
  bicarbonateMgL: "Bikarbonat (mg/L)",
};

export interface TornadoBuildInput {
  geometry: Geometry;
  mitigation: Mitigation;
  operatingCase: OperatingCase;
}

function buildBaseInputs(input: TornadoBuildInput): Record<string, number> {
  const wallShearStressPa = computeSharedWallShearStressPa(input.geometry, input.operatingCase.process);
  const inputs: Record<string, number> = {
    temperatureC: input.operatingCase.process.temperatureC,
    pressureBara: input.operatingCase.process.pressureBara,
    co2MolePercent: input.operatingCase.chemistry.co2MolePercent,
    wallShearStressPa,
  };
  // Klorür/bikarbonat yalnızca pH ÖLÇÜLMEMİŞSE (kimyadan hesaplanıyorsa) modeli ETKİLER —
  // bkz. buildNorsokM506InputFromCase'in aynı dallanması. pH ölçülmüşse bu iki parametrenin
  // gerçek etkisi 0'dır — tornado'ya EKLENMEZ (sıfır etkiyi "düşük etki" gibi göstermek yanıltıcı olurdu).
  if (input.operatingCase.chemistry.phMeasured === undefined) {
    inputs.chlorideMgL = input.operatingCase.chemistry.chlorideMgL;
    inputs.bicarbonateMgL = input.operatingCase.chemistry.bicarbonateMgL;
  }
  return inputs;
}

function buildModelFn(input: TornadoBuildInput): (perturbed: Readonly<Record<string, number>>) => number {
  return (perturbed) => {
    const modifiedCase: OperatingCase = {
      ...input.operatingCase,
      process: {
        ...input.operatingCase.process,
        temperatureC: perturbed.temperatureC,
        pressureBara: perturbed.pressureBara,
      },
      chemistry: {
        ...input.operatingCase.chemistry,
        co2MolePercent: perturbed.co2MolePercent,
        chlorideMgL: perturbed.chlorideMgL ?? input.operatingCase.chemistry.chlorideMgL,
        bicarbonateMgL: perturbed.bicarbonateMgL ?? input.operatingCase.chemistry.bicarbonateMgL,
      },
    };
    const norsokInput = buildNorsokM506InputFromCase(input.mitigation, modifiedCase, perturbed.wallShearStressPa);
    return computeNorsokM506Rate(norsokInput).rateMmPerYear.p50;
  };
}

export function buildTornadoData(input: TornadoBuildInput): TornadoAnalysisResult | null {
  if (input.operatingCase.chemistry.co2MolePercent <= 0) return null;
  const baseInputs = buildBaseInputs(input);
  const modelFn = buildModelFn(input);
  return computeTornadoAnalysis({ baseInputs, modelFn });
}
