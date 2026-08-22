// apps/web/tests/geometry/generators.test.ts

import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { computeMeshVolume } from "three-bvh-csg";
import {
  SURFACE_REGION_FROM_CODE,
  createElbow,
  createFlangedSpool,
  createMiterBend,
  createOrificePlate,
  createReducer,
  createStraightPipe,
  createTee,
  createWeldJoint,
  type GeneratedGeometry,
} from "../../src/geometry";
import { checkManifold } from "./manifoldCheck";

function expectValidUvRange(geometry: GeneratedGeometry["geometry"]) {
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    expect(uv.getX(i)).toBeGreaterThanOrEqual(-1e-9);
    expect(uv.getX(i)).toBeLessThanOrEqual(1 + 1e-9);
    expect(uv.getY(i)).toBeGreaterThanOrEqual(-1e-9);
    expect(uv.getY(i)).toBeLessThanOrEqual(1 + 1e-9);
  }
}

function expectZeroedDamageAttribute(geometry: GeneratedGeometry["geometry"]) {
  const damage = geometry.getAttribute("damage");
  expect(damage).toBeDefined();
  expect(damage.itemSize).toBe(1);
  for (let i = 0; i < damage.count; i++) {
    expect(damage.getX(i)).toBe(0);
  }
}

function expectValidSurfaceRegionAttribute(geometry: GeneratedGeometry["geometry"]) {
  const region = geometry.getAttribute("surfaceRegion");
  expect(region).toBeDefined();
  for (let i = 0; i < region.count; i++) {
    expect(SURFACE_REGION_FROM_CODE[region.getX(i)]).toBeDefined();
  }
}

describe("createStraightPipe", () => {
  const result = createStraightPipe({ odMm: 219.1, wtMm: 8.18, lengthMm: 3000, segAxial: 10, segRadial: 16 });

  it("kapalı manifold üretir", () => {
    const check = checkManifold(result.geometry);
    expect(check.isClosed).toBe(true);
    expect(check.boundaryEdgeCount).toBe(0);
  });

  it("UV aralığı [0,1]'dedir", () => expectValidUvRange(result.geometry));
  it("damage attribute sıfırla dolu Float32'dir", () => expectZeroedDamageAttribute(result.geometry));
  it("surfaceRegion attribute geçerli kodlar taşır", () => expectValidSurfaceRegionAttribute(result.geometry));

  it("vertex sayısı beklenen ızgara boyutuna uyar", () => {
    // (segAxial+1) kesit × (segRadial+1) × 2 duvar + 2 uç halkası × (segRadial+1) × 2
    const expected = 11 * 17 * 2 + 2 * 17 * 2;
    expect(result.metadata.vertexCount).toBe(expected);
  });

  it("v=0 yönü +Y'dir (saat12) — dış duvar vertex'i doğrulanır", () => {
    const point = result.uvMap.uvToPoint(0.5, 0, "outer");
    expect(point.y).toBeGreaterThan(0);
    expect(Math.abs(point.z)).toBeLessThan(1e-6);
  });

  it("dış duvar normali eksenden DIŞA, iç duvar normali İÇE bakar", () => {
    const geometry = result.geometry;
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const region = geometry.getAttribute("surfaceRegion");
    for (let i = 0; i < position.count; i++) {
      if (region.getX(i) === 2) continue; // END_CAP hariç
      const radial = new Vector3(0, position.getY(i), position.getZ(i));
      if (radial.lengthSq() < 1e-9) continue;
      const n = new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));
      const dot = radial.normalize().dot(n);
      if (region.getX(i) === 0) expect(dot).toBeGreaterThan(0.5); // OUTER_WALL
      else expect(dot).toBeLessThan(-0.5); // INNER_WALL
    }
  });

  it("geçersiz girdilerde hata fırlatır", () => {
    expect(() => createStraightPipe({ odMm: -1, wtMm: 5, lengthMm: 100 })).toThrowError();
    expect(() => createStraightPipe({ odMm: 100, wtMm: 60, lengthMm: 100 })).toThrowError();
  });
});

