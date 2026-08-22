// packages/engine/tests/uncertainty/calibration.test.ts

import { describe, expect, it } from "vitest";
import {
  applyCalibrationFactor,
  buildCalibrationResult,
  classifyCalibrationQuality,
  computeCalibrationFactor,
  computeCouponLossRateMmPerYear,
  computeUtThicknessLossRateMmPerYear,
} from "../../src/uncertainty/calibration";

describe("computeCouponLossRateMmPerYear — ASTM G1", () => {
  it("K=8,76e4 formülünü doğru uygular (elle hesaplanmış referans)", () => {
    // CR = (8.76e4 × 5) / (10 × 4380 × 7.85) — 6 aylık (4380 saat) maruziyet, karbon çeliği yoğunluğu
    const rate = computeCouponLossRateMmPerYear({
      massLossG: 5,
      areaCm2: 10,
      exposureHours: 4380,
      densityGPerCm3: 7.85,
    });
    const expected = (8.76e4 * 5) / (10 * 4380 * 7.85);
    expect(rate).toBeCloseTo(expected, 9);
    expect(rate).toBeCloseTo(1.27389, 4);
  });

  it("geçersiz girdilerde hata fırlatır", () => {
    expect(() =>
      computeCouponLossRateMmPerYear({ massLossG: -1, areaCm2: 10, exposureHours: 100, densityGPerCm3: 7.85 }),
    ).toThrowError();
    expect(() =>
      computeCouponLossRateMmPerYear({ massLossG: 1, areaCm2: 0, exposureHours: 100, densityGPerCm3: 7.85 }),
    ).toThrowError();
  });
});

describe("computeUtThicknessLossRateMmPerYear", () => {
  it("kalınlık azalmasından doğru hızı hesaplar", () => {
    const rate = computeUtThicknessLossRateMmPerYear({
      thicknessMmAtStart: 10,
      thicknessMmAtEnd: 8.5,
      intervalYears: 5,
    });
    expect(rate).toBeCloseTo(0.3, 6);
  });

  it("kalınlık artışını (negatif hızı) 0'a kırpar", () => {
    const rate = computeUtThicknessLossRateMmPerYear({
      thicknessMmAtStart: 8,
      thicknessMmAtEnd: 9,
      intervalYears: 2,
    });
    expect(rate).toBe(0);
  });
});

describe("computeCalibrationFactor / applyCalibrationFactor", () => {
  it("ölçülen hız model tahminine eşitse çarpan 1'dir", () => {
    expect(computeCalibrationFactor(2, 2)).toBeCloseTo(1, 9);
  });

  it("ölçülen hız iki katıysa çarpan 2'dir", () => {
    expect(computeCalibrationFactor(4, 2)).toBeCloseTo(2, 9);
  });

  it("model tahmini 0 (veya negatif) iken hata fırlatır", () => {
    expect(() => computeCalibrationFactor(1, 0)).toThrowError();
    expect(() => computeCalibrationFactor(1, -1)).toThrowError();
  });

  it("bandın üç noktasını da aynı çarpanla ölçekler", () => {
    const band = applyCalibrationFactor({ p10: 1, p50: 2, p90: 4 }, 2);
    expect(band).toEqual({ p10: 2, p50: 4, p90: 8 });
  });
});

describe("classifyCalibrationQuality", () => {
  it("makul aralıktaki çarpanı NORMAL sınıflar", () => {
    expect(classifyCalibrationQuality(1)).toBe("NORMAL");
    expect(classifyCalibrationQuality(0.5)).toBe("NORMAL");
    expect(classifyCalibrationQuality(3)).toBe("NORMAL");
  });

  it("çok düşük çarpanı SUSPICIOUS_LOW sınıflar", () => {
    expect(classifyCalibrationQuality(0.1)).toBe("SUSPICIOUS_LOW");
  });

  it("çok yüksek çarpanı SUSPICIOUS_HIGH sınıflar", () => {
    expect(classifyCalibrationQuality(6)).toBe("SUSPICIOUS_HIGH");
  });
});

describe("buildCalibrationResult", () => {
  it("DIRECT_RATE ölçüm tipiyle uçtan uca çalışır", () => {
    const result = buildCalibrationResult({
      measurementType: "DIRECT_RATE",
      measurement: { measuredRateMmPerYear: 3 },
      modelPredictedRateP50MmPerYear: 1.5,
      modelPredictedRateBand: { p10: 0.6, p50: 1.5, p90: 3.0 },
    });
    expect(result.calibrationFactor).toBeCloseTo(2, 9);
    expect(result.qualityFlag).toBe("NORMAL");
    expect(result.calibratedBand).toEqual({ p10: 1.2, p50: 3, p90: 6 });
  });

  it("COUPON_WEIGHT_LOSS ölçüm tipiyle çalışır ve kaynağı kaydeder", () => {
    const result = buildCalibrationResult({
      measurementType: "COUPON_WEIGHT_LOSS",
      measurement: { massLossG: 5, areaCm2: 10, exposureHours: 4380, densityGPerCm3: 7.85 },
      modelPredictedRateP50MmPerYear: 1.27389,
    });
    expect(result.measuredRateMmPerYear).toBeCloseTo(1.27389, 4);
    expect(result.calibrationFactor).toBeCloseTo(1, 2);
    expect(result.sourcesUsed).toContain("uncertainty.astmG1.couponLossConstantMmPerYear");
  });

  it("UT_THICKNESS_LOSS için kalınlık artışında uyarı üretir", () => {
    const result = buildCalibrationResult({
      measurementType: "UT_THICKNESS_LOSS",
      measurement: { thicknessMmAtStart: 8, thicknessMmAtEnd: 9, intervalYears: 2 },
      modelPredictedRateP50MmPerYear: 0.5,
    });
    expect(result.measuredRateMmPerYear).toBe(0);
    expect(result.warningsTr.some((w) => w.includes("ARTIŞI"))).toBe(true);
  });

  it("şüpheli düşük çarpan için ek uyarı üretir", () => {
    const result = buildCalibrationResult({
      measurementType: "DIRECT_RATE",
      measurement: { measuredRateMmPerYear: 0.05 },
      modelPredictedRateP50MmPerYear: 1,
    });
    expect(result.qualityFlag).toBe("SUSPICIOUS_LOW");
    expect(result.warningsTr.length).toBeGreaterThan(0);
  });

  it("modelPredictedRateBand verilmezse calibratedBand null'dur", () => {
    const result = buildCalibrationResult({
      measurementType: "DIRECT_RATE",
      measurement: { measuredRateMmPerYear: 1 },
      modelPredictedRateP50MmPerYear: 1,
    });
    expect(result.calibratedBand).toBeNull();
  });
});
