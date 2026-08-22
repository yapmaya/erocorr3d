// packages/engine/tests/orchestrate/mechanismRunners.test.ts

import { describe, expect, it } from "vitest";
import {
  runAtmosphericExternalMechanism,
  runCo2AndTlcMechanisms,
  runCuiFinding,
  runDropletErosionMechanism,
  runH2sFinding,
  runMicFinding,
  runOxygenFinding,
  runSandErosionMechanism,
  runSynergyMechanism,
  runUdcFinding,
} from "../../src/orchestrate/mechanismRunners";
import { baseGeometry, baseMitigation, buildOperatingCase } from "./testFixtures";

describe("runCo2AndTlcMechanisms", () => {
  it("kuru gaz → CO2_SWEET isApplicable=false, hız 0", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: -8,
      waterDewpointC: -60, // ΔT=52°C ≥10°C → kuru gaz
      isFreeWaterPresent: false,
    });
    const { results, assumptionsTr } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {});
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET");
    expect(co2?.isApplicable).toBe(false);
    expect(co2?.rateP50).toBe(0);
    expect(assumptionsTr).toEqual([]);
    expect(results).toHaveLength(1); // kuru gazda TLC de tetiklenmez
  });

  it("ıslak, serbest sulu, stratifiye+sıcak senaryo → NORSOK M-506 aktif VE TLC tetiklenir ama U₀ verilmediği için assumptionsTr'ye not düşülür", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: 70, // >50°C, TLC eşiği
      ambientTemperatureC: 12,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
    });
    const { results, assumptionsTr, wallShearStressPa } = runCo2AndTlcMechanisms(
      baseGeometry(),
      baseMitigation(),
      operatingCase,
      {},
    );
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET");
    expect(co2?.modelUsed).toContain("NORSOK");
    expect(co2!.rateP50).toBeGreaterThan(0);
    expect(co2!.isApplicable).toBe(true);
    expect(wallShearStressPa).toBeGreaterThan(0);
    expect(results.find((r) => r.mechanismId === "TOP_OF_LINE")).toBeUndefined();
    expect(assumptionsTr.some((a) => a.includes("TLC") || a.includes("U₀"))).toBe(true);
  });

  it("U₀ sağlanınca TLC gerçekten hesaplanır ve ayrı bir MechanismResult döner", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: 70,
      ambientTemperatureC: 12,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
    });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {
      overallHeatTransferCoefficientWm2K: 15,
    });
    const tlc = results.find((r) => r.mechanismId === "TOP_OF_LINE");
    expect(tlc).toBeDefined();
    expect(tlc!.spatialSignatureId).toBe("TLC_CONDENSATION");
  });

  it("inhibitörlü hatta hız asla 0,1 mm/yıl'ın altına inmez", () => {
    const operatingCase = buildOperatingCase({ temperatureC: 40, flowRegime: "STRATIFIED_WAVY" });
    const mitigation = baseMitigation({ inhibitorUsed: true, inhibitorEfficiencyPercent: 99.9, inhibitorAvailabilityPercent: 100 });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), mitigation, operatingCase, {});
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET")!;
    expect(co2.rateP50).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });
});

describe("runSandErosionMechanism", () => {
  it("kum debisi 0 → isApplicable=false", () => {
    const operatingCase = buildOperatingCase({ sandRateKgDay: 0 });
    const result = runSandErosionMechanism(baseGeometry(), operatingCase);
    expect(result.isApplicable).toBe(false);
    expect(result.rateP50).toBe(0);
  });

  it("kum debisi > 0, dirsek üzerinde → DNV §8.4 dirsek modeli, ELBOW_EXTRADOS_IMPINGEMENT imzası", () => {
    const geometry = baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 1.5, bendAngleDeg: 90 });
    const operatingCase = buildOperatingCase({ sandRateKgDay: 50, mixtureVelocityMs: 15 });
    const result = runSandErosionMechanism(geometry, operatingCase);
    expect(result.isApplicable).toBe(true);
    expect(result.rateP50).toBeGreaterThan(0);
    expect(result.spatialSignatureId).toBe("ELBOW_EXTRADOS_IMPINGEMENT");
    expect(result.modelUsed).toContain("8.4");
  });

  it("kum debisi > 0, düz boru üzerinde → UNIFORM_FULL_BORE imzası", () => {
    const operatingCase = buildOperatingCase({ sandRateKgDay: 20, mixtureVelocityMs: 10 });
    const result = runSandErosionMechanism(baseGeometry(), operatingCase);
    expect(result.spatialSignatureId).toBe("UNIFORM_FULL_BORE");
  });
});

