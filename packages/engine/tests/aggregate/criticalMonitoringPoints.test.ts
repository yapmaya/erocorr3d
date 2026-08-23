// packages/engine/tests/aggregate/criticalMonitoringPoints.test.ts

import { describe, expect, it } from "vitest";
import { selectCriticalMonitoringPoints } from "../../src/aggregate/criticalMonitoringPoints";
import { assessComponentScenario } from "../../src/orchestrate/assessScenario";
import { referenceLine1 } from "../../src/fixtures/referenceFacility";

describe("selectCriticalMonitoringPoints — referans tesis (gerçek, sentetik-olmayan hasar alanı)", () => {
  const scenario = assessComponentScenario(
    referenceLine1.geometry,
    referenceLine1.mitigation,
    referenceLine1.operatingProfile,
    {},
    "Reference Line 1",
    { resolutionU: 48, resolutionV: 32 },
  );

  it("en fazla topN nokta döndürür, değere göre azalan sıralıdır", () => {
    const result = selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 5);
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i - 1].hotspot.valueMm).toBeGreaterThanOrEqual(result.points[i].hotspot.valueMm);
    }
  });

  it("her nokta 1'den başlayan sıralı rank taşır", () => {
    const result = selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 3);
    expect(result.points.map((p) => p.rank)).toEqual(result.points.map((_, i) => i + 1));
  });

  it("eksenel mesafe hotspot.u × geometry.lengthMm'dir", () => {
    const result = selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 5);
    for (const point of result.points) {
      expect(point.axialDistanceMm).toBeCloseTo(point.hotspot.u * referenceLine1.geometry.lengthMm, 6);
    }
  });

  it("gömülü hat için erişilebilirlik uyarısı üretir", () => {
    expect(referenceLine1.geometry.installation).toBe("BURIED");
    const result = selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 5);
    expect(result.points[0].accessibilityWarningTr).toContain("Gömülü");
  });

  it("belirleyici senaryonun dominant mekanizmasına göre teknik önerir (CO2_SWEET → UT + kupon)", () => {
    const result = selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 5);
    expect(result.dominantMechanismNameTr).not.toBeNull();
    expect(result.points[0].recommendedTechniquesTr.join(" ")).toContain("UT");
  });

  it("tutarsız governingCaseName ile hata fırlatır", () => {
    const broken = { ...scenario, governingCaseName: "Var Olmayan Senaryo" };
    expect(() => selectCriticalMonitoringPoints(broken, referenceLine1.geometry, 5)).toThrowError();
  });

  it("topN≤0 için hata fırlatır", () => {
    expect(() => selectCriticalMonitoringPoints(scenario, referenceLine1.geometry, 0)).toThrowError();
  });
});
