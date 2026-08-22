// packages/engine/tests/erosion/dnvO501.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  computeBendErosionRate,
  computeBlindTeeErosionRate,
  computeChokeValveErosionRate,
  computeDnvO501ErosionRate,
  computeDownstreamWeldErosionRate,
  computeImpactAngleFactor,
  computeMiterBendErosionRate,
  computeMixtureVelocityMs,
  computeReducerErosionRate,
  computeRestrictionOrificeErosionRate,
  computeStraightPipeErosionRate,
  computeTeeBranchErosionRate,
  computeWeldReinforcementErosionRate,
} from "../../src/erosion/dnvO501";

const BEND_BASE_INPUT = {
  sandMassFlowRateKgS: 0.0001,
  impactVelocityMs: 15,
  pipeIdM: 0.1,
  bendRadiusRatio: 1.5,
  particleDiameterM: 300e-6,
  mixtureDensityKgM3: 30,
  mixtureViscosityPaS: 1.5e-5,
  particleDensityKgM3: 2650,
  targetMaterialDensityKgM3: 7800,
  materialClass: "STEEL" as const,
};

describe("computeImpactAngleFactor", () => {
  it("0 derecede (sıyırma açısı) F(α)=0 verir", () => {
    expect(computeImpactAngleFactor(0)).toBeCloseTo(0, 6);
  });

  it("sünek malzeme için maksimum erozyon 15-30° aralığında oluşur (DNV Bölüm 7)", () => {
    const f20 = computeImpactAngleFactor(20);
    const f30 = computeImpactAngleFactor(30);
    const f90 = computeImpactAngleFactor(90);
    expect(f20).toBeGreaterThan(0);
    expect(f30).toBeGreaterThan(f90);
    expect(f20).toBeGreaterThan(f90);
  });

  it("0-90 derece dışı açı için hata fırlatır", () => {
    expect(() => computeImpactAngleFactor(-1)).toThrowError();
    expect(() => computeImpactAngleFactor(91)).toThrowError();
  });
});

describe("computeMixtureVelocityMs", () => {
  it("yüzeysel gaz ve sıvı hızlarını toplar (Eq. 8.2-8.6)", () => {
    // basit bir sayısal örnek: gaz ve sıvı debisi sıfırsa hız da sıfır olmalı
    const v = computeMixtureVelocityMs(0, 0, 1, 1000, 0.1);
    expect(v).toBe(0);
  });

  it("boru çapı sıfır veya negatif için hata fırlatır", () => {
    expect(() => computeMixtureVelocityMs(1, 1, 1, 1000, 0)).toThrowError();
  });
});

