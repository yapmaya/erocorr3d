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

describe("computeCarbonicAcidK1 / K2 — ⚠ UNVERIFIED katsayılara dayanır", () => {
  it("pozitif bir sayısal değer üretir (kaynak doğrulaması başarısız olsa da fonksiyon hesap yapar)", () => {
    // NOT: Bu testler K1/K2'nin FİZİKSEL OLARAK DOĞRU olduğunu DEĞİL, formülün
    // standardın basılı haliyle tutarlı şekilde ve hatasız çalıştığını doğrular.
    // Bkz. registry/coefficients/norsokPh.ts::norsokPh.k1 için ayrıntılı uyuşmazlık notu.
    expect(computeCarbonicAcidK1(T25C_K, 14.7, 0)).toBeGreaterThan(0);
    expect(computeCarbonicAcidK2(T25C_K, 14.7, 0)).toBeGreaterThan(0);
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

  it("sonlu bir pH üretir (hata fırlatmadan tamamlanır)", () => {
    // NOT: pH'ın FİZİKSEL OLARAK MAKUL bir aralıkta (ör. 0-14) olması BURADA
    // İDDİA EDİLMİYOR — K1/K2'nin UNVERIFIED durumu nedeniyle (bkz. yukarıdaki
    // test ve registry notu) sayısal değer güvenilir değildir; yalnızca
    // hesabın hatasız tamamlandığı doğrulanıyor.
    const result = computeNorsokInSituPh(baseInput);
    expect(Number.isFinite(result.pH)).toBe(true);
  });

  it("⚠ K1/K2 UNVERIFIED olduğundan sonuç confidence=UNVERIFIED taşır ve uyarı ekler", () => {
    const result = computeNorsokInSituPh(baseInput);
    expect(result.confidence).toBe("UNVERIFIED");
    expect(result.validityWarnings.some((w) => w.message.includes("K1/K2"))).toBe(true);
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
