// packages/engine/tests/types/operating.test.ts

import { describe, expect, it } from "vitest";
import { OperatingProfileSchema } from "../../src/types/operating";
import { referenceLine1 } from "../../src/fixtures/referenceFacility";

function cloneCase(durationDaysPerYear: number, name: string) {
  const base = referenceLine1.operatingProfile.cases[0];
  return { ...base, name, durationDaysPerYear };
}

describe("OperatingProfileSchema", () => {
  it("gün toplamı 365'i aşmayan bir profili kabul eder", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(91, "Çekiş"), cloneCase(274, "Enjeksiyon")],
    });
    expect(result.success).toBe(true);
  });

  it("gün toplamı 365'i aşan bir profili reddeder", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(200, "Çekiş"), cloneCase(200, "Enjeksiyon")],
    });
    expect(result.success).toBe(false);
  });

  it("boş senaryo listesini reddeder", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [],
    });
    expect(result.success).toBe(false);
  });

  it("tam olarak 365 gün toplamını kabul eder (sınır durumu)", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(365, "Tüm Yıl")],
    });
    expect(result.success).toBe(true);
  });

  it("aynı ada sahip iki senaryoyu REDDEDER (viewer2d/dataSource.ts'in ad-bazlı eşleştirmesinin sessizce yanlış senaryoyu göstermesini önlemek için)", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(91, "İşletme"), cloneCase(274, "İşletme")],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const message = result.error.issues.map((i) => i.message).join(" ");
    expect(message).toContain("İşletme");
    expect(message).toContain("benzersiz");
  });

  it("üç senaryodan İKİSİ aynı adı taşıdığında da reddeder ve tekrarlanan adı belirtir", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(100, "Kış"), cloneCase(100, "Yaz"), cloneCase(100, "Kış")],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.message.includes("Kış"))).toBe(true);
  });

  it("farklı adlara sahip senaryoları benzersizlik hatası olmadan kabul eder", () => {
    const result = OperatingProfileSchema.safeParse({
      designLifeYears: 30,
      corrosionAllowanceMm: 3,
      cases: [cloneCase(91, "Kış"), cloneCase(274, "Yaz")],
    });
    expect(result.success).toBe(true);
  });
});
