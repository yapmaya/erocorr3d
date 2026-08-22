// packages/engine/tests/corrosion/externalEnvironment.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  assessAtmosphericExternalRisk,
  assessBuriedExternalRisk,
  classifySoilResistivity,
  estimateIso9223CategoryFromCoastalDistance,
  getCarbonSteelRateRangeMmPerYear,
} from "../../src/corrosion/externalEnvironment";

describe("estimateIso9223CategoryFromCoastalDistance", () => {
  it("kıyıya çok yakın → C5", () => {
    expect(estimateIso9223CategoryFromCoastalDistance(0.5)).toBe("C5");
  });

  it("kıyıdan çok uzak → C1", () => {
    expect(estimateIso9223CategoryFromCoastalDistance(200)).toBe("C1");
  });
});

describe("getCarbonSteelRateRangeMmPerYear (ISO 9223 Tablo 2)", () => {
  it("C1 aralığı düşüktür", () => {
    const [min, max] = getCarbonSteelRateRangeMmPerYear("C1");
    expect(min).toBe(0);
    expect(max).toBeCloseTo(0.0013, 5);
  });

  it("kategori arttıkça aralık MONOTON artar", () => {
    const categories = ["C1", "C2", "C3", "C4", "C5", "CX"] as const;
    let previousMax = 0;
    for (const category of categories) {
      const [, max] = getCarbonSteelRateRangeMmPerYear(category);
      expect(max).toBeGreaterThan(previousMax);
      previousMax = max;
    }
  });
});

describe("assessAtmosphericExternalRisk", () => {
  it("iyi durumda kaplama hız aralığını ciddi ölçüde azaltır", () => {
    const uncoated = assessAtmosphericExternalRisk({ knownIso9223Category: "C4", coatingPresent: false });
    const coated = assessAtmosphericExternalRisk({ knownIso9223Category: "C4", coatingPresent: true, coatingConditionGood: true });
    expect(coated.conditionalRateRangeMmPerYear!.p50).toBeLessThan(uncoated.conditionalRateRangeMmPerYear!.p50);
  });

  it("kıyı mesafesinden tahmin edildiğinde LOW confidence uyarısı verir", () => {
    const result = assessAtmosphericExternalRisk({ distanceFromCoastKm: 0.5, coatingPresent: false });
    expect(result.validityWarnings.some((w) => w.parameter.includes("ISO 9223"))).toBe(true);
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    expect(assessAtmosphericExternalRisk({ knownIso9223Category: "C3", coatingPresent: false }).disclaimer).toContain(
      "mühendislik tahminidir",
    );
  });
});

describe("classifySoilResistivity", () => {
  it("düşük direnç ÇOK_KOROZİF döner", () => {
    expect(classifySoilResistivity(300)).toBe("ÇOK_KOROZİF");
  });

  it("yüksek direnç ÖNEMSİZ döner", () => {
    expect(classifySoilResistivity(50000)).toBe("ÖNEMSİZ");
  });
});

describe("assessBuriedExternalRisk", () => {
  const baseInput = {
    soilResistivityOhmCm: 5000,
    coatingPresent: true,
    coatingConditionGood: true,
    cathodicProtectionActive: true,
    cpShieldingRiskPresent: false,
    strayCurrentRiskPresent: false,
  };

  it("kaplama+CP mevcut düşük risk verir", () => {
    expect(assessBuriedExternalRisk(baseInput).riskScore).toBeLessThan(20);
  });

  it("CP perdeleme riski kaplama+CP mevcut olsa bile risk ekler", () => {
    // Not: toprak direnci burada bilerek ÇOK_KOROZİF seçildi — hafif korozif toprakta kaplama+CP
    // bonusu skoru zaten 0'a kırptığından (clampRiskScore), perdeleme etkisinin görünür olması için
    // kırpılmamış bir taban skoru gerekir.
    const veryCorrosiveSoilInput = { ...baseInput, soilResistivityOhmCm: 300 };
    const withoutShielding = assessBuriedExternalRisk(veryCorrosiveSoilInput);
    const withShielding = assessBuriedExternalRisk({ ...veryCorrosiveSoilInput, cpShieldingRiskPresent: true });
    expect(withShielding.riskScore).toBeGreaterThan(withoutShielding.riskScore);
  });

  it("düşük toprak direnci (çok korozif) + kaplama yok yüksek risk verir", () => {
    const result = assessBuriedExternalRisk({
      ...baseInput,
      soilResistivityOhmCm: 300,
      coatingPresent: false,
      cathodicProtectionActive: false,
    });
    expect(result.riskScore).toBeGreaterThan(50);
    expect(result.conditionalRateRangeMmPerYear).toBeNull();
  });
});

describe("externalEnvironment — KDP kayıt defteri entegrasyonu", () => {
  it("ISO 9223 karbon çeliği aralıkları kayıtlıdır, HIGH confidence ve çapraz doğrulanmıştır", () => {
    const entry = listCoefficients().find((c) => c.id === "externalEnvironment.iso9223.carbonSteelRateRangeUmPerYear");
    expect(entry?.confidence).toBe("HIGH");
    expect(entry?.crossChecked).toBe(true);
  });

  it("kıyı mesafesi sezgiseli LOW confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "externalEnvironment.coastalDistanceHeuristicKm");
    expect(entry?.confidence).toBe("LOW");
  });
});
