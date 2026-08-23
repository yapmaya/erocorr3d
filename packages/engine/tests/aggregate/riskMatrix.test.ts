// packages/engine/tests/aggregate/riskMatrix.test.ts

import { describe, expect, it } from "vitest";
import { buildRbiLiteRiskMatrix, mapConsequenceLevelToApi570PipingClass, scoreRbiConsequence } from "../../src/aggregate/riskMatrix";

describe("scoreRbiConsequence — en kötü alt faktör belirler", () => {
  it("tüm faktörler düşükse sonuç A'dır", () => {
    const result = scoreRbiConsequence({
      h2sRiskLevel: "DÜŞÜK",
      governingPressureBara: 5,
      locationClass: 1,
      environmentalSensitivity: "LOW",
    });
    expect(result.level).toBe("A");
  });

  it("H2S ÇOK_YÜKSEK ise diğer faktörler düşük olsa bile sonuç E'dir ve gerekçe H2S'i gösterir", () => {
    const result = scoreRbiConsequence({
      h2sRiskLevel: "ÇOK_YÜKSEK",
      governingPressureBara: 5,
      locationClass: 1,
      environmentalSensitivity: "LOW",
    });
    expect(result.level).toBe("E");
    expect(result.governingFactorTr).toContain("Akışkan tehlikesi");
  });

  it("konum sınıfı 4 (şehir merkezi) tek başına en az D seviyesine çıkarır", () => {
    const result = scoreRbiConsequence({
      h2sRiskLevel: "DÜŞÜK",
      governingPressureBara: 5,
      locationClass: 4,
      environmentalSensitivity: "LOW",
    });
    expect(["D", "E"]).toContain(result.level);
  });

  it("h2sRiskLevel=null iken muhafazakâr ORTA (3) alt puanı kullanılır", () => {
    const result = scoreRbiConsequence({
      h2sRiskLevel: null,
      governingPressureBara: 5,
      locationClass: 1,
      environmentalSensitivity: "LOW",
    });
    expect(result.fluidHazardSubScore).toBe(3);
  });
});

describe("buildRbiLiteRiskMatrix — 4×5 grid", () => {
  it("20 hücre üretir (4 olasılık × 5 sonuç)", () => {
    const result = buildRbiLiteRiskMatrix("MEDIUM", {
      h2sRiskLevel: "ORTA",
      governingPressureBara: 50,
      locationClass: 2,
      environmentalSensitivity: "MEDIUM",
    });
    expect(result.cells).toHaveLength(20);
  });

  it("bileşenin hücresi tam olarak bir tanedir ve doğru olasılık/sonuca sahiptir", () => {
    const result = buildRbiLiteRiskMatrix("HIGH", {
      h2sRiskLevel: "YÜKSEK",
      governingPressureBara: 150,
      locationClass: 3,
      environmentalSensitivity: "HIGH",
    });
    const componentCells = result.cells.filter((c) => c.isComponentCell);
    expect(componentCells).toHaveLength(1);
    expect(componentCells[0].likelihood).toBe("HIGH");
    expect(componentCells[0].consequence).toBe(result.consequence.level);
  });

  it("olasılık NEGLIGIBLE + sonuç A ise renk yeşildir", () => {
    const result = buildRbiLiteRiskMatrix("NEGLIGIBLE", {
      h2sRiskLevel: "DÜŞÜK",
      governingPressureBara: 5,
      locationClass: 1,
      environmentalSensitivity: "LOW",
    });
    expect(result.colorTr).toBe("yeşil");
  });

  it("olasılık HIGH + sonuç E ise renk kırmızıdır", () => {
    const result = buildRbiLiteRiskMatrix("HIGH", {
      h2sRiskLevel: "ÇOK_YÜKSEK",
      governingPressureBara: 250,
      locationClass: 4,
      environmentalSensitivity: "HIGH",
    });
    expect(result.colorTr).toBe("kırmızı");
  });
});

describe("mapConsequenceLevelToApi570PipingClass — RBI-lite sonuç seviyesi → API 570 Piping Class", () => {
  it("A/B → Class 3 (en düşük sonuç)", () => {
    expect(mapConsequenceLevelToApi570PipingClass("A")).toBe(3);
    expect(mapConsequenceLevelToApi570PipingClass("B")).toBe(3);
  });

  it("C → Class 2", () => {
    expect(mapConsequenceLevelToApi570PipingClass("C")).toBe(2);
  });

  it("D/E → Class 1 (en yüksek sonuç)", () => {
    expect(mapConsequenceLevelToApi570PipingClass("D")).toBe(1);
    expect(mapConsequenceLevelToApi570PipingClass("E")).toBe(1);
  });
});
