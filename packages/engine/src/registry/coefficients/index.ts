// packages/engine/src/registry/coefficients/index.ts
//
// Tüm mekanizma modüllerinin katsayılarını tek bir listede birleştirir.
// Bu dosya yalnızca VERİ toplar — kayıt defterine yazma işlemi (yan etki)
// registry/index.ts içinde yapılır.

import type { Coefficient } from "../types";
import { NORSOK_COEFFICIENTS } from "./norsok";
import { NORSOK_PH_COEFFICIENTS } from "./norsokPh";
import { SHARED_COEFFICIENTS } from "./shared";
import { DEWAARD_COEFFICIENTS } from "./deWaard";
import { DNV_O501_COEFFICIENTS } from "./dnvO501";
import { API14E_COEFFICIENTS } from "./api14e";
import { MATERIALS_COEFFICIENTS } from "./materials";
import { VALVES_COEFFICIENTS } from "./valves";
import { TLC_COEFFICIENTS } from "./tlc";
import { NATURAL_GAS_COMPONENTS_COEFFICIENTS } from "./naturalGasComponents";
import { PR_EOS_COEFFICIENTS } from "./prEos";
import { FRICTION_COEFFICIENTS } from "./friction";
import { WATER_PROPERTIES_COEFFICIENTS } from "./waterProperties";
import { VISCOSITY_COEFFICIENTS } from "./viscosity";
import { FLOW_REGIME_COEFFICIENTS } from "./flowRegime";
import { TULSA_ECRC_COEFFICIENTS } from "./tulsaEcrc";
import { DROPLET_EROSION_COEFFICIENTS } from "./dropletErosion";
import { H2S_COEFFICIENTS } from "./h2s";
import { OXYGEN_COEFFICIENTS } from "./oxygen";
import { MIC_COEFFICIENTS } from "./mic";
import { UDC_COEFFICIENTS } from "./udc";
import { PITTING_CREVICE_CSCC_COEFFICIENTS } from "./pittingCreviceCscc";
import { CUI_COEFFICIENTS } from "./cui";
import { EXTERNAL_ENVIRONMENT_COEFFICIENTS } from "./externalEnvironment";
import { GALVANIC_COEFFICIENTS } from "./galvanic";
import { SYNERGY_COEFFICIENTS } from "./synergy";
import { METAL_LOSS_COEFFICIENTS } from "./metalLoss";
import { CTL_ATL_COEFFICIENTS } from "./ctlAtl";
import { MATERIAL_SELECTION_COEFFICIENTS } from "./materialSelection";
import { UNCERTAINTY_COEFFICIENTS } from "./uncertainty";
import { SPATIAL_COEFFICIENTS } from "./spatial";
import { B31G_COEFFICIENTS } from "./b31g";

export const ALL_COEFFICIENTS: Coefficient[] = [
  ...NORSOK_COEFFICIENTS,
  ...NORSOK_PH_COEFFICIENTS,
  ...SHARED_COEFFICIENTS,
  ...DEWAARD_COEFFICIENTS,
  ...DNV_O501_COEFFICIENTS,
  ...API14E_COEFFICIENTS,
  ...MATERIALS_COEFFICIENTS,
  ...VALVES_COEFFICIENTS,
  ...TLC_COEFFICIENTS,
  ...NATURAL_GAS_COMPONENTS_COEFFICIENTS,
  ...PR_EOS_COEFFICIENTS,
  ...FRICTION_COEFFICIENTS,
  ...WATER_PROPERTIES_COEFFICIENTS,
  ...VISCOSITY_COEFFICIENTS,
  ...FLOW_REGIME_COEFFICIENTS,
  ...TULSA_ECRC_COEFFICIENTS,
  ...DROPLET_EROSION_COEFFICIENTS,
  ...H2S_COEFFICIENTS,
  ...OXYGEN_COEFFICIENTS,
  ...MIC_COEFFICIENTS,
  ...UDC_COEFFICIENTS,
  ...PITTING_CREVICE_CSCC_COEFFICIENTS,
  ...CUI_COEFFICIENTS,
  ...EXTERNAL_ENVIRONMENT_COEFFICIENTS,
  ...GALVANIC_COEFFICIENTS,
  ...SYNERGY_COEFFICIENTS,
  ...METAL_LOSS_COEFFICIENTS,
  ...CTL_ATL_COEFFICIENTS,
  ...MATERIAL_SELECTION_COEFFICIENTS,
  ...UNCERTAINTY_COEFFICIENTS,
  ...SPATIAL_COEFFICIENTS,
  ...B31G_COEFFICIENTS,
];

export * from "./norsok";
export * from "./norsokPh";
export * from "./shared";
export * from "./deWaard";
export * from "./dnvO501";
export * from "./api14e";
export * from "./materials";
export * from "./valves";
export * from "./tlc";
export * from "./naturalGasComponents";
export * from "./prEos";
export * from "./friction";
export * from "./waterProperties";
export * from "./viscosity";
export * from "./flowRegime";
export * from "./tulsaEcrc";
export * from "./dropletErosion";
export * from "./h2s";
export * from "./oxygen";
export * from "./mic";
export * from "./udc";
export * from "./pittingCreviceCscc";
export * from "./cui";
export * from "./externalEnvironment";
export * from "./galvanic";
export * from "./synergy";
export * from "./metalLoss";
export * from "./ctlAtl";
export * from "./materialSelection";
export * from "./uncertainty";
export * from "./spatial";
