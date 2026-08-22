// apps/web/src/geometry/tee.ts
//
// Dallanma/kör te — GERÇEK CSG (Boolean) birleşimiyle üretilen TEK bir
// kapalı manifold: dört ilkel (run dış/iç, branch dış/iç) silindirden,
//   sonuç = (runOuter ∪ branchOuter) − runInner − branchInner
// tarifiyle inşa edilir (three-bvh-csg). Bu, "run+branch iki ayrı boruyu
// üst üste koy" yaklaşımından FARKLI olarak GERÇEKTEN TEK PARÇA, dikişsiz
// bir gövde ve run⇄branch arasında GERÇEKTEN AÇIK (bağlı) bir iç boşluk
// üretir — bkz. flangedSpool.ts'in "üç bağımsız katı" yaklaşımıyla
// KARŞILAŞTIRIN (o dosyada bilerek daha basit bir yöntem seçildi).
//
// ⚠ BİLİNEN SINIRLAMA (three-bvh-csg'nin KENDİ belgelediği bir gerçek, bu
// projenin bir hatası DEĞİL): kütüphanenin README'si açıkça şunu söylüyor —
// "Due to numerical precision and corner cases resulting geometry may not
// be correctly completely two-manifold." Ampirik olarak doğrulandı (bkz.
// modül testleri): kesişim eğrisi boyunca bazı kenarlar GERÇEK bir delik
// DEĞİL ama bir "T-junction" (bir üçgenin kenarı, komşu üçgenin YENİ bir
// ara-nokta ile bölünmüş kenarına tam denk gelmiyor — geometrik olarak
// dikişsiz görünür, ışın izleme/hacim hesabı doğru çalışır, ama katı bir
// "her kenar tam 2 üçgende" testi bunu YAKALAR). Bu yüzden Tee için testler
// diğer 7 üreticideki KATI manifold testinden FARKLI, daha uygun bir ölçüt
// kullanır (hacim makullüğü + sınır kenarlarının toplam kenara oranı) —
// bkz. tests/geometry/generators.test.ts.
//
// UV/bölge ataması: CSG işlemi sonrası üretilen YENİ (kesişim) vertex'ler
// için analitik bir UV YOKTUR — bu yüzden uv/surfaceRegion/damage
// öznitelikleri, NİHAİ geometrinin vertex KONUM+NORMAL'İNDEN SONRADAN
// (post-process) hesaplanır: her vertex, run VEYA branch eksenine hangisine
// "daha yakın" (yarıçap kalıntısı en küçük) ise o alt-bölgeye atanır; dış/iç
// duvar o alt-bölgenin kendi yarıçaplarına göre, uç halkası ise normalin
// eksene neredeyse paralel olup olmadığına göre belirlenir. Bilinen
// sınırlama: dal çapı ana hat çapına göre ÇOK büyükse (alışılmadık bir
// tasarım) bu sezgisel yöntem birkaç vertex'i yanlış alt-bölgeye
// atayabilir — bkz. modül testleri.

