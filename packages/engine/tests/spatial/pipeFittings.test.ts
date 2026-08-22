// packages/engine/tests/spatial/pipeFittings.test.ts

import { describe, expect, it } from "vitest";
import { DamageField, integrateOverUnitSquare, vToClockPosition } from "../../src/spatial/fields";
import {
  buildBendIntradosSecondaryShape,
  buildBlcStratifiedShape,
  buildCuiExternalBandsShape,
  buildDeadlegStagnantShape,
  buildElbowExtradosImpingementShape,
  buildMicBottomPatchyShape,
  buildOrificeDownstreamJetShape,
  buildReducerThroatDownstreamShape,
  buildTeeBlindImpactShape,
  buildTeeBranchSharpEdgeShape,
  buildTlcCondensationShape,
  buildUdcSedimentBedShape,
  buildUniformFullBoreShape,
  buildWeldRootTurbulenceShape,
  type PipeFittingSignatureId,
} from "../../src/spatial/pipeFittings";
import type { DamageShapeFn } from "../../src/spatial/fields";

// Her imza, farklı bir integrasyon çözünürlüğünde (build-time normalizeShapeFn'in kullandığı 400'den
// FARKLI, 250) BAĞIMSIZ olarak yeniden doğrulanır — gerçek bir çapraz kontrol, "kendi kendini test etme"
// DEĞİL.
const INDEPENDENT_CHECK_RESOLUTION = 250;

const ALL_SIGNATURES: { id: PipeFittingSignatureId; build: () => DamageShapeFn }[] = [
  { id: "BLC_STRATIFIED", build: () => buildBlcStratifiedShape({ liquidHoldupFraction: 0.3 }) },
  { id: "TLC_CONDENSATION", build: () => buildTlcCondensationShape() },
  { id: "UNIFORM_FULL_BORE", build: () => buildUniformFullBoreShape() },
  { id: "ELBOW_EXTRADOS_IMPINGEMENT", build: () => buildElbowExtradosImpingementShape({ bendRadiusRatio: 1.5 }) },
  { id: "BEND_INTRADOS_SECONDARY", build: () => buildBendIntradosSecondaryShape({ bendRadiusRatio: 1.5 }) },
  { id: "TEE_BLIND_IMPACT", build: () => buildTeeBlindImpactShape() },
  { id: "TEE_BRANCH_SHARP_EDGE", build: () => buildTeeBranchSharpEdgeShape() },
  { id: "REDUCER_THROAT_DOWNSTREAM", build: () => buildReducerThroatDownstreamShape() },
  { id: "WELD_ROOT_TURBULENCE", build: () => buildWeldRootTurbulenceShape() },
  { id: "DEADLEG_STAGNANT", build: () => buildDeadlegStagnantShape() },
  { id: "ORIFICE_DOWNSTREAM_JET", build: () => buildOrificeDownstreamJetShape() },
  { id: "MIC_BOTTOM_PATCHY", build: () => buildMicBottomPatchyShape() },
  { id: "UDC_SEDIMENT_BED", build: () => buildUdcSedimentBedShape() },
  { id: "CUI_EXTERNAL_BANDS", build: () => buildCuiExternalBandsShape() },
];

describe("Tüm 14 boru/fitting imzası — kütle korunumu (∫∫ f dudv ≈ 1, ±%1)", () => {
  for (const { id, build } of ALL_SIGNATURES) {
    it(`${id}: ∫∫≈1`, () => {
      const shape = build();
      const integral = integrateOverUnitSquare(shape, INDEPENDENT_CHECK_RESOLUTION);
      expect(integral).toBeGreaterThan(0.99);
      expect(integral).toBeLessThan(1.01);
    });
  }
});

describe("Tüm 14 imza — toplam hacim kaybı = hız×süre (±%2, DamageField üzerinden)", () => {
  for (const { id, build } of ALL_SIGNATURES) {
    it(`${id}: ortalama ızgara değeri ≈ hız×süre`, () => {
      const shape = build();
      const field = new DamageField(90, 90, "CYLINDRICAL_UV");
      field.addContribution(shape, 2.5, 4); // 2,5 mm/yıl × 4 yıl = 10 mm beklenen
      const mean = field.computeMeanValueMm();
      expect(mean).toBeGreaterThan(10 * 0.98);
      expect(mean).toBeLessThan(10 * 1.02);
    });
  }
});

