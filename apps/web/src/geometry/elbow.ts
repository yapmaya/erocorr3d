// apps/web/src/geometry/elbow.ts
//
// Dirsek/bükme — torus dilimi. Merkez çizgisi, bendRadiusMm yarıçaplı bir
// dairesel yay boyunca YEREL X-Y düzleminde ilerler: θ=0'da konum (0,0,0),
// teğet +X; θ arttıkça +Y yönüne doğru kavis yapar (klasik çeyrek-dirsek
// yönelimi). ⚠ v=0 → EXTRADOS (dış yarıçap, bükme merkezinden UZAK taraf),
// v=0,5 → INTRADOS. Bu eşleme SABİTTİR (packages/engine/src/spatial/
// pipeFittings.ts BUNA GÜVENİYOR — bkz. EXTRADOS_V=0/INTRADOS_V=0,5 orada).
// UV: u = bükme boyunca kesir (0-1), v = çevresel (0-1).

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildOrthonormalFrameBasis, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface ElbowParams {
  odMm: number;
  wtMm: number;
  bendRadiusMm: number;
  angleDeg: number;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

export function createElbow(params: ElbowParams): GeneratedGeometry {
  const { odMm, wtMm, bendRadiusMm, angleDeg } = params;
  if (odMm <= 0 || wtMm <= 0 || bendRadiusMm <= 0) {
    throw new Error("odMm, wtMm ve bendRadiusMm pozitif olmalıdır.");
  }
  if (wtMm * 2 >= odMm) {
    throw new Error("Et kalınlığının iki katı, dış çaptan küçük olmalıdır.");
  }
  if (angleDeg <= 0 || angleDeg > 180) {
    throw new Error("angleDeg (0,180] aralığında olmalıdır.");
  }
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial, params.segRadial);

  const outerRadiusM = odMm / 2 / MM_PER_M;
  const innerRadiusM = (odMm / 2 - wtMm) / MM_PER_M;
  const bendRadiusM = bendRadiusMm / MM_PER_M;
  const sweepRad = (angleDeg * Math.PI) / 180;

  const curvatureCenter = new Vector3(0, bendRadiusM, 0);

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const theta = (i / segAxial) * sweepRad;
    const center = curvatureCenter
      .clone()
      .add(new Vector3(Math.sin(theta), -Math.cos(theta), 0).multiplyScalar(bendRadiusM));
    const tangent = new Vector3(Math.cos(theta), Math.sin(theta), 0);
    const radialOut = center.clone().sub(curvatureCenter).normalize(); // extrados yönü
    const { xAxis, yAxis } = buildOrthonormalFrameBasis(tangent, radialOut);
    frames.push({ center, xAxis, yAxis, outerRadiusM, innerRadiusM });
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
    metadata: buildMetadata("ELBOW", geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
