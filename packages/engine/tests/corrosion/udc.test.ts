// packages/engine/tests/corrosion/udc.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessUnderDepositRisk, isBelowCriticalTransportVelocity } from "../../src/corrosion/udc";

describe("isBelowCriticalTransportVelocity", () => {
  it("düşük hızda true döner", () => {
    expect(isBelowCriticalTransportVelocity(0.5)).toBe(true);
  });

  it("yüksek hızda false döner", () => {
    expect(isBelowCriticalTransportVelocity(3)).toBe(false);
  });
});

describe("assessUnderDepositRisk", () => {
  const baseInput = {
    actualVelocityMs: 3,
    depositFormingSolidsPresent: true,
    isLowPointOrDeadLeg: false,
    aggressiveWaterChemistryPresent: false,
    freeWaterPresent: true,
  };

  it("katı/tortu yoksa mekanizma tetiklenmez", () => {
    expect(assessUnderDepositRisk({ ...baseInput, depositFormingSolidsPresent: false }).isMechanismActive).toBe(false);
  });

  it("yüksek hız + düşük nokta yoksa mekanizma tetiklenmez", () => {
    expect(assessUnderDepositRisk(baseInput).isMechanismActive).toBe(false);
  });

  it("düşük hız mekanizmayı tetikler ve risk skoru pozitiftir", () => {
    const result = assessUnderDepositRisk({ ...baseInput, actualVelocityMs: 0.5 });
    expect(result.isMechanismActive).toBe(true);
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("düşük nokta/ölü bacak tek başına mekanizmayı tetikler", () => {
    const result = assessUnderDepositRisk({ ...baseInput, isLowPointOrDeadLeg: true });
    expect(result.isMechanismActive).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(40);
  });

  it("agresif su kimyası ek risk puanı ekler", () => {
    const withoutChem = assessUnderDepositRisk({ ...baseInput, actualVelocityMs: 0.5 });
    const withChem = assessUnderDepositRisk({ ...baseInput, actualVelocityMs: 0.5, aggressiveWaterChemistryPresent: true });
    expect(withChem.riskScore).toBeGreaterThan(withoutChem.riskScore);
  });

  it("hız açığı arttıkça risk skoru MONOTON artar", () => {
    const near = assessUnderDepositRisk({ ...baseInput, actualVelocityMs: 1.4 });
    const far = assessUnderDepositRisk({ ...baseInput, actualVelocityMs: 0.2 });
    expect(far.riskScore).toBeGreaterThan(near.riskScore);
  });
});

describe("udc — KDP kayıt defteri entegrasyonu", () => {
  it("udc.minimumTransportVelocityRangeMs kayıtlıdır ve LOW confidence taşır (birincil doğrulama yok)", () => {
    const entry = listCoefficients().find((c) => c.id === "udc.minimumTransportVelocityRangeMs");
    expect(entry?.confidence).toBe("LOW");
  });
});
