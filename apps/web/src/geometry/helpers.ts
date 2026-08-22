// apps/web/src/geometry/helpers.ts
//
// Tüm boru/fitting üreticilerinin PAYLAŞTIĞI çekirdek örgü (mesh) inşa
// altyapısı: bir "kesit dizisi" (frame[]) boyunca dış duvar + iç duvar +
// (istenirse) uç halkaları örerek KAPALI (manifold) bir katı üretir.
//
// TEMEL DEĞİŞMEZ (invariant): her frame'in (xAxis, yAxis) tabanı, xAxis×yAxis
// ≈ frame'in "ileri" (artan u) yönünü verecek şekilde SAĞ-ELLİ olmalıdır —
// bkz. buildOrthonormalFrameBasis. Bu sağlanmadığında dış/iç duvar
// normalleri TERS döner (bkz. modül testleri: "normal yönü" kontrolleri).

import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  type Vector3Like,
} from "three";
import { SURFACE_REGION_CODE, type GeometryMetadata, type LodLevel, type SurfaceRegion, type UvMap, type UvSample } from "./types";

/**
 * Bir tüpün BİR kesitini tanımlar: merkez, kesit düzlemini geren birim
 * (xAxis,yAxis) tabanı (xAxis = v=0 yönü — şekle özgü anlam: saat12/extrados
 * vb. — üretici belirler) ve bu kesitteki dış/iç yarıçap.
 */
export interface TubeFrame {
  center: Vector3;
  xAxis: Vector3;
  yAxis: Vector3;
  outerRadiusM: number;
  innerRadiusM: number;
}

/**
 * Verilen "ileri" (tangent) yön ve İSTENEN (yaklaşık) v=0 yönünden, xAxis×yAxis≈tangent
 * olacak şekilde sağ-elli, birbirine dik bir taban üretir (Gram-Schmidt).
 */
export function buildOrthonormalFrameBasis(
  tangent: Vector3,
  approximateXAxis: Vector3,
): { xAxis: Vector3; yAxis: Vector3 } {
  const t = tangent.clone().normalize();
  const yAxis = new Vector3().crossVectors(t, approximateXAxis).normalize();
  const xAxis = new Vector3().crossVectors(yAxis, t).normalize();
  return { xAxis, yAxis };
}

export interface BuiltTube {
  geometry: BufferGeometry;
  regionVertexCounts: Record<SurfaceRegion, number>;
  frames: TubeFrame[];
}

interface MeshAccumulator {
  positions: number[];
  uvs: number[];
  regions: number[];
  indices: number[];
}

function pushRingGrid(
  acc: MeshAccumulator,
  frames: TubeFrame[],
  radialSegments: number,
  radiusOf: (frame: TubeFrame) => number,
  region: SurfaceRegion,
  outward: boolean,
): number {
  const baseIndex = acc.positions.length / 3;
  const n = frames.length;

  for (let i = 0; i < n; i++) {
    const frame = frames[i];
    const radius = radiusOf(frame);
    const u = i / (n - 1);
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments;
      const angle = v * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const point = frame.center
        .clone()
        .addScaledVector(frame.xAxis, radius * cos)
        .addScaledVector(frame.yAxis, radius * sin);
      acc.positions.push(point.x, point.y, point.z);
      acc.uvs.push(u, v);
      acc.regions.push(SURFACE_REGION_CODE[region]);
    }
  }

  const stride = radialSegments + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = baseIndex + i * stride + j;
      const b = baseIndex + (i + 1) * stride + j;
      const c = baseIndex + (i + 1) * stride + (j + 1);
      const d = baseIndex + i * stride + (j + 1);
      if (outward) {
        acc.indices.push(a, c, b, a, d, c);
      } else {
        acc.indices.push(a, b, c, a, c, d);
      }
    }
  }

  return (radialSegments + 1) * n;
}

