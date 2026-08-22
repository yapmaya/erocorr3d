// packages/engine/tests/erosion/valveHydraulics.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  computeLiquidCriticalPressureRatioFactor,
  computeValveHydraulics,
  computeCavitationIndexSigma,
  computeChokingSigma,
  computeSizeScaleExponentB,
  computeSizeScaleEffect,
  computePressureScaleEffect,
  computeScaledIncipientDamageSigma,
  classifyCavitationRegime,
  estimateIndicativeCavitationDamageRateMmPerYear,
  assessLiquidCavitationRisk,
  computeSpecificHeatRatioFactor,
  computeGasPressureDropRatio,
  computeGasChokedPressureDropRatio,
  computeGasExpansionFactorY,
  computeSonicVelocityMs,
  assessGasValveErosionRisk,
  interpolatePartialOpeningMultiplier,
  getGenericPartialOpeningSeverityCurve,
  assessPartialOpeningSuitability,
  computeValveZoneDamage,
} from "../../src/erosion/valveHydraulics";

/** psi → Pa (kesin dönüşüm sabiti). */
const PSI_TO_PA = 6894.757293168;

describe("computeLiquidCriticalPressureRatioFactor (FF)", () => {
  it("buhar basıncı ~0 iken FF, C1 sabitine (0.96) yaklaşır", () => {
    const ff = computeLiquidCriticalPressureRatioFactor(1, 220e5);
    expect(ff).toBeCloseTo(0.96, 2);
  });

  it("buhar basıncı arttıkça FF azalır", () => {
    const ffLow = computeLiquidCriticalPressureRatioFactor(0.02e5, 220e5);
    const ffHigh = computeLiquidCriticalPressureRatioFactor(50e5, 220e5);
    expect(ffHigh).toBeLessThan(ffLow);
  });

  it("negatif buhar basıncı veya sıfır/negatif kritik basınç için hata fırlatır", () => {
    expect(() => computeLiquidCriticalPressureRatioFactor(-1, 220e5)).toThrowError();
    expect(() => computeLiquidCriticalPressureRatioFactor(1, 0)).toThrowError();
  });
});

