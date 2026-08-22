// packages/engine/tests/validation/dryGas.test.ts
//
// MÜHENDİSLİK KURALI: "Kuru gaz (akışkan sıcaklığı su çiy noktasının ≥10°C
// üstünde) korozif DEĞİLDİR → hız 0" (bkz. corrosion/rules.ts::isDryGas).
//
// AYRICA belgelenen, BİLİNÇLİ bir SAPMA: BOTAŞ F3-500-ME-SPC-PSS-0002'nin
// Appendix A tablosunda (Stream 1400, 4000 gibi) "kuru gaz" olarak
// sınıflandırılan akışlar için dahi küçük sıfır-olmayan korozyon hızları
// (ör. 0.14-0.55 mm/yıl) görünür. Bunun nedeni UYDURMA/tahmin DEĞİLDİR —
// dokümanın kendi Table 10-3 Not 4'ü açıkça şunu söyler: "0.1 m3/d free
// water added for calculation (software used can't perform corrosion
// calculation with 0.0 m3/d of free water). However, as the stream is dry
// gas, 1.5 mm corrosion allowance are considered." Yani BOTAŞ'ın kendi
// yazılımı, 0 serbest su ile çalışamadığı için suni olarak küçük bir su
// miktarı eklemiş ve küçük bir hız üretmiştir — ama malzeme seçimini yine
// de "kuru gaz" kabulüyle (minimum 1.5mm CA) yapmıştır.
//
// Bu projenin motoru bu workaround'u YENİDEN ÜRETMEZ: isDryGas()=true olan
// bir senaryoda CO2_SWEET hızı KESİN OLARAK 0'dır (bkz. modelRouter.ts).
// Bu, ±%30 toleransla "eşleştirilmeye çalışılan" bir sapma DEĞİLDİR — bilinçli,
// dokümante edilmiş bir metodoloji farkıdır; bu yüzden botasKmgsCases.test.ts
// KASITLI olarak 1400/4000 akışlarını kapsam DIŞI bırakır (bkz. o dosyanın
// fixture kaynağı, botasPss0002ValidationData.ts'in dosya başı yorumu).

import { describe, expect, it } from "vitest";
import { isDryGas } from "../../src/corrosion/rules";
import { runMechanismAssessment } from "../../src/orchestrate/assessComponent";
import { GeometrySchema } from "../../src/types/geometry";
import { MitigationSchema } from "../../src/types/mitigation";
import { OperatingCaseSchema } from "../../src/types/operating";

describe("isDryGas — saf kural", () => {
  it("ΔT tam 10°C ise kuru gaz kabul edilir (≥ kuralı, sınır dahil)", () => {
    expect(isDryGas(20, 10)).toBe(true);
  });

  it("ΔT 10°C'nin altındaysa kuru gaz DEĞİLDİR", () => {
    expect(isDryGas(19.99, 10)).toBe(false);
  });

  it("ΔT 10°C'nin belirgin üzerindeyse kuru gaz kabul edilir", () => {
    expect(isDryGas(70, -8)).toBe(true); // Enjeksiyon modu mertebesi (-8°C, kurutulmuş gaz)
  });
});

describe("Kuru gaz → motor CO2_SWEET hızını 0 üretir (Table 10-3 Not 4 sapmasıyla karşılaştırma)", () => {
  it("ΔT≥10°C senaryosunda CO2_SWEET isApplicable=false, rateP50=0", () => {
    const geometry = GeometrySchema.parse({
      componentType: "STRAIGHT_PIPE",
      npsInch: 12,
      schedule: "STD",
      odMm: 323.9,
      wallThicknessMm: 9.53,
      idMm: 323.9 - 2 * 9.53,
      lengthMm: 2000,
      orientation: "HORIZONTAL",
      roughnessMm: 0.045,
      installation: "ABOVE_GROUND",
      isInsulated: false,
    });
    const mitigation = MitigationSchema.parse({
      inhibitorUsed: false,
      biocideUsed: false,
      o2ScavengerUsed: false,
      internalLining: "NONE",
      cathodicProtection: false,
    });
    // Table 10-3'ün 1400/4000 için kullandığı SINIFLANDIRMAYI temsil eder
    // ("Dry gas operating at ≥10°C above dew point") — bu akışların KENDİ
    // geometrisi/HMB'si değildir (bkz. dosya başı sapma notu).
    const operatingCase = OperatingCaseSchema.parse({
      name: "Kurutulmuş gaz — Table 10-3 1400/4000 sınıflandırmasını temsil eder",
      description: "T, su çiy noktasının ≥10°C üzerinde — kuru gaz kuralı tetiklenir.",
      durationDaysPerYear: 91,
      process: {
        pressureBara: 70,
        temperatureC: 25,
        gasMassFlowKgS: 3,
        liquidMassFlowKgS: 0,
        waterMassFlowKgS: 0,
        gasDensityKgM3: 55,
        liquidDensityKgM3: 900,
        mixtureDensityKgM3: 55,
        gasViscosityPaS: 1.1e-5,
        liquidViscosityPaS: 5e-4,
        superficialGasVelocityMs: 10,
        superficialLiquidVelocityMs: 0,
        mixtureVelocityMs: 10,
        liquidHoldupFraction: 0,
        flowRegime: "MIST",
        waterCutPercent: 0,
        waterDewpointC: -15, // ΔT=25-(-15)=40°C ≥10°C → kuru gaz
        hydrocarbonDewpointC: -20,
        isFreeWaterPresent: false,
        ambientTemperatureC: 12,
      },
      chemistry: {
        co2MolePercent: 0.5,
        h2sPpmMole: 0,
        o2Ppb: 0,
        chlorideMgL: 0,
        bicarbonateMgL: 0,
        totalDissolvedSolidsMgL: 0,
        aceticAcidMgL: 0,
        glycolWeightPercent: 0,
        methanolWeightPercent: 0,
        isWaterFeSaturated: false,
        bacteriaPresent: false,
      },
      solids: { sandRateKgDay: 0, sandPpmw: 0 },
    });

    const assessment = runMechanismAssessment(geometry, mitigation, operatingCase, {});
    const co2Result = assessment.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");

    expect(co2Result).toBeDefined();
    expect(co2Result?.isApplicable).toBe(false);
    expect(co2Result?.rateP50).toBe(0);
    expect(co2Result?.rateMmPerYear).toBe(0);
    // Appendix A'nın 1400/4000 için gösterdiği 0.14-0.55 mm/yıl mertebesindeki
    // değerlerle KIYASLANMAZ — bkz. dosya başı yorumu.
  });
});
