// apps/web/src/geometry/types.ts
//
// apps/web/src/geometry/ modülünün paylaşılan tipleri. Bu modül SAF three.js
// BufferGeometry üretir — packages/engine'e KASITLI olarak bağımlı DEĞİLDİR
// (engine paketi Three.js'ten bağımsız/taşınabilir kalmalı — bkz. proje
// talimatı); ölçü girdileri (odMm, wtMm, ...) doğrudan mm cinsindendir,
// üreticiler bunu içeride metreye (Three.js sahne birimi) çevirir.

import type { BufferGeometry, Vector3 } from "three";

/** Bir vertex'in bileşenin ET KALINLIĞI üzerindeki konumu — dış duvar/iç duvar/uç halkası. */
export type SurfaceRegion = "OUTER_WALL" | "INNER_WALL" | "END_CAP";

/** `surfaceRegion` vertex attribute'unun (Float32) sayısal kodlaması. */
export const SURFACE_REGION_CODE: Record<SurfaceRegion, number> = {
  OUTER_WALL: 0,
  INNER_WALL: 1,
  END_CAP: 2,
};

export const SURFACE_REGION_FROM_CODE: SurfaceRegion[] = ["OUTER_WALL", "INNER_WALL", "END_CAP"];

export type LodLevel = "low" | "medium" | "high";

export interface UvSample {
  u: number;
  v: number;
  region: SurfaceRegion;
  /** Yalnızca birleşik (ör. Te — run/branch) geometrilerde dolu; tekil parçalarda undefined. */
  subRegion?: string;
}

/**
 * 3B nokta ↔ (u,v) dönüşümü — hotspot etiketleri ve spatial/ modülünün
 * SpatialDamageField sonucunu bu geometri üzerine YERLEŞTİRMEK için.
 * Koordinatlar bileşenin KENDİ YEREL uzayındadır (henüz sahne
 * konumlandırma/döndürme uygulanmamış — çağıran taraf gerekirse kendi
 * dönüşümünü uygular).
 */
export interface UvMap {
  /** (u,v,yüzey) → yerel 3B nokta (metre). surface: "outer" | "inner". */
  uvToPoint(u: number, v: number, surface: "outer" | "inner"): Vector3;
  /**
   * Yerel 3B bir noktaya EN YAKIN (u,v) örneğini döndürür. Analitik ters
   * dönüşüm YERİNE, üretimde kullanılan kesit ("frame") dizisi üzerinde
   * EN YAKIN kesiti bulan SAYISAL bir arama kullanır (bkz. helpers.ts) —
   * hotspot etiketleme için yeterli hassasiyette, basit ve TÜM şekillerde
   * (düz/eğri/mitre) aynı şekilde çalışan tek bir yöntemdir.
   */
  pointToUV(point: Vector3): UvSample;
}

export interface GeometryMetadata {
  /** Üretici fonksiyonun adı (ör. "STRAIGHT_PIPE") — tanılama/etiketleme için. */
  componentKind: string;
  vertexCount: number;
  triangleCount: number;
  regionVertexCounts: Record<SurfaceRegion, number>;
  /** Birleşik (CSG) geometrilerde alt-bölgeler var mı (ör. Te'de run/branch). */
  subRegionLabels: string[] | null;
  lod: LodLevel;
}

export interface GeneratedGeometry {
  /** Vertex attribute'ları: position, normal, uv, surfaceRegion (Float32 kod), damage (Float32, sıfırla dolu). */
  geometry: BufferGeometry;
  uvMap: UvMap;
  metadata: GeometryMetadata;
}

export const MM_PER_M = 1000;
