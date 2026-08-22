// packages/engine/tests/fluids/waterProperties.test.ts

import { describe, expect, it } from "vitest";
import {
  computeSaturatedWaterContentMgPerSm3,
  computeWaterDewPointK,
  computeWaterSaturationPressurePa,
  computeWaterSaturationTemperatureK,
} from "../../src/fluids/waterProperties";

const PA_PER_MPA = 1e6;

describe("computeWaterSaturationPressurePa", () => {
  // Referans: IAPWS-IF97 resmi belgesi, Tablo 35 "Saturation pressures
  // calculated from Eq. (30) for selected values of T" — bu, standardın
  // KENDİ doğrulama tablosudur (bu oturumda birincil kaynaktan okundu).
  it("IAPWS-IF97 Tablo 35 referans değerleriyle tam eşleşir: T=300K", () => {
    expect(computeWaterSaturationPressurePa(300) / PA_PER_MPA).toBeCloseTo(0.353658941e-2, 8);
  });

  it("IAPWS-IF97 Tablo 35 referans değerleriyle tam eşleşir: T=500K", () => {
    expect(computeWaterSaturationPressurePa(500) / PA_PER_MPA).toBeCloseTo(0.263889776e1, 6);
  });

  it("IAPWS-IF97 Tablo 35 referans değerleriyle tam eşleşir: T=600K", () => {
    expect(computeWaterSaturationPressurePa(600) / PA_PER_MPA).toBeCloseTo(0.123443146e2, 5);
  });

  it("100°C'de (373.15K) yaklaşık 1 atm (101325 Pa) verir (suyun kaynama noktası tanımı, %0.2 tolerans)", () => {
    // NOT: IAPWS-95/IF97'nin modern hassas formülasyonu, 373.15K'de tam
    // 101325Pa DEĞİL ~101418Pa verir (~%0.09 fark) — "100°C=1atm'de kaynar"
    // yaklaşımı eski ITS ölçek tanımından kalma bir yuvarlamadır, gerçek
    // deneysel veri bu kadar hassas değildir. Bu yüzden %0.2 tolerans kullanıldı.
    const ps = computeWaterSaturationPressurePa(373.15);
    expect(Math.abs(ps - 101325) / 101325).toBeLessThan(0.002);
  });

  it("sıcaklık negatif/sıfırsa hata fırlatır", () => {
    expect(() => computeWaterSaturationPressurePa(0)).toThrowError();
  });
});

describe("computeWaterSaturationTemperatureK", () => {
  it("Eq. 30'un (ps(T)) matematiksel tersidir: Ts(ps(T))=T round-trip", () => {
    for (const t of [280, 300, 350, 400, 450, 500, 550, 600]) {
      const ps = computeWaterSaturationPressurePa(t);
      expect(computeWaterSaturationTemperatureK(ps)).toBeCloseTo(t, 6);
    }
  });

  it("basınç negatif/sıfırsa hata fırlatır", () => {
    expect(() => computeWaterSaturationTemperatureK(0)).toThrowError();
  });
});

describe("computeWaterDewPointK", () => {
  it("su mol kesri 1 ise çiy noktası, doygunluk sıcaklığının kendisidir", () => {
    const result = computeWaterDewPointK({ totalPressurePa: 101325, waterMoleFraction: 1 });
    expect(result.dewPointK).toBeCloseTo(computeWaterSaturationTemperatureK(101325), 6);
  });

  it("su mol kesri düştükçe (kısmi basınç azaldıkça) çiy noktası düşer", () => {
    const highFraction = computeWaterDewPointK({ totalPressurePa: 50e5, waterMoleFraction: 0.01 });
    const lowFraction = computeWaterDewPointK({ totalPressurePa: 50e5, waterMoleFraction: 0.001 });
    expect(lowFraction.dewPointK).toBeLessThan(highFraction.dewPointK);
  });

  it("70 bar üzerinde validityWarnings ekler", () => {
    const result = computeWaterDewPointK({ totalPressurePa: 100e5, waterMoleFraction: 0.001 });
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("geçersiz mol kesri (0 veya >1) için hata fırlatır", () => {
    expect(() => computeWaterDewPointK({ totalPressurePa: 50e5, waterMoleFraction: 0 })).toThrowError();
    expect(() => computeWaterDewPointK({ totalPressurePa: 50e5, waterMoleFraction: 1.1 })).toThrowError();
  });
});

describe("computeSaturatedWaterContentMgPerSm3", () => {
  it("tipik doğal gaz koşullarında (100°F, 1000psia mertebesi) makul mertebede su içeriği üretir", () => {
    // 100°F ≈ 310.93K, 1000psia ≈ 6.895e6 Pa — Carroll (2002) makalesindeki
    // tipik referans koşullar mertebesinde. Bilinen endüstri pratiği:
    // bu koşullarda su içeriği tipik olarak birkaç yüz mg/Sm³ mertebesindedir.
    const temperatureK = 310.928;
    const totalPressurePa = 1000 * 6894.757293168;
    const result = computeSaturatedWaterContentMgPerSm3({ temperatureK, totalPressurePa });
    expect(result.waterContentMgPerSm3).toBeGreaterThan(10);
    expect(result.waterContentMgPerSm3).toBeLessThan(5000);
    expect(result.validityWarnings).toHaveLength(0);
  });

  it("sıcaklık arttıkça (sabit basınçta) su içeriği artar (daha fazla buharlaşma)", () => {
    const totalPressurePa = 1000 * 6894.757293168;
    const cooler = computeSaturatedWaterContentMgPerSm3({ temperatureK: 300, totalPressurePa });
    const warmer = computeSaturatedWaterContentMgPerSm3({ temperatureK: 340, totalPressurePa });
    expect(warmer.waterContentMgPerSm3).toBeGreaterThan(cooler.waterContentMgPerSm3);
  });

  it("geçerlilik aralığı dışındaki sıcaklık/basınç için validityWarnings ekler", () => {
    const result = computeSaturatedWaterContentMgPerSm3({ temperatureK: 200, totalPressurePa: 1e5 });
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("sıcaklık veya basınç negatifse hata fırlatır", () => {
    expect(() => computeSaturatedWaterContentMgPerSm3({ temperatureK: -1, totalPressurePa: 1e5 })).toThrowError();
    expect(() => computeSaturatedWaterContentMgPerSm3({ temperatureK: 300, totalPressurePa: 0 })).toThrowError();
  });
});