describe("createElbow", () => {
  const result = createElbow({ odMm: 168.3, wtMm: 7.11, bendRadiusMm: 300, angleDeg: 90, segAxial: 20, segRadial: 16 });

  it("kapalı manifold üretir", () => {
    expect(checkManifold(result.geometry).isClosed).toBe(true);
  });

  it("UV aralığı [0,1]'dedir", () => expectValidUvRange(result.geometry));
  it("damage/surfaceRegion attribute'ları doğrudur", () => {
    expectZeroedDamageAttribute(result.geometry);
    expectValidSurfaceRegionAttribute(result.geometry);
  });

  it("⚠ v=0 → extrados (bükme merkezinden EN UZAK nokta) — SABİT sözleşim", () => {
    const extradosPoint = result.uvMap.uvToPoint(0.5, 0, "outer");
    const intradosPoint = result.uvMap.uvToPoint(0.5, 0.5, "outer");
    const curvatureCenter = new Vector3(0, 0.3, 0); // bendRadiusM=0,3
    expect(extradosPoint.distanceTo(curvatureCenter)).toBeGreaterThan(intradosPoint.distanceTo(curvatureCenter));
  });

  it("extrados hattındaki (v≈0) dış duvar vertex'lerinin normali bükme merkezinden UZAĞA bakar", () => {
    // v≈0 (extrados) tam olarak bükme düzleminde yer aldığından, buradaki dışa-radyal yön TAM OLARAK
    // (nokta - eğrilik merkezi) yönüyle çakışır — genel (v'nin herhangi bir değeri) durumdan FARKLI
    // olarak, burada gürültüsüz/doğrudan bir doğrulama yapılabilir.
    const geometry = result.geometry;
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const region = geometry.getAttribute("surfaceRegion");
    const uv = geometry.getAttribute("uv");
    const curvatureCenter = new Vector3(0, 0.3, 0); // bendRadiusM=0,3

    let checkedCount = 0;
    for (let i = 0; i < position.count; i++) {
      if (region.getX(i) !== 0) continue; // yalnızca OUTER_WALL
      const v = uv.getY(i);
      if (v > 0.02 && v < 0.98) continue; // yalnızca extrados dikişine (v≈0) yakın vertex'ler
      const p = new Vector3(position.getX(i), position.getY(i), position.getZ(i));
      const awayFromCenter = p.clone().sub(curvatureCenter).normalize();
      const n = new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i));
      expect(n.dot(awayFromCenter)).toBeGreaterThan(0.5);
      checkedCount++;
    }
    expect(checkedCount).toBeGreaterThan(0);
  });
});

describe("createReducer", () => {
  it("CONCENTRIC: kapalı manifold, UV geçerli", () => {
    const result = createReducer({ od1Mm: 219.1, od2Mm: 114.3, wt1Mm: 8.18, wt2Mm: 6.02, lengthMm: 200, segAxial: 10, segRadial: 16 });
    expect(checkManifold(result.geometry).isClosed).toBe(true);
    expectValidUvRange(result.geometry);
  });

  it("dış yarıçap u=0'dan u=1'e doğru azalır (od1>od2)", () => {
    const result = createReducer({ od1Mm: 219.1, od2Mm: 114.3, wt1Mm: 8.18, wt2Mm: 6.02, lengthMm: 200, segAxial: 10, segRadial: 16 });
    const startPoint = result.uvMap.uvToPoint(0, 0, "outer");
    const endPoint = result.uvMap.uvToPoint(1, 0, "outer");
    expect(startPoint.y).toBeGreaterThan(endPoint.y);
  });

  it("ECCENTRIC: alt taraf (v=0,5) DÜZ kalır — kapalı manifold", () => {
    const result = createReducer({
      od1Mm: 219.1,
      od2Mm: 114.3,
      wt1Mm: 8.18,
      wt2Mm: 6.02,
      lengthMm: 200,
      type: "ECCENTRIC",
      segAxial: 10,
      segRadial: 16,
    });
    expect(checkManifold(result.geometry).isClosed).toBe(true);
    const bottomStart = result.uvMap.uvToPoint(0, 0.5, "outer");
    const bottomEnd = result.uvMap.uvToPoint(1, 0.5, "outer");
    expect(Math.abs(bottomStart.y - bottomEnd.y)).toBeLessThan(1e-6);
  });
});

