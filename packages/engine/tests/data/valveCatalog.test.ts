// packages/engine/tests/data/valveCatalog.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  ValveHydraulicProfileSchema,
  ValveErosionProfileSchema,
  VALVE_HYDRAULIC_PROFILES,
  VALVE_EROSION_PROFILES,
  getValveHydraulicProfile,
  getValveErosionProfile,
} from "../../src/data/valveCatalog";
import { ComponentTypeEnum, type ComponentType } from "../../src/types/enums";

const ALL_VALVE_TYPES: ComponentType[] = [
  "GATE_VALVE",
  "GLOBE_VALVE",
  "BALL_VALVE_FULL",
  "BALL_VALVE_REDUCED",
  "BUTTERFLY_VALVE",
  "CHECK_VALVE_SWING",
  "CHECK_VALVE_LIFT",
  "CHECK_VALVE_DUAL_PLATE",
  "PLUG_VALVE",
  "NEEDLE_VALVE",
  "CHOKE_VALVE",
  "CONTROL_VALVE_GLOBE",
  "CONTROL_VALVE_CAGE",
  "PRESSURE_SAFETY_VALVE",
  "RESTRICTION_ORIFICE",
];

describe("VALVE_HYDRAULIC_PROFILES — veri bütünlüğü", () => {
  it("ComponentTypeEnum'daki 15 vana tipinin tamamı için bir hidrolik profil vardır", () => {
    expect(VALVE_HYDRAULIC_PROFILES.length).toBe(ALL_VALVE_TYPES.length);
    for (const componentType of ALL_VALVE_TYPES) {
      expect(
        VALVE_HYDRAULIC_PROFILES.some((p) => p.componentType === componentType),
        `${componentType} için hidrolik profil eksik`,
      ).toBe(true);
    }
  });

  it("her profil ValveHydraulicProfileSchema'yı geçer", () => {
    for (const profile of VALVE_HYDRAULIC_PROFILES) {
      const result = ValveHydraulicProfileSchema.safeParse(profile);
      expect(result.success, `${profile.componentType} şema doğrulamasından geçemedi`).toBe(true);
    }
  });

  it("componentType değerleri ComponentTypeEnum'a uygundur ve benzersizdir", () => {
    const types = VALVE_HYDRAULIC_PROFILES.map((p) => p.componentType);
    for (const t of types) {
      expect(ComponentTypeEnum.safeParse(t).success).toBe(true);
    }
    expect(new Set(types).size).toBe(types.length);
  });

  it("Fisher El Kitabı'ndan doğrudan okunan kontrol vanası tipleri FL/xT değerlerini korur", () => {
    const cage = getValveHydraulicProfile("CONTROL_VALVE_CAGE");
    expect(cage.flRange).toEqual([0.77, 0.87]);
    expect(cage.xtRange).toEqual([0.62, 0.81]);

    const vNotch = getValveHydraulicProfile("BALL_VALVE_REDUCED");
    expect(vNotch.flRange).toEqual([0.37, 0.86]);
    expect(vNotch.xtRange).toEqual([0.13, 0.54]);
  });

  it("choke vana için deşarj katsayısı aralığı Sachdeva modeliyle uyumludur", () => {
    const choke = getValveHydraulicProfile("CHOKE_VALVE");
    expect(choke.dischargeCoefficientRange).toEqual([0.62, 0.9]);
  });

  it("iğne vana ve çift plakalı çekvalf için sayısal alanlar UYDURULMAMIŞ, boş bırakılmıştır", () => {
    const needle = getValveHydraulicProfile("NEEDLE_VALVE");
    expect(needle.flRange).toBeUndefined();
    expect(needle.xtRange).toBeUndefined();
    expect(needle.cvOverD2Typical).toBeUndefined();

    const dualPlate = getValveHydraulicProfile("CHECK_VALVE_DUAL_PLATE");
    expect(dualPlate.cvOverD2Typical).toBeUndefined();
  });

  it("hiçbir profilde kcTypical değeri yoktur (bu oturumda kaynak bulunamadı)", () => {
    for (const profile of VALVE_HYDRAULIC_PROFILES) {
      expect(profile.kcTypical, `${profile.componentType} için beklenmedik kcTypical`).toBeUndefined();
    }
  });
});

