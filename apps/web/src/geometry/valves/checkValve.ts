// apps/web/src/geometry/valves/checkValve.ts
//
// Çekvalf (check valve) — üç alt tip. Gövde, gate/globe'un T-gövdesinden
// FARKLI: harici bir mil/bonnet YOKTUR (çekvalfler akışla kendiliğinden
// çalışır) — bkz. valveHelpers.ts::bulgeProfile ile ORTASI ŞİŞKİN, delikli
// TEK bir tüp (CSG GEREKMEZ), disk/plakaların sallanması/kalkması için
// gerekli boşluğu doğrudan bore'un kendisi genişleyerek sağlar.
//
// `openingPercent` bu vana için OPSİYONELDİR (varsayılan 60) — çekvalfler
// operatör tarafından AYARLANMAZ, akışla açılır; parametre yalnızca
// GÖSTERİM/animasyon kolaylığı içindir (bkz. JSDoc).
//
// SWING/DUAL_PLATE: disk(ler) bir MENTEŞE ekseni etrafında döner —
// pivotPointM (0,0,0)'dan FARKLI olduğu için o parçaların geometrisi
// menteşe noktasına göre (pivot-relative) inşa edilir (bkz. types.ts::
// ValvePivot ve rotatePivot'un pivotPointM parametresi).
// LIFT: disk akış eksenine (X) yaklaşık paralel dar bir MİL üzerinde
// eksene (X) doğru ötelenir (basit eksenel/inline kalkmalı çekvalf tipi —
// globe-paternli lift-check'in S-yolu burada modellenmez, bkz. modül başlığı).
// DUAL_PLATE'in D-şeklindeki gerçek plakaları, zaman/karmaşıklık nedeniyle
// DİKDÖRTGEN bir yaklaşıklıkla (BoxGeometry) temsil edilir — mekanizmayı
// doğru aktarır, CAD hassasiyeti İDDİA ETMEZ (bkz. proje talimatı).

import { BoxGeometry, CylinderGeometry, Vector3 } from "three";
import type { ComponentType, PressureClass } from "@erocorr3d/engine";
import { buildTubeAlongFrames } from "../helpers";
import type { LodLevel } from "../types";
import {
  BODY_CLASS_THICKNESS_FACTOR,
  VALVE_VISUAL_RATIOS,
  alignGeometryAxis,
  buildAxisTubeFrames,
  buildDamageZone,
  buildSeatRingGeometry,
  bulgeProfile,
  computePartPoseForOpening,
  finalizePartGeometry,
  resolveBoreRadiusM,
  resolveValveSegments,
  rotatePivot,
  translatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValvePart } from "./types";
import { buildStraightFlowPath } from "./gateValve";

export type CheckValveType = "SWING" | "LIFT" | "DUAL_PLATE";

export interface CheckValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  type: CheckValveType;
  /** Yalnızca GÖSTERİM amaçlı (bkz. modül başlığı) — varsayılan 60. */
  openingPercent?: number;
  lod?: LodLevel;
}

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const Y = new Vector3(0, 1, 0);
const OPEN_SWING_RAD = (75 * Math.PI) / 180;

