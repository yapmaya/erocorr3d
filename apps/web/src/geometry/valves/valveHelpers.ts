// apps/web/src/geometry/valves/valveHelpers.ts
//
// 10 vana üreticisinin PAYLAŞTIĞI çekirdek inşa altyapısı. Üç katman:
//  1) GÖVDE: `buildAxisTubeFrames` + `../helpers.ts::buildTubeAlongFrames` —
//     düz VEYA "şişkin" (bulged, ör. çekvalf gövdesi) delikli tüpler; CSG
//     GEREKTİRMEZ, tamamen mevcut (test edilmiş) frame-sweep altyapısını
//     yeniden kullanır.
//  2) DALLANMA PORTU: `cutAxisPort` — ana gövde duvarına (kapak/bonnet
//     boyun deliği, PSV yan çıkışı vb.) TEK bir CSG çıkarma (SUBTRACTION)
//     ile delik açar (three-bvh-csg, bkz. ../tee.ts emsali — aynı bilinen
//     sınırlama burada da geçerlidir, bkz. aşağıdaki not).
//  3) TRIM (iç organ) İLKELLERİ: oturma halkası (torus), mil (silindir),
//     kapak/bonnet (frame-sweep kap), top-içi delik/kafes pencereleri
//     (CSG) — three.js yerleşik ilkellerinden.
//
// ⚠ BİLİNEN SINIRLAMA (three-bvh-csg'nin kendi belgelediği gerçek, bkz.
// ../tee.ts'in AYNI notu): CSG sonucu geometriler KATI manifold testinden
// GEÇMEYEBİLİR (T-junction tarzı kenarlar). Bu dosyadaki CSG işlemleri
// TEK bir çıkarma (tee.ts'in birleşim+2-çıkarma zincirinden daha basit)
// olduğu için risk daha düşüktür, ama testler yine de tee.ts'in
// "hacim makullüğü" ölçütünü kullanır, katı kenar-sayımı DEĞİL.
//
// ⚠ GÖRSEL ORANTILAR: `VALVE_VISUAL_RATIOS` ve `BODY_CLASS_THICKNESS_FACTOR`
// KDP kapsamı DIŞIDIR — ASME B16.34/B16.10 gövde ölçü tablosundan KAYNAK
// GÖSTERİLMEDEN alınmamıştır (bkz. flangedSpool.ts'in FLANGE_OD_RATIO_BY_CLASS'ı
// için AYNI emsal). Yalnızca "makul görünen" bir vana silüeti üretir; hasar
// bölgelerini doğru KONUMLANDIRMak için yeterlidir (bkz. proje talimatı:
// "CAD kalitesi gerekmez").
//
// NPS→delik çapı: `resolveBoreRadiusM`, npsIn(inç)≈nominal iç çap(inç)
// yaklaşıklığını kullanır — ASME B36.10M çizelgesi (packages/engine/src/
// data/pipeSchedules.ts'te zaten KDP-kaynaklı olarak var) BİLEREK
// çağrılmaz: apps/web/src/geometry/ katmanı @erocorr3d/engine'in ÇALIŞMA
// ZAMANI fonksiyonlarına bağımlı DEĞİLDİR (proje kuralı, bkz. flangedSpool.ts
// ve elbow.ts başlıkları) — bu yüzden burada da yalnızca GÖRSEL bir
// yaklaşıklık kullanılır, tıpkı flangeClass oranı gibi.

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ADDITION, Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { PressureClass } from "@erocorr3d/engine";
import {
  allocateDamageAttribute,
  buildOrthonormalFrameBasis,
  buildTubeAlongFrames,
  LOD_SEGMENT_PRESETS,
  type TubeFrame,
} from "../helpers";
import { MM_PER_M, type LodLevel } from "../types";
import type { ValveDamageZone, ValvePartPose, ValvePivot } from "./types";

export const VALVE_VISUAL_RATIOS = {
  bodyOuterOverBore: 1.9,
  bodyHalfLengthOverBore: 1.7,
  bonnetPortOverBore: 1.15,
  bonnetOuterOverBore: 1.5,
  bonnetHeightOverBore: 2.1,
  stemRadiusOverBore: 0.14,
  seatTubeRadiusOverBore: 0.12,
  packingTubeRadiusOverBore: 0.2,
  packingMajorOverStem: 1.6,
};

