// packages/engine/tests/aggregate/inspectionInterval.test.ts

import { describe, expect, it } from "vitest";
import { computeInspectionInterval } from "../../src/aggregate/inspectionInterval";
import { listCoefficients } from "../../src/registry";

const ASOF = new Date("2026-08-23T00:00:00.000Z");

describe("computeInspectionInterval — API 570 yarım-ömür kuralı + Piping Class tavanı", () => {
  it("düşük hızda, geniş marjda: aralık Piping Class tavanınca sınırlanır", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: 100,
      annualLossRateMmPerYear: { p10: 0.01, p50: 0.02, p90: 0.03 },
      api570PipingClass: 1,
      ctlAtlCategory: "NEGLIGIBLE",
      asOfDate: ASOF,
    });
    // P90 kalan ömür = 100/0.03 ≈ 3333 yıl >> tavan (Class 1 = 5 yıl)
    expect(result.recommendedIntervalYears).toBe(5);
    expect(result.api570PipingClassMaxIntervalYears).toBe(5);
  });

  it("yüksek hızda: aralık yarım-ömür × risk çarpanına göre kısalır (tavanın altında)", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: 10,
      annualLossRateMmPerYear: { p10: 0.5, p50: 1, p90: 2 },
      api570PipingClass: 2,
      ctlAtlCategory: "HIGH",
      asOfDate: ASOF,
    });
    // P90 kalan ömür = 10/2 = 5 yıl; × 0.5 (yarım-ömür) × 0.5 (HIGH çarpanı) = 1.25 yıl
    expect(result.remainingLifeFromNowYearsP90).toBeCloseTo(5, 6);
    expect(result.recommendedIntervalYears).toBeCloseTo(1.25, 6);
    expect(result.recommendedIntervalYears).toBeLessThan(result.api570PipingClassMaxIntervalYears);
  });

  it("kalan pay ≤0 ise ACİL (0 yıl) önerir ve uyarı üretir", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: -0.5,
      annualLossRateMmPerYear: { p10: 0.1, p50: 0.2, p90: 0.3 },
      api570PipingClass: 1,
      ctlAtlCategory: "HIGH",
      asOfDate: ASOF,
    });
    expect(result.recommendedIntervalYears).toBe(0);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
    expect(result.nextInspectionDate).toBe("2026-08-23");
  });

  it("P90 hızı 0 ise (kayıp yok) aralık yalnızca Piping Class tavanınca belirlenir", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: 10,
      annualLossRateMmPerYear: { p10: 0, p50: 0, p90: 0 },
      api570PipingClass: 3,
      ctlAtlCategory: "NEGLIGIBLE",
      asOfDate: ASOF,
    });
    expect(result.remainingLifeFromNowYearsP90).toBeNull();
    expect(result.recommendedIntervalYears).toBe(10);
  });

  it("ctlAtlCategory=null iken ORTA (0.75) risk çarpanı ile muhafazakâr davranır ve uyarı üretir", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: 10,
      annualLossRateMmPerYear: { p10: 0.5, p50: 1, p90: 2 },
      api570PipingClass: 2,
      ctlAtlCategory: null,
      asOfDate: ASOF,
    });
    expect(result.riskCategoryMultiplier).toBeCloseTo(0.75, 6);
    expect(result.validityWarnings.some((w) => w.parameter === "ctlAtlCategory")).toBe(true);
  });

  it("nextInspectionDate, asOfDate'e recommendedIntervalYears eklenerek üretilir", () => {
    const result = computeInspectionInterval({
      currentWallMarginMm: 100,
      annualLossRateMmPerYear: { p10: 0.01, p50: 0.02, p90: 0.03 },
      api570PipingClass: 1,
      ctlAtlCategory: "NEGLIGIBLE",
      asOfDate: ASOF,
    });
    expect(result.recommendedIntervalYears).toBe(5);
    const expected = new Date(ASOF.getTime());
    expected.setUTCDate(expected.getUTCDate() + Math.round(5 * 365.25));
    expect(result.nextInspectionDate).toBe(expected.toISOString().slice(0, 10));
  });

  it("geçersiz Piping Class için hata fırlatır", () => {
    expect(() =>
      computeInspectionInterval({
        currentWallMarginMm: 10,
        annualLossRateMmPerYear: { p10: 0.1, p50: 0.2, p90: 0.3 },
        // @ts-expect-error kasıtlı geçersiz değer
        api570PipingClass: 5,
        ctlAtlCategory: "LOW",
        asOfDate: ASOF,
      }),
    ).toThrowError();
  });
});

describe("inspectionPlan — KDP kayıt defteri entegrasyonu", () => {
  it("API 570 katsayıları kayıtlıdır, MEDIUM confidence taşır ve çapraz doğrulanmıştır", () => {
    const fraction = listCoefficients().find((c) => c.id === "inspectionPlan.halfRemainingLifeFraction");
    const table = listCoefficients().find((c) => c.id === "inspectionPlan.api570PipingClassMaxUtIntervalYears");
    expect(fraction?.confidence).toBe("MEDIUM");
    expect(fraction?.crossChecked).toBe(true);
    expect(table?.confidence).toBe("MEDIUM");
    expect(table?.crossChecked).toBe(true);
  });
});
