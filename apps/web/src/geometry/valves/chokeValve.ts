// apps/web/src/geometry/valves/chokeValve.ts
//
// Kısıcı (choke) vana — globeValve.ts ile AYNI T-gövde+oturak+dikey-öteleme
// tekniğini kullanır (bkz. o dosyanın başlığı), ANCAK oturak deliği (bean
// orifisi) globe'a göre BELİRGİN ÖLÇÜDE daha DAR tutulur — kısıcının
// KENDİ işlevi (akışı YOĞUN şekilde daraltmak) budur, bu yüzden mansap
// genişleme bölgesi (downstream_expansion) burada AYRI bir hasar bölgesi
// olarak işaretlenir (bkz. damageZones).

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

export type ChokeTrimType = "POSITIVE" | "ADJUSTABLE" | "MULTI_STAGE";

export interface ChokeValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  trimType?: ChokeTrimType;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);

const BEAN_SHAPE: Record<ChokeTrimType, { baseFactor: number; tipFactor: number; heightFactor: number }> = {
  POSITIVE: { baseFactor: 1.2, tipFactor: 0.85, heightFactor: 0.55 },
  ADJUSTABLE: { baseFactor: 1.35, tipFactor: 0.45, heightFactor: 0.9 },
  MULTI_STAGE: { baseFactor: 1.3, tipFactor: 0.6, heightFactor: 1.4 },
};

export function createChokeValve(params: ChokeValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const trimType = params.trimType ?? "ADJUSTABLE";
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore;
  const bonnetPortRadiusM = boreRadiusM * R.bonnetPortOverBore;
  const bonnetHeightM = boreRadiusM * R.bonnetHeightOverBore * 0.85;
  const bonnetOuterRadiusM = boreRadiusM * R.bonnetOuterOverBore * 0.8;
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore;

  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyWithPort = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(-bodyHalfLengthM * 0.15, 0, 0),
    radiusM: bonnetPortRadiusM,
    reachM: bodyOuterRadiusM * 2.3,
    overlapM: boreRadiusM * 0.6,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithPort);

  const beanXM = -bodyHalfLengthM * 0.15;
  const bonnetGeometry = finalizePartGeometry(
    buildBonnetGeometry({
      axisDir: Y,
      originM: new Vector3(beanXM, bodyOuterRadiusM, 0),
      heightM: bonnetHeightM,
      outerRadiusM: bonnetOuterRadiusM,
      innerRadiusM: bonnetPortRadiusM * 0.95,
      segAxial: Math.max(4, Math.round(segAxial / 3)),
      segRadial,
    }),
  );

  const seatYM = boreRadiusM * 0.2;
  const seatHoleRadiusM = bonnetPortRadiusM * 0.3; // kısıcı orifisi — globe'un oturağından BELİRGİN daha dar
  const seatGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: Y, centerM: new Vector3(beanXM, seatYM, 0), ringRadiusM: seatHoleRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore, segments: trimSegments }),
  );

  const shape = BEAN_SHAPE[trimType];
  const beanHeightM = boreRadiusM * shape.heightFactor;
  const beanBaseRadiusM = seatHoleRadiusM * shape.baseFactor;
  const beanTipRadiusM = seatHoleRadiusM * shape.tipFactor;
  const beanGeo = new CylinderGeometry(beanBaseRadiusM, beanTipRadiusM, beanHeightM, trimSegments, 1, false);
  beanGeo.translate(beanXM, seatYM + beanHeightM / 2, 0);
  const beanGeometry = finalizePartGeometry(beanGeo);

  const beanTopM = seatYM + beanHeightM;
  const bonnetTopM = bodyOuterRadiusM + bonnetHeightM;
  const stemLengthM = bonnetTopM + bonnetHeightM * 0.15 - beanTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(beanXM, beanTopM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
  );

  const openValueM = bodyOuterRadiusM - seatYM + bonnetHeightM * 0.6;
  const beanPivot = translatePivot("BEAN", [0, 1, 0], openValueM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], openValueM);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [buildDamageZone("choke.downstream_expansion", "BODY", 0.75, 0.25, 0.15)] },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
    { name: "SEAT_RING", geometry: seatGeometry, pivot: null, damageZones: [buildDamageZone("choke.bean_orifice", "SEAT_RING", 0.4, 0.25, 0.05)] },
    { name: "BEAN", geometry: beanGeometry, pivot: beanPivot, damageZones: [] },
    { name: "STEM", geometry: stemGeometry, pivot: stemPivot, damageZones: [] },
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
    componentType: "CHOKE_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "CHOKE_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