/** Basınç sınıfı → gövde et kalınlığı GÖRSEL çarpanı (yüksek sınıf = daha "gösterişli" gövde). GÖRSEL, KDP dışı — bkz. modül başlığı. */
export const BODY_CLASS_THICKNESS_FACTOR: Record<PressureClass, number> = {
  150: 1.0,
  300: 1.08,
  600: 1.18,
  900: 1.3,
  1500: 1.45,
  2500: 1.65,
};

export function validateOpeningPercent(openingPercent: number): void {
  if (!Number.isFinite(openingPercent) || openingPercent < 0 || openingPercent > 100) {
    throw new Error("openingPercent [0,100] aralığında bir sayı olmalıdır.");
  }
}

/** NPS(inç)→delik yarıçapı(m) GÖRSEL yaklaşıklığı — bkz. modül başlığı. `boreFraction<1` (ör. daraltılmış geçişli küresel vana) tam-geçiş oranına göre küçültür. */
export function resolveBoreRadiusM(npsIn: number, boreFraction = 1): number {
  if (!(npsIn > 0)) throw new Error("npsIn pozitif olmalıdır.");
  if (!(boreFraction > 0) || boreFraction > 1) throw new Error("boreFraction (0,1] aralığında olmalıdır.");
  const boreDiaMm = npsIn * 25.4 * boreFraction;
  return boreDiaMm / 2 / MM_PER_M;
}

export function resolveValveSegments(lod: LodLevel | undefined): { segAxial: number; segRadial: number; trimSegments: number } {
  const preset = LOD_SEGMENT_PRESETS[lod ?? "medium"];
  return { segAxial: preset.axial, segRadial: preset.radial, trimSegments: Math.max(8, Math.round(preset.radial * 0.6)) };
}

function makeBrush(geo: BufferGeometry): Brush {
  const brush = new Brush(geo);
  brush.updateMatrixWorld(true);
  return brush;
}

/** `fromAxis` yönündeki yerel geometriyi `toAxis`'e hizalayan kuaterniyon döndürmesini UYGULAR (geo'yu mutate eder) ve geo'yu döndürür. */
export function alignGeometryAxis(geo: BufferGeometry, fromAxis: Vector3, toAxis: Vector3): BufferGeometry {
  const q = new Quaternion().setFromUnitVectors(fromAxis.clone().normalize(), toAxis.clone().normalize());
  geo.applyQuaternion(q);
  return geo;
}

export type AxisName = "X" | "Y" | "Z";
const AXIS_VECTORS: Record<AxisName, Vector3> = { X: new Vector3(1, 0, 0), Y: new Vector3(0, 1, 0), Z: new Vector3(0, 0, 1) };

/**
 * X VEYA Y eksenine hizalı, delikli (bore) bir tüpün kesit (frame) dizisini üretir.
 * `outerRadiusM`/`boreRadiusM` sabit bir sayı VEYA eksenel kesir u(0-1)'in bir
 * fonksiyonu olabilir (ikinci durumda "şişkin" gövdeler, ör. çekvalf, üretilir).
 * Dizi, ekseni ORİJİN-MERKEZLİ olacak şekilde ±halfLengthM aralığında kurulur.
 */
export function buildAxisTubeFrames(opts: {
  axis: "X" | "Y";
  outerRadiusM: number | ((u: number) => number);
  boreRadiusM: number | ((u: number) => number);
  halfLengthM: number;
  segAxial: number;
}): TubeFrame[] {
  const { axis, halfLengthM, segAxial } = opts;
  const tangent = AXIS_VECTORS[axis];
  const approxX = axis === "X" ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  const { xAxis, yAxis } = buildOrthonormalFrameBasis(tangent, approxX);
  const start = tangent.clone().multiplyScalar(-halfLengthM);

  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const u = i / segAxial;
    const center = start.clone().addScaledVector(tangent, 2 * halfLengthM * u);
    const outerRadiusM = typeof opts.outerRadiusM === "function" ? opts.outerRadiusM(u) : opts.outerRadiusM;
    const boreRadiusM = typeof opts.boreRadiusM === "function" ? opts.boreRadiusM(u) : opts.boreRadiusM;
    frames.push({ center, xAxis: xAxis.clone(), yAxis: yAxis.clone(), outerRadiusM, innerRadiusM: boreRadiusM });
  }
  return frames;
}

