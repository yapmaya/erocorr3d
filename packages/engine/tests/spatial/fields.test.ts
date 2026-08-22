// packages/engine/tests/spatial/fields.test.ts

import { describe, expect, it } from "vitest";
import {
  DamageField,
  circularGaussianKernel,
  describeClockPositionTr,
  integrateOverUnitSquare,
  linearGaussianKernel,
  normalizeShapeFn,
  solveCircularSegmentAngleRad,
  vToClockPosition,
} from "../../src/spatial/fields";

describe("integrateOverUnitSquare", () => {
  it("sabit fonksiyonun (f=1) integrali 1'dir", () => {
    expect(integrateOverUnitSquare(() => 1, 100)).toBeCloseTo(1, 6);
  });

  it("f=2'nin integrali 2'dir", () => {
    expect(integrateOverUnitSquare(() => 2, 100)).toBeCloseTo(2, 6);
  });
});

describe("normalizeShapeFn", () => {
  it("herhangi bir pozitif fonksiyonu ∫∫=1 olacak şekilde normalize eder", () => {
    const normalized = normalizeShapeFn((u, v) => 3 + u + v, 300);
    const integral = integrateOverUnitSquare(normalized, 300);
    expect(integral).toBeCloseTo(1, 2);
  });

  it("integrali sıfır/negatif olan fonksiyon için hata fırlatır", () => {
    expect(() => normalizeShapeFn(() => 0)).toThrowError();
    expect(() => normalizeShapeFn(() => -1)).toThrowError();
  });
});

describe("circularGaussianKernel", () => {
  it("merkezde en yüksek değeri (1) verir", () => {
    expect(circularGaussianKernel(0.3, 0.3, 0.05)).toBeCloseTo(1, 6);
  });

  it("dairesel sarma (wrap-around) doğru çalışır: v=0,98 ile centerV=0,02 yakındır", () => {
    const wrapped = circularGaussianKernel(0.98, 0.02, 0.05);
    const naive = circularGaussianKernel(0.5, 0.02, 0.05); // uzak nokta, referans için
    expect(wrapped).toBeGreaterThan(naive);
    expect(wrapped).toBeGreaterThan(0.5);
  });
});

describe("linearGaussianKernel", () => {
  it("merkezde en yüksek değeri (1) verir, sınırlı (periyodik değil)", () => {
    expect(linearGaussianKernel(0.5, 0.5, 0.1)).toBeCloseTo(1, 6);
    // u=0,99 ile centerU=0,01 arası UZAK sayılır (periyodik sarma YOK)
    expect(linearGaussianKernel(0.99, 0.01, 0.05)).toBeLessThan(0.01);
  });
});

describe("solveCircularSegmentAngleRad", () => {
  it("areaFraction=0,5 → φ=π TAM OLARAK (kendi kendini doğrulayan yarım daire durumu)", () => {
    expect(solveCircularSegmentAngleRad(0.5)).toBeCloseTo(Math.PI, 9);
  });

  it("areaFraction=0 → φ=0, areaFraction=1 → φ=2π", () => {
    expect(solveCircularSegmentAngleRad(0)).toBe(0);
    expect(solveCircularSegmentAngleRad(1)).toBeCloseTo(2 * Math.PI, 9);
  });

  it("küçük areaFraction küçük φ, büyük areaFraction büyük φ verir (monoton)", () => {
    const low = solveCircularSegmentAngleRad(0.1);
    const high = solveCircularSegmentAngleRad(0.4);
    expect(high).toBeGreaterThan(low);
  });

  it("[0,1] dışı için hata fırlatır", () => {
    expect(() => solveCircularSegmentAngleRad(-0.1)).toThrowError();
    expect(() => solveCircularSegmentAngleRad(1.1)).toThrowError();
  });
});

describe("vToClockPosition / describeClockPositionTr", () => {
  it("v=0→12, v=0,25→3, v=0,5→6, v=0,75→9", () => {
    expect(vToClockPosition(0)).toBe(12);
    expect(vToClockPosition(0.25)).toBeCloseTo(3, 9);
    expect(vToClockPosition(0.5)).toBeCloseTo(6, 9);
    expect(vToClockPosition(0.75)).toBeCloseTo(9, 9);
  });

  it("Türkçe açıklama üretir", () => {
    expect(describeClockPositionTr(6)).toContain("saat 6");
    expect(describeClockPositionTr(12)).toContain("saat 12");
  });
});