describe("computeDnvO501ErosionRate", () => {
  it("kum debisi 0 ise erozyon hızı 0'dır", () => {
    const result = computeDnvO501ErosionRate({
      sandMassFlowRateKgS: 0,
      impactAngleDeg: 30,
      impactVelocityMs: 15,
      targetAreaM2: 0.001,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    expect(result.rateMmPerYear.p50).toBe(0);
  });

  it("tipik girdilerle makul mertebede (mm/yıl) bir hız üretir", () => {
    const result = computeDnvO501ErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactAngleDeg: 30,
      impactVelocityMs: 15,
      targetAreaM2: 0.0005,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    // Bağımsız olarak elle hesaplanan referans değer: ~1.83 mm/yıl (P50)
    expect(result.rateMmPerYear.p50).toBeCloseTo(1.8317, 3);
    expect(result.rateMmPerYear.p10).toBeLessThan(result.rateMmPerYear.p50);
    expect(result.rateMmPerYear.p90).toBeGreaterThan(result.rateMmPerYear.p50);
  });

  it("100 m/s üzerindeki çarpma hızı için geçerlilik uyarısı ekler", () => {
    const result = computeDnvO501ErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactAngleDeg: 30,
      impactVelocityMs: 120,
      targetAreaM2: 0.0005,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    expect(result.validityWarnings.some((w) => w.parameter === "Çarpma hızı")).toBe(true);
  });

  it("250-500 µm dışındaki parçacık boyutu için geçerlilik uyarısı ekler", () => {
    const result = computeDnvO501ErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactAngleDeg: 30,
      impactVelocityMs: 15,
      targetAreaM2: 0.0005,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
      particleDiameterMicron: 800,
    });
    expect(result.validityWarnings.some((w) => w.parameter === "Parçacık boyutu")).toBe(true);
  });

  it("negatif hedef alan veya yoğunluk için hata fırlatır", () => {
    expect(() =>
      computeDnvO501ErosionRate({
        sandMassFlowRateKgS: 0.0001,
        impactAngleDeg: 30,
        impactVelocityMs: 15,
        targetAreaM2: -1,
        targetMaterialDensityKgM3: 7800,
        materialClass: "STEEL",
      }),
    ).toThrowError();
  });

  it("her sonuç mühendislik uyarısını (disclaimer) döndürür", () => {
    const result = computeDnvO501ErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactAngleDeg: 30,
      impactVelocityMs: 15,
      targetAreaM2: 0.0005,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("dnvO501 — KDP kayıt defteri entegrasyonu", () => {
  it("dnvO501 modülü için beklenen katsayılar kayıtlıdır", () => {
    const registered = listCoefficients().filter((c) => c.module === "dnvO501");
    const ids = registered.map((c) => c.id);
    expect(ids).toContain("dnvO501.impactAngleConstants");
    expect(ids).toContain("dnvO501.materialConstants");
    expect(ids).toContain("dnvO501.unitConversionConstant");
  });

  it("birim dönüşüm sabiti bağımsız boyutsal analizle çapraz doğrulanmıştır", () => {
    const entry = listCoefficients().find((c) => c.id === "dnvO501.unitConversionConstant");
    expect(entry?.crossChecked).toBe(true);
    expect(entry?.confidence).toBe("HIGH");
  });

  it("gevrek malzeme (WC/seramik) sabitleri AYRI ve UNVERIFIED bir kayıttadır — HIGH tabloyu seyreltmez", () => {
    const highTable = listCoefficients().find((c) => c.id === "dnvO501.materialConstants");
    const unverifiedTable = listCoefficients().find((c) => c.id === "dnvO501.materialConstantsUnverified");
    expect(highTable?.confidence).toBe("HIGH");
    expect(unverifiedTable?.confidence).toBe("UNVERIFIED");
  });
});

describe("Gevrek malzeme (TUNGSTEN_CARBIDE/CERAMIC_COATING) uyarısı", () => {
  it("dirsek modelinde TUNGSTEN_CARBIDE seçilince F(α) geçerlilik uyarısı ekler", () => {
    const result = computeBendErosionRate({ ...BEND_BASE_INPUT, materialClass: "TUNGSTEN_CARBIDE" });
    expect(result.validityWarnings.some((w) => w.parameter.includes("F(α)"))).toBe(true);
  });

  it("STEEL seçilince bu uyarı EKLENMEZ", () => {
    const result = computeBendErosionRate(BEND_BASE_INPUT);
    expect(result.validityWarnings.some((w) => w.parameter.includes("F(α)"))).toBe(false);
  });
});

describe("computeStraightPipeErosionRate", () => {
  it("kum debisi 0 ise erozyon hızı 0'dır", () => {
    const result = computeStraightPipeErosionRate({
      sandMassFlowRateKgS: 0,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
    });
    expect(result.rateMmPerYear.p50).toBe(0);
  });

  it("hız 2 katına çıkınca erozyon ~2^2,6 kat artar (Eq. 8.9)", () => {
    const base = computeStraightPipeErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 10,
      pipeIdM: 0.1,
    });
    const doubled = computeStraightPipeErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 20,
      pipeIdM: 0.1,
    });
    const ratio = doubled.rateMmPerYear.p50 / base.rateMmPerYear.p50;
    expect(ratio).toBeCloseTo(2 ** 2.6, 4);
  });

  it("yatay yönelim için geçerlilik uyarısı ekler", () => {
    const result = computeStraightPipeErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      orientation: "HORIZONTAL",
    });
    expect(result.validityWarnings.some((w) => w.parameter === "Boru yönelimi")).toBe(true);
  });
});

describe("computeWeldReinforcementErosionRate ve computeDownstreamWeldErosionRate", () => {
  it("kum debisi 0 ise her ikisi de 0 döner", () => {
    const weld = computeWeldReinforcementErosionRate({
      sandMassFlowRateKgS: 0,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      particleDiameterM: 300e-6,
      mixtureDensityKgM3: 30,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    const downstream = computeDownstreamWeldErosionRate({
      sandMassFlowRateKgS: 0,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      weldHeightM: 0.002,
      materialClass: "STEEL",
    });
    expect(weld.rateMmPerYear.p50).toBe(0);
    expect(downstream.rateMmPerYear.p50).toBe(0);
  });

  it("açı verilmezse muhafazakâr 60° varsayılanı kullanılır ve uyarı ekler", () => {
    const result = computeWeldReinforcementErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      particleDiameterM: 300e-6,
      mixtureDensityKgM3: 30,
      targetMaterialDensityKgM3: 7800,
      materialClass: "STEEL",
    });
    expect(result.particleImpactAngleDeg).toBe(60);
    expect(result.validityWarnings.some((w) => w.parameter === "Çarpma açısı")).toBe(true);
  });

  it("aşağı akış kaynak dikişinde yükseklik arttıkça erozyon artar (Eq. 8.14)", () => {
    const low = computeDownstreamWeldErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      weldHeightM: 0.001,
      materialClass: "STEEL",
    });
    const high = computeDownstreamWeldErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      weldHeightM: 0.005,
      materialClass: "STEEL",
    });
    expect(high.rateMmPerYear.p50).toBeGreaterThan(low.rateMmPerYear.p50);
  });

  it("çelik ailesi dışı malzeme için aşağı akış modeli uyarı ekler", () => {
    const result = computeDownstreamWeldErosionRate({
      sandMassFlowRateKgS: 0.0001,
      impactVelocityMs: 15,
      pipeIdM: 0.1,
      weldHeightM: 0.002,
      materialClass: "GRP_EPOXY",
    });
    expect(result.validityWarnings.some((w) => w.parameter === "Malzeme sınıfı")).toBe(true);
  });
});