export function createCheckValve(params: CheckValveParams): ValveAssembly {
  const { npsIn, pressureClass, type } = params;
  const openingPercent = params.openingPercent ?? 60;
  validateOpeningPercent(openingPercent);
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterBaseRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyOuterBulgeRadiusM = bodyOuterBaseRadiusM * 1.25;
  const boreBulgeRadiusM = boreRadiusM * 1.35;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore * 0.9;

  // ── BODY (ortası şişkin delikli tüp — CSG yok) ──────────────────────────
  const outerRadiusFn = bulgeProfile(bodyOuterBaseRadiusM, bodyOuterBulgeRadiusM, 0.5);
  const boreRadiusFn = bulgeProfile(boreRadiusM, boreBulgeRadiusM, 0.5);
  const frames = buildAxisTubeFrames({ axis: "X", outerRadiusM: outerRadiusFn, boreRadiusM: boreRadiusFn, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyRaw } = buildTubeAlongFrames(frames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyGeometry = finalizePartGeometry(bodyRaw);

  const seatTubeRadiusM = boreRadiusM * R.seatTubeRadiusOverBore;
  const seatRingGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(0, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: seatTubeRadiusM, segments: trimSegments }),
  );

  const discRadiusM = boreRadiusM * 1.05;
  const discThicknessM = boreRadiusM * 0.18;

  let parts: ValvePart[];
  if (type === "SWING") {
    const hingeM = new Vector3(0, discRadiusM, 0);
    const discGeo = new CylinderGeometry(discRadiusM, discRadiusM, discThicknessM, Math.max(20, segRadial), 1, false);
    alignGeometryAxis(discGeo, Y, X);
    discGeo.translate(-hingeM.x, -hingeM.y, -hingeM.z); // menteşe-göreli (pivot-relative)
    const discGeometry = finalizePartGeometry(discGeo);

    const pinGeo = new CylinderGeometry(seatTubeRadiusM * 0.8, seatTubeRadiusM * 0.8, discRadiusM * 2.4, Math.max(8, Math.round(trimSegments / 2)), 1, false);
    alignGeometryAxis(pinGeo, Y, Z);
    pinGeo.translate(hingeM.x, hingeM.y, hingeM.z);
    const hingePinGeometry = finalizePartGeometry(pinGeo);

    const discPivot = rotatePivot("DISC", [0, 0, 1], OPEN_SWING_RAD, [hingeM.x, hingeM.y, hingeM.z]);

    parts = [
      { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [] },
      { name: "SEAT_RING", geometry: seatRingGeometry, pivot: null, damageZones: [buildDamageZone("checkSwing.disc_seat_edge", "SEAT_RING", 0.5, 0, 0.05)] },
      { name: "DISC", geometry: discGeometry, pivot: discPivot, damageZones: [] },
      {
        name: "HINGE_PIN",
        geometry: hingePinGeometry,
        pivot: null,
        damageZones: [buildDamageZone("checkSwing.hinge_pin_area", "HINGE_PIN", 0.4, 0.75, 0.05)],
      },
    ];
  } else if (type === "LIFT") {
    const liftOpenM = boreRadiusM * 1.4;
    const discGeo = new CylinderGeometry(discRadiusM * 0.9, discRadiusM * 0.9, discThicknessM, Math.max(20, segRadial), 1, false);
    alignGeometryAxis(discGeo, Y, X);
    const discGeometry = finalizePartGeometry(discGeo);

    const guideLengthM = boreBulgeRadiusM * 1.6;
    const guideGeo = new CylinderGeometry(seatTubeRadiusM * 0.6, seatTubeRadiusM * 0.6, guideLengthM, Math.max(8, Math.round(trimSegments / 2)), 1, false);
    alignGeometryAxis(guideGeo, Y, X);
    guideGeo.translate(discThicknessM / 2, 0, 0);
    const guideStemGeometry = finalizePartGeometry(guideGeo);

    const discPivot = translatePivot("DISC", [1, 0, 0], liftOpenM);

    parts = [
      { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [] },
      { name: "SEAT_RING", geometry: seatRingGeometry, pivot: null, damageZones: [buildDamageZone("checkLift.disc_seat_edge", "SEAT_RING", 0.5, 0, 0.05)] },
      { name: "DISC", geometry: discGeometry, pivot: discPivot, damageZones: [] },
      {
        name: "GUIDE_STEM",
        geometry: guideStemGeometry,
        pivot: null,
        damageZones: [buildDamageZone("checkLift.guide_bore", "GUIDE_STEM", 0.55, 0.25, 0.05)],
      },
    ];
  } else {
    const halfHeightM = discRadiusM;
    const plateThicknessM = boreRadiusM * 0.16;
    const plateWidthZM = boreRadiusM * 1.9;
    const plateAGeo = new BoxGeometry(plateThicknessM, halfHeightM, plateWidthZM);
    plateAGeo.translate(0, halfHeightM / 2, 0);
    const plateAGeometry = finalizePartGeometry(plateAGeo);
    const plateBGeo = new BoxGeometry(plateThicknessM, halfHeightM, plateWidthZM);
    plateBGeo.translate(0, -halfHeightM / 2, 0);
    const plateBGeometry = finalizePartGeometry(plateBGeo);

    const pinGeo = new CylinderGeometry(seatTubeRadiusM * 0.8, seatTubeRadiusM * 0.8, plateWidthZM * 1.05, Math.max(8, Math.round(trimSegments / 2)), 1, false);
    alignGeometryAxis(pinGeo, Y, Z);
    const centerHingePinGeometry = finalizePartGeometry(pinGeo);

    const plateAPivot = rotatePivot("PLATE_A", [0, 0, 1], -OPEN_SWING_RAD, [0, 0, 0]);
    const plateBPivot = rotatePivot("PLATE_B", [0, 0, 1], OPEN_SWING_RAD, [0, 0, 0]);

    parts = [
      { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [] },
      { name: "SEAT_RING", geometry: seatRingGeometry, pivot: null, damageZones: [buildDamageZone("checkDualPlate.seat_area", "SEAT_RING", 0.5, 0.25, 0.15)] },
      { name: "PLATE_A", geometry: plateAGeometry, pivot: plateAPivot, damageZones: [] },
      { name: "PLATE_B", geometry: plateBGeometry, pivot: plateBPivot, damageZones: [] },
      {
        name: "CENTER_HINGE_PIN",
        geometry: centerHingePinGeometry,
        pivot: null,
        damageZones: [buildDamageZone("checkDualPlate.plate_hinge_area", "CENTER_HINGE_PIN", 0.45, 0.5, 0.15)],
      },
    ];
  }

  const currentPose: ValveAssembly["currentPose"] = {};
  for (const part of parts) {
    if (part.pivot) currentPose[part.name] = computePartPoseForOpening(part.pivot, openingPercent);
  }

  const vertexCount = parts.reduce((sum, p) => sum + p.geometry.getAttribute("position").count, 0);
  const triangleCount = parts.reduce((sum, p) => {
    const index = p.geometry.getIndex();
    return sum + (index ? index.count / 3 : p.geometry.getAttribute("position").count / 3);
  }, 0);

  const componentType: ComponentType = type === "SWING" ? "CHECK_VALVE_SWING" : type === "LIFT" ? "CHECK_VALVE_LIFT" : "CHECK_VALVE_DUAL_PLATE";
  return {
    componentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: componentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
