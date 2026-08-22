// apps/web/src/geometry/reducer.ts
//
// Redüksiyon — dış/iç yarıçapı eksenel olarak od1→od2 arasında DOĞRUSAL
// değiştiren bir tüp (bkz. helpers.ts, taper destekleyen aynı çekirdek örgü).
// type="ECCENTRIC" iken kesit merkezleri, ALT (v=0,5, bkz. straightPipe.ts'in
// v=0="saat12" sözleşimi) tarafı DÜZ (flat-bottom, drenaj için yaygın
// endüstri pratiği) kalacak şekilde YUKARI kaydırılır — CONCENTRIC'te
// merkez ekseni sabittir.

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export type ReducerType = "CONCENTRIC" | "ECCENTRIC";

export interface ReducerParams {
  od1Mm: number;
  od2Mm: number;
  wt1Mm: number;
  wt2Mm: number;
  lengthMm: number;
  type?: ReducerType;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

const X_AXIS = new Vector3(0, 1, 0);
const Y_AXIS = new Vector3(0, 0, 1);

export function createReducer(params: ReducerParams): GeneratedGeometry {
  const { od1Mm, od2Mm, wt1Mm, wt2Mm, lengthMm } = params;
  if (od1Mm <= 0 || od2Mm <= 0 || wt1Mm <= 0 || wt2Mm <= 0 || lengthMm <= 0) {
    throw new Error("Tüm ölçüler pozitif olmalıdır.");
  }
  if (wt1Mm * 2 >= od1Mm || wt2Mm * 2 >= od2Mm) {
    throw new Error("Et kalınlığının iki katı, ait olduğu dış çaptan küçük olmalıdır.");
  }
  const type = params.type ?? "CONCENTRIC";
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial, params.segRadial);

  const outerRadius1M = od1Mm / 2 / MM_PER_M;
  const outerRadius2M = od2Mm / 2 / MM_PER_M;
  const innerRadius1M = (od1Mm / 2 - wt1Mm) / MM_PER_M;
  const innerRadius2M = (od2Mm / 2 - wt2Mm) / MM_PER_M;
  const lengthM = lengthMm / MM_PER_M;
  const bottomYM = -outerRadius1M; // ECCENTRIC için sabit "düz alt" referansı (büyük uca göre)

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const t = i / segAxial;
    const x = t * lengthM;
    const outerRadiusM = outerRadius1M + (outerRadius2M - outerRadius1M) * t;
    const innerRadiusM = innerRadius1M + (innerRadius2M - innerRadius1M) * t;
    const y = type === "ECCENTRIC" ? bottomYM + outerRadiusM : 0;
    frames.push({ center: new Vector3(x, y, 0), xAxis: X_AXIS.clone(), yAxis: Y_AXIS.clone(), outerRadiusM, innerRadiusM });
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
    metadata: buildMetadata(`REDUCER_${type}`, geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
