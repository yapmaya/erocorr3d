// packages/engine/tests/types/customMaterial.test.ts

import { describe, expect, it } from "vitest";
import { CustomMaterialSchema, isCustomMaterialApplicable, type CustomMaterial } from "../../src/types/customMaterial";

const BASE: CustomMaterial = {
  id: "custom-1",
  nameTr: "Özel Alaşım X",
  notesTr: "Tedarikçi test raporuna göre yüksek klorür direnci",
  sourceNoteTr: "Tedarikçi X'in 2024 test raporu (bağımsız doğrulanmadı)",
  minRequiredCaMm: 3,
  maxRequiredCaMm: 6,
  relativeCostIndex: 4.2,
};

describe("CustomMaterialSchema", () => {
  it("geçerli bir kaydı kabul eder", () => {
    expect(() => CustomMaterialSchema.parse(BASE)).not.toThrow();
  });

  it("maxRequiredCaMm=null (üst sınır yok) geçerlidir", () => {
    expect(() => CustomMaterialSchema.parse({ ...BASE, maxRequiredCaMm: null })).not.toThrow();
  });

  it("maxRequiredCaMm < minRequiredCaMm ise reddeder", () => {
    expect(() => CustomMaterialSchema.parse({ ...BASE, minRequiredCaMm: 5, maxRequiredCaMm: 2 })).toThrow();
  });

  it("boş sourceNoteTr'yi reddeder (KDP: gerekçesiz kullanıcı verisi olamaz)", () => {
    expect(() => CustomMaterialSchema.parse({ ...BASE, sourceNoteTr: "" })).toThrow();
  });
});

describe("isCustomMaterialApplicable", () => {
  it("aralık içindeyse true döner", () => {
    expect(isCustomMaterialApplicable(BASE, 4)).toBe(true);
    expect(isCustomMaterialApplicable(BASE, 3)).toBe(true); // alt sınır dahil
    expect(isCustomMaterialApplicable(BASE, 6)).toBe(true); // üst sınır dahil
  });

  it("aralık dışındaysa false döner", () => {
    expect(isCustomMaterialApplicable(BASE, 2.9)).toBe(false);
    expect(isCustomMaterialApplicable(BASE, 6.1)).toBe(false);
  });

  it("maxRequiredCaMm=null iken üst sınır yoktur", () => {
    const unbounded = { ...BASE, maxRequiredCaMm: null };
    expect(isCustomMaterialApplicable(unbounded, 1000)).toBe(true);
  });
});
