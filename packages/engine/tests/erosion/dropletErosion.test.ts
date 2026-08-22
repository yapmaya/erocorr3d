// packages/engine/tests/erosion/dropletErosion.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { assessDropletErosionRisk, computeDropletErosionVelocityLimit } from "../../src/erosion/dropletErosion";

describe("computeDropletErosionVelocityLimit", () => {
  it("DNV'nin 70-80 m/s eşiğini döndürür", () => {
    const result = computeDropletErosionVelocityLimit();
    expect(result.velocityLimitRangeMs).toEqual([70, 80]);
    expect(result.conservativeLimitMs).toBe(70);
    expect(result.confidence).toBe("HIGH");
  });
});

describe("assessDropletErosionRisk", () => {
  it("serbest sıvı yoksa risk GÜVENLİ ve gösterge hız null'dır", () => {
    const result = assessDropletErosionRisk({ actualGasVelocityMs: 100, entrainedLiquidPresent: false });
    expect(result.riskLevel).toBe("GÜVENLİ");
    expect(result.indicativeRateMmPerYear).toBeNull();
  });

  it("hız eşiğin belirgin altındaysa GÜVENLİ döner", () => {
    const result = assessDropletErosionRisk({ actualGasVelocityMs: 30, entrainedLiquidPresent: true });
    expect(result.riskLevel).toBe("GÜVENLİ");
    expect(result.indicativeRateMmPerYear).toBeNull();
  });

  it("hız eşiği aşarsa RİSKLİ döner ve UNVERIFIED bir gösterge hız üretir", () => {
    const result = assessDropletErosionRisk({ actualGasVelocityMs: 100, entrainedLiquidPresent: true });
    expect(result.riskLevel).toBe("RİSKLİ");
    expect(result.indicativeRateMmPerYear).not.toBeNull();
    expect(result.indicativeRateMmPerYear!.p50).toBeGreaterThan(0);
    expect(result.confidence).toBe("UNVERIFIED");
  });

  it("hız arttıkça gösterge hız da artar", () => {
    const moderate = assessDropletErosionRisk({ actualGasVelocityMs: 90, entrainedLiquidPresent: true });
    const severe = assessDropletErosionRisk({ actualGasVelocityMs: 140, entrainedLiquidPresent: true });
    expect(severe.indicativeRateMmPerYear!.p50).toBeGreaterThan(moderate.indicativeRateMmPerYear!.p50);
  });

  it("her zaman 'yalnızca tarama' notunu döndürür", () => {
    const result = assessDropletErosionRisk({ actualGasVelocityMs: 30, entrainedLiquidPresent: true });
    expect(result.screeningOnlyNoteTr).toContain("TARAMA");
  });

  it("negatif hız için hata fırlatır", () => {
    expect(() =>
      assessDropletErosionRisk({ actualGasVelocityMs: -1, entrainedLiquidPresent: true }),
    ).toThrowError();
  });
});

describe("dropletErosion — KDP kayıt defteri entegrasyonu", () => {
  it("dropletErosion modülü için beklenen katsayılar kayıtlıdır", () => {
    const registered = listCoefficients().filter((c) => c.module === "dropletErosion");
    const ids = registered.map((c) => c.id);
    expect(ids).toContain("dropletErosion.velocityLimitRangeMs");
    expect(ids).toContain("dropletErosion.indicativeRateAtThresholdMmPerYear");
  });

  it("gösterge hız sabiti UNVERIFIED işaretlidir", () => {
    const entry = listCoefficients().find((c) => c.id === "dropletErosion.indicativeRateAtThresholdMmPerYear");
    expect(entry?.confidence).toBe("UNVERIFIED");
  });
});
