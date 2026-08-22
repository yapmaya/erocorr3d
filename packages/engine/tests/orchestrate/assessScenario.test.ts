// packages/engine/tests/orchestrate/assessScenario.test.ts
//
// Uçtan uca doğrulama: gerçek (BOTAŞ fixture) Geometry/Mitigation/
// OperatingProfile verisinden GERÇEK, sentetik-olmayan bir SpatialDamageField
// üretilebiliyor mu — bu, "MechanismResult[]→SpatialDamageField üretim
// katmanı" boşluğunun kapandığının uçtan uca kanıtıdır.

import { describe, expect, it } from "vitest";
import { assessComponentScenario } from "../../src/orchestrate/assessScenario";
import { BOTAS_FIXTURES, botasStream1030 } from "../../src/fixtures/botas";
import { SpatialDamageFieldSchema } from "../../src/types/results";

describe("assessComponentScenario — BOTAŞ fixture ile uçtan uca", () => {
  it("Stream 1030: iki senaryo (çekiş+enjeksiyon) da değerlendirilir", () => {
    const scenario = assessComponentScenario(
      botasStream1030.geometry,
      botasStream1030.mitigation,
      botasStream1030.operatingProfile,
    );
    expect(scenario.perCase).toHaveLength(2);
    expect(scenario.perCase.map((c) => c.caseName)).toEqual(
      botasStream1030.operatingProfile.cases.map((c) => c.name),
    );
  });

  it("Kış Çekiş Modu (ıslak/ekşi): gerçek, sıfır-olmayan bir hasar alanı üretir — sentetik demo DEĞİLDİR", () => {
    const scenario = assessComponentScenario(
      botasStream1030.geometry,
      botasStream1030.mitigation,
      botasStream1030.operatingProfile,
      {},
      "Stream 1030",
      { resolutionU: 48, resolutionV: 32 },
    );
    const withdrawal = scenario.perCase.find((c) => c.caseName.includes("Çekiş"))!;
    expect(withdrawal.spatialDamageFieldFullLife.maxValueMm).toBeGreaterThan(0);
    expect(withdrawal.spatialDamageFieldFullLife.hotspots.length).toBeGreaterThan(0);
    // Zod şemasına karşı da geçerli olmalı — gerçekten SpatialDamageField sözleşmesine uyuyor
    expect(() => SpatialDamageFieldSchema.parse(withdrawal.spatialDamageFieldFullLife)).not.toThrow();

    const co2 = withdrawal.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");
    expect(co2?.isApplicable).toBe(true);
    expect(co2?.sourceRefs.length).toBeGreaterThan(0);
  });

  it("Yaz Enjeksiyon Modu (kurutulmuş kuru gaz): hasar alanı sıfırdır (korozyon riski yok)", () => {
    const scenario = assessComponentScenario(
      botasStream1030.geometry,
      botasStream1030.mitigation,
      botasStream1030.operatingProfile,
      {},
      "Stream 1030",
      { resolutionU: 32, resolutionV: 24 },
    );
    const injection = scenario.perCase.find((c) => c.caseName.includes("Enjeksiyon"))!;
    expect(injection.spatialDamageFieldFullLife.maxValueMm).toBe(0);
    const co2 = injection.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");
    expect(co2?.isApplicable).toBe(false);
  });

  it("belirleyici (governing) senaryo, daha yüksek yıllık kayıplı çekiş modudur ve toplam metal kaybı pozitiftir", () => {
    const scenario = assessComponentScenario(
      botasStream1030.geometry,
      botasStream1030.mitigation,
      botasStream1030.operatingProfile,
    );
    expect(scenario.governingCaseName).toContain("Çekiş");
    expect(scenario.metalLoss.totalAnnualLossMmPerYear.p50).toBeGreaterThan(0);
    expect(scenario.metalLoss.totalServiceLifeCorrosionMm.p50).toBeGreaterThan(0);
  });

  it("her iki BOTAŞ hattı da (1030 gömülü, 1130 yer üstü) hatasız uçtan uca çalışır", () => {
    for (const fixture of BOTAS_FIXTURES) {
      expect(() =>
        assessComponentScenario(fixture.geometry, fixture.mitigation, fixture.operatingProfile, {}, fixture.streamId, {
          resolutionU: 24,
          resolutionV: 16,
        }),
      ).not.toThrow();
    }
  });
});
