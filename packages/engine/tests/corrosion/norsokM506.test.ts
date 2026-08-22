// packages/engine/tests/corrosion/norsokM506.test.ts

import { describe, expect, it } from "vitest";
import { buildNorsokM506InputFromCase, computeNorsokM506Rate, type NorsokM506Input } from "../../src/corrosion/norsokM506";
import type { Mitigation } from "../../src/types/mitigation";
import type { OperatingCase } from "../../src/types/operating";

function baseInput(overrides: Partial<NorsokM506Input> = {}): NorsokM506Input {
  return {
    temperatureK: 313.15, // 40°C
    totalPressurePa: 10e5,
    co2PartialPressurePa: 2e5, // 2 bar
    wallShearStressPa: 20,
    pH: 5.5,
    waterDewPointK: 308,
    waterCutPercent: 5,
    condensationExpected: false,
    inhibited: false,
    ...overrides,
  };
}

describe("computeNorsokM506Rate — mühendislik kuralları (norsok.ts ile paylaşılan)", () => {
  it("kuru gaz durumunda hız 0'dır", () => {
    const result = computeNorsokM506Rate(baseInput({ waterDewPointK: 290 }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("serbest su yoksa hız 0'dır", () => {
    const result = computeNorsokM506Rate(baseInput({ waterCutPercent: 0, condensationExpected: false }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });

  it("CO2 kısmi basıncı 0 ise hız 0'dır", () => {
    const result = computeNorsokM506Rate(baseInput({ co2PartialPressurePa: 0 }));
    expect(result.rateMmPerYear).toEqual({ p10: 0, p50: 0, p90: 0 });
  });
});

describe("computeNorsokM506Rate — yapısal/monotonluk testleri", () => {
  it("CO2 fugasitesi arttıkça hız artar", () => {
    const low = computeNorsokM506Rate(baseInput({ co2PartialPressurePa: 1e5 }));
    const high = computeNorsokM506Rate(baseInput({ co2PartialPressurePa: 8e5 }));
    expect(high.rateMmPerYear.p50).toBeGreaterThan(low.rateMmPerYear.p50);
  });

  it("kayma gerilmesi arttıkça (fCO2>1bar bölgesinde) hız artar", () => {
    const low = computeNorsokM506Rate(baseInput({ wallShearStressPa: 5 }));
    const high = computeNorsokM506Rate(baseInput({ wallShearStressPa: 100 }));
    expect(high.rateMmPerYear.p50).toBeGreaterThan(low.rateMmPerYear.p50);
  });

  it("20°C'den 60°C'ye (Kt tablosunun artan bölgesi) sıcaklık arttıkça hız artar", () => {
    // waterDewPointK her iki durumda da akışkan sıcaklığına yakın tutulur ki
    // ΔT≥10°C kuru-gaz kuralı yanlışlıkla devreye girmesin.
    const t20 = computeNorsokM506Rate(baseInput({ temperatureK: 293.15, waterDewPointK: 288.15 }));
    const t60 = computeNorsokM506Rate(baseInput({ temperatureK: 333.15, waterDewPointK: 328.15 }));
    expect(t60.rateMmPerYear.p50).toBeGreaterThan(t20.rateMmPerYear.p50);
  });

  it("5°C düğümünde kayma gerilmesi teriminin OLMADIĞINI doğrular (standardın Eq.3'ü)", () => {
    // 5°C tam düğüm noktasıdır (enterpolasyon yok) — Eq.3 kayma gerilmesi
    // içermediğinden, kayma gerilmesi ne olursa olsun hız AYNI olmalıdır.
    const lowShear = computeNorsokM506Rate(baseInput({ temperatureK: 278.15, wallShearStressPa: 1 }));
    const highShear = computeNorsokM506Rate(baseInput({ temperatureK: 278.15, wallShearStressPa: 150 }));
    expect(lowShear.rateMmPerYear.p50).toBeCloseTo(highShear.rateMmPerYear.p50, 10);
  });
});

describe("computeNorsokM506Rate — pH alt-modeli entegrasyonu", () => {
  it("pH verilmezse kimyadan hesaplar ve phWasCalculated=true işaretler", () => {
    const { pH: _omit, ...withoutPh } = baseInput();
    const result = computeNorsokM506Rate({
      ...withoutPh,
      bicarbonateMgL: 200,
      ionicStrengthMolar: 0.1,
      isWaterFeSaturated: false,
    });
    expect(result.phWasCalculated).toBe(true);
    expect(Number.isFinite(result.phUsed)).toBe(true);
  });

  it("pH verilirse phWasCalculated=false olur ve verilen pH kullanılır", () => {
    const result = computeNorsokM506Rate(baseInput({ pH: 6.0 }));
    expect(result.phWasCalculated).toBe(false);
    expect(result.phUsed).toBe(6.0);
  });
});

describe("computeNorsokM506Rate — glikol ve inhibitör", () => {
  it("glikol uygulandığında hızı azaltır", () => {
    const without = computeNorsokM506Rate(baseInput());
    const withGlycol = computeNorsokM506Rate(baseInput({ glycolWeightPercent: 60 }));
    expect(withGlycol.rateMmPerYear.p50).toBeLessThan(without.rateMmPerYear.p50);
    expect(withGlycol.appliedReduction).toBe("GLYCOL");
    expect(withGlycol.glycolFactorApplied).not.toBeNull();
  });

  it("inhibitör uygulandığında hızı azaltır ve asla 0.1mm/yıl altına inmez", () => {
    const result = computeNorsokM506Rate(
      baseInput({ inhibited: true, inhibitorEfficiencyPercent: 99.99, inhibitorAvailabilityPercent: 100 }),
    );
    expect(result.appliedReduction).toBe("INHIBITOR");
    expect(result.rateMmPerYear.p50).toBeGreaterThanOrEqual(0.1);
  });

  it("erişilebilirlik %100'ün altındaysa daha az azaltma sağlar (daha yüksek kalıntı hız)", () => {
    const fullAvailability = computeNorsokM506Rate(
      baseInput({ inhibited: true, inhibitorEfficiencyPercent: 80, inhibitorAvailabilityPercent: 100 }),
    );
    const partialAvailability = computeNorsokM506Rate(
      baseInput({ inhibited: true, inhibitorEfficiencyPercent: 80, inhibitorAvailabilityPercent: 50 }),
    );
    expect(partialAvailability.rateMmPerYear.p50).toBeGreaterThan(fullAvailability.rateMmPerYear.p50);
  });

  it("glikol VE inhibitör birlikte varsa DAHA BÜYÜK azaltmayı veren (daha düşük hız) uygulanır, ikisi toplanmaz", () => {
    const glycolOnly = computeNorsokM506Rate(baseInput({ glycolWeightPercent: 80 }));
    const inhibitorOnly = computeNorsokM506Rate(
      baseInput({ inhibited: true, inhibitorEfficiencyPercent: 50, inhibitorAvailabilityPercent: 100 }),
    );
    const both = computeNorsokM506Rate(
      baseInput({
        glycolWeightPercent: 80,
        inhibited: true,
        inhibitorEfficiencyPercent: 50,
        inhibitorAvailabilityPercent: 100,
      }),
    );
    const expectedRate = Math.min(glycolOnly.rateMmPerYear.p50, inhibitorOnly.rateMmPerYear.p50);
    expect(both.rateMmPerYear.p50).toBeCloseTo(expectedRate, 6);
  });
});

describe("computeNorsokM506Rate — belirsizlik bandı ve izlenebilirlik", () => {
  it("P10=0.5×P50, P90=2.5×P50 varsayılan bandını uygular (azaltma yokken)", () => {
    const result = computeNorsokM506Rate(baseInput());
    expect(result.rateMmPerYear.p10).toBeCloseTo(result.rateMmPerYear.p50 * 0.5, 6);
    expect(result.rateMmPerYear.p90).toBeCloseTo(result.rateMmPerYear.p50 * 2.5, 6);
  });

  it("calculationTrace dolu ve her adımda formül/birim/katsayı kimlikleri bulunur", () => {
    const result = computeNorsokM506Rate(baseInput());
    expect(result.calculationTrace.length).toBeGreaterThan(0);
    for (const step of result.calculationTrace) {
      expect(step.stepName.length).toBeGreaterThan(0);
      expect(step.formula.length).toBeGreaterThan(0);
      expect(typeof step.output).toBe("number");
    }
  });

  it("mühendislik uyarısını her sonuçta döndürür", () => {
    const result = computeNorsokM506Rate(baseInput());
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("computeNorsokM506Rate — geçerlilik uyarıları", () => {
  it("geçerlilik aralığı dışındaki pH için uyarı ekler", () => {
    const result = computeNorsokM506Rate(baseInput({ pH: 7.5 }));
    expect(result.validityWarnings.some((w) => w.parameter === "pH")).toBe(true);
  });

  it("organik asit >100ppm için uyarı ekler", () => {
    const result = computeNorsokM506Rate(baseInput({ organicAcidMgL: 150 }));
    expect(result.validityWarnings.some((w) => w.parameter === "Organik asit derişimi")).toBe(true);
  });

  it("fCO2<0.5bar için düşük tahmin uyarısı ekler", () => {
    const result = computeNorsokM506Rate(baseInput({ co2PartialPressurePa: 0.2e5 }));
    expect(result.validityWarnings.some((w) => w.parameter.includes("düşük-fCO2"))).toBe(true);
  });
});

describe("computeNorsokM506Rate — Zod girdi doğrulaması", () => {
  it("pH verilmemişse VE bicarbonateMgL de yoksa hata fırlatır", () => {
    const { pH: _omit, ...withoutPh } = baseInput();
    expect(() => computeNorsokM506Rate(withoutPh)).toThrowError();
  });

  it("inhibited=true iken inhibitorEfficiencyPercent verilmezse hata fırlatır", () => {
    expect(() => computeNorsokM506Rate(baseInput({ inhibited: true }))).toThrowError();
  });
});

describe("buildNorsokM506InputFromCase — orchestrate/mechanismRunners.ts ile PAYLAŞILAN girdi üretici", () => {
  const mitigation: Mitigation = {
    inhibitorUsed: false,
    biocideUsed: false,
    o2ScavengerUsed: false,
    internalLining: "NONE",
    cathodicProtection: false,
  };

  const operatingCase: OperatingCase = {
    name: "Test Senaryosu",
    description: "",
    durationDaysPerYear: 365,
    process: {
      pressureBara: 40,
      temperatureC: 45,
      gasMassFlowKgS: 2,
      liquidMassFlowKgS: 0.1,
      waterMassFlowKgS: 0.05,
      gasDensityKgM3: 45,
      liquidDensityKgM3: 800,
      mixtureDensityKgM3: 50,
      gasViscosityPaS: 1.2e-5,
      liquidViscosityPaS: 3e-4,
      superficialGasVelocityMs: 5,
      superficialLiquidVelocityMs: 0.2,
      mixtureVelocityMs: 5.2,
      liquidHoldupFraction: 0.05,
      flowRegime: "STRATIFIED_WAVY",
      waterCutPercent: 5,
      waterDewpointC: 40,
      hydrocarbonDewpointC: -5,
      isFreeWaterPresent: true,
      ambientTemperatureC: 20,
    },
    chemistry: {
      co2MolePercent: 2,
      h2sPpmMole: 10,
      o2Ppb: 0,
      chlorideMgL: 500,
      bicarbonateMgL: 300,
      totalDissolvedSolidsMgL: 1000,
      aceticAcidMgL: 0,
      glycolWeightPercent: 0,
      methanolWeightPercent: 0,
      isWaterFeSaturated: false,
      bacteriaPresent: false,
    },
    solids: { sandRateKgDay: 0, sandPpmw: 0 },
  };

  it("SI birimlerine doğru çevirir (K, Pa) ve kısmi basınçları mol yüzdesinden hesaplar", () => {
    const input = buildNorsokM506InputFromCase(mitigation, operatingCase, 20);
    expect(input.temperatureK).toBeCloseTo(318.15, 6);
    expect(input.totalPressurePa).toBeCloseTo(40e5, 6);
    expect(input.co2PartialPressurePa).toBeCloseTo(0.02 * 40e5, 6);
    expect(input.h2sPartialPressurePa).toBeCloseTo((10 / 1e6) * 40e5, 6);
    expect(input.waterDewPointK).toBeCloseTo(313.15, 6);
    expect(input.wallShearStressPa).toBe(20);
    expect(input.waterCutPercent).toBe(5);
  });

  it("pH ölçülmemişse kimyasal alanları (bikarbonat/klorür/doygunluk) taşır, pH'ı undefined bırakır", () => {
    const input = buildNorsokM506InputFromCase(mitigation, operatingCase, 20);
    expect(input.pH).toBeUndefined();
    expect(input.bicarbonateMgL).toBe(300);
    expect(input.chlorideMgL).toBe(500);
    expect(input.isWaterFeSaturated).toBe(false);
  });

  it("pH ölçülmüşse yalnızca pH'ı taşır, kimyasal alt-model girdilerini undefined bırakır", () => {
    const withPh: OperatingCase = { ...operatingCase, chemistry: { ...operatingCase.chemistry, phMeasured: 5.8 } };
    const input = buildNorsokM506InputFromCase(mitigation, withPh, 20);
    expect(input.pH).toBe(5.8);
    expect(input.bicarbonateMgL).toBeUndefined();
    expect(input.chlorideMgL).toBeUndefined();
    expect(input.isWaterFeSaturated).toBeUndefined();
  });

  it("computeNorsokM506Rate ile UÇTAN UCA gerçek bir hız üretir (mechanismRunners.ts'in NORSOK dalıyla aynı yol)", () => {
    const withPh: OperatingCase = { ...operatingCase, chemistry: { ...operatingCase.chemistry, phMeasured: 5.5 } };
    const input = buildNorsokM506InputFromCase(mitigation, withPh, 20);
    const result = computeNorsokM506Rate(input);
    expect(result.rateMmPerYear.p50).toBeGreaterThan(0);
  });

  it("inhibitorUsed=true iken inhibited/verimlilik/erişilebilirlik alanlarını taşır", () => {
    const inhibited: Mitigation = { ...mitigation, inhibitorUsed: true, inhibitorEfficiencyPercent: 60, inhibitorAvailabilityPercent: 90 };
    const input = buildNorsokM506InputFromCase(inhibited, operatingCase, 20);
    expect(input.inhibited).toBe(true);
    expect(input.inhibitorEfficiencyPercent).toBe(60);
    expect(input.inhibitorAvailabilityPercent).toBe(90);
  });
});
