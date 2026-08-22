// apps/web/src/geometry/flangedSpool.ts
//
// Flanşlı spool — düz boru gövdesi + iki uçta flanş diski (bilezik/collar).
// ÜÇ BAĞIMSIZ KAPALI KATI (gövde + flanş1 + flanş2) uzayda üst üste
// binecek şekilde konumlandırılıp tek bir BufferGeometry'de BİRLEŞTİRİLİR
// (three.js BufferGeometryUtils.mergeGeometries). Her flanş, boru gövdesini
// ÇEVRELEYEN bir bilezik olarak modellenir (flanşın "iç yarıçapı" = boru
// dış yarıçapı) — bu sayede HER ÜÇ parça da KENDİ BAŞINA tam kapalı bir
// manifolddur (dikişsiz iç içe geçme problemi YOKTUR, bkz. modül testleri).
// ⚠ Bu gerçek bir CAD B-rep birleşimi (tek sınır yüzeyi) DEĞİLDİR — üç
// bağımsız kapalı katının uzayda iç içe geçecek biçimde bir araya
// getirilmesidir (görselleştirme için yeterli — bkz. tee.ts'in gerçek CSG
// birleşimiyle KARŞILAŞTIRIN).
//
// Flanş dış çapı/kalınlığı ASME B16.5'ten OKUNMUŞ bir KDP değeri DEĞİLDİR —
// yalnızca GÖRSEL olarak makul bir basınç sınıfı → çap oranı yaklaşıklığıdır.

import { Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PressureClass } from "@erocorr3d/engine";
import { allocateDamageAttribute, buildMetadata, buildTubeAlongFrames, createCompositeUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M, type GeneratedGeometry, type LodLevel } from "./types";

export interface FlangedSpoolParams {
  odMm: number;
  wtMm: number;
  lengthMm: number;
  flangeClass: PressureClass;
  segAxial?: number;
  segRadial?: number;
  lod?: LodLevel;
}

const X_AXIS = new Vector3(0, 1, 0);
const Y_AXIS = new Vector3(0, 0, 1);

/** Basınç sınıfı → flanş dış çapı/boru dış çapı GÖRSEL oranı (yaklaşık, KDP kapsamı DIŞI — bkz. modül başlığı). */
const FLANGE_OD_RATIO_BY_CLASS: Record<PressureClass, number> = {
  150: 1.7,
  300: 1.8,
  600: 1.9,
  900: 2.0,
  1500: 2.15,
  2500: 2.35,
};

function buildStraightSegment(
  outerRadiusM: number,
  innerRadiusM: number,
  startXM: number,
  lengthM: number,
  segAxial: number,
  segRadial: number,
) {
  const frames: TubeFrame[] = [];
  for (let i = 0; i <= segAxial; i++) {
    const x = startXM + (i / segAxial) * lengthM;
    frames.push({ center: new Vector3(x, 0, 0), xAxis: X_AXIS.clone(), yAxis: Y_AXIS.clone(), outerRadiusM, innerRadiusM });
  }
  return { ...buildTubeAlongFrames(frames, { radialSegments: segRadial, capStart: true, capEnd: true }), frames };
}

export function createFlangedSpool(params: FlangedSpoolParams): GeneratedGeometry {
  const { odMm, wtMm, lengthMm, flangeClass } = params;
  if (odMm <= 0 || wtMm <= 0 || lengthMm <= 0) {
    throw new Error("odMm, wtMm ve lengthMm pozitif olmalıdır.");
  }
  if (wtMm * 2 >= odMm) {
    throw new Error("Et kalınlığının iki katı, dış çaptan küçük olmalıdır.");
  }
  const { segAxial, segRadial } = resolveSegments(params.lod, params.segAxial, params.segRadial);

  const outerRadiusM = odMm / 2 / MM_PER_M;
  const innerRadiusM = (odMm / 2 - wtMm) / MM_PER_M;
  const lengthM = lengthMm / MM_PER_M;
  const flangeOdRadiusM = outerRadiusM * FLANGE_OD_RATIO_BY_CLASS[flangeClass];
  const flangeThicknessM = outerRadiusM * 0.5; // görsel olarak fark edilir bilezik kalınlığı (yaklaşık, KDP dışı)
  const flangeSegAxial = Math.max(2, Math.round(segAxial / 4));
  // Bilezik iç yarıçapı, boru dış yarıçapından KASITLI olarak %2 daha geniş: gövde/flanş iki BAĞIMSIZ kapalı
  // katı olduğundan, iç içe geçen yüzeyler TAM ÇAKIŞIRSA (aynı yarıçap) birleştirilmiş geometri, aynı 3B
  // yüzeyi kaplayan İKİ ayrı örgü (mesh) katmanı taşır — bu görsel olarak fark edilmez ama manifold
  // (watertight) testini BOZAR (aynı kenar >2 üçgen tarafından paylaşılmış görünür). Küçük bir boşluk
  // (gerçek bir kayar-tip flanşın bilezik toleransına da benzer şekilde) bunu KÖKTEN önler.
  const flangeBoreClearanceFactor = 1.02;
  const flangeBoreRadiusM = outerRadiusM * flangeBoreClearanceFactor;

  // Gövde: tam boyunda, kendi başına KAPALI bir düz boru.
  const body = buildStraightSegment(outerRadiusM, innerRadiusM, 0, lengthM, Math.max(2, segAxial), segRadial);
  // Flanşlar: boru gövdesini ÇEVRELEYEN (iç yarıçapı ≈ boru dış yarıçapı + tolerans) bağımsız kapalı bilezikler.
  const flange1 = buildStraightSegment(flangeOdRadiusM, flangeBoreRadiusM, 0, flangeThicknessM, flangeSegAxial, segRadial);
  const flange2 = buildStraightSegment(
    flangeOdRadiusM,
    flangeBoreRadiusM,
    lengthM - flangeThicknessM,
    flangeThicknessM,
    flangeSegAxial,
    segRadial,
  );

  const merged = mergeGeometries([body.geometry, flange1.geometry, flange2.geometry], false);
  if (!merged) {
    throw new Error("Flanşlı spool geometrileri birleştirilemedi.");
  }
  allocateDamageAttribute(merged);

  const regionVertexCounts = {
    OUTER_WALL: body.regionVertexCounts.OUTER_WALL + flange1.regionVertexCounts.OUTER_WALL + flange2.regionVertexCounts.OUTER_WALL,
    INNER_WALL: body.regionVertexCounts.INNER_WALL + flange1.regionVertexCounts.INNER_WALL + flange2.regionVertexCounts.INNER_WALL,
    END_CAP: body.regionVertexCounts.END_CAP + flange1.regionVertexCounts.END_CAP + flange2.regionVertexCounts.END_CAP,
  };

  return {
    geometry: merged,
    uvMap: createCompositeUvMap([
      { label: "BODY", frames: body.frames },
      { label: "FLANGE_1", frames: flange1.frames },
      { label: "FLANGE_2", frames: flange2.frames },
    ]),
    metadata: buildMetadata("FLANGED_SPOOL", merged, regionVertexCounts, params.lod ?? "medium", ["BODY", "FLANGE_1", "FLANGE_2"]),
  };
}