function pushCapRing(
  acc: MeshAccumulator,
  frame: TubeFrame,
  radialSegments: number,
  isStart: boolean,
): number {
  const baseIndex = acc.positions.length / 3;
  for (let j = 0; j <= radialSegments; j++) {
    const v = j / radialSegments;
    const angle = v * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dir = new Vector3().addScaledVector(frame.xAxis, cos).addScaledVector(frame.yAxis, sin);
    const innerPoint = frame.center.clone().addScaledVector(dir, frame.innerRadiusM);
    const outerPoint = frame.center.clone().addScaledVector(dir, frame.outerRadiusM);
    acc.positions.push(innerPoint.x, innerPoint.y, innerPoint.z);
    acc.uvs.push(isStart ? 0 : 1, v);
    acc.regions.push(SURFACE_REGION_CODE.END_CAP);
    acc.positions.push(outerPoint.x, outerPoint.y, outerPoint.z);
    acc.uvs.push(isStart ? 0 : 1, v);
    acc.regions.push(SURFACE_REGION_CODE.END_CAP);
  }

  for (let j = 0; j < radialSegments; j++) {
    const innerJ = baseIndex + j * 2;
    const outerJ = baseIndex + j * 2 + 1;
    const innerJ1 = baseIndex + (j + 1) * 2;
    const outerJ1 = baseIndex + (j + 1) * 2 + 1;
    if (isStart) {
      // normal ≈ -tangent (bkz. modül başlığı türetimi)
      acc.indices.push(innerJ, innerJ1, outerJ1, innerJ, outerJ1, outerJ);
    } else {
      // normal ≈ +tangent
      acc.indices.push(innerJ, outerJ, outerJ1, innerJ, outerJ1, innerJ1);
    }
  }

  return (radialSegments + 1) * 2;
}

export interface BuildTubeOptions {
  radialSegments: number;
  capStart: boolean;
  capEnd: boolean;
}

/**
 * Bir kesit (frame) dizisi boyunca dış duvar + iç duvar + (istenirse) uç
 * halkalarını örerek KAPALI bir BufferGeometry üretir. UV: u=kesit indeksi
 * kesri (0-1), v=çevresel açı kesri (0-1, dikişte [0,1] iki kopya vertex).
 */