describe("BLC_STRATIFIED — tepe konumu", () => {
  it("tepe v≈0,5 (saat 6)", () => {
    const shape = buildBlcStratifiedShape({ liquidHoldupFraction: 0.3 });
    const field = new DamageField(80, 80, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    const peak = field.findPeak();
    expect(peak.v).toBeCloseTo(0.5, 1);
    expect(vToClockPosition(peak.v)).toBeCloseTo(6, 0);
  });

  it("daha yüksek holdup → daha geniş ıslak yay (daha az keskin bir çevresel profil)", () => {
    const narrow = buildBlcStratifiedShape({ liquidHoldupFraction: 0.05 });
    const wide = buildBlcStratifiedShape({ liquidHoldupFraction: 0.45 });
    // saat 6'dan biraz uzakta (v=0,4), geniş-holdup şekli DAHA YÜKSEK değer vermelidir (daha yayvan).
    expect(wide(0.5, 0.4)).toBeGreaterThan(narrow(0.5, 0.4));
  });

  it("geçersiz holdup için hata fırlatır", () => {
    expect(() => buildBlcStratifiedShape({ liquidHoldupFraction: 0 })).toThrowError();
    expect(() => buildBlcStratifiedShape({ liquidHoldupFraction: 1 })).toThrowError();
  });
});

describe("TLC_CONDENSATION — tepe konumu", () => {
  it("tepe v≈0 (saat 12) — corrosion/tlc.ts::tlcAngularProfile ile tutarlı", () => {
    const shape = buildTlcCondensationShape();
    const field = new DamageField(80, 80, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    const peak = field.findPeak();
    // v periyodik: saat12 hem v=0 hem v≈1'e çok yakın olabilir (ızgara ayrıklaştırması) — ikisini de kabul et.
    const distanceFromZero = Math.min(peak.v, 1 - peak.v);
    expect(distanceFromZero).toBeLessThan(0.05);
  });

  it("saat 6'da (v=0,5) şiddet, saat 12'ye (v=0) göre belirgin ölçüde düşüktür", () => {
    const shape = buildTlcCondensationShape();
    expect(shape(0.35, 0)).toBeGreaterThan(shape(0.35, 0.5));
  });
});

describe("ELBOW_EXTRADOS_IMPINGEMENT — tepe extrados'ta, R/D ve parçacık çapıyla kayıyor", () => {
  it("tepe v≈0 (extrados)", () => {
    const shape = buildElbowExtradosImpingementShape({ bendRadiusRatio: 1.5 });
    const field = new DamageField(90, 60, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    const peak = field.findPeak();
    const distanceFromZero = Math.min(peak.v, 1 - peak.v);
    expect(distanceFromZero).toBeLessThan(0.05);
  });

  it("daha küçük R/D (daha keskin dirsek) → daha büyük α → tepe daha ileride (büyük u)", () => {
    const sharp = buildElbowExtradosImpingementShape({ bendRadiusRatio: 1 });
    const gentle = buildElbowExtradosImpingementShape({ bendRadiusRatio: 5 });
    const fieldSharp = new DamageField(120, 40, "CYLINDRICAL_UV");
    fieldSharp.addContribution(sharp, 1, 1);
    const fieldGentle = new DamageField(120, 40, "CYLINDRICAL_UV");
    fieldGentle.addContribution(gentle, 1, 1);
    expect(fieldSharp.findPeak().u).toBeGreaterThan(fieldGentle.findPeak().u);
  });

  it("büyük parçacık çapı → tepe girişe yaklaşır (küçük u)", () => {
    const noParticle = buildElbowExtradosImpingementShape({ bendRadiusRatio: 1.5 });
    const bigParticle = buildElbowExtradosImpingementShape({
      bendRadiusRatio: 1.5,
      particleDiameterM: 0.01,
      pipeIdM: 0.1, // dp/D=0,1 — referans (0,05) üstü, tam kayma uygulanır
    });
    const fieldA = new DamageField(120, 40, "CYLINDRICAL_UV");
    fieldA.addContribution(noParticle, 1, 1);
    const fieldB = new DamageField(120, 40, "CYLINDRICAL_UV");
    fieldB.addContribution(bigParticle, 1, 1);
    expect(fieldB.findPeak().u).toBeLessThan(fieldA.findPeak().u);
  });
});

describe("BEND_INTRADOS_SECONDARY — tepe intrados'ta (v≈0,5)", () => {
  it("tepe v≈0,5", () => {
    const shape = buildBendIntradosSecondaryShape({ bendRadiusRatio: 1.5 });
    const field = new DamageField(90, 60, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    expect(field.findPeak().v).toBeCloseTo(0.5, 1);
  });
});

describe("TEE_BLIND_IMPACT — tepe u≈1'de (kör kolun ucu)", () => {
  it("tepe u yüksek bir değerdedir", () => {
    const shape = buildTeeBlindImpactShape();
    const field = new DamageField(100, 20, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    expect(field.findPeak().u).toBeGreaterThan(0.9);
  });
});

describe("MIC_BOTTOM_PATCHY — tohumlu tekrarlanabilirlik", () => {
  it("aynı seed her zaman aynı şekli üretir", () => {
    const shapeA = buildMicBottomPatchyShape({ seed: 777 });
    const shapeB = buildMicBottomPatchyShape({ seed: 777 });
    for (const [u, v] of [
      [0.1, 0.4],
      [0.5, 0.6],
      [0.9, 0.55],
    ]) {
      expect(shapeA(u, v)).toBeCloseTo(shapeB(u, v), 9);
    }
  });

  it("farklı seed farklı bir desen üretir", () => {
    const shapeA = buildMicBottomPatchyShape({ seed: 1 });
    const shapeB = buildMicBottomPatchyShape({ seed: 2 });
    const valuesA = [0.1, 0.3, 0.5, 0.7, 0.9].map((u) => shapeA(u, 0.5));
    const valuesB = [0.1, 0.3, 0.5, 0.7, 0.9].map((u) => shapeB(u, 0.5));
    expect(valuesA).not.toEqual(valuesB);
  });

  it("şiddet alt yarım çemberde (bottom) yoğunlaşır — üst yarıya göre belirgin daha düşüktür", () => {
    const shape = buildMicBottomPatchyShape({ seed: 42 });
    const field = new DamageField(60, 60, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    let bottomSum = 0;
    let topSum = 0;
    for (let iv = 0; iv < 60; iv++) {
      const v = (iv + 0.5) / 60;
      const rowSum = Array.from({ length: 60 }, (_, iu) => field.getValueMm(iu, iv)).reduce((a, b) => a + b, 0);
      if (v > 0.25 && v < 0.75) bottomSum += rowSum;
      else topSum += rowSum;
    }
    expect(bottomSum).toBeGreaterThan(topSum);
  });
});

describe("UDC_SEDIMENT_BED — saat 5-7 arasında yoğunlaşır", () => {
  it("tepe v≈0,5 (saat 6)", () => {
    const shape = buildUdcSedimentBedShape();
    const field = new DamageField(80, 80, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    expect(field.findPeak().v).toBeCloseTo(0.5, 1);
  });

  it("saat 4'te (yayın çok dışında) neredeyse sıfırdır", () => {
    const shape = buildUdcSedimentBedShape();
    const clock4V = 4 / 12;
    expect(shape(0.5, clock4V)).toBeLessThan(shape(0.5, 0.5) * 0.05);
  });
});

describe("CUI_EXTERNAL_BANDS — çoklu bant", () => {
  it("varsayılan bant sayısı kadar yerel tepe üretir", () => {
    const shape = buildCuiExternalBandsShape();
    const field = new DamageField(200, 10, "CYLINDRICAL_UV");
    field.addContribution(shape, 1, 1);
    const hotspots = field.extractHotspots(10, 0.3);
    expect(hotspots.length).toBeGreaterThanOrEqual(3); // en az birkaç bant ayırt edilebilir olmalı
  });

  it("özel destek konumları verildiğinde onları kullanır", () => {
    const shape = buildCuiExternalBandsShape({ supportPositionsAxialFraction: [0.2, 0.8] });
    expect(shape(0.2, 0.5)).toBeGreaterThan(shape(0.5, 0.5));
  });
});