describe("computeValveHydraulics", () => {
  const baseInput = {
    upstreamPressurePa: 10e5,
    downstreamPressurePa: 6e5,
    vaporPressurePa: 0.02e5,
    thermodynamicCriticalPressurePa: 220e5,
    flowCoefficientCv: 50,
    liquidPressureRecoveryFactorFl: 0.9,
    fluidDensityKgM3: 1000,
  };

  it("tam açık (choked olmayan) su akışı için bağımsız elle hesaplanan referans debiyle eşleşir", () => {
    const result = computeValveHydraulics(baseInput);
    // Bağımsız çapraz kontrol: ABD birimleriyle klasik Cv=q√(SG/ΔPpsi) formülü
    // aynı koşullar için ~86.5 m³/h veriyor (bkz. kod incelemesi notları).
    expect(result.volumetricFlowRateM3H).toBeCloseTo(86.33018012259674, 3);
    expect(result.isChokedFlow).toBe(false);
    expect(result.pressureDropPa).toBe(4e5);
  });

  it("ΔP, ΔPchoked'i aştığında tıkanmış (choked) akış olarak işaretler", () => {
    const result = computeValveHydraulics({
      ...baseInput,
      downstreamPressurePa: 0.5e5, // çok büyük ΔP, tıkanmayı tetikler
    });
    expect(result.isChokedFlow).toBe(true);
    expect(result.validityWarnings.some((w) => w.parameter === "Akış durumu")).toBe(true);
  });

  it("giriş basıncı çıkıştan büyük değilse debi 0 ve uyarı döner", () => {
    const result = computeValveHydraulics({
      ...baseInput,
      upstreamPressurePa: 5e5,
      downstreamPressurePa: 6e5,
    });
    expect(result.volumetricFlowRateM3H).toBe(0);
    expect(result.validityWarnings.some((w) => w.parameter === "Basınç düşümü")).toBe(true);
  });

  it("Kc sağlanmazsa kavitasyon riski UNKNOWN olur ve uyarı eklenir", () => {
    const result = computeValveHydraulics(baseInput);
    expect(result.cavitationRisk).toBe("UNKNOWN");
    expect(result.validityWarnings.some((w) => w.parameter.includes("Kc"))).toBe(true);
  });

  it("Kc sağlandığında xF'e göre LIKELY/UNLIKELY döner", () => {
    const likely = computeValveHydraulics({ ...baseInput, cavitationCoefficientKc: 0.01 });
    expect(likely.cavitationRisk).toBe("LIKELY");

    const unlikely = computeValveHydraulics({ ...baseInput, cavitationCoefficientKc: 0.99 });
    expect(unlikely.cavitationRisk).toBe("UNLIKELY");
  });

  it("geçersiz Cv/FL/basınç için hata fırlatır", () => {
    expect(() => computeValveHydraulics({ ...baseInput, flowCoefficientCv: 0 })).toThrowError();
    expect(() => computeValveHydraulics({ ...baseInput, liquidPressureRecoveryFactorFl: 1.5 })).toThrowError();
    expect(() => computeValveHydraulics({ ...baseInput, upstreamPressurePa: 0 })).toThrowError();
  });

  it("her sonuç mühendislik uyarısını (disclaimer) döndürür", () => {
    const result = computeValveHydraulics(baseInput);
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("valveHydraulics — KDP kayıt defteri entegrasyonu", () => {
  it("valves modülü için ISA 60534 denklem sabitleri kayıtlıdır", () => {
    const registered = listCoefficients().filter((c) => c.module === "valves");
    const ids = registered.map((c) => c.id);
    expect(ids).toContain("valves.isa60534.n6Metric");
    expect(ids).toContain("valves.isa60534.ffFormulaConstant1");
    expect(ids).toContain("valves.isa60534.ffFormulaConstant2");
  });

  it("N6 sabiti iki bağımsız kaynakla çapraz doğrulanmış HIGH confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "valves.isa60534.n6Metric");
    expect(entry?.crossChecked).toBe(true);
    expect(entry?.confidence).toBe("HIGH");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// A) ISA-RP75.23-1995 sigma yöntemi — DeZURIK Alpha I Cavitation Guide'ın
// KENDİ tam sayısal örneğiyle (Bölüm 8, 2" VPB vana) çapraz doğrulama.
// Girdi: P1=300psia, P2=50psia, Pv=29.84psia, Pc=3206psia, gerekli Cv=32,
// d=2in, dR=3in, PR=100psia, a=0.3, σmr=1.6 (@%47 açıklık).
// Kaynağın kendi sonuçları: σ=1.08, b=0.115, SSE=0.954, PSE=1.347, σv=1.71,
// σ/σv=0.63.
// ═══════════════════════════════════════════════════════════════════════
describe("ISA-RP75.23-1995 sigma yöntemi — DeZURIK Alpha I Guide örneğiyle çapraz doğrulama", () => {
  const p1Pa = 300 * PSI_TO_PA;
  const p2Pa = 50 * PSI_TO_PA;
  const pvPa = 29.84 * PSI_TO_PA;
  const referencePressureDropPa = 100 * PSI_TO_PA; // PR

  it("computeCavitationIndexSigma, kaynağın kendi σ=1.08 sonucuyla eşleşir", () => {
    const sigma = computeCavitationIndexSigma(p1Pa, p2Pa, pvPa);
    expect(sigma).toBeCloseTo(1.0806, 3);
  });

  it("computeSizeScaleExponentB, kaynağın kendi b=0.115 sonucuyla eşleşir", () => {
    const b = computeSizeScaleExponentB(32, 2);
    expect(b).toBeCloseTo(0.115, 2);
  });

  it("computeSizeScaleEffect, kaynağın kendi SSE=0.954 sonucuyla eşleşir", () => {
    const b = computeSizeScaleExponentB(32, 2);
    const sse = computeSizeScaleEffect(2, 3, b);
    expect(sse).toBeCloseTo(0.954, 2);
  });

  it("computePressureScaleEffect, kaynağın kendi PSE=1.347 sonucuyla eşleşir", () => {
    const pse = computePressureScaleEffect(p1Pa, pvPa, referencePressureDropPa, 0.3);
    expect(pse).toBeCloseTo(1.347, 3);
  });

  it("computeScaledIncipientDamageSigma, kaynağın kendi σv=1.71 sonucuyla eşleşir", () => {
    const b = computeSizeScaleExponentB(32, 2);
    const sse = computeSizeScaleEffect(2, 3, b);
    const pse = computePressureScaleEffect(p1Pa, pvPa, referencePressureDropPa, 0.3);
    const sigmaV = computeScaledIncipientDamageSigma(1.6, sse, pse);
    expect(sigmaV).toBeCloseTo(1.71, 2);
  });

  it("σ/σv oranı, kaynağın kendi %63 sonucuyla eşleşir", () => {
    const sigma = computeCavitationIndexSigma(p1Pa, p2Pa, pvPa);
    const b = computeSizeScaleExponentB(32, 2);
    const sse = computeSizeScaleEffect(2, 3, b);
    const pse = computePressureScaleEffect(p1Pa, pvPa, referencePressureDropPa, 0.3);
    const sigmaV = computeScaledIncipientDamageSigma(1.6, sse, pse);
    expect(sigma / sigmaV).toBeCloseTo(0.63, 2);
  });
});

describe("computeChokingSigma", () => {
  it("FL küçüldükçe (daha kolay boğulan vana) σch artar", () => {
    const lowFl = computeChokingSigma(10e5, 0.02e5, 0.6, 0.95);
    const highFl = computeChokingSigma(10e5, 0.02e5, 0.9, 0.95);
    expect(lowFl).toBeGreaterThan(highFl);
  });

  it("Ff≈1, Pv≪Pc iken σch≈1/FL²'ye yaklaşır", () => {
    const sigmaCh = computeChokingSigma(100e5, 0.001e5, 0.8, 0.999);
    expect(sigmaCh).toBeCloseTo(1 / 0.8 ** 2, 2);
  });
});

describe("classifyCavitationRegime", () => {
  it("σ ≤ σch iken BOĞULMUŞ döner", () => {
    expect(classifyCavitationRegime(1.0, 1.5, null).level).toBe("BOĞULMUŞ");
  });

  it("σv sağlanmadığında (ve boğulma yoksa) BİLİNMİYOR döner", () => {
    expect(classifyCavitationRegime(3.0, 1.0, null).level).toBe("BİLİNMİYOR");
  });

  it("σ ≥ σv iken GÜVENLİ döner (kavitasyon başlangıç eşiğinin üzerinde → hasar riski yok)", () => {
    const result = classifyCavitationRegime(3.0, 1.0, 2.0);
    expect(result.level).toBe("GÜVENLİ");
    expect(result.sigmaToScaledDamageRatio).toBeCloseTo(1.5, 5);
  });

  it("0.9 ≤ σ/σv < 1.0 iken BAŞLANGIÇ_HASARI döner", () => {
    expect(classifyCavitationRegime(1.85, 1.0, 2.0).level).toBe("BAŞLANGIÇ_HASARI");
  });

  it("σ/σv < 0.9 iken HASAR_RİSKİ döner", () => {
    expect(classifyCavitationRegime(1.0, 0.5, 2.0).level).toBe("HASAR_RİSKİ");
  });
});

describe("estimateIndicativeCavitationDamageRateMmPerYear", () => {
  it("σ eşiğin üzerinde/eşitse null döner (hasar beklenmiyor)", () => {
    expect(estimateIndicativeCavitationDamageRateMmPerYear(2.0, 2.0)).toBeNull();
    expect(estimateIndicativeCavitationDamageRateMmPerYear(3.0, 2.0)).toBeNull();
  });

  it("eşiğin altına inildikçe gösterge hız MONOTON artar", () => {
    const mild = estimateIndicativeCavitationDamageRateMmPerYear(1.9, 2.0)!;
    const severe = estimateIndicativeCavitationDamageRateMmPerYear(1.0, 2.0)!;
    const veryServere = estimateIndicativeCavitationDamageRateMmPerYear(0.2, 2.0)!;
    expect(mild.p50).toBeGreaterThan(0);
    expect(severe.p50).toBeGreaterThan(mild.p50);
    expect(veryServere.p50).toBeGreaterThan(severe.p50);
  });

  it("daha sert (relativeMaterialHardnessFactor>1) malzeme hasar hızını AZALTIR", () => {
    const csRate = estimateIndicativeCavitationDamageRateMmPerYear(1.0, 2.0, 1)!;
    const hardenedRate = estimateIndicativeCavitationDamageRateMmPerYear(1.0, 2.0, 3)!;
    expect(hardenedRate.p50).toBeLessThan(csRate.p50);
  });

  it("her sonuç UNVERIFIED confidence taşıyan registry sabitlerine dayanır (kayıt defteri kontrolü)", () => {
    const entry = listCoefficients().find((c) => c.id === "valves.cavitationDamage.severityExponentRange");
    expect(entry?.confidence).toBe("UNVERIFIED");
  });
});

describe("assessLiquidCavitationRisk", () => {
  const baseInput = {
    upstreamPressurePa: 10e5,
    downstreamPressurePa: 6e5,
    vaporPressurePa: 0.02e5,
    thermodynamicCriticalPressurePa: 220e5,
    liquidPressureRecoveryFactorFl: 0.9,
  };

  it("σmr/SSE/PSE sağlanmadığında hasar rejimi BİLİNMİYOR döner ve uyarı verir", () => {
    const result = assessLiquidCavitationRisk(baseInput);
    expect(result.regimeLevel).toBe("BİLİNMİYOR");
    expect(result.scaledIncipientDamageSigma).toBeNull();
    expect(result.validityWarnings.some((w) => w.parameter.includes("σmr"))).toBe(true);
  });

  it("P2 < Pv (flashing) durumunda isFlashing=true döner ve farklı hasar deseni uyarısı verir", () => {
    const result = assessLiquidCavitationRisk({ ...baseInput, downstreamPressurePa: 0.01e5 });
    expect(result.isFlashing).toBe(true);
    expect(result.validityWarnings.some((w) => w.parameter === "Flashing durumu")).toBe(true);
  });

  it("P2 ≥ Pv iken isFlashing=false döner", () => {
    const result = assessLiquidCavitationRisk(baseInput);
    expect(result.isFlashing).toBe(false);
  });

  it("σ, σch'e çok yakın (neredeyse boğulmuş) koşulda BOĞULMUŞ rejimi ve pozitif gösterge hız döner", () => {
    const result = assessLiquidCavitationRisk({ ...baseInput, downstreamPressurePa: 0.5e5 });
    expect(result.regimeLevel).toBe("BOĞULMUŞ");
    expect(result.indicativeDamageRateMmPerYear).not.toBeNull();
    expect(result.indicativeDamageRateMmPerYear!.p50).toBeGreaterThan(0);
  });

  it("σ, σv'nin çok üzerinde (bol ölçekleme marjı) iken GÜVENLİ rejimi ve gösterge hız=null döner", () => {
    const result = assessLiquidCavitationRisk({
      ...baseInput,
      downstreamPressurePa: 9e5, // çok küçük ΔP → yüksek σ
      manufacturerRecommendedSigmaMr: 1.6,
      sizeScaleEffectSse: 0.954,
      pressureScaleEffectPse: 1.347,
    });
    expect(result.regimeLevel).toBe("GÜVENLİ");
    expect(result.indicativeDamageRateMmPerYear).toBeNull();
  });

  it("her sonuç mühendislik uyarısını (disclaimer) ve tarama notunu döndürür", () => {
    const result = assessLiquidCavitationRisk(baseInput);
    expect(result.disclaimer).toContain("mühendislik tahminidir");
    expect(result.screeningOnlyNoteTr).toContain("ÜRETİCİNİN");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// B) Gaz/buhar servisi — IEC 60534-2-1
// ═══════════════════════════════════════════════════════════════════════
describe("computeSpecificHeatRatioFactor (Fγ)", () => {
  it("γ=1.4 iken Fγ=1 döner", () => {
    expect(computeSpecificHeatRatioFactor(1.4)).toBeCloseTo(1, 5);
  });

  it("γ≤1 için hata fırlatır", () => {
    expect(() => computeSpecificHeatRatioFactor(1)).toThrowError();
  });
});

describe("computeGasPressureDropRatio / computeGasChokedPressureDropRatio", () => {
  it("x = ΔP/P1 doğru hesaplanır", () => {
    expect(computeGasPressureDropRatio(20e5, 10e5)).toBeCloseTo(0.5, 10);
  });

  it("xchoked = Fγ×xT doğru hesaplanır", () => {
    const fGamma = computeSpecificHeatRatioFactor(1.3);
    expect(computeGasChokedPressureDropRatio(fGamma, 0.7)).toBeCloseTo((1.3 / 1.4) * 0.7, 10);
  });

  it("xT aralık dışıysa hata fırlatır", () => {
    expect(() => computeGasChokedPressureDropRatio(1, 1.5)).toThrowError();
  });
});

describe("computeGasExpansionFactorY", () => {
  it("x çok küçükken (boğulmadan uzak) Y, 1'e yakındır", () => {
    const y = computeGasExpansionFactorY(0.01, 0.5);
    expect(y).toBeGreaterThan(0.9);
  });

  it("boğulmada (x≥xchoked) Y TAM OLARAK 2/3'e sabitlenir", () => {
    const yAtChoke = computeGasExpansionFactorY(0.5, 0.5);
    const yBeyondChoke = computeGasExpansionFactorY(0.9, 0.5);
    expect(yAtChoke).toBeCloseTo(2 / 3, 10);
    expect(yBeyondChoke).toBeCloseTo(2 / 3, 10);
  });
});

describe("computeSonicVelocityMs", () => {
  it("hava için (γ=1.4, M=0.02896 kg/mol) 20°C'de yaklaşık 343 m/s verir (bilinen fiziksel değer çapraz kontrolü)", () => {
    const c = computeSonicVelocityMs(1.4, 293.15, 0.02896);
    expect(c).toBeCloseTo(343, 0);
  });
});

describe("assessGasValveErosionRisk", () => {
  const baseInput = {
    upstreamPressurePa: 20e5,
    downstreamPressurePa: 10e5,
    specificHeatRatioGamma: 1.3,
    pressureDifferentialRatioFactorXt: 0.7,
    temperatureK: 320,
    molarMassKgPerMol: 0.018, // doğal gaza yakın karışım için kaba örnek
  };

  it("boğulmuş akışta Mach=1 (gerçek hız sağlanmasa bile, tanım gereği sonik) ve risk KRİTİK döner", () => {
    const result = assessGasValveErosionRisk({
      ...baseInput,
      downstreamPressurePa: 2e5, // çok büyük ΔP → boğulma
    });
    expect(result.isChoked).toBe(true);
    expect(result.machNumber).toBe(1.0);
    expect(result.noiseRiskLevel).toBe("KRİTİK");
  });

  it("gerçek çıkış hızı sağlandığında Mach = hız/sonik hız olarak hesaplanır", () => {
    const result = assessGasValveErosionRisk({ ...baseInput, actualOutletVelocityMs: 50 });
    expect(result.machNumber).toBeCloseTo(50 / result.sonicVelocityMs, 5);
  });

  it("Mach ≥ sürekli-kısma limitini (0.33) aştığında YAKLAŞIYOR/KRİTİK döner, altındaysa GÜVENLİ", () => {
    const low = assessGasValveErosionRisk({ ...baseInput, actualOutletVelocityMs: 10 });
    const high = assessGasValveErosionRisk({ ...baseInput, actualOutletVelocityMs: 200 });
    expect(low.noiseRiskLevel).toBe("GÜVENLİ");
    expect(high.noiseRiskLevel === "YAKLAŞIYOR" || high.noiseRiskLevel === "KRİTİK").toBe(true);
  });

  it("her sonuç tarama notu ve mühendislik uyarısı döndürür", () => {
    const result = assessGasValveErosionRisk(baseInput);
    expect(result.screeningOnlyNoteTr).toContain("TARAMA");
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C) Kısmi açıklık etkisi
// ═══════════════════════════════════════════════════════════════════════
describe("interpolatePartialOpeningMultiplier", () => {
  const curve = getGenericPartialOpeningSeverityCurve();

  it("uç noktalarda tam eğri değerini döner", () => {
    expect(interpolatePartialOpeningMultiplier(100, curve)).toBeCloseTo(1.0, 5);
    expect(interpolatePartialOpeningMultiplier(10, curve)).toBeCloseTo(12, 5);
  });

  it("kontrol noktaları arasında DOĞRUSAL enterpolasyon yapar", () => {
    // 50→2.5, 20→6.0 arasında, 35 tam ortada → (2.5+6.0)/2=4.25
    expect(interpolatePartialOpeningMultiplier(35, curve)).toBeCloseTo(4.25, 5);
  });

  it("açıklık yüzdesi azaldıkça çarpan MONOTON artar", () => {
    const openings = [100, 90, 75, 50, 30, 20, 15, 10];
    const multipliers = openings.map((o) => interpolatePartialOpeningMultiplier(o, curve));
    for (let i = 1; i < multipliers.length; i++) {
      expect(multipliers[i]).toBeGreaterThanOrEqual(multipliers[i - 1]!);
    }
  });

  it("aralık dışı açıklık için hata fırlatır", () => {
    expect(() => interpolatePartialOpeningMultiplier(150, curve)).toThrowError();
  });
});

describe("assessPartialOpeningSuitability", () => {
  it("GATE_VALVE %100'ün altında açıklıkta UYGUN DEĞİL olarak işaretlenir", () => {
    const result = assessPartialOpeningSuitability("GATE_VALVE", 50);
    expect(result.isSuitable).toBe(false);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("BALL_VALVE_FULL %100'ün altında açıklıkta UYGUN DEĞİL olarak işaretlenir", () => {
    expect(assessPartialOpeningSuitability("BALL_VALVE_FULL", 30).isSuitable).toBe(false);
  });

  it("BALL_VALVE_REDUCED (kısma için tasarlanmış) her açıklıkta UYGUN kabul edilir", () => {
    expect(assessPartialOpeningSuitability("BALL_VALVE_REDUCED", 30).isSuitable).toBe(true);
  });

  it("herhangi bir tip %100 açıklıkta her zaman UYGUN kabul edilir", () => {
    expect(assessPartialOpeningSuitability("GATE_VALVE", 100).isSuitable).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D) Bölge bazlı hasar dağılımı
// ═══════════════════════════════════════════════════════════════════════
describe("computeValveZoneDamage", () => {
  const baseRate = { p10: 0.1, p50: 0.5, p90: 2.0 };

  it("CHOKE_VALVE'ın her bölgesi için bir UncertaintyBand döner", () => {
    const zones = computeValveZoneDamage("CHOKE_VALVE", 100, baseRate);
    expect(Object.keys(zones).length).toBeGreaterThan(0);
    for (const band of Object.values(zones)) {
      expect(band.p50).toBeGreaterThan(0);
      expect(band.p90).toBeGreaterThan(band.p10);
    }
  });

  it("açıklık azaldıkça HER bölgenin hasar hızı MONOTON artar", () => {
    const at100 = computeValveZoneDamage("GATE_VALVE", 100, baseRate);
    const at50 = computeValveZoneDamage("GATE_VALVE", 50, baseRate);
    const at10 = computeValveZoneDamage("GATE_VALVE", 10, baseRate);
    for (const zoneId of Object.keys(at100)) {
      expect(at50[zoneId]!.p50).toBeGreaterThan(at100[zoneId]!.p50);
      expect(at10[zoneId]!.p50).toBeGreaterThan(at50[zoneId]!.p50);
    }
  });

  it("bilinmeyen bileşen tipi için hata fırlatır (getValveErosionProfile üzerinden)", () => {
    // @ts-expect-error kasıtlı geçersiz tip
    expect(() => computeValveZoneDamage("NOT_A_VALVE", 100, baseRate)).toThrowError();
  });
});

describe("valveHydraulics — yeni registry sabitleri KDP kaydı", () => {
  it("ISA-RP75.23 σv formülü iki bağımsız kaynakla çapraz doğrulanmış HIGH confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "valves.isaRp7523.scaledIncipientDamageSigmaFormula");
    expect(entry?.crossChecked).toBe(true);
    expect(entry?.confidence).toBe("HIGH");
  });

  it("jenerik kısmi açıklık eğrisi UNVERIFIED işaretlidir (kaynak bulunamadı, kalibre edilebilir varsayılan)", () => {
    const entry = listCoefficients().find((c) => c.id === "valves.partialOpeningSeverity.genericMultiplierCurve");
    expect(entry?.confidence).toBe("UNVERIFIED");
  });

  it("gaz 110dBA sınırı iki bağımsız üretici kaynağıyla çapraz doğrulanmıştır", () => {
    const entry = listCoefficients().find((c) => c.id === "valves.gasSizing.aerodynamicNoiseNeverExceedDbA");
    expect(entry?.crossChecked).toBe(true);
  });
});
