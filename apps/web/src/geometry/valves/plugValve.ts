// apps/web/src/geometry/valves/plugValve.ts
//
// Tapa vana (plug valve). Tapa, konik bir gövdedir (CylinderGeometry'nin
// doğal Y ekseni zaten tapanın KENDİ konikleşme/mil ekseni — hizalama
// gerekmez), ORTASINDAN TEK bir CSG çıkarmasıyla (valveHelpers.ts::
// cutThroughAxis) port deliği açılır. ballValve.ts ile AYNI Y-ekseni-
// etrafında-90° kapalı→açık sözleşimi: kapalı pozda port deliği Z boyunca
// (akışa DİK), +90° dönüşle X'e (akışa PARALEL) hizalanır.

import { CylinderGeometry, Vector3 } from "three";
import type { ComponentType, PressureClass } from "@erocorr3d/engine";
import { buildTubeAlongFrames } from "../helpers";
import type { LodLevel } from "../types";
import {
  BODY_CLASS_THICKNESS_FACTOR,
  VALVE_VISUAL_RATIOS,
  buildAxisCylinderGeometry,
  buildAxisTubeFrames,
  buildDamageZone,
  buildSeatRingGeometry,
  computePartPoseForOpening,
  cutAxisPort,
  cutThroughAxis,
  finalizePartGeometry,
  resolveBoreRadiusM,
  resolveValveSegments,
  rotatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValvePart } from "./types";
import { buildStraightFlowPath } from "./gateValve";

export interface PlugValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);

export function createPlugValve(params: PlugValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore * 0.85;
  const stemPortRadiusM = boreRadiusM * 0.4;
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore;

  // ── BODY ──────────────────────────────────────────────────────────────
  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyWithPort = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(0, 0, 0),
    radiusM: stemPortRadiusM,
    reachM: bodyOuterRadiusM * 1.6,
    overlapM: boreRadiusM * 0.5,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithPort);

  // ── TAPA (plug) — konik, ortasından port delikli ──────────────────────────
  const plugHeightM = bodyOuterRadiusM * 1.3;
  const plugTopRadiusM = boreRadiusM * 1.05;
  const plugBottomRadiusM = boreRadiusM * 0.75;
  const plugPortRadiusM = boreRadiusM * 0.82;
  const plugGeo = new CylinderGeometry(plugTopRadiusM, plugBottomRadiusM, plugHeightM, Math.max(20, segRadial), 1, false);
  const plugWithPort = cutThroughAxis(plugGeo, { axis: "Z", crossPointM: new Vector3(0, 0, 0), radiusM: plugPortRadiusM, halfLengthM: plugTopRadiusM * 2 });
  const plugGeometry = finalizePartGeometry(plugWithPort);

  // ── MİL + SALMASTRA ──────────────────────────────────────────────────────
  const plugTopM = plugHeightM / 2;
  const stemLengthM = bodyOuterRadiusM * 1.5 + bodyOuterRadiusM * 0.3 - plugTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, plugTopM, 0), lengthM: Math.max(stemLengthM, boreRadiusM * 0.4), radiusM: stemRadiusM, radialSegments: trimSegments }),
  );
  const packingGeometry = finalizePartGeometry(
    buildSeatRingGeometry({
      flowAxis: Y,
      centerM: new Vector3(0, bodyOuterRadiusM * 1.15, 0),
      ringRadiusM: stemRadiusM * R.packingMajorOverStem,
      tubeRadiusM: boreRadiusM * R.packingTubeRadiusOverBore,
      segments: trimSegments,
    }),
  );

  // ── PİVOT: tapa+mil Y ekseni etrafında +90° ────────────────────────────
  const openValueRad = Math.PI / 2;
  const plugPivot = rotatePivot("PLUG", [0, 1, 0], openValueRad);
  const stemPivot = rotatePivot("STEM", [0, 1, 0], openValueRad);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [buildDamageZone("plug.body_cavity_below_plug", "BODY", 0.55, 0.5, 0.15)] },
    { name: "PLUG", geometry: plugGeometry, pivot: plugPivot, damageZones: [buildDamageZone("plug.port_edge", "PLUG", 0.5, 0, 0.05)] },
    { name: "STEM", geometry: stemGeometry, pivot: stemPivot, damageZones: [] },
    { name: "PACKING", geometry: packingGeometry, pivot: null, damageZones: [] },
  ];

  const currentPose: ValveAssembly["currentPose"] = {};
  for (const part of parts) {
    if (part.pivot) currentPose[part.name] = computePartPoseForOpening(part.pivot, openingPercent);
  }

  const vertexCount = parts.reduce((sum, p) => sum + p.geometry.getAttribute("position").count, 0);
  const triangleCount = parts.reduce((sum, p) => {
    const index = p.geometry.getIndex();
    return sum + (index ? index.count / 3 : p.geometry.getAttribute("position").count / 3);
  }, 0);

  return {
    componentType: "PLUG_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "PLUG_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