/** Bir "şişkinlik" (bulge) profili — u=0.5'te tepe, kenarlara doğru düz (smoothstep) — çekvalf gibi geniş-orta gövdeler için. */
export function bulgeProfile(baseRadiusM: number, bulgeRadiusM: number, widthFraction: number): (u: number) => number {
  const half = widthFraction / 2;
  return (u: number) => {
    const d = Math.abs(u - 0.5);
    if (d >= half) return baseRadiusM;
    const t = 1 - d / half; // 0..1, kenarda 0, ortada 1
    const smooth = t * t * (3 - 2 * t);
    return baseRadiusM + (bulgeRadiusM - baseRadiusM) * smooth;
  };
}

/**
 * Ana gövde duvarına, verilen eksende TEK bir CSG çıkarma ile delik açar
 * (bonnet boynu, mil deliği, PSV yan çıkışı...). Kesme silindiri
 * `crossPointM`'den `sign*axis` yönünde `reachM` kadar UZANIR, ters yönde
 * `overlapM` kadar TAŞAR (ana delikle temiz kesişimi garanti etmek için —
 * bkz. tee.ts'in benzer "runExtensionM" mantığı).
 */
/**
 * İki CSG operand'ının öznitelik KÜMELERİ (position/normal/uv/...) BİRE BİR
 * UYUŞMALIDIR — three-bvh-csg bunu VARSAYAR, uyuşmazsa `GeometryBuilder`
 * içeride çöker. `../helpers.ts::buildTubeAlongFrames` çıktısı `surfaceRegion`/
 * `damage` gibi three.js ilkellerinde (CSG kesme araçlarında) BULUNMAYAN
 * öznitelikler taşır — bu yüzden CSG'ye girmeden önce SİLİNİR (nihai
 * geometriye `finalizePartGeometry` ile yeniden eklenir). ⚠ `uv` İSE
 * TUTULUR/SİLİNMEZ (bkz. bu dosyanın kendi testlerinde yakalanan gerçek hata:
 * zincirleme `cutAxisPort` çağrılarında BİRİNCİ çağrının çıktısından `uv`
 * silinirse, İKİNCİ çağrının base'i uv'siz kalır ama tazece üretilen kesme
 * aracı (tool, three.js ilkeli) hâlâ uv taşır — bu UYUŞMAZLIK çöküyor;
 * three-bvh-csg'nin kendisi `uv`'nin HER İKİ tarafta da (ya İKİSİNDE DE VAR
 * ya da İKİSİNDE DE YOK değil, İKİSİNDE DE VAR) tutarlı kalmasını istiyor —
 * bu yüzden `uv` asla silinmez, üretilen sonuç geometrisinde ANLAMSIZ ama
 * ZARARSIZ bir kalıntı olarak kalır, vana parçaları gerçek UV'ye ihtiyaç
 * duymaz).
 */