describe("runDropletErosionMechanism", () => {
  it("MIST rejimi + serbest su yok → sürüklenen sıvı YOK kabul edilir, isApplicable=false", () => {
    const operatingCase = buildOperatingCase({ flowRegime: "MIST", isFreeWaterPresent: false, superficialGasVelocityMs: 50 });
    const result = runDropletErosionMechanism(baseGeometry(), operatingCase);
    expect(result.isApplicable).toBe(false);
  });

  it("MIST rejimi + serbest su + eşik üstü hız → gösterge (UNVERIFIED) bir hız üretir", () => {
    const operatingCase = buildOperatingCase({ flowRegime: "MIST", isFreeWaterPresent: true, superficialGasVelocityMs: 90 });
    const result = runDropletErosionMechanism(baseGeometry(), operatingCase);
    expect(result.isApplicable).toBe(true);
    expect(result.confidence).toBe("LOW"); // UNVERIFIED → LOW eşlemesi
  });
});

describe("runAtmosphericExternalMechanism", () => {
  it("bağlam verilmezse null döner (uydurulmaz)", () => {
    const result = runAtmosphericExternalMechanism(baseGeometry({ installation: "ABOVE_GROUND" }), {});
    expect(result).toBeNull();
  });

  it("gömülü bileşende (ABOVE_GROUND değilse) her koşulda null döner", () => {
    const result = runAtmosphericExternalMechanism(baseGeometry({ installation: "BURIED" }), {
      atmosphericContext: { knownIso9223Category: "C3", coatingPresent: false },
    });
    expect(result).toBeNull();
  });

  it("bağlam verilirse gerçek ISO 9223 tabanlı bir hız döner", () => {
    const result = runAtmosphericExternalMechanism(baseGeometry({ installation: "ABOVE_GROUND" }), {
      atmosphericContext: { knownIso9223Category: "C5", coatingPresent: false },
    });
    expect(result).not.toBeNull();
    expect(result!.rateP50).toBeGreaterThan(0);
    expect(result!.modelUsed).toContain("ISO 9223");
  });
});

