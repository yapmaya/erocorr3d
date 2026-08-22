// packages/engine/tests/erosion/api14e.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessApi14eScreening, computeApi14eErosionalVelocityMs } from "../../src/erosion/api14e";

describe("computeApi14eErosionalVelocityMs", () => {
  it("yoğunluk arttıkça Ve azalır (Ve=C/√ρm)", () => {
    const low = computeApi14eErosionalVelocityMs(100, "SOLIDS_FREE_NON_CORROSIVE", "CONTINUOUS");
    const high = computeApi14eErosionalVelocityMs(400, "SOLIDS_FREE_NON_CORROSIVE", "CONTINUOUS");
    expect(high.erosionalVelocityMs).toBeLessThan(low.erosionalVelocityMs);
  });

  it("aralıklı servis, sürekli servisten daha yüksek Ve verir", () => {
    const continuous = computeApi14eErosionalVelocityMs(100, "SOLIDS_FREE_NON_CORROSIVE", "CONTINUOUS");
    const intermittent = computeApi14eErosionalVelocityMs(100, "SOLIDS_FREE_NON_CORROSIVE", "INTERMITTENT");
    expect(intermittent.erosionalVelocityMs).toBeGreaterThan(continuous.erosionalVelocityMs);
  });

  it("azaltma önlemi olmayan korozif akışkan, en muhafazakâr (en düşük) Ve'yi verir", () => {
    const nonCorrosive = computeApi14eErosionalVelocityMs(100, "SOLIDS_FREE_NON_CORROSIVE", "CONTINUOUS");
    const noMitigation = computeApi14eErosionalVelocityMs(
      100,
      "SOLIDS_FREE_CORROSIVE_NO_MITIGATION",
      "CONTINUOUS",
    );
    expect(noMitigation.erosionalVelocityMs).toBeLessThan(nonCorrosive.erosionalVelocityMs);
  });

  it("katı içeren akışlar için hata fırlatır (API 14E sayısal c-faktörü vermez)", () => {
    expect(() => computeApi14eErosionalVelocityMs(100, "WITH_SOLIDS", "CONTINUOUS")).toThrowError();
  });

  it("negatif/sıfır yoğunluk için hata fırlatır", () => {
    expect(() => computeApi14eErosionalVelocityMs(0, "SOLIDS_FREE_NON_CORROSIVE", "CONTINUOUS")).toThrowError();
  });
});

describe("assessApi14eScreening", () => {
  it("gerçek hız Ve'nin çok altındaysa GÜVENLİ döner", () => {
    const result = assessApi14eScreening({
      mixtureDensityKgM3: 100,
      actualVelocityMs: 1,
      fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
      serviceType: "CONTINUOUS",
    });
    expect(result.warningLevel).toBe("GÜVENLİ");
    expect(result.velocityToLimitRatio).toBeLessThan(0.8);
  });

  it("gerçek hız Ve'yi belirgin aşarsa KRİTİK döner", () => {
    const result = assessApi14eScreening({
      mixtureDensityKgM3: 100,
      actualVelocityMs: 50,
      fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
      serviceType: "CONTINUOUS",
    });
    expect(result.warningLevel).toBe("KRİTİK");
    expect(result.exceedancePercent).toBeGreaterThan(20);
  });

  it("her zaman 'yalnızca tarama' notunu döndürür", () => {
    const result = assessApi14eScreening({
      mixtureDensityKgM3: 100,
      actualVelocityMs: 1,
      fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
      serviceType: "CONTINUOUS",
    });
    expect(result.screeningOnlyNoteTr).toContain("TARAMA");
  });

  it("katı içeren akış kategorisinde Ve hesaplamaz, KRİTİK + uyarı döner", () => {
    const result = assessApi14eScreening({
      mixtureDensityKgM3: 100,
      actualVelocityMs: 10,
      fluidCategory: "WITH_SOLIDS",
      serviceType: "CONTINUOUS",
    });
    expect(result.warningLevel).toBe("KRİTİK");
    expect(result.validityWarnings.length).toBeGreaterThan(0);
    expect(Number.isNaN(result.erosionalVelocityMs)).toBe(true);
  });

  it("negatif hız için hata fırlatır", () => {
    expect(() =>
      assessApi14eScreening({
        mixtureDensityKgM3: 100,
        actualVelocityMs: -1,
        fluidCategory: "SOLIDS_FREE_NON_CORROSIVE",
        serviceType: "CONTINUOUS",
      }),
    ).toThrowError();
  });
});

describe("api14e — KDP kayıt defteri entegrasyonu", () => {
  it("api14e modülü için beklenen katsayılar kayıtlıdır", () => {
    const registered = listCoefficients().filter((c) => c.module === "api14e");
    const ids = registered.map((c) => c.id);
    expect(ids).toContain("api14e.cFactorTable");
    expect(ids).toContain("api14e.imperialToSiVelocityFactor");
  });

  it("c-faktörü tablosu API RP 14E'ye karşı çapraz doğrulanmıştır", () => {
    const entry = listCoefficients().find((c) => c.id === "api14e.cFactorTable");
    expect(entry?.crossChecked).toBe(true);
    expect(entry?.confidence).toBe("HIGH");
  });
});
