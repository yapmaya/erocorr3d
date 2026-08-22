// packages/engine/tests/corrosion/cui.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessCuiRisk, isWithinCuiTemperatureWindow } from "../../src/corrosion/cui";

describe("isWithinCuiTemperatureWindow", () => {
  it("karbon çeliği için pencere içinde true döner", () => {
    expect(isWithinCuiTemperatureWindow("CARBON_STEEL", 50)).toBe(true);
  });

  it("paslanmaz çelik için karbon çeliği penceresinde geçerli olmayan bir sıcaklıkta false döner", () => {
    expect(isWithinCuiTemperatureWindow("AUSTENITIC_OR_DUPLEX_STAINLESS", 30)).toBe(false);
  });
});

describe("assessCuiRisk", () => {
  const baseInput = {
    isInsulated: true,
    materialFamily: "CARBON_STEEL" as const,
    operatingTemperatureC: 50,
    isCyclicService: false,
    vaporBarrierDamaged: false,
    isCriticalCuiLocation: false,
  };

  it("yalıtımsız bileşende mekanizma tetiklenmez", () => {
    expect(assessCuiRisk({ ...baseInput, isInsulated: false }).isMechanismActive).toBe(false);
  });

  it("riskli pencere dışında mekanizma tetiklenmez", () => {
    expect(assessCuiRisk({ ...baseInput, operatingTemperatureC: 300 }).isMechanismActive).toBe(false);
  });

  it("en riskli alt-bant (100-121°C) ek risk puanı verir", () => {
    const normal = assessCuiRisk({ ...baseInput, operatingTemperatureC: 50 });
    const worstCase = assessCuiRisk({ ...baseInput, operatingTemperatureC: 110 });
    expect(worstCase.riskScore).toBeGreaterThan(normal.riskScore);
    expect(worstCase.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("hasarlı buhar bariyeri + siklik servis + kritik konum risk skorunu ciddi artırır", () => {
    const base = assessCuiRisk(baseInput);
    const worse = assessCuiRisk({
      ...baseInput,
      vaporBarrierDamaged: true,
      isCyclicService: true,
      isCriticalCuiLocation: true,
    });
    expect(worse.riskScore).toBeGreaterThan(base.riskScore);
    expect(worse.riskScore).toBeGreaterThanOrEqual(50);
  });

  it("paslanmaz çelik + klorür sızdıran yalıtım EXTERNAL_CSCC uyarısı ekler", () => {
    const result = assessCuiRisk({
      isInsulated: true,
      materialFamily: "AUSTENITIC_OR_DUPLEX_STAINLESS",
      operatingTemperatureC: 100,
      isCyclicService: false,
      vaporBarrierDamaged: false,
      isCriticalCuiLocation: false,
      insulationChlorideLeachRisk: true,
    });
    expect(result.validityWarnings.some((w) => w.parameter === "Dış CSCC riski")).toBe(true);
  });
});

describe("cui — KDP kayıt defteri entegrasyonu", () => {
  it("cui.temperatureWindow kayıtlıdır ve HIGH confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "cui.temperatureWindow");
    expect(entry?.confidence).toBe("HIGH");
  });
});
