// apps/web/src/geometry/valves/controlValveCage.ts
//
// Kafesli (cage-trim) kontrol vanası. Gövde gate/globe ile AYNI T-tekniği;
// asıl fark KAFES (cage) parçasıdır — ince duvarlı bir silindir kabuk
// (buildAxisTubeFrames+buildTubeAlongFrames, CSG YOK) üzerine `cageWindows`
// adet dikdörtgen pencere CSG ile AÇILIR (valveHelpers.ts::cutBoxWindows).
// PİSTON (plug), kafesin İÇİNDE dikey eksende kayarak pencereleri KADEMELİ
// olarak açar/kapatır — klasik kafes-trim kontrol vanası çalışma prensibi.

import { CylinderGeometry, Vector3 } from "three";
import type { ComponentType, PressureClass } from "@erocorr3d/engine";
import { buildTubeAlongFrames } from "../helpers";
import type { LodLevel } from "../types";
import {
  BODY_CLASS_THICKNESS_FACTOR,
  VALVE_VISUAL_RATIOS,
  buildAxisCylinderGeometry,
  buildAxisTubeFrames,
  buildBonnetGeometry,
  buildDamageZone,
  buildSeatRingGeometry,
  computePartPoseForOpening,
  cutAxisPort,
  cutBoxWindows,
  finalizePartGeometry,
  resolveBoreRadiusM,
  resolveValveSegments,
  translatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValvePart } from "./types";
import { buildStraightFlowPath } from "./gateValve";

export interface ControlValveCageParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  /** Kafes çevresindeki pencere sayısı (tipik 3-8). */
  cageWindows?: number;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);

export function createControlValveCage(params: ControlValveCageParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const cageWindows = Math.max(2, Math.round(params.cageWindows ?? 4));
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore;
  const bonnetPortRadiusM = boreRadiusM * R.bonnetPortOverBore;
  const bonnetHeightM = boreRadiusM * R.bonnetHeightOverBore;
  const bonnetOuterRadiusM = boreRadiusM * R.bonnetOuterOverBore;
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore;

  // ── BODY ──────────────────────────────────────────────────────────────
  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyWithPort = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(0, 0, 0),
    radiusM: bonnetPortRadiusM,
    reachM: bodyOuterRadiusM * 2.5,
    overlapM: boreRadiusM * 0.6,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithPort);

  const bonnetGeometry = finalizePartGeometry(
    buildBonnetGeometry({
      axisDir: Y,
      originM: new Vector3(0, bodyOuterRadiusM, 0),
      heightM: bonnetHeightM,
      outerRadiusM: bonnetOuterRadiusM,
      innerRadiusM: bonnetPortRadiusM * 0.95,
      segAxial: Math.max(4, Math.round(segAxial / 3)),
      segRadial,
    }),
  );

  // ── KAFES (cage) — pencereli ince duvarlı silindir ──────────────────────
  const cageCenterYM = boreRadiusM * 1.0;
  const cageHeightM = boreRadiusM * 2.2;
  const cageOuterRadiusM = bonnetPortRadiusM * 0.9;
  const cageInnerRadiusM = cageOuterRadiusM * 0.72;
  const cageWallM = cageOuterRadiusM - cageInnerRadiusM;

  const cageFrames = buildAxisTubeFrames({ axis: "Y", outerRadiusM: cageOuterRadiusM, boreRadiusM: cageInnerRadiusM, halfLengthM: cageHeightM / 2, segAxial: Math.max(4, Math.round(segAxial / 3)) });
  const { geometry: cageRaw } = buildTubeAlongFrames(cageFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  cageRaw.translate(0, cageCenterYM, 0);
  const windowHeightM = cageHeightM * 0.5;
  const windowWidthM = cageOuterRadiusM * 1.05;
  const windows = Array.from({ length: cageWindows }, (_, i) => {
    const angle = (i / cageWindows) * Math.PI * 2;
    const radialDir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    return { centerM: radialDir.clone().multiplyScalar(cageOuterRadiusM).add(new Vector3(0, cageCenterYM, 0)), radialDir, widthM: windowWidthM, heightM: windowHeightM, thicknessM: cageWallM * 2.4 };
  });
  const cageWithWindows = cutBoxWindows(cageRaw, windows);
  const cageGeometry = finalizePartGeometry(cageWithWindows);

  // ── PİSTON (plug) — kafes içinde dikey kayar, kapalıyken pencereleri örter ─
  const pistonHeightM = cageHeightM * 0.58;
  const pistonRadiusM = cageInnerRadiusM * 0.92;
  const pistonGeo = new CylinderGeometry(pistonRadiusM, pistonRadiusM, pistonHeightM, Math.max(16, segRadial), 1, false);
  pistonGeo.translate(0, cageCenterYM, 0);
  const pistonGeometry = finalizePartGeometry(pistonGeo);

  // ── OTURMA HALKASI (kafes tabanında) ─────────────────────────────────────
  const seatYM = cageCenterYM - cageHeightM / 2;
  const seatGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: Y, centerM: new Vector3(0, seatYM, 0), ringRadiusM: cageInnerRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore, segments: trimSegments }),
  );

  // ── MİL + SALMASTRA ──────────────────────────────────────────────────────
  const pistonTopM = cageCenterYM + pistonHeightM / 2;
  const bonnetTopM = bodyOuterRadiusM + bonnetHeightM;
  const stemLengthM = bonnetTopM + bonnetHeightM * 0.15 - pistonTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, pistonTopM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
  );
  const packingGeometry = finalizePartGeometry(
    buildSeatRingGeometry({
      flowAxis: Y,
      centerM: new Vector3(0, bonnetTopM - bonnetHeightM * 0.1, 0),
      ringRadiusM: stemRadiusM * R.packingMajorOverStem,
      tubeRadiusM: boreRadiusM * R.packingTubeRadiusOverBore,
      segments: trimSegments,
    }),
  );

  // ── PİVOT: piston(+mil) 0=pencereleri örter(aşağı) → 100=tamamen açar(yukarı) ──
  const openValueM = cageHeightM * 0.6;
  const pistonPivot = translatePivot("PISTON", [0, 1, 0], openValueM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], openValueM);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [buildDamageZone("controlCage.downstream_cage", "BODY", 0.65, 0.25, 0.15)] },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
    { name: "CAGE", geometry: cageGeometry, pivot: null, damageZones: [buildDamageZone("controlCage.cage_window_edges", "CAGE", 0.5, 0.25, 0.05)] },
    { name: "PISTON", geometry: pistonGeometry, pivot: pistonPivot, damageZones: [] },
    { name: "SEAT_RING", geometry: seatGeometry, pivot: null, damageZones: [] },
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
    componentType: "CONTROL_VALVE_CAGE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "CONTROL_VALVE_CAGE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
