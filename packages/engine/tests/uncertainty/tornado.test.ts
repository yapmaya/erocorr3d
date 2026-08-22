// packages/engine/tests/uncertainty/tornado.test.ts

import { describe, expect, it } from "vitest";
import { computeTornadoAnalysis } from "../../src/uncertainty/tornado";

// rate = 2×temperature + 10×pressure + 0×zeroParam — pressure'ın etkisi kasıtlı olarak
// temperature'ınkinden çok daha büyük, zeroParam ise taban değeri 0 olduğu için atlanmalı.
function testModel(inputs: Readonly<Record<string, number>>): number {
  return 2 * inputs.temperature + 10 * inputs.pressure + 0 * (inputs.zeroParam ?? 0);
}

describe("computeTornadoAnalysis", () => {
  it("en büyük etkiye sahip parametreyi ilk sıraya koyar", () => {
    const { results } = computeTornadoAnalysis({
      baseInputs: { temperature: 40, pressure: 20, zeroParam: 5 },
      modelFn: testModel,
    });
    expect(results[0].parameter).toBe("pressure");
  });

  it("sonuçlar impactRangeMmPerYear'a göre azalan sıradadır", () => {
    const { results } = computeTornadoAnalysis({
      baseInputs: { temperature: 40, pressure: 20 },
      modelFn: testModel,
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].impactRangeMmPerYear).toBeGreaterThanOrEqual(results[i].impactRangeMmPerYear);
    }
  });

  it("taban değeri 0 olan parametreler atlanır ve skippedParameters'ta listelenir", () => {
    const { results, skippedParameters } = computeTornadoAnalysis({
      baseInputs: { temperature: 40, pressure: 20, zeroParam: 0 },
      modelFn: testModel,
    });
    expect(skippedParameters).toContain("zeroParam");
    expect(results.find((r) => r.parameter === "zeroParam")).toBeUndefined();
  });

  it("±%20 pertürbasyonla doğru düşük/yüksek değerleri hesaplar", () => {
    const { results } = computeTornadoAnalysis({
      baseInputs: { temperature: 40, pressure: 20 },
      modelFn: testModel,
      parameters: ["temperature"],
    });
    const [temperatureResult] = results;
    expect(temperatureResult.lowValue).toBeCloseTo(32, 6);
    expect(temperatureResult.highValue).toBeCloseTo(48, 6);
    // rate = 2*T + 10*20 = 2T + 200
    expect(temperatureResult.lowOutputMmPerYear).toBeCloseTo(264, 6);
    expect(temperatureResult.highOutputMmPerYear).toBeCloseTo(296, 6);
    expect(temperatureResult.impactRangeMmPerYear).toBeCloseTo(32, 6);
  });

  it("baseOutputMmPerYear taban girdilerle hesaplanan modele eşittir", () => {
    const { baseOutputMmPerYear } = computeTornadoAnalysis({
      baseInputs: { temperature: 40, pressure: 20 },
      modelFn: testModel,
    });
    expect(baseOutputMmPerYear).toBeCloseTo(280, 6);
  });

  it("baseInputs'ta bulunmayan parametre istendiğinde hata fırlatır", () => {
    expect(() =>
      computeTornadoAnalysis({
        baseInputs: { temperature: 40 },
        modelFn: testModel,
        parameters: ["missing"],
      }),
    ).toThrowError();
  });

  it("hiçbir parametre kalmadığında (hepsi taban 0) boş sonuç döner, atma listesi doludur", () => {
    const { results, skippedParameters } = computeTornadoAnalysis({
      baseInputs: { a: 0, b: 0 },
      modelFn: () => 0,
    });
    expect(results).toHaveLength(0);
    expect(skippedParameters).toEqual(["a", "b"]);
  });
});
