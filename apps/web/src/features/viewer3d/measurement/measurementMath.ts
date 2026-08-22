// apps/web/src/features/viewer3d/measurement/measurementMath.ts
//
// Ölçüm araçlarının SAF matematiği. KDP kapsamı DIŞINDADIR (mesafe hesabı
// standart Öklid geometrisidir); duvar-kalınlığı probu ise zaten var olan
// (ve KDP-EXEMPT olarak belgelenmiş, bkz. o dosyanın kendi başlığı)
// `timeSlider/demoTimeDependentField.ts::computeDemoTimeDependentDamageMm`i
// YENİDEN KULLANIR — yeni bir sentetik model İCAT EDİLMEDİ, ısı haritası/
// hotspot'ların KULLANDIĞI AYNI alan, tek bir noktada örneklenir.

import { computeDemoTimeDependentDamageMm, type DemoScenario } from "../timeSlider/demoTimeDependentField";

export type Vec3Tuple = [number, number, number];

/** İki dünya-uzayı noktası (metre) arasındaki mesafe (mm). */
export function computeDistanceMm(a: Vec3Tuple, b: Vec3Tuple): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000;
}

/** İki nokta arası orta nokta — mesafe etiketinin 3B konumu için. */
export function computeMidpoint(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

export interface WallProbeResult {
  damageMm: number;
  remainingWallMm: number;
}

/** Yüzeydeki bir (u,v) noktasında, o anki senaryo/zamana göre kalan et kalınlığı. */
export function computeWallProbeResult(u: number, v: number, wtMm: number, elapsedYears: number, scenario: DemoScenario): WallProbeResult {
  if (wtMm <= 0) throw new Error("wtMm pozitif olmalıdır.");
  const damageMm = computeDemoTimeDependentDamageMm(u, v, elapsedYears, scenario);
  return { damageMm, remainingWallMm: Math.max(wtMm - damageMm, 0) };
}
