// packages/engine/tests/fluids/viscosity.test.ts

import { describe, expect, it } from "vitest";
import {
  computeApiGravityFromDensity,
  computeGasViscosityPaS,
  computeLiquidHydrocarbonViscosityPaS,
  computeWaterViscosityPaS,
} from "../../src/fluids/viscosity";

describe("computeApiGravityFromDensity", () => {
  it("suyun kendi yoğunluğu için API≈10 verir (su API gravitesi tanım gereği ~10)", () => {
    expect(computeApiGravityFromDensity(999.016)).toBeCloseTo(10, 1);
  });

  it("negatif/sıfır yoğunluk için hata fırlatır", () => {
    expect(() => computeApiGravityFromDensity(0)).toThrowError();
  });
});

describe("computeWaterViscosityPaS", () => {
  // Referans: yaygın bilinen su viskozitesi değerleri (0°C≈1.792cP,
  // 20°C≈1.002cP, 100°C≈0.282cP — bu oturumdaki web taramasında bağımsız
  // olarak da doğrulandı, "su 20°C'de 1 santipoaz'dır" yaygın bilgisi).
  it("20°C'de yaklaşık 1 cP (1e-3 Pa·s) verir (±%5 tolerans)", () => {
    const mu = computeWaterViscosityPaS(293.15);
    expect(Math.abs(mu - 1.002e-3) / 1.002e-3).toBeLessThan(0.05);
  });

  it("0°C'de yaklaşık 1.792 cP verir (±%5 tolerans, formülün 0°C'deki bilinen ±%2.5 belirsizliği dahil)", () => {
    const mu = computeWaterViscosityPaS(273.15);
    expect(Math.abs(mu - 1.792e-3) / 1.792e-3).toBeLessThan(0.05);
  });

  it("100°C'de yaklaşık 0.282 cP verir (±%5 tolerans)", () => {
    const mu = computeWaterViscosityPaS(373.15);
    expect(Math.abs(mu - 0.282e-3) / 0.282e-3).toBeLessThan(0.05);
  });

  it("sıcaklık arttıkça viskozite azalır (sıvı suyun bilinen davranışı)", () => {
    expect(computeWaterViscosityPaS(350)).toBeLessThan(computeWaterViscosityPaS(300));
  });

  it("140K veya altında hata fırlatır (formül tekilliği)", () => {
    expect(() => computeWaterViscosityPaS(140)).toThrowError();
  });
});

describe("computeGasViscosityPaS", () => {
  it("tipik doğal gaz koşullarında (SG≈0.65, ~50°C, ~50kg/m³) makul mertebede (1e-5 mertebesi Pa·s) sonuç verir", () => {
    const molarMassKgPerMol = 0.0188; // SG≈0.65 doğal gaz mertebesi
    const result = computeGasViscosityPaS(323.15, molarMassKgPerMol, 45);
    expect(result.viscosityPaS).toBeGreaterThan(5e-6);
    expect(result.viscosityPaS).toBeLessThan(5e-5);
  });

  it("sıcaklık arttıkça (sabit yoğunlukta) gaz viskozitesi artar (seyreltik gazların bilinen davranışı)", () => {
    const molarMassKgPerMol = 0.0188;
    const cooler = computeGasViscosityPaS(300, molarMassKgPerMol, 45);
    const warmer = computeGasViscosityPaS(400, molarMassKgPerMol, 45);
    expect(warmer.viscosityPaS).toBeGreaterThan(cooler.viscosityPaS);
  });

  it("geçerlilik aralığı dışındaki sıcaklık için validityWarnings ekler", () => {
    const result = computeGasViscosityPaS(150, 0.0188, 45);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("negatif/sıfır girdiler için hata fırlatır", () => {
    expect(() => computeGasViscosityPaS(0, 0.0188, 45)).toThrowError();
    expect(() => computeGasViscosityPaS(300, 0, 45)).toThrowError();
    expect(() => computeGasViscosityPaS(300, 0.0188, 0)).toThrowError();
  });
});

describe("computeLiquidHydrocarbonViscosityPaS", () => {
  it("tipik orta ağırlıktaki ham petrol için (API=30, 200°F≈366.5K) makul mertebede (birkaç cP) sonuç verir", () => {
    const temperatureK = ((200 - 32) * 5) / 9 + 273.15;
    const result = computeLiquidHydrocarbonViscosityPaS(temperatureK, 30);
    expect(result.viscosityPaS).toBeGreaterThan(0.1e-3);
    expect(result.viscosityPaS).toBeLessThan(50e-3);
    expect(result.validityWarnings).toHaveLength(0);
  });

  it("sıcaklık arttıkça sıvı hidrokarbon viskozitesi azalır (bilinen davranış)", () => {
    const t1 = ((150 - 32) * 5) / 9 + 273.15;
    const t2 = ((250 - 32) * 5) / 9 + 273.15;
    const cooler = computeLiquidHydrocarbonViscosityPaS(t1, 30);
    const warmer = computeLiquidHydrocarbonViscosityPaS(t2, 30);
    expect(warmer.viscosityPaS).toBeLessThan(cooler.viscosityPaS);
  });

  it("geçerlilik aralığı dışındaki API/sıcaklık için validityWarnings ekler", () => {
    const temperatureK = ((200 - 32) * 5) / 9 + 273.15;
    const result = computeLiquidHydrocarbonViscosityPaS(temperatureK, 10);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("150°F altında bilinen aşırı-tahmin uyarısını ekler", () => {
    const temperatureK = ((100 - 32) * 5) / 9 + 273.15;
    const result = computeLiquidHydrocarbonViscosityPaS(temperatureK, 30);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("sıcaklık negatif/sıfırsa hata fırlatır", () => {
    expect(() => computeLiquidHydrocarbonViscosityPaS(0, 30)).toThrowError();
  });
});