export function buildTubeAlongFrames(frames: TubeFrame[], options: BuildTubeOptions): BuiltTube {
  if (frames.length < 2) {
    throw new Error("buildTubeAlongFrames: en az 2 kesit (frame) gereklidir.");
  }
  const { radialSegments, capStart, capEnd } = options;
  if (radialSegments < 3) {
    throw new Error("radialSegments en az 3 olmalıdır.");
  }

  const acc: MeshAccumulator = { positions: [], uvs: [], regions: [], indices: [] };
  const regionVertexCounts: Record<SurfaceRegion, number> = { OUTER_WALL: 0, INNER_WALL: 0, END_CAP: 0 };

  regionVertexCounts.OUTER_WALL += pushRingGrid(acc, frames, radialSegments, (f) => f.outerRadiusM, "OUTER_WALL", true);
  regionVertexCounts.INNER_WALL += pushRingGrid(acc, frames, radialSegments, (f) => f.innerRadiusM, "INNER_WALL", false);
  if (capStart) {
    regionVertexCounts.END_CAP += pushCapRing(acc, frames[0], radialSegments, true);
  }
  if (capEnd) {
    regionVertexCounts.END_CAP += pushCapRing(acc, frames[frames.length - 1], radialSegments, false);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(acc.positions), 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(new Float32Array(acc.uvs), 2));
  geometry.setAttribute("surfaceRegion", new Float32BufferAttribute(new Float32Array(acc.regions), 1));
  geometry.setIndex(new BufferAttribute(new Uint32Array(acc.indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return { geometry, regionVertexCounts, frames };
}

/** `damage` vertex attribute'unu (Float32, sıfırla dolu) geometriye ekler — spatial/ katmanı gelecekte doldurur. */
export function allocateDamageAttribute(geometry: BufferGeometry): void {
  const vertexCount = geometry.getAttribute("position").count;
  geometry.setAttribute("damage", new Float32BufferAttribute(new Float32Array(vertexCount), 1));
}

export function buildMetadata(
  componentKind: string,
  geometry: BufferGeometry,
  regionVertexCounts: Record<SurfaceRegion, number>,
  lod: LodLevel,
  subRegionLabels: string[] | null = null,
): GeometryMetadata {
  const index = geometry.getIndex();
  const triangleCount = index ? index.count / 3 : geometry.getAttribute("position").count / 3;
  return {
    componentKind,
    vertexCount: geometry.getAttribute("position").count,
    triangleCount,
    regionVertexCounts,
    subRegionLabels,
    lod,
  };
}

function classifyRadialRegion(radialM: number, frameIndex: number, frameCount: number, outerRadiusM: number, innerRadiusM: number): SurfaceRegion {
  const isAtEnd = frameIndex === 0 || frameIndex === frameCount - 1;
  const capTolerance = (outerRadiusM - innerRadiusM) * 0.1;
  if (isAtEnd && radialM > innerRadiusM + capTolerance && radialM < outerRadiusM - capTolerance) {
    return "END_CAP";
  }
  const distanceToOuter = Math.abs(radialM - outerRadiusM);
  const distanceToInner = Math.abs(radialM - innerRadiusM);
  return distanceToOuter <= distanceToInner ? "OUTER_WALL" : "INNER_WALL";
}

/**
 * `buildTubeAlongFrames`'in ÜRETTİĞİ AYNI frame dizisi üzerinden çalışan,
 * TÜM tüp şekilleri (düz/eğri/mitre) için ORTAK bir UvMap üretir.
 *
 * `pointToUV`, EN YAKIN frame'i (merkeze Öklid mesafesiyle) sayısal olarak
 * bulur — analitik ters dönüşüm yerine kasıtlı olarak basit/genel bir
 * yaklaşımdır (bkz. types.ts::UvMap JSDoc'u); frame sayısı yeterince
 * (≥~16) olduğunda hotspot etiketleme için yeterli hassasiyettedir.
 */
export function createFrameSequenceUvMap(frames: TubeFrame[]): UvMap {
  const n = frames.length;
  return {
    uvToPoint(u, v, surface) {
      const rawIndex = Math.min(Math.max(u, 0), 1) * (n - 1);
      const i0 = Math.min(Math.floor(rawIndex), n - 2);
      const t = rawIndex - i0;
      const frameA = frames[i0];
      const frameB = frames[i0 + 1];
      const center = frameA.center.clone().lerp(frameB.center, t);
      const xAxis = frameA.xAxis.clone().lerp(frameB.xAxis, t).normalize();
      const yAxis = frameA.yAxis.clone().lerp(frameB.yAxis, t).normalize();
      const radius =
        surface === "outer"
          ? frameA.outerRadiusM + (frameB.outerRadiusM - frameA.outerRadiusM) * t
          : frameA.innerRadiusM + (frameB.innerRadiusM - frameA.innerRadiusM) * t;
      const angle = v * Math.PI * 2;
      return center.addScaledVector(xAxis, radius * Math.cos(angle)).addScaledVector(yAxis, radius * Math.sin(angle));
    },
    pointToUV(point) {
      let bestIndex = 0;
      let bestDistanceSq = Infinity;
      for (let i = 0; i < n; i++) {
        const distanceSq = point.distanceToSquared(frames[i].center);
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          bestIndex = i;
        }
      }
      const frame = frames[bestIndex];
      const local = point.clone().sub(frame.center);
      const x = local.dot(frame.xAxis);
      const y = local.dot(frame.yAxis);
      const angle = Math.atan2(y, x);
      const v = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
      const radial = Math.sqrt(x * x + y * y);
      const region = classifyRadialRegion(radial, bestIndex, n, frame.outerRadiusM, frame.innerRadiusM);
      return { u: bestIndex / (n - 1), v, region };
    },
  };
}

/** Birden fazla frame dizisinin (ör. Te'nin run/branch'i) BİRLEŞİK UvMap'i — her alt-dizi kendi etiketini taşır. */
export function createCompositeUvMap(sequences: { label: string; frames: TubeFrame[] }[]): UvMap {
  const subMaps = sequences.map((s) => ({ label: s.label, uvMap: createFrameSequenceUvMap(s.frames) }));
  return {
    uvToPoint(u, v, surface) {
      return subMaps[0].uvMap.uvToPoint(u, v, surface);
    },
    pointToUV(point) {
      let best: UvSample | null = null;
      let bestLabel = subMaps[0].label;
      let bestDistanceSq = Infinity;
      for (const { label, uvMap } of subMaps) {
        const sample = uvMap.pointToUV(point);
        const worldPoint = uvMap.uvToPoint(sample.u, sample.v, sample.region === "INNER_WALL" ? "inner" : "outer");
        const distanceSq = worldPoint.distanceToSquared(point);
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          best = sample;
          bestLabel = label;
        }
      }
      return { ...(best as UvSample), subRegion: bestLabel };
    },
  };
}

export const LOD_SEGMENT_PRESETS: Record<LodLevel, { axial: number; radial: number }> = {
  low: { axial: 8, radial: 12 },
  medium: { axial: 16, radial: 24 },
  high: { axial: 32, radial: 48 },
};

export function resolveSegments(
  lod: LodLevel | undefined,
  segAxial: number | undefined,
  segRadial: number | undefined,
): { segAxial: number; segRadial: number } {
  const preset = LOD_SEGMENT_PRESETS[lod ?? "medium"];
  return { segAxial: segAxial ?? preset.axial, segRadial: segRadial ?? preset.radial };
}

/** İki 3B nokta arasında `count` adet EŞİT aralıklı ara nokta üretir (uç noktalar dahil, count+1 nokta). */
export function lerpPoints(a: Vector3Like, b: Vector3Like, count: number): Vector3[] {
  const start = new Vector3(a.x, a.y, a.z);
  const end = new Vector3(b.x, b.y, b.z);
  const points: Vector3[] = [];
  for (let i = 0; i <= count; i++) {
    points.push(start.clone().lerp(end, i / count));
  }
  return points;
}
