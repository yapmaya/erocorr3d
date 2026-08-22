// packages/engine/tests/corrosion/norsokPh.test.ts

import { describe, expect, it } from "vitest";
import {
  computeCarbonicAcidK1,
  computeCarbonicAcidK2,
  computeCo2HenryConstant,
  computeIronCarbonateSolubility,
  computeNorsokInSituPh,
  computeWaterDissociationConstant,
  correctBicarbonateForOrganicAcid,
  estimateIonicStrengthMolar,
} from "../../src/corrosion/norsokPh";

const T25C_K = 298.15;
const PA_PER_BAR = 1e5;

describe("computeCo2HenryConstant — bağımsız fiziksel referans doğrulaması", () => {
  it("25°C, 1 bar, I=0'da bilinen CO2 Henry sabitine (~0.034 mol/(L·bar)) çok yakın sonuç verir", () => {
    const kH = computeCo2HenryConstant(T25C_K, 1, 0);
    expect(kH).toBeGreaterThan(0.03);
    expect(kH).toBeLessThan(0.037);
  });
});

describe("computeWaterDissociationConstant — bağımsız fiziksel referans doğrulaması", () => {
  it("25°C'de bilinen suyun ayrışma sabitine (~1.0e-14) aynı mertebede çok yakın sonuç verir", () => {
    const kW = computeWaterDissociationConstant(T25C_K);
    expect(kW).toBeGreaterThan(1e-15);
    expect(kW).toBeLessThan(1e-13);
  });

  it("sıcaklık arttıkça Kw artar (bilinen davranış — su ayrışması endotermiktir)", () => {
    expect(computeWaterDissociationConstant(350)).toBeGreaterThan(computeWaterDissociationConstant(300));
  });
});

describe("computeIronCarbonateSolubility — makullük kontrolü", () => {
  it("25°C, I=0'da FeCO3 için literatürde bilinen mertebeyle (~1e-11 ila 1e-10 molal²) uyumlu bir değer verir", () => {
    const ksp = computeIronCarbonateSolubility(T25C_K, 0);
    expect(ksp).toBeGreaterThan(1e-12);
    expect(ksp).toBeLessThan(1e-9);
  });
});

describe("computeCarbonicAcidK1 / K2 — bağımsız fiziksel referans doğrulaması", () => {
  // 2026-08-22 GÜNCELLEMESİ: K1'in tkInverseSquaredCoeff katsayısındaki ondalık
  // kayması (1684915 yerine 168491.5) düzeltildi — bkz. registry/coefficients/
  // norsokPh.ts::norsokPh.k1'in düzeltme notu. Bu testler artık K1/K2'nin
  // FİZİKSEL OLARAK DOĞRU olduğunu (Plummer & Busenberg 1982'ye çapraz
  // doğrulanmış, confidence=HIGH) iddia eder — önceki "UNVERIFIED" başlığı
  // artık geçerli değildir.
  it("25°C, ~1atm (14.7 PSİ), I=0'da bilinen karbonik asit pK1'ine (~6.35) çok yakın sonuç verir", () => {
    const k1 = computeCarbonicAcidK1(T25C_K, 14.7, 0);
    expect(-Math.log10(k1)).toBeGreaterThan(6.2);
    expect(-Math.log10(k1)).toBeLessThan(6.5);
  });

  it("25°C, ~1atm (14.7 PSİ), I=0'da bilinen karbonik asit pK2'sine (~10.33) çok yakın sonuç verir", () => {
    const k2 = computeCarbonicAcidK2(T25C_K, 14.7, 0);
    expect(-Math.log10(k2)).toBeGreaterThan(10.1);
    expect(-Math.log10(k2)).toBeLessThan(10.5);
  });

  it("K1 > K2 (karbonik asidin ilk ayrışması ikinciden her zaman daha kolaydır — yapısal özellik)", () => {
    const k1 = computeCarbonicAcidK1(T25C_K, 14.7, 0);
    const k2 = computeCarbonicAcidK2(T25C_K, 14.7, 0);
    expect(k1).toBeGreaterThan(k2);
  });
});

describe("estimateIonicStrengthMolar", () => {
  it("35000mg/L klorür (deniz suyu mertebesi) için ~1M mertebesinde iyonik kuvvet verir", () => {
    const i = estimateIonicStrengthMolar(35000);
    expect(i).toBeGreaterThan(0.5);
    expect(i).toBeLessThan(1.5);
  });

  it("negatif klorür için hata fırlatır", () => {
    expect(() => estimateIonicStrengthMolar(-1)).toThrowError();
  });
});

