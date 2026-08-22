// apps/web/src/features/viewer3d/cameraViews.ts
//
// SAF (three.js/React'tan bağımsız) kamera-görünüm matematiği: hızlı görünüm
// yönleri (ön/üst/yan/izometrik), bir küreyi (bounding sphere) dikey görüş
// açısına TAM olarak sığdıran mesafe, ve ortografik kamera için eşdeğer
// zoom değeri. KDP kapsamı DIŞINDADIR — mühendislik katsayısı değil, standart
// perspektif-projeksiyon geometrisi (bkz. spatial/fields.ts'in aynı gerekçesi).
//
// Yön sözleşimi (bu projeye özgü, dünya eksenleri üzerinden — bileşenin
// KENDİ yereli değil): boru/fitting üreticileri eksenlerini YEREL +X boyunca
// kurar (bkz. geometry/straightPipe.ts) ve sahnede hiçbir ek döndürme
// uygulanmaz, bu yüzden dünya ekseni = bileşen ekseni.
//   ÖN  (FRONT) : kamera +Z'de  → silindirin yan (gövde) profili görünür
//   ÜST (TOP)   : kamera +Y'de  → silindir üstten görünür
//   YAN (SIDE)  : kamera +X'te  → borunun UÇ kesiti (dairesel ağız) görünür —
//                 saat-pozisyonu tabanlı hotspot'lar için en okunaklı açı
//   İZO (ISO)   : kamera (1,1,1) köşesinde — klasik izometrik köşe görünümü

export type QuickViewPreset = "FRONT" | "TOP" | "SIDE" | "ISO";

export const QUICK_VIEW_PRESETS: QuickViewPreset[] = ["FRONT", "TOP", "SIDE", "ISO"];

type Vec3Tuple = [number, number, number];

const PRESET_RAW_DIRECTIONS: Record<QuickViewPreset, Vec3Tuple> = {
  FRONT: [0, 0, 1],
  TOP: [0, 1, 0],
  SIDE: [1, 0, 0],
  ISO: [1, 1, 1],
};

function normalize(v: Vec3Tuple): Vec3Tuple {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) throw new Error("Sıfır uzunluklu vektör normalize edilemez.");
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Ön/üst/yan/izo görünümünün kamera-yönü birim vektörü (hedeften kameraya doğru). */
export function getQuickViewDirection(preset: QuickViewPreset): Vec3Tuple {
  return normalize(PRESET_RAW_DIRECTIONS[preset]);
}

/**
 * OrbitControls'un `up` vektörü — ÜST görünümde kamera dünya +Y ekseniyle
 * (varsayılan up) neredeyse çakıştığından `lookAt` yönelimi belirsizleşir
 * (çapraz çarpım sıfıra yaklaşır); bu görünüm için geçici olarak farklı bir
 * up (+Z'ye göre -Z) kullanılır. Diğer tüm görünümlerde standart +Y.
 */
export function getQuickViewUp(preset: QuickViewPreset): Vec3Tuple {
  return preset === "TOP" ? [0, 0, -1] : [0, 1, 0];
}

/**
 * Bir küreyi (yarıçap `boundingRadiusM`) dikey görüş açısı `verticalFovDeg`
 * olan bir perspektif kamerada TAM olarak (kürenin tamamı görünür kenarda
 * kesilmeden) sığdıran mesafe. `marginFactor>1` ekstra boşluk payı ekler.
 *
 * Türetim: küre tamamen görünür kalsın diye kamera-küre merkezi mesafesi d
 * için sin(fov/2) = r/d ⟹ d = r/sin(fov/2) (kürenin kamera konisine
 * TEĞET olduğu sınır durum — bkz. modül testi).
 */
export function computeFitDistanceM(boundingRadiusM: number, verticalFovDeg: number, marginFactor = 1.35): number {
  if (boundingRadiusM <= 0) throw new Error("boundingRadiusM pozitif olmalıdır.");
  if (verticalFovDeg <= 0 || verticalFovDeg >= 180) throw new Error("verticalFovDeg (0,180) aralığında olmalıdır.");
  if (marginFactor <= 0) throw new Error("marginFactor pozitif olmalıdır.");
  const halfFovRad = (verticalFovDeg * Math.PI) / 180 / 2;
  return (boundingRadiusM * marginFactor) / Math.sin(halfFovRad);
}

/** Bir hızlı-görünüm ön ayarı için kamera konumu (dünya, metre). */
export function computeQuickViewCameraPositionM(
  preset: QuickViewPreset,
  targetM: Vec3Tuple,
  boundingRadiusM: number,
  verticalFovDeg: number,
  marginFactor = 1.6,
): Vec3Tuple {
  const [dx, dy, dz] = getQuickViewDirection(preset);
  const distanceM = computeFitDistanceM(boundingRadiusM, verticalFovDeg, marginFactor);
  return [targetM[0] + dx * distanceM, targetM[1] + dy * distanceM, targetM[2] + dz * distanceM];
}

/**
 * Ortografik kamera için "nesneye sığdır" zoom değeri. R3F/drei'nin
 * varsayılan ortografik kamera kurulumunda (Canvas `orthographic` modu)
 * frustum YARI-yükseklik/genişliği viewport PİKSEL boyutuna eşittir ve
 * `zoom=1` bunu birebir (1 dünya birimi = 1 piksel) yansıtır — bu yüzden
 * "küreyi viewport'a sığdır" zoom'u basitçe (viewport yarı-yüksekliği px) /
 * (küre yarıçapı × pay) oranıdır.
 */
export function computeOrthoFitZoom(boundingRadiusM: number, viewportHalfHeightPx: number, marginFactor = 1.35): number {
  if (boundingRadiusM <= 0) throw new Error("boundingRadiusM pozitif olmalıdır.");
  if (viewportHalfHeightPx <= 0) throw new Error("viewportHalfHeightPx pozitif olmalıdır.");
  if (marginFactor <= 0) throw new Error("marginFactor pozitif olmalıdır.");
  return viewportHalfHeightPx / (boundingRadiusM * marginFactor);
}
