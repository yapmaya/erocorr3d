// packages/engine/tests/corrosion/galvanic.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessGalvanicRisk, computeAreaRatioAccelerationFactor, getGalvanicSeriesRank } from "../../src/corrosion/galvanic";

describe("getGalvanicSeriesRank", () => {
  it("titanyum en soy (rank=1) civarındadır", () => {
    expect(getGalvanicSeriesRank("TITANIUM")).toBe(1);
  });

  it("bilinmeyen malzeme için hata fırlatır", () => {
    expect(() => getGalvanicSeriesRank("UNOBTANIUM")).toThrowError();
  });
});

describe("computeAreaRatioAccelerationFactor", () => {
  it("büyük katot/küçük anot yüksek çarpan verir", () => {
    expect(computeAreaRatioAccelerationFactor(1, 100)).toBeCloseTo(100, 5);
  });

  it("eşit alanlarda çarpan 1'dir", () => {
    expect(computeAreaRatioAccelerationFactor(10, 10)).toBeCloseTo(1, 5);
  });

  it("geçersiz alan için hata fırlatır", () => {
    expect(() => computeAreaRatioAccelerationFactor(0, 10)).toThrowError();
  });
});

describe("assessGalvanicRisk", () => {
  const baseInput = {
    anodeMaterialLabel: "CARBON_STEEL_LTCS",
    cathodeMaterialLabel: "STAINLESS_316_PASSIVE",
    anodeAreaM2: 10,
    cathodeAreaM2: 10,
    electrolytePresent: true,
    isolationKitPresent: false,
  };

  it("elektrolit yoksa mekanizma tetiklenmez", () => {
    expect(assessGalvanicRisk({ ...baseInput, electrolytePresent: false }).isMechanismActive).toBe(false);
  });

  it("izolasyon kiti varsa mekanizma tetiklenmez", () => {
    expect(assessGalvanicRisk({ ...baseInput, isolationKitPresent: true }).isMechanismActive).toBe(false);
  });

  it("CS anot + 316 katot mekanizmayı tetikler", () => {
    const result = assessGalvanicRisk(baseInput);
    expect(result.isMechanismActive).toBe(true);
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.conditionalRateRangeMmPerYear).toBeNull();
  });

  it("küçük anot/büyük katot alan oranı risk skorunu artırır", () => {
    const equalArea = assessGalvanicRisk(baseInput);
    const smallAnode = assessGalvanicRisk({ ...baseInput, anodeAreaM2: 0.1, cathodeAreaM2: 10 });
    expect(smallAnode.riskScore).toBeGreaterThan(equalArea.riskScore);
  });

  it("yüksek risk skorunda izolasyon kiti önerisi uyarısı verir", () => {
    const result = assessGalvanicRisk({ ...baseInput, anodeAreaM2: 0.1, cathodeAreaM2: 50 });
    expect(result.validityWarnings.some((w) => w.parameter === "İzolasyon kiti önerisi")).toBe(true);
  });
});

describe("galvanic — KDP kayıt defteri entegrasyonu", () => {
  it("galvanic.seawaterSeries kayıtlıdır ve MEDIUM confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "galvanic.seawaterSeries");
    expect(entry?.confidence).toBe("MEDIUM");
  });

  it("alan oranı formülü belgesi kayıtlıdır", () => {
    const entry = listCoefficients().find((c) => c.id === "galvanic.areaRatioWorstCaseFormula");
    expect(entry).toBeDefined();
  });
});