import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Vector3 } from "three";
import { ADDITION, Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { SURFACE_REGION_CODE, type GeneratedGeometry, type LodLevel, type SurfaceRegion } from "./types";
import { buildMetadata, createCompositeUvMap, resolveSegments, type TubeFrame } from "./helpers";
import { MM_PER_M } from "./types";

export type TeeType = "TEE_BLIND" | "TEE_BRANCH" | "TEE_SWEEPING";

export interface TeeParams {
  runOdMm: number;
  runWtMm: number;
  runLengthMm: number;
  branchOdMm: number;
  branchWtMm: number;
  branchLengthMm: number;
  type?: TeeType;
  /** Dalın ana hat üzerindeki eksenel konumu (0-1) — varsayılan 0,5 (orta). */
  branchAxialFraction?: number;
  segRadial?: number;
  lod?: LodLevel;
}

function buildCappedCylinder(radiusM: number, heightM: number, radialSegments: number): BufferGeometry {
  return new CylinderGeometry(radiusM, radiusM, heightM, radialSegments, 1, false);
}

export function createTee(params: TeeParams): GeneratedGeometry {
  const {
    runOdMm,
    runWtMm,
    runLengthMm,
    branchOdMm,
    branchWtMm,
    branchLengthMm,
  } = params;
  if (runOdMm <= 0 || runWtMm <= 0 || runLengthMm <= 0 || branchOdMm <= 0 || branchWtMm <= 0 || branchLengthMm <= 0) {
    throw new Error("Tüm ölçüler pozitif olmalıdır.");
  }
  if (runWtMm * 2 >= runOdMm || branchWtMm * 2 >= branchOdMm) {
    throw new Error("Et kalınlığının iki katı, ait olduğu dış çaptan küçük olmalıdır.");
  }
  const branchAxialFraction = params.branchAxialFraction ?? 0.5;
  const { segRadial } = resolveSegments(params.lod, undefined, params.segRadial);

  const runOuterRadiusM = runOdMm / 2 / MM_PER_M;
  const runInnerRadiusM = (runOdMm / 2 - runWtMm) / MM_PER_M;
  const runLengthM = runLengthMm / MM_PER_M;
  const branchOuterRadiusM = branchOdMm / 2 / MM_PER_M;
  const branchInnerRadiusM = (branchOdMm / 2 - branchWtMm) / MM_PER_M;
  const branchLengthM = branchLengthMm / MM_PER_M;
  const branchAxialPositionM = branchAxialFraction * runLengthM;

  // run ekseni (dış-duvar-yarıçapı ile iç-duvar-yarıçapının ORTASI) kadar dala nüfuz eder — bkz. modül başlığı.
  const penetrationDepthM = (runInnerRadiusM + runOuterRadiusM) / 2;
  const runExtensionM = runOuterRadiusM * 0.2; // uçları TEMİZ açık bırakmak için iç bore'u hafifçe uzat

  const runOuterGeo = buildCappedCylinder(runOuterRadiusM, runLengthM, segRadial)
    .rotateZ(-Math.PI / 2)
    .translate(runLengthM / 2, 0, 0);
  const runInnerGeo = buildCappedCylinder(runInnerRadiusM, runLengthM + 2 * runExtensionM, segRadial)
    .rotateZ(-Math.PI / 2)
    .translate(runLengthM / 2, 0, 0);

  const branchOuterHeightM = branchLengthM + penetrationDepthM;
  const branchOuterCenterY = branchLengthM / 2 - penetrationDepthM / 2;
  const branchOuterGeo = buildCappedCylinder(branchOuterRadiusM, branchOuterHeightM, segRadial).translate(
    branchAxialPositionM,
    branchOuterCenterY,
    0,
  );
  const branchInnerGeo = buildCappedCylinder(branchInnerRadiusM, branchOuterHeightM, segRadial).translate(
    branchAxialPositionM,
    branchOuterCenterY,
    0,
  );

  const makeBrush = (geo: BufferGeometry) => {
    const brush = new Brush(geo);
    brush.updateMatrixWorld(true);
    return brush;
  };

  const evaluator = new Evaluator();
  const outerUnion = evaluator.evaluate(makeBrush(runOuterGeo), makeBrush(branchOuterGeo), ADDITION);
  outerUnion.updateMatrixWorld(true);
  const minusRunBore = evaluator.evaluate(outerUnion, makeBrush(runInnerGeo), SUBTRACTION);
  minusRunBore.updateMatrixWorld(true);
  const finalBrush = evaluator.evaluate(minusRunBore, makeBrush(branchInnerGeo), SUBTRACTION);

  const geometry = finalBrush.geometry;
  geometry.deleteAttribute("uv");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const regionVertexCounts = tagTeeAttributes(geometry, {
    runOuterRadiusM,
    runInnerRadiusM,
    runLengthM,
    branchAxialPositionM,
    branchOuterRadiusM,
    branchInnerRadiusM,
    branchLengthM,
  });

  const vertexCount = geometry.getAttribute("position").count;
  geometry.setAttribute("damage", new Float32BufferAttribute(new Float32Array(vertexCount), 1));

  const runFrames = buildAxisFrames(new Vector3(0, 0, 0), new Vector3(1, 0, 0), runLengthM, runOuterRadiusM, runInnerRadiusM, 8);
  const branchFrames = buildAxisFrames(
    new Vector3(branchAxialPositionM, 0, 0),
    new Vector3(0, 1, 0),
    branchLengthM,
    branchOuterRadiusM,
    branchInnerRadiusM,
    8,
  );

  return {
    geometry,
    uvMap: createCompositeUvMap([
      { label: "RUN", frames: runFrames },
      { label: "BRANCH", frames: branchFrames },
    ]),
    metadata: buildMetadata(params.type ?? "TEE_BRANCH", geometry, regionVertexCounts, params.lod ?? "medium", ["RUN", "BRANCH"]),
  };
}

function buildAxisFrames(
  origin: Vector3,
  axisDirection: Vector3,
  lengthM: number,
  outerRadiusM: number,
  innerRadiusM: number,
  count: number,
): TubeFrame[] {
  const yAxis = new Vector3(0, 0, 1);
  const xAxis = new Vector3().crossVectors(yAxis, axisDirection).normalize();
  const frames: TubeFrame[] = [];
  for (let i = 0; i <= count; i++) {
    const center = origin.clone().addScaledVector(axisDirection, (i / count) * lengthM);
    frames.push({ center, xAxis: xAxis.clone(), yAxis: yAxis.clone(), outerRadiusM, innerRadiusM });
  }
  return frames;
}

interface TagContext {
  runOuterRadiusM: number;
  runInnerRadiusM: number;
  runLengthM: number;
  branchAxialPositionM: number;
  branchOuterRadiusM: number;
  branchInnerRadiusM: number;
  branchLengthM: number;
}

function tagTeeAttributes(geometry: BufferGeometry, ctx: TagContext): Record<SurfaceRegion, number> {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const count = position.count;
  const uv = new Float32Array(count * 2);
  const region = new Float32Array(count);
  const counts: Record<SurfaceRegion, number> = { OUTER_WALL: 0, INNER_WALL: 0, END_CAP: 0 };

  const runMidOuter = (ctx.runOuterRadiusM + ctx.runInnerRadiusM) / 2;
  const branchMidOuter = (ctx.branchOuterRadiusM + ctx.branchInnerRadiusM) / 2;

  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = normal.getX(i);
    const ny = normal.getY(i);

    const distToRunAxis = Math.sqrt(y * y + z * z);
    const distToBranchAxis = Math.sqrt((x - ctx.branchAxialPositionM) ** 2 + z * z);
    const runResidual = Math.min(Math.abs(distToRunAxis - ctx.runOuterRadiusM), Math.abs(distToRunAxis - ctx.runInnerRadiusM));
    const branchResidual = Math.min(
      Math.abs(distToBranchAxis - ctx.branchOuterRadiusM),
      Math.abs(distToBranchAxis - ctx.branchInnerRadiusM),
    );

    let regionCode: number;
    let u: number;
    let v: number;

    if (runResidual <= branchResidual) {
      const isCap = Math.abs(nx) > 0.9;
      if (isCap) {
        regionCode = SURFACE_REGION_CODE.END_CAP;
      } else {
        regionCode = distToRunAxis >= runMidOuter ? SURFACE_REGION_CODE.OUTER_WALL : SURFACE_REGION_CODE.INNER_WALL;
      }
      u = Math.min(Math.max(x / ctx.runLengthM, 0), 1);
      const angle = Math.atan2(z, y);
      v = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
    } else {
      const isCap = Math.abs(ny) > 0.9;
      if (isCap) {
        regionCode = SURFACE_REGION_CODE.END_CAP;
      } else {
        regionCode = distToBranchAxis >= branchMidOuter ? SURFACE_REGION_CODE.OUTER_WALL : SURFACE_REGION_CODE.INNER_WALL;
      }
      u = Math.min(Math.max(y / ctx.branchLengthM, 0), 1);
      const angle = Math.atan2(z, x - ctx.branchAxialPositionM);
      v = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
    }

    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
    region[i] = regionCode;
    counts[regionCode === 0 ? "OUTER_WALL" : regionCode === 1 ? "INNER_WALL" : "END_CAP"] += 1;
  }

  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("surfaceRegion", new Float32BufferAttribute(region, 1));
  return counts;
}