function stripNonCsgAttributes(geometry: BufferGeometry): BufferGeometry {
  for (const name of ["surfaceRegion", "damage"]) {
    if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

export function cutAxisPort(
  baseGeometry: BufferGeometry,
  opts: { axis: AxisName; crossPointM: Vector3; radiusM: number; reachM: number; overlapM: number; sign?: 1 | -1; radialSegments?: number },
): BufferGeometry {
  stripNonCsgAttributes(baseGeometry);
  const dir = AXIS_VECTORS[opts.axis].clone().multiplyScalar(opts.sign ?? 1);
  const totalLengthM = opts.reachM + opts.overlapM;
  const centerM = opts.crossPointM.clone().addScaledVector(dir, totalLengthM / 2 - opts.overlapM);
  const toolGeo = new CylinderGeometry(opts.radiusM, opts.radiusM, totalLengthM, opts.radialSegments ?? 16, 1, false);
  alignGeometryAxis(toolGeo, new Vector3(0, 1, 0), dir);
  toolGeo.translate(centerM.x, centerM.y, centerM.z);

  const evaluator = new Evaluator();
  const resultBrush = evaluator.evaluate(makeBrush(baseGeometry), makeBrush(toolGeo), SUBTRACTION);
  const geometry = resultBrush.geometry;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** `cutAxisPort`'un SİMETRİK (her iki yönde de eşit) özel durumu — bir katıyı TAM ORTASINDAN delen bir port (ör. tapa vananın port deliği). */
export function cutThroughAxis(baseGeometry: BufferGeometry, opts: { axis: AxisName; crossPointM: Vector3; radiusM: number; halfLengthM: number; radialSegments?: number }): BufferGeometry {
  return cutAxisPort(baseGeometry, { axis: opts.axis, crossPointM: opts.crossPointM, radiusM: opts.radiusM, reachM: opts.halfLengthM, overlapM: opts.halfLengthM, radialSegments: opts.radialSegments });
}

/** Bir kutuyu (window) verilen eksene/konuma hizalayıp gövdeden ÇIKARIR — kafes penceresi (kafes trim) için. */
export function cutBoxWindows(
  baseGeometry: BufferGeometry,
  windows: { centerM: Vector3; radialDir: Vector3; widthM: number; heightM: number; thicknessM: number }[],
): BufferGeometry {
  let current = stripNonCsgAttributes(baseGeometry);
  const evaluator = new Evaluator();
  for (const w of windows) {
    const boxGeo = new BoxGeometry(w.widthM, w.heightM, w.thicknessM);
    alignGeometryAxis(boxGeo, new Vector3(0, 0, 1), w.radialDir);
    boxGeo.translate(w.centerM.x, w.centerM.y, w.centerM.z);
    const resultBrush = evaluator.evaluate(makeBrush(current), makeBrush(boxGeo), SUBTRACTION);
    current = resultBrush.geometry;
  }
  current.computeVertexNormals();
  current.computeBoundingSphere();
  return current;
}

/** Oturma halkası (seat ring) — deliği `flowAxis`'e hizalı ince bir torus. */
export function buildSeatRingGeometry(opts: { flowAxis: Vector3; centerM: Vector3; ringRadiusM: number; tubeRadiusM: number; segments: number }): BufferGeometry {
  const geo = new TorusGeometry(opts.ringRadiusM, opts.tubeRadiusM, Math.max(8, Math.round(opts.segments / 2)), opts.segments);
  alignGeometryAxis(geo, new Vector3(0, 0, 1), opts.flowAxis);
  geo.translate(opts.centerM.x, opts.centerM.y, opts.centerM.z);
  geo.computeVertexNormals();
  return geo;
}

/** Mil/gövde/tapa gibi düz bir silindir — `axisDir`'e hizalı, `originM`'den `lengthM` kadar `axisDir` yönünde uzanır. */
export function buildAxisCylinderGeometry(opts: {
  axisDir: Vector3;
  originM: Vector3;
  lengthM: number;
  radiusM: number;
  topRadiusM?: number;
  radialSegments: number;
}): BufferGeometry {
  const geo = new CylinderGeometry(opts.topRadiusM ?? opts.radiusM, opts.radiusM, opts.lengthM, opts.radialSegments, 1, false);
  geo.translate(0, opts.lengthM / 2, 0); // taban originM'de, tepe +lengthM'de olacak şekilde kaydır
  alignGeometryAxis(geo, new Vector3(0, 1, 0), opts.axisDir);
  geo.translate(opts.originM.x, opts.originM.y, opts.originM.z);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Kapak/bonnet — `axisDir` boyunca `originM`'den başlayıp `heightM` kadar
 * uzanan, ALT UCU AÇIK (gövdeye oturur, gerçek bir CSG birleşimi DEĞİL —
 * bkz. flangedSpool.ts'in "3 bağımsız katı" emsali), ÜST UCU KAPALI bir kap.
 */
export function buildBonnetGeometry(opts: {
  axisDir: Vector3;
  originM: Vector3;
  heightM: number;
  outerRadiusM: number;
  innerRadiusM: number;
  segAxial: number;
  segRadial: number;
}): BufferGeometry {
  const frames = buildAxisTubeFrames({
    axis: "Y",
    outerRadiusM: opts.outerRadiusM,
    boreRadiusM: opts.innerRadiusM,
    halfLengthM: opts.heightM / 2,
    segAxial: opts.segAxial,
  }).map((f) => ({ ...f, center: f.center.clone().add(new Vector3(0, opts.heightM / 2, 0)) })); // 0..heightM'e kaydır (yerel referans altta)
  const { geometry } = buildTubeAlongFrames(frames, { radialSegments: opts.segRadial, capStart: false, capEnd: true });
  alignGeometryAxis(geometry, new Vector3(0, 1, 0), opts.axisDir);
  geometry.translate(opts.originM.x, opts.originM.y, opts.originM.z);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Top (ball) gövdesi — merkezi delik `boreAxisClosed`'e hizalı bir
 * küre-eksi-silindir(/koni) CSG çıkarması. Kapalı pozda (referans) delik
 * AKIŞ EKSENİNE DİK durur (bkz. ballValve.ts pivot sözleşimi). `boreExitRadiusM`
 * verilirse delik KONİK (V-çentik benzeri) kesilir — daraltılmış geçişli
 * (REDUCED bore) toplar için, bkz. ballValve.ts.
 */
export function buildBallGeometry(opts: { ballRadiusM: number; boreRadiusM: number; boreExitRadiusM?: number; boreAxisClosed: Vector3; segments: number }): BufferGeometry {
  const sphereGeo = new SphereGeometry(opts.ballRadiusM, opts.segments, Math.max(8, Math.round(opts.segments / 2)));
  const boreGeo = new CylinderGeometry(
    opts.boreRadiusM,
    opts.boreExitRadiusM ?? opts.boreRadiusM,
    opts.ballRadiusM * 3,
    Math.max(12, Math.round(opts.segments / 1.5)),
    1,
    false,
  );
  alignGeometryAxis(boreGeo, new Vector3(0, 1, 0), opts.boreAxisClosed);
  const evaluator = new Evaluator();
  const resultBrush = evaluator.evaluate(makeBrush(sphereGeo), makeBrush(boreGeo), SUBTRACTION);
  const geometry = resultBrush.geometry;
  geometry.deleteAttribute("uv");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function mergeNamedGeometries(geometries: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error("Geometriler birleştirilemedi (mergeGeometries null döndürdü).");
  return merged;
}

/** Her parça geometrisine `damage` (Float32, sıfır) attribute'u ekler — Faz 2 ısı-haritası shader'ının beklediği isim (bkz. shaders/heatmap.*.glsl), ../helpers.ts::allocateDamageAttribute ile aynı sözleşim. */
export function finalizePartGeometry(geometry: BufferGeometry): BufferGeometry {
  allocateDamageAttribute(geometry);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Basit bir TRANSLATE pivotu (`axis` yönünde `openValueM` metre öteleme). */
export function translatePivot(partName: string, axis: [number, number, number], openValueM: number): ValvePivot {
  return { partName, kind: "TRANSLATE", axis, pivotPointM: [0, 0, 0], closedValue: 0, openValue: openValueM };
}

/**
 * Basit bir ROTATE pivotu (`axis` etrafında `openValueRad` radyan döndürme).
 * `axis` yalnızca TEK bir temel eksene hizalı olmalıdır (bkz. types.ts).
 * `pivotPointM` verilmezse (0,0,0) — parçanın geometrisi montaj MERKEZİNE
 * göre inşa edilmiş demektir (ör. top/disk/tapa döner vanaları — bkz.
 * ballValve.ts/butterflyValve.ts/plugValve.ts). Menteşeli (hinge) parçalar
 * (ör. checkValve.ts) NEREDE olursa olsun `pivotPointM`'İ AÇIKÇA verir VE
 * kendi geometrisini o noktaya göre inşa eder (bkz. types.ts::ValvePivot).
 */
export function rotatePivot(partName: string, axis: [number, number, number], openValueRad: number, pivotPointM: [number, number, number] = [0, 0, 0]): ValvePivot {
  return { partName, kind: "ROTATE", axis, pivotPointM, closedValue: 0, openValue: openValueRad };
}

/**
 * `pivot` ve `openingPercent`'ten ANLIK parça pozunu (delta) türetir — SAF
 * fonksiyon, her karede (animasyon sırasında) yeniden çağrılabilir (bkz.
 * types.ts başlığı — "referans poz" sözleşimi). `axis` bileşenlerinden
 * TAM OLARAK biri sıfırdan farklı olmalıdır (tek-eksenli rotasyon/öteleme
 * kısıtı) — aksi hâlde THREE.Euler ile temsil edilemeyen bileşik bir
 * rotasyon gerekirdi, bu proje bilerek bundan kaçınır (tüm vana pivotları
 * zaten tek eksenlidir).
 */
export function computePartPoseForOpening(pivot: ValvePivot, openingPercent: number): ValvePartPose {
  const t = Math.min(Math.max(openingPercent, 0), 100) / 100;
  const value = pivot.closedValue + (pivot.openValue - pivot.closedValue) * t;
  if (pivot.kind === "TRANSLATE") {
    return { positionM: [pivot.axis[0] * value, pivot.axis[1] * value, pivot.axis[2] * value], rotationRad: [0, 0, 0] };
  }
  return { positionM: [0, 0, 0], rotationRad: [pivot.axis[0] * value, pivot.axis[1] * value, pivot.axis[2] * value] };
}

export function buildDamageZone(id: string, meshName: string, centerU: number, centerV: number, radius: number): ValveDamageZone {
  return { id, meshName, centerUV: { u: centerU, v: centerV }, radius };
}

export { ADDITION, SUBTRACTION };
export { makeBrush };
