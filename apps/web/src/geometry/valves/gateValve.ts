// apps/web/src/geometry/valves/gateValve.ts
//
// Sürgülü vana (gate valve). Gövde: düz delikli tüp (buildAxisTubeFrames,
// CSG YOK) + üstte TEK bir CSG çıkarmasıyla açılan bonnet boynu deliği
// (cutAxisPort). Sürgü (wedge), REFERANS/KAPALI pozunda deliği TAM
// KAPATACAK şekilde inşa edilir (bkz. types.ts "referans poz" sözleşimi);
// açılırken +Y yönünde bonnet boşluğuna doğru ÖTELENİR (TRANSLATE pivot).
//
// wedgeType: yalnızca GÖRSEL bir varyasyon — SPLIT iki ince plaka+boşluk
// olarak, FLEXIBLE ise SOLID ile aynı ancak biraz daha ince olarak
// modellenir (gerçek esnek-sürgü mekanizması — merkez göbek/yay — bu
// aracın "CAD kalitesi gerekmez" kapsamının dışındadır, bkz. proje talimatı).

import { BoxGeometry, Vector3 } from "three";
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
  buildBonnetGeometry,
  computePartPoseForOpening,
  cutAxisPort,
  finalizePartGeometry,
  mergeNamedGeometries,
  resolveBoreRadiusM,
  resolveValveSegments,
  translatePivot,
  validateOpeningPercent,
} from "./valveHelpers";
import type { ValveAssembly, ValveFlowPathPoint, ValvePart } from "./types";

export type WedgeType = "SOLID" | "FLEXIBLE" | "SPLIT";

export interface GateValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  wedgeType?: WedgeType;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);

export function createGateValve(params: GateValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const wedgeType = params.wedgeType ?? "SOLID";
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

  // ── BONNET ────────────────────────────────────────────────────────────
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

  // ── WEDGE (referans/kapalı pozunda: deliği tam kapatır) ─────────────────
  const wedgeSpanYM = boreRadiusM * 2.15; // delik çapını hafifçe aşar — tam kapama
  const wedgeWidthZM = boreRadiusM * 2.15;
  const wedgeThicknessXM = boreRadiusM * (wedgeType === "SOLID" ? 0.36 : 0.24);
  let wedgeGeometry;
  if (wedgeType === "SPLIT") {
    const plateThicknessM = wedgeThicknessXM * 0.4;
    const gapM = wedgeThicknessXM * 0.35;
    const plateA = boxGeometryAt(plateThicknessM, wedgeSpanYM, wedgeWidthZM, -gapM / 2 - plateThicknessM / 2, 0, 0);
    const plateB = boxGeometryAt(plateThicknessM, wedgeSpanYM, wedgeWidthZM, gapM / 2 + plateThicknessM / 2, 0, 0);
    wedgeGeometry = finalizePartGeometry(mergeNamedGeometries([plateA, plateB]));
  } else {
    wedgeGeometry = finalizePartGeometry(boxGeometryAt(wedgeThicknessXM, wedgeSpanYM, wedgeWidthZM, 0, 0, 0));
  }

  // ── STEM + PACKING ──────────────────────────────────────────────────────
  const wedgeTopM = wedgeSpanYM / 2;
  const bonnetTopM = bodyOuterRadiusM + bonnetHeightM;
  const stemProtrusionM = bonnetHeightM * 0.15;
  const stemLengthM = bonnetTopM + stemProtrusionM - wedgeTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, wedgeTopM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
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

  // ── SEAT RINGS (2 — task'ın kendi "oturma halkaları (2)" listesine göre) ──
  const seatOffsetXM = wedgeThicknessXM / 2 + boreRadiusM * 0.12;
  const seatUpstreamGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(-seatOffsetXM, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore, segments: trimSegments }),
  );
  const seatDownstreamGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(seatOffsetXM, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: boreRadiusM * R.seatTubeRadiusOverBore, segments: trimSegments }),
  );

  // ── PİVOT: sürgü + mil, bonnet boşluğuna doğru +Y ötelenir ───────────────
  const openValueM = bodyOuterRadiusM - wedgeTopM + bonnetHeightM * 0.7;
  const wedgePivot = translatePivot("WEDGE", [0, 1, 0], openValueM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], openValueM);

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: [buildDamageZone("gate.seat_cavity", "BODY", 0.5, 0.25, 0.15)] },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
    { name: "WEDGE", geometry: wedgeGeometry, pivot: wedgePivot, damageZones: [] },
    { name: "STEM", geometry: stemGeometry, pivot: stemPivot, damageZones: [] },
    { name: "PACKING", geometry: packingGeometry, pivot: null, damageZones: [] },
    { name: "SEAT_RING_UPSTREAM", geometry: seatUpstreamGeometry, pivot: null, damageZones: [] },
    {
      name: "SEAT_RING_DOWNSTREAM",
      geometry: seatDownstreamGeometry,
      pivot: null,
      damageZones: [buildDamageZone("gate.downstream_seat", "SEAT_RING_DOWNSTREAM", 0, 0.5, 0.05)],
    },
  ];

  const currentPose: ValveAssembly["currentPose"] = {};
  for (const part of parts) {
    if (part.pivot) currentPose[part.name] = computePartPoseForOpening(part.pivot, openingPercent);
  }

  const flowPath: ValveFlowPathPoint[] = buildStraightFlowPath(bodyHalfLengthM, 5);

  const vertexCount = parts.reduce((sum, p) => sum + p.geometry.getAttribute("position").count, 0);
  const triangleCount = parts.reduce((sum, p) => {
    const index = p.geometry.getIndex();
    return sum + (index ? index.count / 3 : p.geometry.getAttribute("position").count / 3);
  }, 0);

  return {
    componentType: "GATE_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath,
    metadata: { componentKind: "GATE_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}

function boxGeometryAt(width: number, height: number, depth: number, cx: number, cy: number, cz: number) {
  const geo = new BoxGeometry(width, height, depth);
  geo.translate(cx, cy, cz);
  return geo;
}

export function buildStraightFlowPath(bodyHalfLengthM: number, count: number): ValveFlowPathPoint[] {
  const points: ValveFlowPathPoint[] = [];
  for (let i = 0; i < count; i++) {
    const x = -bodyHalfLengthM + (2 * bodyHalfLengthM * i) / (count - 1);
    points.push({ positionM: [x, 0, 0], tangent: [1, 0, 0], relativeSpeedHint: 1 });
  }
  return points;
}