describe("createWeldJoint", () => {
  const result = createWeldJoint({ odMm: 168.3, wtMm: 7.11, lengthMm: 100, capHeightMm: 3, rootPenetrationMm: 1, segAxial: 12, segRadial: 16 });

  it("kapalı manifold üretir, UV geçerlidir", () => {
    expect(checkManifold(result.geometry).isClosed).toBe(true);
    expectValidUvRange(result.geometry);
  });

  it("orta noktada (u=0,5) dış yarıçap uçlardan büyüktür (kaynak kapağı)", () => {
    const midPoint = result.uvMap.uvToPoint(0.5, 0, "outer");
    const endPoint = result.uvMap.uvToPoint(0, 0, "outer");
    expect(midPoint.y).toBeGreaterThan(endPoint.y);
  });
});

describe("createOrificePlate", () => {
  const result = createOrificePlate({ pipeOdMm: 168.3, boreDiaMm: 60, thicknessMm: 6, segRadial: 16 });

  it("kapalı manifold üretir, UV geçerlidir", () => {
    expect(checkManifold(result.geometry).isClosed).toBe(true);
    expectValidUvRange(result.geometry);
  });

  it("dış yarıçap boru ODsi, iç yarıçap bore çapıyla eşleşir", () => {
    const outerPoint = result.uvMap.uvToPoint(0, 0, "outer");
    const innerPoint = result.uvMap.uvToPoint(0, 0, "inner");
    expect(outerPoint.length()).toBeCloseTo(0.1683 / 2, 6);
    expect(innerPoint.length()).toBeCloseTo(0.06 / 2, 6);
  });
});

describe("createMiterBend", () => {
  const result = createMiterBend({ odMm: 168.3, wtMm: 7.11, bendRadiusMm: 300, angleDeg: 90, segments: 4, segRadial: 16 });

  it("kapalı manifold üretir, UV geçerlidir", () => {
    expect(checkManifold(result.geometry).isClosed).toBe(true);
    expectValidUvRange(result.geometry);
  });

  it("çoklu düz parçadan oluşur (segments arttıkça vertex sayısı artar)", () => {
    const coarse = createMiterBend({ odMm: 168.3, wtMm: 7.11, bendRadiusMm: 300, angleDeg: 90, segments: 2, segRadial: 16 });
    const fine = createMiterBend({ odMm: 168.3, wtMm: 7.11, bendRadiusMm: 300, angleDeg: 90, segments: 8, segRadial: 16 });
    expect(fine.metadata.vertexCount).toBeGreaterThan(coarse.metadata.vertexCount);
  });

  it("geçersiz segments için hata fırlatır", () => {
    expect(() => createMiterBend({ odMm: 168.3, wtMm: 7.11, bendRadiusMm: 300, angleDeg: 90, segments: 0 })).toThrowError();
  });

  it("kapatılan toplam sonuç makuldür (vertex sayısı tanımlıdır)", () => {
    expect(result.metadata.vertexCount).toBeGreaterThan(0);
  });
});

