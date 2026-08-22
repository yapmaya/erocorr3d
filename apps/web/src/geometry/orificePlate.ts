// apps/web/src/geometry/orificePlate.ts
//
// Kısıcı orifis plakası — sabit dış yarıçaplı (pipeOdMm/2), sabit iç
// yarıçaplı (boreDiaMm/2) İNCE bir halka (washer). Aynı çekirdek tüp
// örgüsüyle (helpers.ts) üretilir — burada "dış duvar" pipeOd'ye, "iç
// duvar" bore deliğine karşılık gelir, "uç halkaları" plakanın ön/arka
// yüzleridir.

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface OrificePlateParams {
  pipeOdMm: number;
  boreDiaMm: number;
  thicknessMm: number;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

const X_AXIS = new Vector3(0, 1, 0);
const Y_AXIS = new Vector3(0, 0, 1);

export function createOrificePlate(params: OrificePlateParams): GeneratedGeometry {
  const { pipeOdMm, boreDiaMm, thicknessMm } = params;
  if (pipeOdMm <= 0 || boreDiaMm <= 0 || thicknessMm <= 0) {
    throw new Error("pipeOdMm, boreDiaMm ve thicknessMm pozitif olmalıdır.");
  }
  if (boreDiaMm >= pipeOdMm) {
    throw new Error("boreDiaMm, pipeOdMm'den küçük olmalıdır.");
  }
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial ?? 2, params.segRadial);

  const outerRadiusM = pipeOdMm / 2 / MM_PER_M;
  const innerRadiusM = boreDiaMm / 2 / MM_PER_M;
  const thicknessM = thicknessMm / MM_PER_M;

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const x = (i / segAxial) * thicknessM;
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
    metadata: buildMetadata("ORIFICE_PLATE", geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
