// apps/web/src/geometry/straightPipe.ts
//
// Düz boru — en basit ve TÜM diğer üreticilerin paylaştığı çekirdek örgü
// altyapısının (helpers.ts) referans kullanımı.
//
// Yerel eksen sözleşimi: boru ekseni YEREL +X boyunca uzanır, kesit YZ
// düzlemindedir. v=0 yönü = +Y ("saat 12", proje talimatının kendi
// sözleşimi). v artışı +Y'den +Z'ye doğrudur (sağ-elli, xAxis×yAxis=+X=ileri).
// UV: u=eksenel (0=giriş, 1=çıkış), v=çevresel (0-1, 0≡saat12).

import { Vector3 } from "three";
import { allocateDamageAttribute, buildMetadata, buildTubeAlongFrames, createFrameSequenceUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface StraightPipeParams {
  odMm: number;
  wtMm: number;
  lengthMm: number;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

const X_AXIS = new Vector3(0, 1, 0); // v=0 yönü ("saat12")
const Y_AXIS = new Vector3(0, 0, 1);

export function createStraightPipe(params: StraightPipeParams): GeneratedGeometry {
  const { odMm, wtMm, lengthMm } = params;
  if (odMm <= 0 || wtMm <= 0 || lengthMm <= 0) {
    throw new Error("odMm, wtMm ve lengthMm pozitif olmalıdır.");
  }
  if (wtMm * 2 >= odMm) {
    throw new Error("Et kalınlığının iki katı, dış çaptan küçük olmalıdır (pozitif iç çap gerekir).");
  }
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial, params.segRadial);

  const outerRadiusM = odMm / 2 / MM_PER_M;
  const innerRadiusM = (odMm / 2 - wtMm) / MM_PER_M;
  const lengthM = lengthMm / MM_PER_M;

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const x = (i / segAxial) * lengthM;
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
    metadata: buildMetadata("STRAIGHT_PIPE", geometry, regionVertexCounts, params.lod ?? "medium"),
  };
}
