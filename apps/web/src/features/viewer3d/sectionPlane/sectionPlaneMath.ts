// apps/web/src/features/viewer3d/sectionPlane/sectionPlaneMath.ts
//
// Kesit düzleminin SAF matematiği (three.js'ten bağımsız, düz sayı
// dizileriyle çalışır — `useSectionPlane.ts` bunu gerçek `THREE.Plane`e
// bağlar). KDP kapsamı DIŞINDADIR: mühendislik katsayısı değil, standart
// düzlem/küresel-koordinat geometrisi (bkz. spatial/fields.ts'in aynı
// gerekçesi).
//
// Eksen sözleşimi: boru ekseni YEREL/DÜNYA +X'tir (bkz. PipeMesh.tsx —
// bu bileşende sahnede ek döndürme uygulanmaz). Bu yüzden:
//   X ekseni kesiti → normal=+X → borunun EKSENİNE DİK bir düzlem →
//     kesişimde dairesel ET KALINLIĞI kesiti (klasik "kesit al") görünür.
//   Y/Z ekseni kesiti, offset=0 → normal=+Y veya +Z, borunun MERKEZİNDEN
//     geçer → borunun TÜM UZUNLUĞU boyunca BOYUNA yarıya bölünmüş hâli
//     görünür — bu proje "yarım kesit modu"nu AYRI bir mekanizma yerine
//     TAM OLARAK bu düzlem seçimiyle karşılar (bkz. useSectionPlane.ts'in
//     `setHalfSectionEnabled`'ı: sadece axis=Y, offsetM=0'a geçer).

export type SectionAxis = "X" | "Y" | "Z" | "FREE";

export const SECTION_AXES: SectionAxis[] = ["X", "Y", "Z", "FREE"];

export type Vec3Tuple = [number, number, number];

export interface SectionPlaneAngles {
  /** FREE modunda normalin KUTUPSAL açısı (+Z'den, derece, [0,180]). θ=0 → normal=+Z (Z ekseni ön ayarıyla süreklilik). */
  thetaDeg: number;
  /** FREE modunda normalin AZİMUT açısı (+X'ten +Y'ye, derece, [0,360)). */
  phiDeg: number;
}

const AXIS_NORMALS: Record<Exclude<SectionAxis, "FREE">, Vec3Tuple> = {
  X: [1, 0, 0],
  Y: [0, 1, 0],
  Z: [0, 0, 1],
};

/**
 * Kesit düzleminin birim normal vektörü. FREE modunda standart fizik
 * sözleşimiyle (θ: kutup açısı +Z'den, φ: azimut +X'ten) küresel→kartezyen
 * dönüşümü kullanılır — θ=0 tam olarak "Z" ön ayarına, θ=90°/φ=0° "X"e,
 * θ=90°/φ=90° "Y"ye denk düşer (bkz. modül testi, süreklilik kontrolü).
 */
export function computeSectionPlaneNormal(axis: SectionAxis, angles: SectionPlaneAngles): Vec3Tuple {
  if (axis !== "FREE") return AXIS_NORMALS[axis];
  const thetaRad = (angles.thetaDeg * Math.PI) / 180;
  const phiRad = (angles.phiDeg * Math.PI) / 180;
  const sinTheta = Math.sin(thetaRad);
  return [sinTheta * Math.cos(phiRad), sinTheta * Math.sin(phiRad), Math.cos(thetaRad)];
}

/**
 * `THREE.Plane`in `constant`'ı — düzlem, normal boyunca orijinden `offsetM`
 * kadar uzakta (normal·nokta+constant=0, nokta=normal×offsetM) olacak
 * şekilde. Bu proje boyunca (bkz. components/three/SectionCapPlane.tsx)
 * "normal·nokta+constant ≥ 0" olan taraf TUTULUR sözleşimi kullanılır.
 */
export function computeSectionPlaneConstant(offsetM: number): number {
  return -offsetM;
}

export interface SectionPlaneEquation {
  normal: Vec3Tuple;
  constant: number;
}

export function computeSectionPlaneEquation(axis: SectionAxis, offsetM: number, angles: SectionPlaneAngles): SectionPlaneEquation {
  return { normal: computeSectionPlaneNormal(axis, angles), constant: computeSectionPlaneConstant(offsetM) };
}

/**
 * Kaydırıcının [min,max] aralığı — eksene göre anlamlı bir fiziksel sınır:
 * X ekseni borunun UZUNLUĞU boyunca (0..lengthM, borunun İÇİNDE kalacak
 * şekilde), Y/Z/FREE ise dış yarıçapla sınırlı (çapın dışına çıkan bir
 * kesit hiçbir şeyi "kesmez", anlamsızdır).
 */
export function computeSectionOffsetRangeM(axis: SectionAxis, lengthM: number, outerRadiusM: number): [number, number] {
  if (lengthM <= 0) throw new Error("lengthM pozitif olmalıdır.");
  if (outerRadiusM <= 0) throw new Error("outerRadiusM pozitif olmalıdır.");
  if (axis === "X") return [0, lengthM];
  return [-outerRadiusM, outerRadiusM];
}
