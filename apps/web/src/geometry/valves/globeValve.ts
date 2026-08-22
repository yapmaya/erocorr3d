// apps/web/src/geometry/valves/globeValve.ts
//
// ⚠ S-ŞEKİLLİ AKIŞ YOLU: gövde, gateValve.ts ile AYNI "T-gövde" tekniğini
// (düz delikli tüp + TEK CSG dallanma-portu çıkarması) kullanır — ana yatay
// delik (X) ile dikey bonnet portu (Y) TEK bir bağlı boşluk oluşturur (bkz.
// valveHelpers.ts::cutAxisPort'un "port merkezi zaten boş delik içinde"
// notu). Gerçek fiziksel ayrım (giriş/çıkış odalarının doğrudan
// BİRLEŞMEMESİ) bu basitleştirilmiş CAD-olmayan modelde YOKTUR — akışın
// "yukarı çıkıp geri inmesi" gerekliliği, tapa/oturak halkasının TAM
// olarak dikey port ekseninde, gövde ortasında konumlandırılmasıyla
// TEMSİL EDİLİR (jet çarpma bölgesi bu yüzden oturağın hemen mansabında,
// port/bonnet boşluğunun duvarında yer alır — bkz. damageZones).
//
// trimType SADECE tapa/tıpanın GÖRSEL şeklini değiştirir (PLUG=geniş konik,
// NEEDLE=ince/sivri, CAGE=daha silindirik) — gerçek kafes (cage) trim'in
// pencereli yapısı createControlValveCage'de TAM olarak modellenmiştir;
// globe'un "CAGE" seçeneği burada yalnızca bir GÖRSEL yaklaşıklıktır.

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

export type GlobeTrimType = "PLUG" | "NEEDLE" | "CAGE";

export interface GlobeValveParams {
  npsIn: number;
  pressureClass: PressureClass;
  openingPercent: number;
  trimType?: GlobeTrimType;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);

const TRIM_SHAPE: Record<GlobeTrimType, { baseFactor: number; tipFactor: number; heightFactor: number }> = {
  PLUG: { baseFactor: 1.35, tipFactor: 0.5, heightFactor: 0.9 },
  NEEDLE: { baseFactor: 1.1, tipFactor: 0.05, heightFactor: 1.3 },
  CAGE: { baseFactor: 1.5, tipFactor: 0.9, heightFactor: 0.6 },
};

export function createGlobeValve(params: GlobeValveParams): ValveAssembly {
  const { npsIn, pressureClass, openingPercent } = params;
  validateOpeningPercent(openingPercent);
  const trimType = params.trimType ?? "PLUG";
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

  // ── BODY (T-gövde, gate ile aynı teknik) ────────────────────────────────
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

  // ── OTURMA HALKASI (seat) — dikey port ekseninde, gövde ortasında ────────
  const seatYM = boreRadiusM * 0.25;
  const seatHoleRadiusM = bonnetPortRadiusM * 0.55;
  const seatTubeRadiusM = boreRadiusM * R.seatTubeRadiusOverBore;
  const seatGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: Y, centerM: new Vector3(0, seatYM, 0), ringRadiusM: seatHoleRadiusM, tubeRadiusM: seatTubeRadiusM, segments: trimSegments }),
  );

  // ── TAPA/TIPA (plug) — kapalı pozda ucu tam oturak deliğinde ─────────────
  const shape = TRIM_SHAPE[trimType];
  const plugHeightM = boreRadiusM * shape.heightFactor;
  const plugBaseRadiusM = seatHoleRadiusM * shape.baseFactor;
  const plugTipRadiusM = seatHoleRadiusM * shape.tipFactor;
  const plugTipYM = seatYM;
  const plugGeo = new CylinderGeometry(plugBaseRadiusM, plugTipRadiusM, plugHeightM, trimSegments, 1, false);
  plugGeo.translate(0, plugTipYM + plugHeightM / 2, 0);
  const plugGeometry = finalizePartGeometry(plugGeo);

  // ── MİL + SALMASTRA ──────────────────────────────────────────────────────
  const plugTopM = plugTipYM + plugHeightM;
  const bonnetTopM = bodyOuterRadiusM + bonnetHeightM;
  const stemProtrusionM = bonnetHeightM * 0.15;
  const stemLengthM = bonnetTopM + stemProtrusionM - plugTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, plugTopM, 0), lengthM: stemLengthM, radiusM: stemRadiusM, radialSegments: trimSegments }),
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

  // ── PİVOT: tapa+mil bonnet boşluğuna doğru +Y ötelenir ────────────────────
  const openValueM = bodyOuterRadiusM - plugTipYM + bonnetHeightM * 0.7;
  const plugPivot = translatePivot("PLUG", [0, 1, 0], openValueM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], openValueM);

  const parts: ValvePart[] = [
    {
      name: "BODY",
      geometry: bodyGeometry,
      pivot: null,
      damageZones: [buildDamageZone("globe.downstream_seat", "BODY", 0.65, 0.25, 0.05)],
    },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
    {
      name: "SEAT_RING",
      geometry: seatGeometry,
      pivot: null,
      damageZones: [buildDamageZone("globe.plug_seat_contact", "SEAT_RING", 0.5, 0.25, 0.05)],
    },
    { name: "PLUG", geometry: plugGeometry, pivot: plugPivot, damageZones: [] },
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
    componentType: "GLOBE_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath: buildStraightFlowPath(bodyHalfLengthM, 5),
    metadata: { componentKind: "GLOBE_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
