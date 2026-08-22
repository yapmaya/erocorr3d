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
});
