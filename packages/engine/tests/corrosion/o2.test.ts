// packages/engine/tests/corrosion/o2.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessOxygenCorrosionRisk } from "../../src/corrosion/o2";

describe("assessOxygenCorrosionRisk", () => {
  const baseInput = {
    dissolvedOxygenPpb: 5,
    rapidTemperatureRiseLocation: false,
    flowVelocityMs: 1,
    freeWaterPresent: true,
    isDryGas: false,
  };

  it("kuru gazda mekanizma tetiklenmez", () => {
    const result = assessOxygenCorrosionRisk({ ...baseInput, isDryGas: true });
    expect(result.isMechanismActive).toBe(false);
    expect(result.riskScore).toBe(0);
  });

  it("serbest su yoksa mekanizma tetiklenmez", () => {
    expect(assessOxygenCorrosionRisk({ ...baseInput, freeWaterPresent: false }).isMechanismActive).toBe(false);
  });

  it("düşük O2 (bant altı) mekanizmayı tetiklemez", () => {
    expect(assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: 3 }).isMechanismActive).toBe(false);
  });

  it("yüksek O2 mekanizmayı tetikler ve risk skoru artar", () => {
    const moderate = assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: 50 });
    const high = assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: 600 });
    expect(moderate.isMechanismActive).toBe(true);
    expect(high.riskScore).toBeGreaterThan(moderate.riskScore);
    expect(high.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("ani sıcaklık artışı noktası ek risk puanı ekler", () => {
    const base = assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: 50 });
    const rapidRise = assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: 50, rapidTemperatureRiseLocation: true });
    expect(rapidRise.riskScore).toBeGreaterThan(base.riskScore);
  });

  it("geçersiz girdi için hata fırlatır", () => {
    expect(() => assessOxygenCorrosionRisk({ ...baseInput, dissolvedOxygenPpb: -1 })).toThrowError();
  });
});

describe("o2 — KDP kayıt defteri entegrasyonu", () => {
  it("oxygen.riskBandsPpb kayıtlıdır ve MEDIUM confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "oxygen.riskBandsPpb");
    expect(entry).toBeDefined();
    expect(entry?.confidence).toBe("MEDIUM");
  });
});