describe("DamageField", () => {
  it("boş ızgara sıfırdan başlar", () => {
    const field = new DamageField(10, 10, "CYLINDRICAL_UV");
    expect(field.computeMeanValueMm()).toBe(0);
  });

  it("addContribution: kütle korunumu — ortalama değer ≈ hız×süre (±%2)", () => {
    const field = new DamageField(80, 80, "CYLINDRICAL_UV");
    const shape = normalizeShapeFn((u, v) => circularGaussianKernel(v, 0.5, 0.1) * linearGaussianKernel(u, 0.3, 0.2), 300);
    field.addContribution(shape, 2, 10); // 2 mm/yıl × 10 yıl = 20 mm beklenen ortalama
    const mean = field.computeMeanValueMm();
    expect(mean).toBeGreaterThan(20 * 0.98);
    expect(mean).toBeLessThan(20 * 1.02);
  });

  it("accumulate: birden fazla katkı toplamı doğrusal birikir", () => {
    const field = new DamageField(60, 60, "CYLINDRICAL_UV");
    const shapeA = normalizeShapeFn(() => 1);
    const shapeB = normalizeShapeFn((u, v) => circularGaussianKernel(v, 0.5, 0.1) * linearGaussianKernel(u, 0.5, 0.1));
    field.accumulate(
      [
        { mechanismId: "a", shapeFn: shapeA, rateMmPerYear: 1 },
        { mechanismId: "b", shapeFn: shapeB, rateMmPerYear: 3 },
      ],
      5,
    );
    expect(field.computeMeanValueMm()).toBeCloseTo((1 + 3) * 5, 0);
  });

  it("findPeak: tek bir Gauss tepesinin konumunu doğru bulur", () => {
    const field = new DamageField(100, 100, "CYLINDRICAL_UV");
    const shape = normalizeShapeFn((u, v) => circularGaussianKernel(v, 0.7, 0.05) * linearGaussianKernel(u, 0.2, 0.05));
    field.addContribution(shape, 1, 1);
    const peak = field.findPeak();
    expect(peak.u).toBeCloseTo(0.2, 1);
    expect(peak.v).toBeCloseTo(0.7, 1);
  });

  it("negatif rateMmPerYear/elapsedYears hata fırlatır", () => {
    const field = new DamageField(10, 10, "CYLINDRICAL_UV");
    expect(() => field.addContribution(normalizeShapeFn(() => 1), -1, 1)).toThrowError();
    expect(() => field.addContribution(normalizeShapeFn(() => 1), 1, -1)).toThrowError();
  });

  it("toSpatialDamageField: Zod şemasının beklediği tüm alanları üretir", () => {
    const field = new DamageField(32, 32, "CYLINDRICAL_UV");
    field.addContribution(normalizeShapeFn(() => 1), 1, 5);
    const result = field.toSpatialDamageField();
    expect(result.resolutionU).toBe(32);
    expect(result.resolutionV).toBe(32);
    expect(result.valuesMm.length).toBe(32 * 32);
    expect(result.maxValueMm).toBeGreaterThan(0);
    expect(result.maxLocation.clockPosition).toBeGreaterThanOrEqual(1);
    expect(result.maxLocation.clockPosition).toBeLessThanOrEqual(12);
  });

  it("extractHotspots: eşiğin altındaki noktaları eler, azalan sırada döner", () => {
    const field = new DamageField(100, 100, "CYLINDRICAL_UV");
    const bigPeak = normalizeShapeFn((u, v) => circularGaussianKernel(v, 0.2, 0.03) * linearGaussianKernel(u, 0.2, 0.03));
    const smallPeak = normalizeShapeFn((u, v) => circularGaussianKernel(v, 0.8, 0.03) * linearGaussianKernel(u, 0.8, 0.03));
    field.accumulate(
      [
        { mechanismId: "big", shapeFn: bigPeak, rateMmPerYear: 10 },
        { mechanismId: "small", shapeFn: smallPeak, rateMmPerYear: 1 },
      ],
      1,
    );
    const hotspots = field.extractHotspots(5, 0.05);
    expect(hotspots.length).toBeGreaterThanOrEqual(2);
    expect(hotspots[0].valueMm).toBeGreaterThanOrEqual(hotspots[1].valueMm);
  });

  it("ızgara bağımsızlığı: çözünürlük 2× → tepe konumu (u,v) değişmiyor", () => {
    const shape = normalizeShapeFn(
      (u, v) => circularGaussianKernel(v, 0.65, 0.05) * linearGaussianKernel(u, 0.35, 0.05),
      300,
    );
    const low = new DamageField(50, 50, "CYLINDRICAL_UV");
    low.addContribution(shape, 1, 1);
    const high = new DamageField(100, 100, "CYLINDRICAL_UV");
    high.addContribution(shape, 1, 1);

    const peakLow = low.findPeak();
    const peakHigh = high.findPeak();
    expect(Math.abs(peakLow.u - peakHigh.u)).toBeLessThan(0.03);
    expect(Math.abs(peakLow.v - peakHigh.v)).toBeLessThan(0.03);
  });

  it("geçersiz çözünürlük için hata fırlatır", () => {
    expect(() => new DamageField(0, 10, "CYLINDRICAL_UV")).toThrowError();
    expect(() => new DamageField(10, 1.5, "CYLINDRICAL_UV")).toThrowError();
  });
});
