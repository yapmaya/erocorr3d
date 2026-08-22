// apps/web/src/geometry/miterBend.ts
//
// Gönye (miter) bükme — `segments` adet DÜZ boru parçasının, aralarındaki
// yönü ikiye bölen (bisector) düzlemlerden KESİLİP birleştirilmesiyle
// gerçek imalat pratiğine uygun şekilde üretilir (bkz. aşağıdaki türetim).
// bendRadiusMm YALNIZCA referans eğrinin (eklem noktalarının üzerine
// oturtulduğu) boyutunu belirler — elbow.ts'teki AYNI extrados/intrados
// (v=0/v=0,5) sözleşimini KORUR (packages/engine/src/erosion/dnvO501.ts'in
// dirsek modelini gönye bükmeler için de YENİDEN KULLANMASIYLA — bkz.
// computeMiterBendErosionRate — TUTARLI).

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildOrthonormalFrameBasis, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface MiterBendParams {
  odMm: number;
  wtMm: number;
  bendRadiusMm: number;
  angleDeg: number;
  /** Düz parça sayısı — eklem sayısı = segments-1, kesit (frame) sayısı = segments+1. */
  segments: number;
  segRadial?: number;
  lod?: LodLevel;
}

export function createMiterBend(params: MiterBendParams): GeneratedGeometry {
  const { odMm, wtMm, bendRadiusMm, angleDeg, segments } = params;
  if (odMm <= 0 || wtMm <= 0 || bendRadiusMm <= 0) {
    throw new Error("odMm, wtMm ve bendRadiusMm pozitif olmalıdır.");
  }
  if (wtMm * 2 >= odMm) {
    throw new Error("Et kalınlığının iki katı, dış çaptan küçük olmalıdır.");
  }
  if (angleDeg <= 0 || angleDeg > 180) {
    throw new Error("angleDeg (0,180] aralığında olmalıdır.");
  }
  if (segments < 1 || !Number.isInteger(segments)) {
    throw new Error("segments pozitif bir tam sayı olmalıdır.");
  }
  const { segRadial } = resolveSegments(params.lod, undefined, params.segRadial);

  const outerRadiusM = odMm / 2 / MM_PER_M;
  const innerRadiusM = (odMm / 2 - wtMm) / MM_PER_M;
  const bendRadiusM = bendRadiusMm / MM_PER_M;
  const sweepRad = (angleDeg * Math.PI) / 180;
  const curvatureCenter = new Vector3(0, bendRadiusM, 0);

  // Referans eğri üzerindeki eklem NOKTALARI (elbow.ts ile AYNI P(θ) formülü).
  const jointPoints: Vector3[] = [];
  for (let j = 0; j <= segments; j++) {
    const theta = (j / segments) * sweepRad;
    jointPoints.push(
      curvatureCenter.clone().add(new Vector3(Math.sin(theta), -Math.cos(theta), 0).multiplyScalar(bendRadiusM)),
    );
  }

  const pieceDirections: Vector3[] = [];
  for (let k = 0; k < segments; k++) {
    pieceDirections.push(jointPoints[k + 1].clone().sub(jointPoints[k]).normalize());
  }

  const frames: TubeFrame[] = [];
  for (let j = 0; j <= segments; j++) {
    const tangent =
      j === 0
        ? pieceDirections[0]
        : j === segments
          ? pieceDirections[segments - 1]
          : pieceDirections[j - 1].clone().add(pieceDirections[j]).normalize();
    const radialOut = jointPoints[j].clone().sub(curvatureCenter).normalize();
    const { xAxis, yAxis } = buildOrthonormalFrameBasis(tangent, radialOut);
    frames.push({ center: jointPoints[j], xAxis, yAxis, outerRadiusM, innerRadiusM });
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
    metadata: buildMetadata("MITER_BEND", geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
