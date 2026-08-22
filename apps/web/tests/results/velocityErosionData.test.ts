// apps/web/tests/results/velocityErosionData.test.ts

import { describe, expect, it } from "vitest";
import { buildVelocityErosionData } from "../../src/features/results/charts/velocityErosionData";
import { getTemplate } from "../../src/features/input/templates";

describe("buildVelocityErosionData", () => {
  it("kum mevcutsa (Kum İçeren Kuyu Başı Hattı) DNV_O501_SAND modunu seçer, hız arttıkça hız artar", () => {
    const values = getTemplate("sandy-wellhead")!.apply();
    const operatingCase = values.operatingProfile.cases[0];
    expect(operatingCase.solids.sandRateKgDay).toBeGreaterThan(0);

    const data = buildVelocityErosionData(values.geometry, operatingCase, values.mitigation);
    expect(data.mode).toBe("DNV_O501_SAND");
    expect(data.points.length).toBeGreaterThan(1);
    // Genel eğilim: en düşük hızdaki nokta en yüksek hızdakinden daha düşük olmalı (monoton artan bir model).
    expect(data.points[data.points.length - 1].rateMmPerYear).toBeGreaterThanOrEqual(data.points[0].rateMmPerYear);
    expect(data.operatingRateMmPerYear).toBeGreaterThan(0);
  });

  it("kum yok, damlacık erozyonu koşulları sağlanmıyorsa (Islak Gaz Toplama Hattı, STRATIFIED_WAVY) SCREENING_ONLY modunu seçer", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const operatingCase = values.operatingProfile.cases[0];
    expect(operatingCase.solids.sandRateKgDay).toBe(0);
    expect(operatingCase.process.flowRegime).not.toBe("MIST");

    const data = buildVelocityErosionData(values.geometry, operatingCase, values.mitigation);
    expect(data.mode).toBe("SCREENING_ONLY");
    expect(data.api14eScreening).not.toBeNull();
    expect(data.points.every((p) => p.rateMmPerYear === 0)).toBe(true);
  });

  it("SCREENING_ONLY modunda korozif kimya varsa (CO2>0) ve inhibitör YOKSA doğru kategori seçilir", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const operatingCase = values.operatingProfile.cases[0];
    const mitigationNoInhibitor = { ...values.mitigation, inhibitorUsed: false };
    const data = buildVelocityErosionData(values.geometry, operatingCase, mitigationNoInhibitor);
    expect(data.fluidCategoryUsed).toBe("SOLIDS_FREE_CORROSIVE_NO_MITIGATION");
  });

  it("kum yok ama MIST + serbest su varsa DROPLET_EROSION modunu seçer", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const operatingCase = { ...values.operatingProfile.cases[0], process: { ...values.operatingProfile.cases[0].process, flowRegime: "MIST" as const, isFreeWaterPresent: true, superficialGasVelocityMs: 90 } };
    const data = buildVelocityErosionData(values.geometry, operatingCase, values.mitigation);
    expect(data.mode).toBe("DROPLET_EROSION");
  });

  it("çalışma noktası hızı gerçek senaryo hızıyla eşleşir", () => {
    const values = getTemplate("sandy-wellhead")!.apply();
    const operatingCase = values.operatingProfile.cases[0];
    const data = buildVelocityErosionData(values.geometry, operatingCase, values.mitigation);
    expect(data.operatingVelocityMs).toBeCloseTo(operatingCase.process.mixtureVelocityMs, 9);
  });
});
