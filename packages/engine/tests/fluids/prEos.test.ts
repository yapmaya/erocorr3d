// packages/engine/tests/fluids/prEos.test.ts

import { describe, expect, it } from "vitest";
import {
  computeAlpha,
  computeCompressibilityFactor,
  computeMixtureCompressibilityFactor,
  getBinaryInteractionParameter,
  solveCubicReal,
} from "../../src/fluids/prEos";

// Referans: saf metan için Tc=190.6K, Pc=46.1bar, ω=0.011 (bkz.
// registry/coefficients/naturalGasComponents.ts, NIST WebBook kaynaklı).
const METHANE = { criticalTemperatureK: 190.6, criticalPressurePa: 46.1e5, acentricFactor: 0.011 };

describe("solveCubicReal", () => {
  it("bilinen kökleri olan bir kübik denklemi doğru çözer: (Z-1)(Z-2)(Z-3)=0", () => {
    // Z³ - 6Z² + 11Z - 6 = 0
    const roots = solveCubicReal(-6, 11, -6);
    expect(roots.length).toBe(3);
    expect(roots.map((r) => Math.round(r * 1e6) / 1e6).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("tek reel kökü olan bir kübik denklemi doğru çözer: (Z-2)(Z²+1)=0 → Z=2", () => {
    // Z³ - 2Z² + Z - 2 = 0
    const roots = solveCubicReal(-2, 1, -2);
    expect(roots.length).toBe(1);
    expect(roots[0]).toBeCloseTo(2, 6);
  });
});

describe("computeAlpha", () => {
  it("T=Tc iken α=1 verir (Tr=1, √Tr=1 ⇒ α=[1+κ·0]²=1)", () => {
    expect(computeAlpha(190.6, 190.6, 0.011)).toBeCloseTo(1, 6);
  });

  it("sıcaklık veya kritik sıcaklık negatifse hata fırlatır", () => {
    expect(() => computeAlpha(-1, 190.6, 0.011)).toThrowError();
    expect(() => computeAlpha(293.15, 0, 0.011)).toThrowError();
  });
});

describe("computeCompressibilityFactor — saf metan", () => {
  it("düşük basınçta (1 bar) ideal gaz limitine yaklaşır (Z≈1)", () => {
    const result = computeCompressibilityFactor({
      temperatureK: 293.15,
      pressurePa: 1e5,
      ...METHANE,
    });
    expect(result.compressibilityFactor).toBeGreaterThan(0.98);
    expect(result.compressibilityFactor).toBeLessThanOrEqual(1.01);
  });

  it("50 bar / 20°C'de NIST gerçek gaz yoğunluğundan türetilen referans Z değerine yakın sonuç verir", () => {
    // Referans: NIST Chemistry WebBook izotermal akışkan özellikleri hesaplayıcısı,
    // metan, 20°C, 50 bar ⇒ yoğunluk 36.096 kg/m³ (erişim: 2026-08-11).
    // Z_referans = ρ_ideal/ρ_gerçek = (P·M/(R·T)) / ρ_gerçek
    //            = (5e6 Pa × 0.016043 kg/mol / (8.314462618 × 293.15)) / 36.096 ≈ 0.912
    // PR EOS yaklaşık bir denklem olduğundan (gerçek çok-parametreli hâl denklemi
    // DEĞİL), %5 tolerans ile karşılaştırılıyor.
    const result = computeCompressibilityFactor({
      temperatureK: 293.15,
      pressurePa: 50e5,
      ...METHANE,
    });
    expect(result.compressibilityFactor).toBeGreaterThan(0.87);
    expect(result.compressibilityFactor).toBeLessThan(0.96);
  });

  it("VAPOR ve LIQUID fazı için farklı (VAPOR > LIQUID) kökler seçer (çift-fazlı bölgede)", () => {
    // T=150K < Tc=190.6K (alt-kritik) ve P=10 bar: kübik üç reel kök verir
    // (doğrulandı: Node ile bağımsız bir tarama scripti, bkz. oturum notları).
    const vapor = computeCompressibilityFactor(
      { temperatureK: 150, pressurePa: 10e5, ...METHANE },
      "VAPOR",
    );
    const liquid = computeCompressibilityFactor(
      { temperatureK: 150, pressurePa: 10e5, ...METHANE },
      "LIQUID",
    );
    expect(vapor.compressibilityFactor).toBeGreaterThan(liquid.compressibilityFactor);
  });

  it("sıcaklık veya basınç negatifse hata fırlatır", () => {
    expect(() => computeCompressibilityFactor({ temperatureK: -1, pressurePa: 1e5, ...METHANE })).toThrowError();
    expect(() => computeCompressibilityFactor({ temperatureK: 293.15, pressurePa: 0, ...METHANE })).toThrowError();
  });
});

describe("getBinaryInteractionParameter", () => {
  it("aynı bileşen için 0 döndürür", () => {
    expect(getBinaryInteractionParameter("CH4", "CH4")).toBe(0);
  });

  it("iki hidrokarbon arasında varsayılan 0 döndürür", () => {
    expect(getBinaryInteractionParameter("CH4", "C3H8")).toBe(0);
  });

  it("su-CO2 çifti için kayıtlı (MEDIUM confidence) değeri döndürür", () => {
    expect(getBinaryInteractionParameter("H2O", "CO2")).toBeCloseTo(0.19, 6);
    expect(getBinaryInteractionParameter("CO2", "H2O")).toBeCloseTo(0.19, 6);
  });

  it("kaynağı bulunamayan çiftler (ör. CO2-N2) için UNVERIFIED varsayılanı (0) döndürür", () => {
    expect(getBinaryInteractionParameter("CO2", "N2")).toBe(0);
  });
});

describe("computeMixtureCompressibilityFactor", () => {
  it("tek bileşenli (saf metan) karışım, saf bileşen hesabıyla aynı Z'yi verir", () => {
    const pure = computeCompressibilityFactor({ temperatureK: 293.15, pressurePa: 50e5, ...METHANE });
    const mixture = computeMixtureCompressibilityFactor({
      temperatureK: 293.15,
      pressurePa: 50e5,
      composition: [{ componentId: "CH4", moleFraction: 1 }],
    });
    expect(mixture.compressibilityFactor).toBeCloseTo(pure.compressibilityFactor, 6);
  });

  it("tipik bir doğal gaz bileşimi için makul mertebede yoğunluk üretir", () => {
    // Tipik "sales gas" bileşimi (yaklaşık, GPSA tipik değerlerine benzer mertebe)
    const result = computeMixtureCompressibilityFactor({
      temperatureK: 288.15,
      pressurePa: 70e5,
      composition: [
        { componentId: "CH4", moleFraction: 0.85 },
        { componentId: "C2H6", moleFraction: 0.07 },
        { componentId: "C3H8", moleFraction: 0.03 },
        { componentId: "CO2", moleFraction: 0.02 },
        { componentId: "N2", moleFraction: 0.03 },
      ],
    });
    expect(result.compressibilityFactor).toBeGreaterThan(0.7);
    expect(result.compressibilityFactor).toBeLessThan(1.05);
    expect(result.densityKgM3).toBeGreaterThan(40);
    expect(result.densityKgM3).toBeLessThan(90);
    expect(result.sourcesUsed).toContain("naturalGasComponents.CH4");
  });

  it("mol kesirleri toplamı 1 değilse hata fırlatır", () => {
    expect(() =>
      computeMixtureCompressibilityFactor({
        temperatureK: 288.15,
        pressurePa: 70e5,
        composition: [{ componentId: "CH4", moleFraction: 0.5 }],
      }),
    ).toThrowError();
  });

  it("manuel yoğunluk override verilirse EOS hesabını atlar ve override değerini döndürür", () => {
    const result = computeMixtureCompressibilityFactor({
      temperatureK: 288.15,
      pressurePa: 70e5,
      composition: [{ componentId: "CH4", moleFraction: 1 }],
      manualDensityOverrideKgM3: 55,
    });
    expect(result.densityKgM3).toBe(55);
    expect(result.isManualOverride).toBe(true);
  });

  it("binaryInteractionOverrides ile kayıt defteri varsayılanı ezilebilir", () => {
    const withDefault = computeMixtureCompressibilityFactor({
      temperatureK: 300,
      pressurePa: 50e5,
      composition: [
        { componentId: "CH4", moleFraction: 0.9 },
        { componentId: "CO2", moleFraction: 0.1 },
      ],
    });
    const withOverride = computeMixtureCompressibilityFactor({
      temperatureK: 300,
      pressurePa: 50e5,
      composition: [
        { componentId: "CH4", moleFraction: 0.9 },
        { componentId: "CO2", moleFraction: 0.1 },
      ],
      binaryInteractionOverrides: { CH4_CO2: 0.12 },
    });
    expect(withOverride.compressibilityFactor).not.toBeCloseTo(withDefault.compressibilityFactor, 8);
  });
});