describe("correctBicarbonateForOrganicAcid", () => {
  it("organik asit yoksa bikarbonatı değiştirmez", () => {
    expect(correctBicarbonateForOrganicAcid(500, 0)).toBe(500);
  });

  it("organik asidin 2/3'ü kadar bikarbonatı azaltır", () => {
    expect(correctBicarbonateForOrganicAcid(500, 300)).toBeCloseTo(500 - 200, 6);
  });

  it("sonuç negatif olamaz (0'da sınırlanır)", () => {
    expect(correctBicarbonateForOrganicAcid(100, 1000)).toBe(0);
  });
});

describe("computeNorsokInSituPh", () => {
  const baseInput = {
    temperatureK: T25C_K,
    totalPressurePa: 10 * PA_PER_BAR,
    co2FugacityPa: 1 * PA_PER_BAR,
    bicarbonateMgL: 200,
    ionicStrengthMolar: 0.1,
    isWaterFeSaturated: false,
  };

  it("fiziksel olarak makul bir aralıkta (0-14) sonlu bir pH üretir", () => {
    // 2026-08-22 GÜNCELLEMESİ: K1/K2 artık HIGH confidence (bkz. yukarıdaki
    // K1/K2 describe bloğu) — bu yüzden pH'ın da fiziksel olarak makul bir
    // aralıkta olması artık İDDİA EDİLEBİLİR, yalnızca "hatasız tamamlanma" değil.
    const result = computeNorsokInSituPh(baseInput);
    expect(Number.isFinite(result.pH)).toBe(true);
    expect(result.pH).toBeGreaterThan(0);
    expect(result.pH).toBeLessThan(14);
  });

  it("K0/K1/K2/KH/Kw/Ksp'nin TAMAMI HIGH confidence olduğundan sonuç confidence=HIGH taşır, K1/K2 uyarısı EKLENMEZ", () => {
    const result = computeNorsokInSituPh(baseInput);
    expect(result.confidence).toBe("HIGH");
    expect(result.validityWarnings.some((w) => w.message.includes("K1/K2"))).toBe(false);
  });

  it("CO2 fugasitesi arttıkça pH azalır (daha asidik — temel karbonik asit kimyası, K1/K2'nin kesin değerinden BAĞIMSIZ bir yapısal özellik)", () => {
    const lowCo2 = computeNorsokInSituPh({ ...baseInput, co2FugacityPa: 0.5 * PA_PER_BAR });
    const highCo2 = computeNorsokInSituPh({ ...baseInput, co2FugacityPa: 5 * PA_PER_BAR });
    expect(highCo2.pH).toBeLessThan(lowCo2.pH);
  });

  it("bikarbonat arttıkça pH artar (daha fazla tamponlama — yapısal özellik)", () => {
    const lowBicarb = computeNorsokInSituPh({ ...baseInput, bicarbonateMgL: 50 });
    const highBicarb = computeNorsokInSituPh({ ...baseInput, bicarbonateMgL: 2000 });
    expect(highBicarb.pH).toBeGreaterThan(lowBicarb.pH);
  });

  it("FeCO3 doygun modu, doygun-olmayan moddan farklı (ve sonlu) bir pH üretir", () => {
    const unsaturated = computeNorsokInSituPh({ ...baseInput, isWaterFeSaturated: false });
    const saturated = computeNorsokInSituPh({ ...baseInput, isWaterFeSaturated: true });
    expect(Number.isFinite(saturated.pH)).toBe(true);
    expect(saturated.pH).not.toBeCloseTo(unsaturated.pH, 6);
  });

  it("chlorideMgL verilip ionicStrengthMolar verilmezse iyonik kuvveti tahmin ederek hesap yapar", () => {
    const { ionicStrengthMolar: _omit, ...withoutIonic } = baseInput;
    const result = computeNorsokInSituPh({ ...withoutIonic, chlorideMgL: 20000 });
    expect(Number.isFinite(result.pH)).toBe(true);
  });

  it("ne ionicStrengthMolar ne chlorideMgL verilmezse hata fırlatır", () => {
    const { ionicStrengthMolar: _omit, ...withoutIonic } = baseInput;
    expect(() => computeNorsokInSituPh(withoutIonic)).toThrowError();
  });

  it("geçersiz girdiler için hata fırlatır", () => {
    expect(() => computeNorsokInSituPh({ ...baseInput, temperatureK: 0 })).toThrowError();
    expect(() => computeNorsokInSituPh({ ...baseInput, co2FugacityPa: 0 })).toThrowError();
    expect(() => computeNorsokInSituPh({ ...baseInput, bicarbonateMgL: -1 })).toThrowError();
  });

  it("geçerlilik aralığı dışındaki iyonik kuvvet/bikarbonat için uyarı ekler", () => {
    const result = computeNorsokInSituPh({ ...baseInput, ionicStrengthMolar: 5 });
    expect(result.validityWarnings.some((w) => w.parameter === "İyonik kuvvet")).toBe(true);
  });
});