describe("createFlangedSpool", () => {
  const result = createFlangedSpool({ odMm: 168.3, wtMm: 7.11, lengthMm: 500, flangeClass: 300, segAxial: 10, segRadial: 16 });

  it("kapalı manifold üretir (3 bağımsız kapalı katının birleşimi)", () => {
    expect(checkManifold(result.geometry).isClosed).toBe(true);
  });

  it("UV/damage/surfaceRegion attribute'ları doğrudur", () => {
    expectValidUvRange(result.geometry);
    expectZeroedDamageAttribute(result.geometry);
    expectValidSurfaceRegionAttribute(result.geometry);
  });

  it("metadata alt-bölge etiketlerini taşır (BODY/FLANGE_1/FLANGE_2)", () => {
    expect(result.metadata.subRegionLabels).toEqual(["BODY", "FLANGE_1", "FLANGE_2"]);
  });

  it("geçersiz basınç sınıfı için TS tip hatası verecek şekilde tiplendirilmiştir (çalışma zamanı kontrolü yok)", () => {
    // flangeClass PressureClass birlik tipiyle sınırlıdır — derleme zamanı garantisi, ek çalışma zamanı testi gerekmez.
    expect(result.metadata.componentKind).toBe("FLANGED_SPOOL");
  });
});

describe("createTee", () => {
  const result = createTee({
    runOdMm: 219.1,
    runWtMm: 8.18,
    runLengthMm: 600,
    branchOdMm: 114.3,
    branchWtMm: 6.02,
    branchLengthMm: 250,
    segRadial: 24,
  });

  // ⚠ Tee'de KATI (her kenar tam 2 üçgende) manifold testi UYGULANMAZ — three-bvh-csg'nin kendi
  // README'si "resulting geometry may not be correctly completely two-manifold" diyor ve bu ampirik
  // olarak doğrulandı (bkz. tee.ts başlığı): kesişim sonrası bazı kenarlar gerçek bir delik değil,
  // "T-junction" (görsel olarak dikişsiz, katı kenar-sayım testini geçmeyen) yapılardır. Bunun yerine
  // GERÇEK bir delik/leke olmadığını dolaylı ama sağlam biçimde doğrulayan iki ölçüt kullanılır:
  // hesaplanan hacmin pozitif ve analitik olarak beklenen aralıkta olması, ve NaN/dejenere vertex
  // bulunmaması.
  it("hesaplanan hacim pozitiftir ve makul bir aralıktadır (gerçek bir 'delik' olmadığının dolaylı kanıtı)", () => {
    const volume = computeMeshVolume(result.geometry);
    const runOuterRadiusM = 0.2191 / 2;
    const runInnerRadiusM = (0.2191 - 2 * 0.00818) / 2;
    const runTubeVolumeM3 = Math.PI * (runOuterRadiusM ** 2 - runInnerRadiusM ** 2) * 0.6;
    const branchOuterRadiusM = 0.1143 / 2;
    const generousUpperBoundM3 = runTubeVolumeM3 + Math.PI * branchOuterRadiusM ** 2 * 0.25;

    expect(volume).toBeGreaterThan(runTubeVolumeM3 * 0.95); // en az run borusu kadar (branch katkısı ek)
    expect(volume).toBeLessThan(generousUpperBoundM3);
  });

  it("hiçbir vertex NaN/sonsuz değer taşımaz", () => {
    const position = result.geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
    }
  });

  it("damage attribute sıfırla dolu Float32'dir", () => expectZeroedDamageAttribute(result.geometry));

  it("surfaceRegion TÜM vertex'ler için geçerli bir koda sahiptir", () => expectValidSurfaceRegionAttribute(result.geometry));

  it("UV aralığı [0,1]'dedir", () => expectValidUvRange(result.geometry));

  it("metadata run/branch alt-bölge etiketlerini taşır", () => {
    expect(result.metadata.subRegionLabels).toEqual(["RUN", "BRANCH"]);
  });

  it("run ekseninden uzak (dal üzerindeki) bir nokta BRANCH alt-bölgesine atanır", () => {
    // Dal, x=runLengthM/2=0,3 civarında +Y'ye doğru uzanır — dalın UCUNA yakın bir nokta net biçimde BRANCH'tır.
    const branchTip = new Vector3(0.3, 0.15, 0.114 / 2 + 0.001);
    const sample = result.uvMap.pointToUV(branchTip);
    expect(sample.subRegion).toBe("BRANCH");
  });
});
