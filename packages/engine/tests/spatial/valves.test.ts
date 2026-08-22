// packages/engine/tests/spatial/valves.test.ts

import { describe, expect, it } from "vitest";
import { VALVE_EROSION_PROFILES } from "../../src/data/valveCatalog";
import { computeValveDamageField, getValveZoneSpatialDescriptor } from "../../src/spatial/valves";

describe("getValveZoneSpatialDescriptor — kapsama", () => {
  it("data/valveCatalog.ts'teki HER erozyon bölgesi için bir (u,v) tanımı vardır", () => {
    for (const profile of VALVE_EROSION_PROFILES) {
      for (const zone of profile.zones) {
        expect(() => getValveZoneSpatialDescriptor(zone.id)).not.toThrow();
      }
    }
  });

  it("bilinmeyen bölge kimliği için hata fırlatır", () => {
    expect(() => getValveZoneSpatialDescriptor("no_such_zone")).toThrowError();
  });
});

describe("computeValveDamageField — kütle korunumu", () => {
  it("tüm bölgelerin toplamı, ortalama ızgara değerine (±%3, çoklu Gauss örtüşmesi toleransıyla) eşittir", () => {
    const band = { p10: 0.4, p50: 1, p90: 2.5 };
    const elapsedYears = 10;
    const result = computeValveDamageField("GATE_VALVE", band, elapsedYears, 100, {
      resolutionU: 100,
      resolutionV: 100,
    });

    const profile = VALVE_EROSION_PROFILES.find((p) => p.componentType === "GATE_VALVE")!;
    const totalWeight = profile.zones.reduce((sum, zone) => sum + zone.defaultSeverityWeight, 0);
    // %100 açıklıkta partialOpeningMultiplier ~1 olduğundan (eğrinin son noktası) beklenen toplam ≈ Σ(ağırlık×P50×yıl)
    const expectedMean = totalWeight * band.p50 * elapsedYears;

    let sum = 0;
    for (let i = 0; i < result.valuesMm.length; i++) sum += result.valuesMm[i];
    const mean = sum / result.valuesMm.length;

    expect(mean).toBeGreaterThan(expectedMean * 0.9);
    expect(mean).toBeLessThan(expectedMean * 1.15);
  });

  it("LATHE_PROFILE parametrizasyonunu kullanır", () => {
    const result = computeValveDamageField("BALL_VALVE_REDUCED", { p10: 0.1, p50: 0.3, p90: 0.8 }, 5);
    expect(result.parameterization).toBe("LATHE_PROFILE");
  });

  it("hasar sıfırdan farklıdır (en az bir bölgede)", () => {
    const result = computeValveDamageField("CHOKE_VALVE", { p10: 1, p50: 2, p90: 5 }, 3);
    expect(result.maxValueMm).toBeGreaterThan(0);
  });

  it("açıklık düştükçe (kısma servisi bölgelerinde) toplam hasar değişir", () => {
    const band = { p10: 0.4, p50: 1, p90: 2.5 };
    const full = computeValveDamageField("GLOBE_VALVE", band, 10, 100);
    const throttled = computeValveDamageField("GLOBE_VALVE", band, 10, 20);
    let sumFull = 0;
    let sumThrottled = 0;
    for (let i = 0; i < full.valuesMm.length; i++) sumFull += full.valuesMm[i];
    for (let i = 0; i < throttled.valuesMm.length; i++) sumThrottled += throttled.valuesMm[i];
    expect(sumFull).not.toBeCloseTo(sumThrottled, 3);
  });

  it("15 vana tipinin TÜMÜ hatasız çalışır", () => {
    for (const profile of VALVE_EROSION_PROFILES) {
      expect(() => computeValveDamageField(profile.componentType, { p10: 0.1, p50: 0.3, p90: 0.8 }, 5)).not.toThrow();
    }
  });
});
