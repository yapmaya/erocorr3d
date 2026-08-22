// apps/web/src/geometry/valves/psv.ts
//
// Basınç emniyet vanası (PSV). Diğer 9 vanadan FARKLI olarak ANA GÖVDE
// EKSENİ DİKEYDİR (Y — giriş nozulü ALTTA, kapak/yay gövdesi ÜSTTE) ve
// ÇIKIŞ, yan taraftan (X) TEK bir CSG portu ile açılır (bkz. valveHelpers.ts
// ::cutAxisPort — gate/globe'un dikey bonnet portuyla AYNI teknik, sadece
// ana eksen ve port ekseni YER DEĞİŞTİRİR). Bu, gerçek "açı paternli"
// (angle pattern) PSV gövdesinin (giriş alt-dikey, çıkış yan-yatay, disk/
// yay üstte) DOĞRU bir basitleştirmesidir.
//
// `openingPercent` OPSİYONELDİR (varsayılan 0 — normal çalışmada PSV
// KAPALIDIR) — yalnızca GÖSTERİM/kalkma (lift) animasyonu içindir, gerçek
// bir set-basıncı hesaplaması YAPILMAZ (bkz. proje: bu KDP kapsamı DIŞI
// bir geometri/görselleştirme modülüdür).

import { CylinderGeometry, TorusGeometry, Vector3 } from "three";
import type { ComponentType, PressureClass } from "@erocorr3d/engine";
import { buildTubeAlongFrames } from "../helpers";
import type { LodLevel } from "../types";
import {
  BODY_CLASS_THICKNESS_FACTOR,
  VALVE_VISUAL_RATIOS,
  alignGeometryAxis,
  buildAxisCylinderGeometry,
  buildAxisTubeFrames,
  buildBonnetGeometry,
  buildDamageZone,
  buildSeatRingGeometry,
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

export interface PsvParams {
  npsIn: number;
  pressureClass: PressureClass;
  /** Varsayılan 0 — bkz. modül başlığı. */
  openingPercent?: number;
  lod?: LodLevel;
}

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export function createPSV(params: PsvParams): ValveAssembly {
  const { npsIn, pressureClass } = params;
  const openingPercent = params.openingPercent ?? 0;
  validateOpeningPercent(openingPercent);
  const R = VALVE_VISUAL_RATIOS;
  const classFactor = BODY_CLASS_THICKNESS_FACTOR[pressureClass];
  const { segAxial, segRadial, trimSegments } = resolveValveSegments(params.lod);

  const boreRadiusM = resolveBoreRadiusM(npsIn);
  const bodyOuterRadiusM = boreRadiusM * R.bodyOuterOverBore * classFactor;
  const bodyHalfLengthM = boreRadiusM * R.bodyHalfLengthOverBore * 1.1; // dikey gövde yarı-yüksekliği
  const outletPortRadiusM = boreRadiusM * 0.9;
  const outletYM = -bodyHalfLengthM * 0.15;
  const nozzleYM = -bodyHalfLengthM * 0.6;
  const bonnetHeightM = boreRadiusM * R.bonnetHeightOverBore;
  const bonnetOuterRadiusM = bodyOuterRadiusM * 0.85;

  // ── BODY (dikey — alt uç kapalı/flanş yüzü, üst uç açık/kapak oturur) ────
  const bodyFrames = buildAxisTubeFrames({ axis: "Y", outerRadiusM: bodyOuterRadiusM, boreRadiusM, halfLengthM: bodyHalfLengthM, segAxial });
  const { geometry: bodyTube } = buildTubeAlongFrames(bodyFrames, { radialSegments: segRadial, capStart: true, capEnd: false });
  const bodyWithOutlet = cutAxisPort(bodyTube, {
    axis: "X",
    crossPointM: new Vector3(0, outletYM, 0),
    radiusM: outletPortRadiusM,
    reachM: bodyOuterRadiusM * 2.5,
    overlapM: boreRadiusM * 0.6,
  });
  const bodyGeometry = finalizePartGeometry(bodyWithOutlet);

  // ── NOZUL/OTURAK ──────────────────────────────────────────────────────
  const nozzleRingRadiusM = boreRadiusM * 0.6;
  const nozzleTubeRadiusM = boreRadiusM * R.seatTubeRadiusOverBore;
  const nozzleGeometry = finalizePartGeometry(
    buildSeatRingGeometry({ flowAxis: Y, centerM: new Vector3(0, nozzleYM, 0), ringRadiusM: nozzleRingRadiusM, tubeRadiusM: nozzleTubeRadiusM, segments: trimSegments }),
  );

  // ── DİSK (kapalı pozda nozul üzerinde oturur) ────────────────────────────
  const discRadiusM = nozzleRingRadiusM * 1.3;
  const discThicknessM = boreRadiusM * 0.22;
  const discCenterYM = nozzleYM + nozzleTubeRadiusM + discThicknessM / 2;
  const discGeo = new CylinderGeometry(discRadiusM, discRadiusM, discThicknessM, Math.max(16, segRadial), 1, false);
  discGeo.translate(0, discCenterYM, 0);
  const discGeometry = finalizePartGeometry(discGeo);

  // ── MİL (disk üstünden yay/kılavuz bölgesine) ────────────────────────────
  const stemRadiusM = boreRadiusM * R.stemRadiusOverBore * 0.7;
  const discTopM = discCenterYM + discThicknessM / 2;
  const stemLengthM = bodyHalfLengthM + bonnetHeightM * 0.5 - discTopM;
  const stemGeometry = finalizePartGeometry(
    buildAxisCylinderGeometry({ axisDir: Y, originM: new Vector3(0, discTopM, 0), lengthM: Math.max(stemLengthM, boreRadiusM * 0.3), radiusM: stemRadiusM, radialSegments: trimSegments }),
  );

  // ── YAY (spring) — üst üste dizilmiş torus'larla KABA bir bobin yaklaşıklığı ──
  const coilCount = 5;
  const coilBottomM = discTopM + boreRadiusM * 0.15;
  const coilTopM = bodyHalfLengthM + bonnetHeightM * 0.35;
  const coilRadiusM = boreRadiusM * 0.55;
  const coilTubeRadiusM = boreRadiusM * 0.08;
  const coilGeometries = Array.from({ length: coilCount }, (_, i) => {
    const y = coilBottomM + ((coilTopM - coilBottomM) * i) / (coilCount - 1);
    const geo = new TorusGeometry(coilRadiusM, coilTubeRadiusM, Math.max(6, Math.round(trimSegments / 2)), Math.max(10, trimSegments));
    alignGeometryAxis(geo, Z, Y);
    geo.translate(0, y, 0);
    return geo;
  });
  const springGeometry = finalizePartGeometry(mergeNamedGeometries(coilGeometries));

  // ── KAPAK (bonnet/cap) ────────────────────────────────────────────────
  const bonnetGeometry = finalizePartGeometry(
    buildBonnetGeometry({
      axisDir: Y,
      originM: new Vector3(0, bodyHalfLengthM, 0),
      heightM: bonnetHeightM,
      outerRadiusM: bonnetOuterRadiusM,
      innerRadiusM: boreRadiusM * 0.85,
      segAxial: Math.max(4, Math.round(segAxial / 3)),
      segRadial,
    }),
  );

  // ── PİVOT: disk+mil YUKARI kalkar (lift) ──────────────────────────────────
  const liftOpenM = boreRadiusM * 0.55;
  const discPivot = translatePivot("DISC", [0, 1, 0], liftOpenM);
  const stemPivot = translatePivot("STEM", [0, 1, 0], liftOpenM);

  const parts: ValvePart[] = [
    {
      name: "BODY",
      geometry: bodyGeometry,
      pivot: null,
      damageZones: [buildDamageZone("psv.downstream_outlet_elbow", "BODY", 0.85, 0, 0.15)],
    },
    { name: "NOZZLE", geometry: nozzleGeometry, pivot: null, damageZones: [buildDamageZone("psv.nozzle_seat_disc", "NOZZLE", 0.5, 0.25, 0.05)] },
    { name: "DISC", geometry: discGeometry, pivot: discPivot, damageZones: [] },
    { name: "STEM", geometry: stemGeometry, pivot: stemPivot, damageZones: [] },
    { name: "SPRING", geometry: springGeometry, pivot: null, damageZones: [] },
    { name: "BONNET", geometry: bonnetGeometry, pivot: null, damageZones: [] },
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

  // Akış yolu: girişten (alt) yukarı nozula, sonra yan çıkışa (+X) doğru bükülür.
  const flowPath: ValveFlowPathPoint[] = [
    { positionM: [0, -bodyHalfLengthM, 0], tangent: [0, 1, 0], relativeSpeedHint: 1 },
    { positionM: [0, nozzleYM, 0], tangent: [0, 1, 0], relativeSpeedHint: 1.4 },
    { positionM: [0, outletYM, 0], tangent: [0.5, 0.5, 0], relativeSpeedHint: 1.2 },
    { positionM: [bodyOuterRadiusM * 1.5, outletYM, 0], tangent: [1, 0, 0], relativeSpeedHint: 1 },
  ];

  return {
    componentType: "PRESSURE_SAFETY_VALVE" as ComponentType,
    parts,
    currentPose,
    flowPath,
    metadata: { componentKind: "PRESSURE_SAFETY_VALVE" as ComponentType, partNames: parts.map((p) => p.name), vertexCount, triangleCount, lod: params.lod ?? "medium" },
  };
}
