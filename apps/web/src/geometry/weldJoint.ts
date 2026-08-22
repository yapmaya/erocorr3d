// apps/web/src/geometry/weldJoint.ts
//
// Kaynak dikişi — orta noktada (u=0,5) bir Gauss tümseği kadar dış yarıçapı
// ARTIRAN (kaynak kapağı, capHeight) VE iç yarıçapı AZALTAN (kök nüfuziyeti,
// rootPenetration) kısa bir boru parçası. Yalnızca GÖRSELLEŞTİRME amaçlıdır
// — gerçek bir kaynak prosedürü/WPS verisi DEĞİLDİR, beadWidthMm varsayılanı
// da (wtMm×3) saf görsel bir orandır, KDP kapsamı DIŞINDADIR.

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface WeldJointParams {
  odMm: number;
  wtMm: number;
  lengthMm: number;
  capHeightMm: number;
  rootPenetrationMm: number;
  /** Kaynak tümseğinin eksenel genişliği — varsayılan wtMm×3 (görsel oran, mühendislik verisi değil). */
  beadWidthMm?: number;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

const X_AXIS = new Vector3(0, 1, 0);
const Y_AXIS = new Vector3(0, 0, 1);

export function createWeldJoint(params: WeldJointParams): GeneratedGeometry {
  const { odMm, wtMm, lengthMm, capHeightMm, rootPenetrationMm } = params;
  if (odMm <= 0 || wtMm <= 0 || lengthMm <= 0) {
    throw new Error("odMm, wtMm ve lengthMm pozitif olmalıdır.");
  }
  if (wtMm * 2 >= odMm) {
    throw new Error("Et kalınlığının iki katı, dış çaptan küçük olmalıdır.");
  }
  if (capHeightMm < 0 || rootPenetrationMm < 0) {
    throw new Error("capHeightMm ve rootPenetrationMm negatif olamaz.");
  }
  const beadWidthMm = params.beadWidthMm ?? wtMm * 3;
  if (beadWidthMm <= 0) {
    throw new Error("beadWidthMm pozitif olmalıdır.");
  }
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial, params.segRadial);

  const baseOuterRadiusM = odMm / 2 / MM_PER_M;
  const baseInnerRadiusM = (odMm / 2 - wtMm) / MM_PER_M;
  const lengthM = lengthMm / MM_PER_M;
  const capHeightM = capHeightMm / MM_PER_M;
  const rootPenetrationM = rootPenetrationMm / MM_PER_M;
  const beadSigmaM = beadWidthMm / MM_PER_M / 2;
  const midXM = lengthM / 2;

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const x = (i / segAxial) * lengthM;
    const bumpFactor = Math.exp(-0.5 * ((x - midXM) / beadSigmaM) ** 2);
    const outerRadiusM = baseOuterRadiusM + capHeightM * bumpFactor;
    const innerRadiusM = Math.max(baseInnerRadiusM - rootPenetrationM * bumpFactor, 0.001);
    frames.push({ center: new Vector3(x, 0, 0), xAxis: X_AXIS.clone(), yAxis: Y_AXIS.clone(), outerRadiusM, innerRadiusM });
  }

  const { geometry, regionVertexCounts } = buildTubeAlongFrames(frames, {
    radialSegments: segRadial,
    capStart: true,
    capEnd: true,
  });
  allocateDamageAttribute(geometry);

  return {
    geometry,
    uvMap: createFrameSequenceUvMap(frames),
    metadata: buildMetadata("WELD_JOINT", geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
