// apps/web/src/geometry/valves/ballValve.ts
//
// Küresel vana (ball valve). Top, REFERANS/KAPALI pozda deliği AKIŞ EKSENİNE
// (X) DİK (Z boyunca) duracak şekilde inşa edilir; açılırken Y (mil) ekseni
// etrafında +90° döner, delik X'e hizalanır (bkz. valveHelpers.ts::
// buildBallGeometry ve rotatePivot). Bu, gerçek küresel vana çalışma
// prensibiyle BİREBİR örtüşür (çeyrek-tur).
//
// bore="REDUCED": geçiş deliği pipeOD'den küçüktür VE deliğin bir ucu
// hafifçe daralır (V-çentik BENZERİ konik kesim) — task'ın "kenarı akışı
// daraltıyor → hasar bölgesi" notuna karşılık gelir; gerçek V-çentik
// (V-notch) trim'in kesin geometrisi (imalatçıya özgü) KAYNAK GÖSTERİLMEDEN
// iddia edilmez, bu YALNIZCA görsel bir yaklaşıklıktır (bkz. modül başlığı).
//
// HANDLE parçası: top ile BİRLİKTE döner — gerçek küresel vanaların bilinen
// "kolu boruyla aynı hizada = açık" görsel ipucunu VERİR, ayrı bir raycast
// hedefi olarak da faydalıdır.

import { BoxGeometry, Vector3 } from "three";
import type { ComponentType, PressureClass } from "@erocorr3d/engine";
import { buildTubeAlongFrames } from "../helpers";
import type { LodLevel } from "../types";
import {
  BODY_CLASS_THICKNESS_FACTOR,
  VALVE_VISUAL_RATIOS,
  buildAxisCylinderGeometry,
  buildAxisTubeFrames,
  buildBallGeometry,
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

export type BallBoreType = "FULL" | "REDUCED";

export interface BallValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  bore?: BallBoreType;
  lod?: LodLevel;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export function createBallValve(params: BallValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const bore = params.bore ?? "FULL";
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const ballBoreRadiusM = bore === "FULL" ? boreRadiusM * 0.98 : boreRadiusM * 0.72;
  const ballBoreExitRadiusM = bore === "REDUCED" ? ballBoreRadiusM * 0.55 : undefined;
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore * 0.75; // top vanaları gate/globe'a göre daha kısadır
  const ballRadiusM = bodyOuterRadiusM * 0.82;
  const stemPortRadiusM = boreRadiusM * 0.32;
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore;

  // ── BODY (küçük bir mil portu ile — bonnet boşluğu YOKTUR, top yerinde döner) ──
  const bodyFrames = buildAxisTubeFrames({ axis: "X", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: true });
  const bodyWithPort = cutAxisPort(bodyTube, {
    axis: "Y",
    crossPointM: new Vector3(0, 0, 0),
    radiusM: stemPortRadiusM,
    reachM: bodyOuterRadiusM * 1.6,
    overlapM: boreRadiusM * 0.4,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithPort);

  // ── BALL (kapalı pozda delik Z boyunca — akışa DİK) ────────────────────
  const ballGeometry = finalizePartGeometry(
    buildBallGeometry({ ballRadiusM, boreRadiusM: ballBoreRadiusM, boreExitRadiusM: ballBoreExitRadiusM, boreAxisClosed: Z, segments: Math.max(20, segRadial) }),
  );

  // ── OTURMA HALKALARI (2) ─────────────────────────────────────────────────
  const seatOffsetXM = ballRadiusM * 0.55;
  const seatTubeRadiusM = boreRadiusM * R.seatTubeRadiusOverBore;
  const seatUpstream = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(-seatOffsetXM, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: seatTubeRadiusM, segments: trimSegments }),
  );
  const seatDownstream = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: X, centerM: new Vector3(seatOffsetXM, 0, 0), ringRadiusM: boreRadiusM, tubeRadiusM: seatTubeRadiusM, segments: trimSegments }),
  );

  // ── MİL + KOL + SALMASTRA (topla BİRLİKTE Y etrafında döner) ─────────────
  const stemOriginYM = ballRadiusM * 0.35;
  const stemLengthM = bodyOuterRadiusM * 1.3 - stemOriginYM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, stemOriginYM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
  );
  const packingGeometry = finalizePartGeometry(
    buildSeatRingGeometry({
      flowAxis: Y,
      centerM: new Vector3(0, bodyOuterRadiusM * 1.05, 0),
      ringRadiusM: stemRadiusM * R.packingMajorOverStem,
      tubeRadiusM: boreRadiusM * R.packingTubeRadiusOverBore,
      segments: trimSegments,
    }),
  );
  const handleTopM = stemOriginYM + stemLengthM;
  const handleGeo = new BoxGeometry(stemRadiusM * 1.2, stemRadiusM * 0.9, ballBoreRadiusM * 1.8);
  handleGeo.translate(0, handleTopM + stemRadiusM * 0.6, 0);
  const handleGeometry = finalizePartGeometry(handleGeo);

  // ── PİVOT: top+mil+kol Y ekseni etrafında +90° (kapalı→açık) ─────────────
  const openValueRad = Math.PI / 2;
  const ballPivot = rotatePivot("BALL", [0, 1, 0], openValueRad);
  const stemPivot = rotatePivot("STEM", [0, 1, 0], openValueRad);
  const handlePivot = rotatePivot("HANDLE", [0, 1, 0], openValueRad);

  const zonePrefix = bore === "FULL" ? "ballFull" : "ballReduced";
  const seatDamageZones = bore === "FULL" ? [buildDamageZone(`${zonePrefix}.seat_ring`, "SEAT_RING_DOWNSTREAM", 0.5, 0.25, 0.15)] : [];
  const ballDamageZones = bore === "REDUCED" ? [buildDamageZone("ballReduced.v_notch_edge", "BALL", 0.45, 0, 0.05)] : [];
  const bodyDamageZones = bore === "REDUCED" ? [buildDamageZone("ballReduced.downstream_cavity", "BODY", 0.7, 0.25, 0.15)] : [];

  const parts: ValvePart[] = [
    { name: "BODY", geometry: bodyGeometry, pivot: null, damageZones: bodyDamageZones },
    { name: "BALL", geometry: ballGeometry, pivot: ballPivot, damageZones: ballDamageZones },
    { name: "SEAT_RING_UPSTREAM", geometry: seatUpstream, pivot: null, damageZones: [] },
    { name: "SEAT_RING_DOWNSTREAM", geometry: seatDownstream, pivot: null, damageZones: seatDamageZones },
    { name: "STEM", geometry: stemGeometry, pivot: stemPivot, damageZones: [] },
    { name: "HANDLE", geometry: handleGeometry, pivot: handlePivot, damageZones: [] },
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

  const componentType: ComponentType = bore === "FULL" ? "BALL_VALVE_FULL" : "BALL_VALVE_REDUCED";
  return {
    componentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: componentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
