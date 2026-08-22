// apps/web/tests/results/tornadoData.test.ts

import { describe, expect, it } from "vitest";
import { buildTornadoData, TORNADO_PARAMETER_LABELS_TR } from "../../src/features/results/charts/tornadoData";
import { getTemplate } from "../../src/features/input/templates";

describe("buildTornadoData", () => {
  it("CO2 mevcut senaryoda (Islak Gaz Toplama Hattı) gerçek bir duyarlılık sıralaması üretir", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const result = buildTornadoData({ geometry: values.geometry, mitigation: values.mitigation, operatingCase: values.operatingProfile.cases[0] });
    expect(result).not.toBeNull();
    expect(result!.results.length).toBeGreaterThan(0);
    // Azalan sırada olmalı (en kritik parametre ilk sırada).
    for (let i = 1; i < result!.results.length; i++) {
      expect(result!.results[i - 1].impactRangeMmPerYear).toBeGreaterThanOrEqual(result!.results[i].impactRangeMmPerYear);
    }
  });

  it("her sonuçtaki 'parameter' TORNADO_PARAMETER_LABELS_TR'de karşılığı olan bilinen bir anahtardır", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const result = buildTornadoData({ geometry: values.geometry, mitigation: values.mitigation, operatingCase: values.operatingProfile.cases[0] })!;
    for (const r of result.results) {
      expect(TORNADO_PARAMETER_LABELS_TR[r.parameter]).toBeDefined();
    }
  });

  it("CO2 mol yüzdesi 0 ise null döner (mekanizma yapısal olarak devre dışı)", () => {
    const values = getTemplate("seawater")!.apply();
    expect(values.operatingProfile.cases[0].chemistry.co2MolePercent).toBe(0);
    const result = buildTornadoData({ geometry: values.geometry, mitigation: values.mitigation, operatingCase: values.operatingProfile.cases[0] });
    expect(result).toBeNull();
  });

  it("pH ölçülmüşse klorür/bikarbonat parametreleri analiz dışı kalır (gerçek etkileri 0'dır)", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const caseWithPh = { ...values.operatingProfile.cases[0], chemistry: { ...values.operatingProfile.cases[0].chemistry, phMeasured: 5.5 } };
    const result = buildTornadoData({ geometry: values.geometry, mitigation: values.mitigation, operatingCase: caseWithPh })!;
    expect(result.results.some((r) => r.parameter === "chlorideMgL")).toBe(false);
    expect(result.results.some((r) => r.parameter === "bicarbonateMgL")).toBe(false);
  });

  it("sıcaklık parametresinin baseValue'su gerçek senaryo sıcaklığıyla eşleşir", () => {
    const values = getTemplate("wet-gas-gathering")!.apply();
    const operatingCase = values.operatingProfile.cases[0];
    const result = buildTornadoData({ geometry: values.geometry, mitigation: values.mitigation, operatingCase })!;
    const temperatureResult = result.results.find((r) => r.parameter === "temperatureC");
    expect(temperatureResult?.baseValue).toBeCloseTo(operatingCase.process.temperatureC, 9);
  });
});
