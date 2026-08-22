// apps/web/src/geometry/valves/butterflyValve.ts
//
// Kelebek vana — "wafer" (ince) gövde, disk merkezden geçen dikey milin
// (Y) etrafında döner. KAPALI referans pozunda diskin YÜZ NORMALİ akış
// eksenine (X) hizalıdır (yüzey düzlemi YZ — akışı TAM kapatır); +90°
// dönüşle yüz normali -Z'ye döner (düzlem ~XY, akışa PARALEL — açık).
// Bu, ballValve.ts ile AYNI Y-ekseni-etrafında-90° sözleşimidir (tutarlılık).
//
// discType SADECE mil ekseninin gövde merkezine göre GÖRSEL bir ofsetini
// değiştirir (dış-merkezli/üçlü-ofset tiplerin gerçek imalatçıya-özgü ofset
// değerleri KAYNAK GÖSTERİLMEDEN iddia edilmez — bkz. modül başlığı).

import { CylinderGeometry, Vector3 } from "three";
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
  computePartPoseForOpening,
  cutAxisPort,
  finalizePartGeometry,
  resolveBoreRadiusM,
  resolveValveSegments,
  rotatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValvePart } from "./types";
import { buildStraightFlowPath } from "./gateValve";

export type ButterflyDiscType = "CONCENTRIC" | "ECCENTRIC" | "TRIPLE_OFFSET";

export interface ButterflyValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  discType?: ButterflyDiscType;
  lod?: LodLevel;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);

const SHAFT_OFFSET_FACTOR: Record<ButterflyDiscType, number> = { CONCENTRIC: 0, ECCENTRIC: 0.12, TRIPLE_OFFSET: 0.2 };

export function createButterflyValve(params: ButterflyValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const discType = params.discType ?? "CONCENTRIC";
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * 0.45; // wafer gövde — çok kısa
  const shaftPortRadiusM = boreRadiusM * 0.22;
  const shaftRadiusM = boreRadiusM * R.stemRadiusOverBore;
  const discThicknessM = boreRadiusM * 0.22;
  const discRadiusM = boreRadiusM * 1.02;
  const shaftXOffsetM = boreRadiusM * SHAFT_OFFSET_FACTOR[discType];

  // ── BODY (wafer, üst+alt mil portları) ──────────────────────────────────
  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial: 8 });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyTop = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(shaftXOffsetM, 0, 0),
    radiusM: shaftPortRadiusM,
    reachM: bodyOuterRadiusM * 1.4,
    overlapM: boreRadiusM * 0.4,
    sign: 1,
  });
  const bodyBoth = cutAxisPort(bodyTop, {
    axis: "Y",
    crossPointM: new Vector3(shaftXOffsetM, 0, 0),
    radiusM: shaftPortRadiusM,
    reachM: bodyOuterRadiusM * 1.4,
    overlapM: boreRadiusM * 0.4,
    sign: -1,
  });
  const bodyGeometry = finalizePartGeometry(bodyBoth);

  // ── DİSK (kapalı referans pozunda yüz normali X'e hizalı) ────────────────
  const discGeo = new CylinderGeometry(discRadiusM, discRadiusM, discThicknessM, Math.max(20, segRadial), 1, false);
  alignGeometryAxis(discGeo, Y, X);
  discGeo.translate(shaftXOffsetM, 0, 0);
  const discGeometry = finalizePartGeometry(discGeo);

  // ── MİL (üstten alta, disk merkezinden geçer) ────────────────────────────
  const shaftHalfLengthM = bodyOuterRadiusM * 1.5;
  const shaftGeo = new CylinderGeometry(shaftRadiusM, shaftRadiusM, shaftHalfLengthM * 2, trimSegments, 1, false);
  shaftGeo.translate(shaftXOffsetM, 0, 0);
  const shaftGeometry = finalizePartGeometry(shaftGeo);

  // ── OTURAK ASTARI (seat liner) ───────────────────────────────────────────
  const seatLinerGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(0, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore, segments: trimSegments }),
  );

  // ── PİVOT: disk+mil Y ekseni etrafında +90° ───────────────────────────────
  const openValueRad = Math.PI / 2;
  const discPivot = rotatePivot("DISC", [0, 1, 0], openValueRad);
  const shaftPivot = rotatePivot("SHAFT", [0, 1, 0], openValueRad);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [buildDamageZone("butterfly.downstream_disc", "BODY", 0.65, 0.25, 0.15)] },
    { name: "DISC", geometry: discGeometry, pivot: discPivot, damageZones: [] },
    { name: "SHAFT", geometry: shaftGeometry, pivot: shaftPivot, damageZones: [] },
    {
      name: "SEAT_LINER",
      geometry: seatLinerGeometry,
      pivot: null,
      damageZones: [buildDamageZone("butterfly.disc_edge_seat", "SEAT_LINER", 0.5, 0, 0.05)],
    },
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
    componentType: "BUTTERFLY_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "BUTTERFLY_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
