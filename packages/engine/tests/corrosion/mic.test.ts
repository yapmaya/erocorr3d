// packages/engine/tests/corrosion/mic.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessMicRisk, isWithinMicSurvivalWindow } from "../../src/corrosion/mic";

describe("isWithinMicSurvivalWindow", () => {
  it("API 571 penceresi içinde true döner", () => {
    expect(isWithinMicSurvivalWindow(30, 7)).toBe(true);
  });

  it("pencere dışında (çok sıcak) false döner", () => {
    expect(isWithinMicSurvivalWindow(150, 7)).toBe(false);
  });
});

describe("assessMicRisk", () => {
  const baseInput = {
    temperatureC: 25,
    inSituPh: 7,
    freeWaterPresent: true,
    isStagnantOrDeadLeg: true,
    waterType: "PRODUCED_WATER" as const,
    biocideProgramActive: false,
  };

  it("serbest su yoksa mekanizma tetiklenmez", () => {
    expect(assessMicRisk({ ...baseInput, freeWaterPresent: false }).isMechanismActive).toBe(false);
  });

  it("hayatta kalma penceresi dışında mekanizma tetiklenmez", () => {
    expect(assessMicRisk({ ...baseInput, temperatureC: 150 }).isMechanismActive).toBe(false);
  });

  it("durgun akış + hidrotest suyu yüksek risk skoru verir", () => {
    const result = assessMicRisk({ ...baseInput, waterType: "HYDROTEST_WATER_LEFT_IN_SYSTEM" });
    expect(result.isMechanismActive).toBe(true);
    expect(result.riskScore).toBeGreaterThanOrEqual(50);
    expect(result.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("aktif biyosit programı riski azaltır", () => {
    const withoutBiocide = assessMicRisk(baseInput);
    const withBiocide = assessMicRisk({ ...baseInput, biocideProgramActive: true });
    expect(withBiocide.riskScore).toBeLessThan(withoutBiocide.riskScore);
  });

  it("durgun olmayan akış riski düşürür", () => {
    const stagnant = assessMicRisk(baseInput);
    const flowing = assessMicRisk({ ...baseInput, isStagnantOrDeadLeg: false });
    expect(flowing.riskScore).toBeLessThan(stagnant.riskScore);
  });
});

describe("mic — KDP kayıt defteri entegrasyonu", () => {
  it("mic.organismSurvivalWindow kayıtlıdır ve HIGH confidence taşır (API 571 doğrudan okundu)", () => {
    const entry = listCoefficients().find((c) => c.id === "mic.organismSurvivalWindow");
    expect(entry?.confidence).toBe("HIGH");
  });
});
