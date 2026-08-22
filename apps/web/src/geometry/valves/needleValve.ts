// apps/web/src/geometry/valves/needleValve.ts
//
// İğne vana (needle valve) — globeValve.ts'in KÜÇÜLTÜLMÜŞ, DAHA SİVRİ
// uçlu bir varyantı gibi düşünülebilir: AYNI T-gövde + dikey-öteleme
// tekniği, ANCAK tapa yerine İNCE/SİVRİ bir iğne ucu ve KÜÇÜK bir konik
// oturak kullanır (hassas debi ayarına uygun, tipik olarak KÜÇÜK NPS'de
// kullanılan bir vana tipi — bkz. modül gövde oranları).

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
  finalizePartGeometry,
  resolveBoreRadiusM,
  resolveValveSegments,
  translatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValvePart } from "./types";
import { buildStraightFlowPath } from "./gateValve";

export interface NeedleValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);

export function createNeedleValve(params: NeedleValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor * 0.9;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore * 0.75;
  const bonnetPortRadiusM = boreRadiusM * 0.65; // globe'a göre DAHA DAR — ince mil/iğne
  const bonnetHeightM = boreRadiusM * R.bonnetHeightOverBore * 0.9;
  const bonnetOuterRadiusM = boreRadiusM * R.bonnetOuterOverBore * 0.7;
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore * 0.8;

  // ── BODY ──────────────────────────────────────────────────────────────
  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyWithPort = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(0, 0, 0),
    radiusM: bonnetPortRadiusM,
    reachM: bodyOuterRadiusM * 2.4,
    overlapM: boreRadiusM * 0.5,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithPort);

  const bonnetGeometry = finalizePartGeometry(
    buildBonnetGeometry({
      axisDir: Y,
      originM: new Vector3(0, bodyOuterRadiusM, 0),
      heightM: bonnetHeightM,
      outerRadiusM: bonnetOuterRadiusM,
      innerRadiusM: bonnetPortRadiusM * 0.9,
      segAxial: Math.max(4, Math.round(segAxial / 3)),
      segRadial,
    }),
  );

  // ── KÜÇÜK KONİK OTURAK ────────────────────────────────────────────────
  const seatYM = boreRadiusM * 0.15;
  const seatHoleRadiusM = bonnetPortRadiusM * 0.25;
  const seatGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: Y, centerM: new Vector3(0, seatYM, 0), ringRadiusM: seatHoleRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore * 0.7, segments: trimSegments }),
  );

  // ── İĞNE (needle) — kapalı pozda ucu tam oturakta ──────────────────────
  const needleHeightM = boreRadiusM * 1.1;
  const needleGeo = new CylinderGeometry(seatHoleRadiusM * 1.4, seatHoleRadiusM * 0.04, needleHeightM, trimSegments, 1, false);
  needleGeo.translate(0, seatYM + needleHeightM / 2, 0);
  const needleGeometry = finalizePartGeometry(needleGeo);

  // ── MİL + SALMASTRA ──────────────────────────────────────────────────────
  const needleTopM = seatYM + needleHeightM;
  const bonnetTopM = bodyOuterRadiusM + bonnetHeightM;
  const stemLengthM = bonnetTopM + bonnetHeightM * 0.2 - needleTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, needleTopM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
  );
  const packingGeometry = finalizePartGeometry(
    buildSeatRingGeometry({
      flowAxis: Y,
      centerM: new Vector3(0, bonnetTopM - bonnetHeightM * 0.1, 0),
      ringRadiusM: stemRadiusM * R.packingMajorOverStem,
      tubeRadiusM: boreRadiusM * R.packingTubeRadiusOverBore * 0.8,
      segments: trimSegments,
    }),
  );

  // ── PİVOT ─────────────────────────────────────────────────────────────
  const openValueM = bodyOuterRadiusM - seatYM + bonnetHeightM * 0.55;
  const needlePivot = translatePivot("NEEDLE", [0, 1, 0], openValueM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], openValueM);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [] },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
    { name: "SEAT", geometry: seatGeometry, pivot: null, damageZones: [buildDamageZone("needle.tip_seat", "SEAT", 0.5, 0.25, 0.05)] },
    { name: "NEEDLE", geometry: needleGeometry, pivot: needlePivot, damageZones: [] },
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
    componentType: "NEEDLE_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "NEEDLE_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
