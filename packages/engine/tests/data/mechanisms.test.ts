// packages/engine/tests/data/mechanisms.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  DamageMechanismSchema,
  MECHANISMS,
  getMechanism,
  listMechanismsByCategory,
} from "../../src/data/mechanisms";

const EXPECTED_INTERNAL_IDS = [
  "CO2_SWEET",
  "H2S_SOUR",
  "TOP_OF_LINE",
  "UNDER_DEPOSIT",
  "MIC",
  "OXYGEN",
  "GALVANIC_INTERNAL",
  "EROSION_SAND",
  "EROSION_DROPLET",
  "EROSION_CORROSION_SYNERGY",
  "CAVITATION",
  "FLASHING",
  "PITTING_INTERNAL",
  "CREVICE_INTERNAL",
  "CSCC_INTERNAL",
  "ORGANIC_ACID",
];

const EXPECTED_EXTERNAL_IDS = [
  "ATMOSPHERIC_MARINE",
  "CUI",
  "EXTERNAL_CSCC",
  "EXTERNAL_PITTING",
  "SOIL_CORROSION",
  "STRAY_CURRENT",
  "GALVANIC_EXTERNAL",
  "CP_SHIELDING",
];

describe("MECHANISMS — veri bütünlüğü", () => {
  it("tam 24 mekanizma tanımlıdır (16 iç + 8 dış)", () => {
    expect(MECHANISMS.length).toBe(24);
    expect(listMechanismsByCategory("INTERNAL").length).toBe(16);
    expect(listMechanismsByCategory("EXTERNAL").length).toBe(8);
  });

  it("beklenen tüm iç mekanizma kimlikleri mevcuttur", () => {
    const ids = MECHANISMS.map((m) => m.id);
    for (const id of EXPECTED_INTERNAL_IDS) {
      expect(ids, `${id} eksik`).toContain(id);
    }
  });

  it("beklenen tüm dış mekanizma kimlikleri mevcuttur", () => {
    const ids = MECHANISMS.map((m) => m.id);
    for (const id of EXPECTED_EXTERNAL_IDS) {
      expect(ids, `${id} eksik`).toContain(id);
    }
  });

  it("kimlikler benzersizdir", () => {
    const ids = MECHANISMS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("her mekanizma DamageMechanismSchema'yı geçer", () => {
    for (const mechanism of MECHANISMS) {
      const result = DamageMechanismSchema.safeParse(mechanism);
      expect(result.success, `${mechanism.id} şema doğrulamasından geçemedi`).toBe(true);
    }
  });

  it("her mekanizmanın en az bir önleyici tedbiri vardır", () => {
    for (const mechanism of MECHANISMS) {
      expect(mechanism.preventiveMeasuresTr.length).toBeGreaterThan(0);
    }
  });

  it("çatlama tipi mekanizmalar (CSCC) için typicalRateRangeMmPerYear tanımsızdır", () => {
    for (const id of ["CSCC_INTERNAL", "EXTERNAL_CSCC"]) {
      expect(getMechanism(id).typicalRateRangeMmPerYear).toBeUndefined();
    }
  });

  it("CP_SHIELDING için typicalRateRangeMmPerYear tanımsızdır (mekanizma değil, koruma durumu)", () => {
    expect(getMechanism("CP_SHIELDING").typicalRateRangeMmPerYear).toBeUndefined();
  });

  it("API 571 Tablo 4-5'ten dönüştürülen sayısal aralıklar korunur", () => {
    expect(getMechanism("ATMOSPHERIC_MARINE").typicalRateRangeMmPerYear).toEqual([0.13, 0.51]);
    expect(getMechanism("EROSION_SAND").typicalRateRangeMmPerYear).toEqual([0.15, 1.19]);
    expect(getMechanism("TOP_OF_LINE").typicalRateRangeMmPerYear).toEqual([1, 3]);
  });

  it("CO2_SWEET, asıl niceliksel modelin NORSOK'ta olduğunu belirtir ve kendi rate range'i tanımsızdır", () => {
    const co2 = getMechanism("CO2_SWEET");
    expect(co2.typicalRateRangeMmPerYear).toBeUndefined();
    expect(co2.relatedStandardOrSource).toContain("API RP 571");
  });
});

describe("getMechanism / listMechanismsByCategory", () => {
  it("bilinmeyen bir kimlik için Türkçe hata fırlatır", () => {
    expect(() => getMechanism("NOT_A_MECHANISM")).toThrowError(/bulunamadı/);
  });

  it("bilinen bir mekanizmayı kimliğiyle getirir", () => {
    const co2 = getMechanism("CO2_SWEET");
    expect(co2.nameTr).toContain("CO2");
  });

  it("listMechanismsByCategory doğru filtrelenmiş liste döner", () => {
    for (const mechanism of listMechanismsByCategory("EXTERNAL")) {
      expect(mechanism.category).toBe("EXTERNAL");
    }
  });
});

describe("mechanisms — KDP kayıt defteri entegrasyonu", () => {
  it("her mekanizma registry'de ayrı bir kayıt olarak bulunur", () => {
    const registered = listCoefficients().filter((c) => c.module === "mechanisms");
    expect(registered.length).toBe(MECHANISMS.length);
    for (const mechanism of MECHANISMS) {
      const entry = registered.find((c) => c.id === `data.mechanisms.${mechanism.id}`);
      expect(entry, `${mechanism.id} registry'de bulunamadı`).toBeDefined();
    }
  });

  it("API RP 571'den doğrudan okunan girdiler (CO2_SWEET, H2S_SOUR, MIC, CAVITATION, CSCC_INTERNAL) HIGH confidence taşır", () => {
    const registered = listCoefficients().filter((c) => c.module === "mechanisms");
    for (const id of ["CO2_SWEET", "H2S_SOUR", "MIC", "CAVITATION", "CSCC_INTERNAL"]) {
      const entry = registered.find((c) => c.id === `data.mechanisms.${id}`);
      expect(entry?.confidence, `${id} beklenen HIGH confidence taşımıyor`).toBe("HIGH");
    }
  });

  it("NACE SP0169'dan doğrudan okunan STRAY_CURRENT ve CP_SHIELDING HIGH confidence taşır", () => {
    const registered = listCoefficients().filter((c) => c.module === "mechanisms");
    for (const id of ["STRAY_CURRENT", "CP_SHIELDING"]) {
      const entry = registered.find((c) => c.id === `data.mechanisms.${id}`);
      expect(entry?.confidence).toBe("HIGH");
    }
  });

  it("hiçbir kayıt UNVERIFIED değildir (bu oturumda 24 mekanizmanın hepsi için en az bir gerçek kaynak bulundu)", () => {
    const registered = listCoefficients().filter((c) => c.module === "mechanisms");
    for (const entry of registered) {
      expect(entry.confidence).not.toBe("UNVERIFIED");
    }
  });
});
