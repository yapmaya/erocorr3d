// packages/engine/tests/orchestrate/assessComponent.test.ts

import { describe, expect, it } from "vitest";
import { runMechanismAssessment } from "../../src/orchestrate/assessComponent";
import { baseGeometry, baseMitigation, buildOperatingCase } from "./testFixtures";

describe("runMechanismAssessment", () => {
  it("vana bileşen tipiyle çağrılırsa AÇIK bir hata fırlatır (bu sürümde desteklenmiyor)", () => {
    expect(() =>
      runMechanismAssessment(baseGeometry({ componentType: "GATE_VALVE" }), baseMitigation(), buildOperatingCase()),
    ).toThrowError(/vana/i);
  });

  it("ıslak/ekşi/stratifiye bir senaryoda: CO2 aktif, nitel bulgular mevcut, atlanan mekanizmalar assumptionsTr'de açıkça belirtilir", () => {
    const geometry = baseGeometry();
    const mitigation = baseMitigation();
    const operatingCase = buildOperatingCase({
      temperatureC: 40,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
      h2sPpmMole: 15,
    });

    const assessment = runMechanismAssessment(geometry, mitigation, operatingCase);

    const co2 = assessment.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");
    expect(co2?.isApplicable).toBe(true);
    expect(co2?.rateP50).toBeGreaterThan(0);

    // Her sayısal mekanizma sonucunun geçerli bir kaynak atfı olmalı (sayısal, isApplicable ise)
    for (const result of assessment.mechanismResults) {
      if (result.isApplicable) {
        expect(result.sourceRefs.length).toBeGreaterThan(0);
      }
    }

    const mechanismIds = assessment.qualitativeRiskFindings.map((f) => f.mechanismId);
    expect(mechanismIds).toEqual(expect.arrayContaining(["H2S_SOUR", "MIC", "UNDER_DEPOSIT", "OXYGEN"]));

    // Bu senaryoda kum yok → sinerji atlanmaz (zaten erozyon hızı 0 olduğundan hiç denenmez),
    // ama atmosferik dış korozyon (bağlam verilmedi) ve galvanik/pitting açıkça atlandı olarak işaretlenmeli.
    expect(assessment.assumptionsTr.some((a) => a.includes("Atmosferik"))).toBe(true);
    expect(assessment.assumptionsTr.some((a) => a.includes("Galvanik"))).toBe(true);
  });

  it("yalıtımlı bileşende CUI bulgusu üretir, yalıtımsızda üretmez", () => {
    const operatingCase = buildOperatingCase({ temperatureC: 80 });
    const insulated = runMechanismAssessment(baseGeometry({ isInsulated: true }), baseMitigation(), operatingCase);
    const uninsulated = runMechanismAssessment(baseGeometry({ isInsulated: false }), baseMitigation(), operatingCase);
    expect(insulated.qualitativeRiskFindings.some((f) => f.mechanismId === "CUI")).toBe(true);
    expect(uninsulated.qualitativeRiskFindings.some((f) => f.mechanismId === "CUI")).toBe(false);
  });

  it("kum + korozyon birlikte aktifken referans hız verilirse sinerji sonucu da üretilir", () => {
    const geometry = baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 1.5, bendAngleDeg: 90 });
    const operatingCase = buildOperatingCase({
      temperatureC: 40,
      flowRegime: "STRATIFIED_WAVY",
      isFreeWaterPresent: true,
      sandRateKgDay: 30,
      mixtureVelocityMs: 12,
    });
    const withoutSynergyOption = runMechanismAssessment(geometry, baseMitigation(), operatingCase);
    expect(withoutSynergyOption.mechanismResults.find((r) => r.mechanismId === "EROSION_CORROSION_SYNERGY")).toBeUndefined();
    expect(withoutSynergyOption.assumptionsTr.some((a) => a.includes("sinerji") || a.includes("Sinerji"))).toBe(true);

    const withSynergyOption = runMechanismAssessment(geometry, baseMitigation(), operatingCase, {
      synergyReferenceImpactVelocityMs: 20,
    });
    const synergy = withSynergyOption.mechanismResults.find((r) => r.mechanismId === "EROSION_CORROSION_SYNERGY");
    expect(synergy).toBeDefined();
  });
});