describe("VALVE_EROSION_PROFILES — veri bütünlüğü", () => {
  it("15 vana tipinin tamamı için bir erozyon bölge profili vardır", () => {
    expect(VALVE_EROSION_PROFILES.length).toBe(ALL_VALVE_TYPES.length);
    for (const componentType of ALL_VALVE_TYPES) {
      expect(
        VALVE_EROSION_PROFILES.some((p) => p.componentType === componentType),
        `${componentType} için erozyon profili eksik`,
      ).toBe(true);
    }
  });

  it("her profil ValveErosionProfileSchema'yı geçer", () => {
    for (const profile of VALVE_EROSION_PROFILES) {
      const result = ValveErosionProfileSchema.safeParse(profile);
      expect(result.success, `${profile.componentType} şema doğrulamasından geçemedi`).toBe(true);
    }
  });

  it("her vana tipinde en az bir erozyon bölgesi tanımlıdır", () => {
    for (const profile of VALVE_EROSION_PROFILES) {
      expect(profile.zones.length).toBeGreaterThan(0);
    }
  });

  it("her bölgenin severityWeight'i 0-1 aralığındadır ve çarpan eğrisi en az 2 nokta içerir", () => {
    for (const profile of VALVE_EROSION_PROFILES) {
      for (const zone of profile.zones) {
        expect(zone.defaultSeverityWeight).toBeGreaterThanOrEqual(0);
        expect(zone.defaultSeverityWeight).toBeLessThanOrEqual(1);
        expect(zone.partialOpeningMultiplierCurve.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("choke vana en yüksek şiddet ağırlığına (referans nokta) sahiptir", () => {
    const choke = getValveErosionProfile("CHOKE_VALVE");
    const maxWeight = Math.max(...choke.zones.map((z) => z.defaultSeverityWeight));
    expect(maxWeight).toBe(1.0);
  });
});

describe("getValveHydraulicProfile / getValveErosionProfile", () => {
  it("bilinmeyen bir componentType için Türkçe hata fırlatır", () => {
    // @ts-expect-error kasıtlı geçersiz değer
    expect(() => getValveHydraulicProfile("NOT_A_VALVE")).toThrowError(/bulunamadı/);
    // @ts-expect-error kasıtlı geçersiz değer
    expect(() => getValveErosionProfile("NOT_A_VALVE")).toThrowError(/bulunamadı/);
  });

  it("bilinen bir componentType için profili getirir", () => {
    const gate = getValveHydraulicProfile("GATE_VALVE");
    expect(gate.displayNameTr).toContain("Sürgülü");
  });
});

describe("valveCatalog — KDP kayıt defteri entegrasyonu", () => {
  it("her vana tipi için hem hydraulics hem erosionZones kaydı ayrı ayrı bulunur", () => {
    const registered = listCoefficients().filter((c) => c.module === "valveCatalog");
    expect(registered.length).toBe(ALL_VALVE_TYPES.length * 2);
    for (const componentType of ALL_VALVE_TYPES) {
      const hydraulics = registered.find((c) => c.id === `data.valveCatalog.hydraulics.${componentType}`);
      const erosion = registered.find((c) => c.id === `data.valveCatalog.erosionZones.${componentType}`);
      expect(hydraulics, `${componentType} hydraulics kaydı bulunamadı`).toBeDefined();
      expect(erosion, `${componentType} erosionZones kaydı bulunamadı`).toBeDefined();
    }
  });

  it("Fisher El Kitabı'ndan doğrudan okunan girdiler (CONTROL_VALVE_CAGE, BALL_VALVE_REDUCED, BUTTERFLY_VALVE, CONTROL_VALVE_GLOBE, CHOKE_VALVE) HIGH confidence taşır", () => {
    const registered = listCoefficients().filter((c) => c.module === "valveCatalog");
    for (const id of [
      "data.valveCatalog.hydraulics.CONTROL_VALVE_CAGE",
      "data.valveCatalog.hydraulics.BALL_VALVE_REDUCED",
      "data.valveCatalog.hydraulics.BUTTERFLY_VALVE",
      "data.valveCatalog.hydraulics.CONTROL_VALVE_GLOBE",
      "data.valveCatalog.hydraulics.CHOKE_VALVE",
    ]) {
      const entry = registered.find((c) => c.id === id);
      expect(entry?.confidence, `${id} beklenen HIGH confidence taşımıyor`).toBe("HIGH");
    }
  });

  it("hiçbir erosionZones kaydı HIGH veya MEDIUM confidence taşımaz (bu oturumda hiçbir şiddet ağırlığı/çarpan için doğrudan kaynak bulunamadı)", () => {
    const registered = listCoefficients().filter(
      (c) => c.module === "valveCatalog" && c.id.startsWith("data.valveCatalog.erosionZones."),
    );
    expect(registered.length).toBe(ALL_VALVE_TYPES.length);
    for (const entry of registered) {
      expect(["UNVERIFIED", "LOW"]).toContain(entry.confidence);
    }
  });

  it("NEEDLE_VALVE ve CHECK_VALVE_DUAL_PLATE hydraulics kayıtları UNVERIFIED işaretlidir", () => {
    const registered = listCoefficients().filter((c) => c.module === "valveCatalog");
    for (const id of [
      "data.valveCatalog.hydraulics.NEEDLE_VALVE",
      "data.valveCatalog.hydraulics.CHECK_VALVE_DUAL_PLATE",
    ]) {
      const entry = registered.find((c) => c.id === id);
      expect(entry?.confidence).toBe("UNVERIFIED");
    }
  });
});