describe("computeBendErosionRate — en kritik model", () => {
  it("kum debisi 0 ise erozyon hızı 0'dır", () => {
    const result = computeBendErosionRate({ ...BEND_BASE_INPUT, sandMassFlowRateKgS: 0 });
    expect(result.rateMmPerYear.p50).toBe(0);
  });

  it("hız 2 katına çıkınca erozyon ~2^n kat artar (n=2,6, STEEL)", () => {
    const base = computeBendErosionRate({ ...BEND_BASE_INPUT, impactVelocityMs: 10 });
    const doubled = computeBendErosionRate({ ...BEND_BASE_INPUT, impactVelocityMs: 20 });
    const ratio = doubled.rateMmPerYear.p50 / base.rateMmPerYear.p50;
    expect(ratio).toBeCloseTo(2 ** 2.6, 2);
  });

  it("R/D artınca dirsek erozyonu azalır", () => {
    const shortRadius = computeBendErosionRate({ ...BEND_BASE_INPUT, bendRadiusRatio: 1.0 });
    const longRadius = computeBendErosionRate({ ...BEND_BASE_INPUT, bendRadiusRatio: 5.0 });
    expect(longRadius.rateMmPerYear.p50).toBeLessThan(shortRadius.rateMmPerYear.p50);
  });

  it("R/D arttıkça karakteristik çarpma açısı (α) azalır — tepe konumu sabit değildir", () => {
    const shortRadius = computeBendErosionRate({ ...BEND_BASE_INPUT, bendRadiusRatio: 1.0 });
    const longRadius = computeBendErosionRate({ ...BEND_BASE_INPUT, bendRadiusRatio: 5.0 });
    expect(longRadius.particleImpactAngleDeg).toBeLessThan(shortRadius.particleImpactAngleDeg);
    // sabit 45° YAZILMADIĞININ doğrudan kanıtı:
    expect(shortRadius.particleImpactAngleDeg).not.toBeCloseTo(45, 0);
  });

  it("parçacık çapı arttıkça erozyon artar (kritik çapa/eşiğe kadar)", () => {
    const small = computeBendErosionRate({ ...BEND_BASE_INPUT, particleDiameterM: 50e-6 });
    const large = computeBendErosionRate({ ...BEND_BASE_INPUT, particleDiameterM: 400e-6 });
    expect(large.rateMmPerYear.p50).toBeGreaterThanOrEqual(small.rateMmPerYear.p50);
  });

  it("malzeme sertliği (K düşükse daha dayanıklı) arttıkça erozyon azalır", () => {
    const steel = computeBendErosionRate({ ...BEND_BASE_INPUT, materialClass: "STEEL" });
    const tungstenCarbide = computeBendErosionRate({ ...BEND_BASE_INPUT, materialClass: "TUNGSTEN_CARBIDE" });
    expect(tungstenCarbide.rateMmPerYear.p50).toBeLessThan(steel.rateMmPerYear.p50);
  });

  it("hesap izi (calculationTrace) doldurulur", () => {
    const result = computeBendErosionRate(BEND_BASE_INPUT);
    expect(result.calculationTrace.length).toBeGreaterThan(0);
    expect(result.modelUsed).toContain("§8.4");
  });

  it("negatif R/D için hata fırlatır", () => {
    expect(() => computeBendErosionRate({ ...BEND_BASE_INPUT, bendRadiusRatio: -1 })).toThrowError();
  });
});

