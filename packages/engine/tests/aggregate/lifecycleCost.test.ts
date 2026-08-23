// packages/engine/tests/aggregate/lifecycleCost.test.ts

import { describe, expect, it } from "vitest";
import { compareLifecycleCost } from "../../src/aggregate/lifecycleCost";

describe("compareLifecycleCost — göreli birim (CS=1.0), NPV", () => {
  it("yıl 0'da kümülatif maliyet tam CAPEX'e eşittir", () => {
    const result = compareLifecycleCost([
      { labelTr: "CS + İnhibitör", relativeCapexCostIndex: 1.0, inhibitorUsed: true, continuousMonitoringApplied: true, inspectionIntervalYears: 2 },
      { labelTr: "CRA", relativeCapexCostIndex: 3.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 10 },
    ]);
    expect(result.options[0].cumulativeByYear[0].cumulativeUndiscountedRelative).toBe(1.0);
    expect(result.options[1].cumulativeByYear[0].cumulativeUndiscountedRelative).toBe(3.0);
  });

  it("düşük CAPEX + yüksek OPEX'li CS seçeneği, uzun ufukta CRA'dan pahalıya gelebilir", () => {
    const result = compareLifecycleCost(
      [
        { labelTr: "CS + İnhibitör", relativeCapexCostIndex: 1.0, inhibitorUsed: true, continuousMonitoringApplied: true, inspectionIntervalYears: 1 },
        { labelTr: "CRA", relativeCapexCostIndex: 3.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 10 },
      ],
      { horizonYears: 30, discountRatePercent: 0, inhibitorAnnualCostFactor: 0.2, monitoringAnnualCostFactor: 0.1, inspectionEventCostFactor: 0.05 },
    );
    // İskonto oranı 0 iken NPV = basit toplam. CS: 1.0 + 30×(0.2+0.1+0.05) = 1+30×0.35=11.5. CRA: 3.0 + 3×0.05=3.15.
    expect(result.options[0].npvRelative).toBeCloseTo(11.5, 6);
    expect(result.options[1].npvRelative).toBeCloseTo(3.15, 6);
    expect(result.cheaperOptionLabelTr).toBe("CRA");
  });

  it("cheaperOptionLabelTr en düşük NPV'li seçeneği doğru raporlar", () => {
    const result = compareLifecycleCost([
      { labelTr: "A", relativeCapexCostIndex: 1.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 100 },
      { labelTr: "B", relativeCapexCostIndex: 0.5, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 100 },
    ]);
    expect(result.cheaperOptionLabelTr).toBe("B");
  });

  it("varsayılan iskonto oranı/OPEX faktörleri kullanılabilir (girdi verilmezse)", () => {
    const result = compareLifecycleCost([
      { labelTr: "CS", relativeCapexCostIndex: 1.0, inhibitorUsed: true, continuousMonitoringApplied: true, inspectionIntervalYears: 5 },
      { labelTr: "CRA", relativeCapexCostIndex: 3.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 10 },
    ]);
    expect(result.assumptions.horizonYears).toBe(30);
    expect(result.assumptions.discountRatePercent).toBe(8);
  });

  it("2'den az seçenek için hata fırlatır", () => {
    expect(() =>
      compareLifecycleCost([{ labelTr: "Tek", relativeCapexCostIndex: 1.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 5 }]),
    ).toThrowError();
  });

  it("horizonYears≤0 için hata fırlatır", () => {
    expect(() =>
      compareLifecycleCost(
        [
          { labelTr: "A", relativeCapexCostIndex: 1.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 5 },
          { labelTr: "B", relativeCapexCostIndex: 2.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 5 },
        ],
        { horizonYears: 0 },
      ),
    ).toThrowError();
  });

  it("notesTr göreli birim ve UNVERIFIED uyarısını içerir", () => {
    const result = compareLifecycleCost([
      { labelTr: "A", relativeCapexCostIndex: 1.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 5 },
      { labelTr: "B", relativeCapexCostIndex: 2.0, inhibitorUsed: false, continuousMonitoringApplied: false, inspectionIntervalYears: 5 },
    ]);
    expect(result.notesTr.join(" ")).toContain("PARA BİRİMİ");
  });
});