describe("nitel (risk skoru) mekanizma çalıştırıcıları", () => {
  it("runH2sFinding: serbest su yoksa mekanizma pasif", () => {
    const operatingCase = buildOperatingCase({ isFreeWaterPresent: false, h2sPpmMole: 5000 });
    const finding = runH2sFinding(operatingCase, undefined, false, {});
    expect(finding.isMechanismActive).toBe(false);
  });

  it("runH2sFinding: serbest su + yüksek H2S → aktif, risk skoru > 0", () => {
    const operatingCase = buildOperatingCase({ isFreeWaterPresent: true, h2sPpmMole: 50000 });
    const finding = runH2sFinding(operatingCase, 5, true, {});
    expect(finding.isMechanismActive).toBe(true);
    expect(finding.riskScore).toBeGreaterThan(0);
  });

  it("runMicFinding: serbest su yoksa pasif", () => {
    const operatingCase = buildOperatingCase({ isFreeWaterPresent: false });
    const finding = runMicFinding(operatingCase, undefined, false, baseMitigation(), []);
    expect(finding.isMechanismActive).toBe(false);
  });

  it("runUdcFinding: kum/tortu yoksa pasif", () => {
    const operatingCase = buildOperatingCase({ sandRateKgDay: 0 });
    const finding = runUdcFinding(operatingCase, true);
    expect(finding.isMechanismActive).toBe(false);
  });

  it("runOxygenFinding: kuru gazda pasif", () => {
    const operatingCase = buildOperatingCase({ o2Ppb: 500 });
    const finding = runOxygenFinding(operatingCase, false, true);
    expect(finding.isMechanismActive).toBe(false);
  });

  it("runCuiFinding: yalıtımsızsa pasif, yalıtımlıysa (riskli sıcaklıkta) aktif", () => {
    const operatingCase = buildOperatingCase({ temperatureC: 80 });
    const insulated = baseGeometry({ isInsulated: true });
    const assumptions: string[] = [];
    const finding = runCuiFinding(insulated, operatingCase, baseMitigation(), {}, assumptions);
    expect(finding.isMechanismActive).toBe(true);
    expect(assumptions.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// calculationTrace şeffaflığı — features/results/'ün (apps/web) "doğrulanmamış
// katsayı kullanıldı" rozeti SADECE calculationTrace[].coefficientIds'ten
// okunabildiği için (bkz. registry/store.ts'in erişim geçmişi tutmaması),
// UYGULANAN (isApplicable=true) her sayısal mekanizmanın gerçek bir iz
// bırakması ZORUNLUDUR — aksi halde rozet SESSİZCE yanlış negatif verir.
// ─────────────────────────────────────────────────────────────────────────
describe("calculationTrace şeffaflığı (uygulanan mekanizmalar YALNIZCA rozet için gerekli — sahte adım İCAT EDİLMEZ)", () => {
  it("CO2_SWEET — de Waard dalı (serbest su yok, ıslak gaz yoğunma taraması) gerçek bir iz taşır", () => {
    const operatingCase = buildOperatingCase({ temperatureC: 40, waterDewpointC: 35, isFreeWaterPresent: false });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {});
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET")!;
    expect(co2.modelUsed).toContain("de Waard");
    expect(co2.isApplicable).toBe(true);
    expect(co2.calculationTrace.length).toBeGreaterThan(0);
    expect(co2.calculationTrace[0].coefficientIds.length).toBeGreaterThan(0);
    expect(co2.calculationTrace[0].output).toBeCloseTo(co2.rateP50, 9);
  });

  it("CO2_SWEET — NORSOK dalı zaten kendi (çok adımlı) izini taşır (regresyon: bu değişiklik onu ETKİLEMEDİ)", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: 70,
      ambientTemperatureC: 12,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
    });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {});
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET")!;
    expect(co2.calculationTrace.length).toBeGreaterThan(1);
  });

  it("TOP_OF_LINE — U₀ verilince gerçek bir iz taşır", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: 70,
      ambientTemperatureC: 12,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
    });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {
      overallHeatTransferCoefficientWm2K: 15,
    });
    const tlc = results.find((r) => r.mechanismId === "TOP_OF_LINE")!;
    expect(tlc.calculationTrace.length).toBeGreaterThan(0);
    expect(tlc.calculationTrace[0].coefficientIds.length).toBeGreaterThan(0);
    expect(tlc.calculationTrace[0].output).toBeCloseTo(tlc.rateP50, 9);
  });

  it("EROSION_DROPLET — uygulanan durumda gerçek bir iz taşır", () => {
    const operatingCase = buildOperatingCase({ flowRegime: "MIST", isFreeWaterPresent: true, superficialGasVelocityMs: 90 });
    const result = runDropletErosionMechanism(baseGeometry(), operatingCase);
    expect(result.isApplicable).toBe(true);
    expect(result.calculationTrace.length).toBeGreaterThan(0);
    expect(result.calculationTrace[0].coefficientIds.length).toBeGreaterThan(0);
  });

  it("EROSION_CORROSION_SYNERGY — referans hız verilince gerçek bir iz taşır", () => {
    const result = runSynergyMechanism(baseGeometry(), 1.5, 0.8, 25, 12, { synergyReferenceImpactVelocityMs: 10 });
    expect(result).not.toBeNull();
    expect(result!.calculationTrace.length).toBeGreaterThan(0);
    expect(result!.calculationTrace[0].coefficientIds.length).toBeGreaterThan(0);
    expect(result!.calculationTrace[0].output).toBeCloseTo(result!.rateP50, 9);
  });

  it("ATMOSPHERIC_MARINE — bağlam verilince gerçek bir iz taşır", () => {
    const result = runAtmosphericExternalMechanism(baseGeometry({ installation: "ABOVE_GROUND" }), {
      atmosphericContext: { knownIso9223Category: "C5", coatingPresent: false },
    });
    expect(result).not.toBeNull();
    expect(result!.calculationTrace.length).toBeGreaterThan(0);
    expect(result!.calculationTrace[0].coefficientIds.length).toBeGreaterThan(0);
    expect(result!.calculationTrace[0].output).toBeCloseTo(result!.rateP50, 9);
  });

  it("mekanizma UYGULANMADIYSA (buildZeroRateMechanismResult) iz BOŞ kalır — sahte adım İCAT EDİLMEZ", () => {
    const operatingCase = buildOperatingCase({
      temperatureC: -8,
      waterDewpointC: -60,
      isFreeWaterPresent: false,
    });
    const { results } = runCo2AndTlcMechanisms(baseGeometry(), baseMitigation(), operatingCase, {});
    const co2 = results.find((r) => r.mechanismId === "CO2_SWEET")!;
    expect(co2.isApplicable).toBe(false);
    expect(co2.calculationTrace).toEqual([]);
  });
});