describe("computeMiterBendErosionRate", () => {
  it("dirsek modelini kullanır ve her zaman bir DOĞRULANMAMIŞ geometri uyarısı ekler", () => {
    const result = computeMiterBendErosionRate(BEND_BASE_INPUT);
    expect(result.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(result.confidence).toBe("LOW");
    expect(result.validityWarnings.some((w) => w.parameter === "Geometri modeli")).toBe(true);
  });
});

describe("computeBlindTeeErosionRate", () => {
  const BLIND_TEE_INPUT = {
    sandMassFlowRateKgS: 0.0001,
    impactVelocityMs: 15,
    pipeIdM: 0.1,
    particleDiameterM: 300e-6,
    mixtureDensityKgM3: 30,
    mixtureViscosityPaS: 1.5e-5,
    particleDensityKgM3: 2650,
    targetMaterialDensityKgM3: 7800,
    materialClass: "STEEL" as const,
  };

  it("kum debisi 0 ise erozyon hızı 0'dır", () => {
    const result = computeBlindTeeErosionRate({ ...BLIND_TEE_INPUT, sandMassFlowRateKgS: 0 });
    expect(result.rateMmPerYear.p50).toBe(0);
  });

  it("β=ρp/ρm >= 40 dalında da pozitif bir sonuç üretir (yüksek yoğunluklu karışım)", () => {
    const result = computeBlindTeeErosionRate({ ...BLIND_TEE_INPUT, mixtureDensityKgM3: 100 });
    expect(Number.isFinite(result.rateMmPerYear.p50)).toBe(true);
    expect(result.rateMmPerYear.p50).toBeGreaterThanOrEqual(0);
  });

  it("kör uca yaklaşık normal (90°) çarpma raporlanır", () => {
    const result = computeBlindTeeErosionRate(BLIND_TEE_INPUT);
    expect(result.particleImpactAngleDeg).toBe(90);
  });
});

describe("computeReducerErosionRate", () => {
  const REDUCER_INPUT = {
    sandMassFlowRateKgS: 0.0001,
    upstreamVelocityMs: 10,
    upstreamIdM: 0.1,
    downstreamIdM: 0.05,
    particleDiameterM: 300e-6,
    mixtureDensityKgM3: 30,
    targetMaterialDensityKgM3: 7800,
    materialClass: "STEEL" as const,
  };

  it("kum debisi 0 ise erozyon hızı 0'dır", () => {
    const result = computeReducerErosionRate({ ...REDUCER_INPUT, sandMassFlowRateKgS: 0 });
    expect(result.rateMmPerYear.p50).toBe(0);
  });

  it("çıkış çapı giriş çapından büyük/eşitse hata fırlatır", () => {
    expect(() =>
      computeReducerErosionRate({ ...REDUCER_INPUT, downstreamIdM: 0.1 }),
    ).toThrowError();
  });

  it("daralma oranı arttıkça (D2 küçüldükçe) erozyon artar", () => {
    const mild = computeReducerErosionRate({ ...REDUCER_INPUT, downstreamIdM: 0.09 });
    const severe = computeReducerErosionRate({ ...REDUCER_INPUT, downstreamIdM: 0.04 });
    expect(severe.rateMmPerYear.p50).toBeGreaterThan(mild.rateMmPerYear.p50);
  });
});

describe("computeRestrictionOrificeErosionRate ve computeChokeValveErosionRate — DNV kapsamı dışı uzantılar", () => {
  const INPUT = {
    sandMassFlowRateKgS: 0.0001,
    upstreamVelocityMs: 10,
    upstreamIdM: 0.1,
    downstreamIdM: 0.03,
    particleDiameterM: 300e-6,
    mixtureDensityKgM3: 30,
    targetMaterialDensityKgM3: 7800,
    materialClass: "STEEL" as const,
  };

  it("ikisi de redüksiyon modelini kullanır ve kapsam-dışı uyarısı ekler", () => {
    const orifice = computeRestrictionOrificeErosionRate(INPUT);
    const choke = computeChokeValveErosionRate(INPUT);
    expect(orifice.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(choke.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(orifice.validityWarnings.some((w) => w.parameter === "Geometri modeli")).toBe(true);
    expect(choke.validityWarnings.some((w) => w.parameter === "Geometri modeli")).toBe(true);
  });

  it("choke sonucu LOW confidence taşır (DNV kapsamı dışı yaklaşım)", () => {
    const choke = computeChokeValveErosionRate(INPUT);
    expect(choke.confidence).toBe("LOW");
  });
});

describe("computeTeeBranchErosionRate", () => {
  it("dirsek modelini kullanır ve dallanma-Te uyarısı ekler", () => {
    const result = computeTeeBranchErosionRate(BEND_BASE_INPUT);
    expect(result.rateMmPerYear.p50).toBeGreaterThan(0);
    expect(result.confidence).toBe("LOW");
    expect(result.validityWarnings.some((w) => w.parameter === "Geometri modeli")).toBe(true);
  });
});
