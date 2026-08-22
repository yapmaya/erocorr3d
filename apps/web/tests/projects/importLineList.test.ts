// apps/web/tests/projects/importLineList.test.ts

import { describe, expect, it } from "vitest";
import { buildComponentsFromLineListRows, type LineListColumnMapping } from "../../src/features/projects/importLineList";
import type { ParsedSheet } from "../../src/features/input/importExcel/parseLineList";
import { WizardDraftSchema } from "../../src/features/input/schema";

const HEADERS = ["Hat Adı", "NPS", "Schedule", "Gün", "Basınç", "Sıcaklık", "CO2%"];
const MAPPING: LineListColumnMapping = {
  componentLabel: 0,
  npsInch: 1,
  schedule: 2,
  durationDaysPerYear: 3,
  pressureBara: 4,
  temperatureC: 5,
  co2MolePercent: 6,
};

function makeSheet(rows: (string | number)[][]): ParsedSheet {
  return { headers: HEADERS, rows };
}

describe("buildComponentsFromLineListRows", () => {
  it("her satırı AYRI bir WizardDraft'a çevirir", () => {
    const sheet = makeSheet([
      ["Hat-101", 6, "STD", 365, 50, 40, 2],
      ["Hat-102", 8, "STD", 200, 60, 45, 1.5],
    ]);
    const { drafts, skippedRowsTr } = buildComponentsFromLineListRows(sheet, MAPPING);
    expect(skippedRowsTr).toEqual([]);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]!.componentLabel).toBe("Hat-101");
    expect(drafts[0]!.geometry.npsInch).toBe(6);
    expect(drafts[1]!.componentLabel).toBe("Hat-102");
    expect(drafts[1]!.operatingProfile.cases[0]!.process.pressureBara).toBe(60);
    expect(drafts[1]!.operatingProfile.cases[0]!.chemistry.co2MolePercent).toBe(1.5);
  });

  it("her bileşenin id'si BENZERSİZDİR", () => {
    const sheet = makeSheet([
      ["Hat-A", 6, "STD", 365, 50, 40, 0],
      ["Hat-B", 6, "STD", 365, 50, 40, 0],
    ]);
    const { drafts } = buildComponentsFromLineListRows(sheet, MAPPING);
    expect(drafts[0]!.id).not.toBe(drafts[1]!.id);
  });

  it("zorunlu alan eksikse satır ATLANIR ve nedeni raporlanır", () => {
    const sheet = makeSheet([["", 6, "STD", 365, 50, 40, 0]]);
    const { drafts, skippedRowsTr } = buildComponentsFromLineListRows(sheet, MAPPING);
    expect(drafts).toHaveLength(0);
    expect(skippedRowsTr).toHaveLength(1);
    expect(skippedRowsTr[0]).toContain("Satır 2");
  });

  it("tanınmayan boru cetveli için satır ATLANIR", () => {
    const sheet = makeSheet([["Hat-X", 6, "GEÇERSİZ", 365, 50, 40, 0]]);
    const { drafts, skippedRowsTr } = buildComponentsFromLineListRows(sheet, MAPPING);
    expect(drafts).toHaveLength(0);
    expect(skippedRowsTr[0]).toContain("tanınan bir boru cetveli değil");
  });

  it("eşlenmeyen alanlar temsili varsayılanları KORUR (0'a sıfırlanmaz)", () => {
    const sheet = makeSheet([["Hat-Y", 6, "STD", "", "", "", ""]]);
    const { drafts } = buildComponentsFromLineListRows(sheet, { componentLabel: 0, npsInch: 1, schedule: 2 });
    expect(drafts[0]!.operatingProfile.cases[0]!.durationDaysPerYear).toBe(365); // createDefaultOperatingCase varsayılanı
  });

  it("Su Kesri>0 eşlenirse isFreeWaterPresent OTOMATİK true olur (aksi halde ProcessConditionsSchema BAŞARISIZ olur — gerçek testte gözlemlendi)", () => {
    const headers = [...HEADERS, "SuKesri"];
    const sheet: ParsedSheet = { headers, rows: [["Hat-Su", 6, "STD", 365, 50, 40, 0, 15]] };
    const { drafts, skippedRowsTr } = buildComponentsFromLineListRows(sheet, { ...MAPPING, waterCutPercent: 7 });
    expect(skippedRowsTr).toEqual([]);
    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.operatingProfile.cases[0]!.process.waterCutPercent).toBe(15);
    expect(draft.operatingProfile.cases[0]!.process.isFreeWaterPresent).toBe(true);
    expect(() => WizardDraftSchema.parse(draft)).not.toThrow();
  });

  it("Kum Debisi>0 eşlenirse parçacık çapı/yoğunluğu/şekil faktörü OTOMATİK doldurulur (aksi halde SolidsDataSchema BAŞARISIZ olur — gerçek testte gözlemlendi)", () => {
    const headers = [...HEADERS, "Kum"];
    const sheet: ParsedSheet = { headers, rows: [["Hat-Kum", 6, "STD", 365, 50, 40, 0, 25]] };
    const { drafts, skippedRowsTr } = buildComponentsFromLineListRows(sheet, { ...MAPPING, sandRateKgDay: 7 });
    expect(skippedRowsTr).toEqual([]);
    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.operatingProfile.cases[0]!.solids.sandRateKgDay).toBe(25);
    expect(draft.operatingProfile.cases[0]!.solids.particleDiameterUm).toBeGreaterThan(0);
    expect(draft.operatingProfile.cases[0]!.solids.particleDensityKgM3).toBeGreaterThan(0);
    expect(draft.operatingProfile.cases[0]!.solids.particleShapeFactor).toBeGreaterThan(0);
    expect(() => WizardDraftSchema.parse(draft)).not.toThrow();
  });

  it("her üretilen taslak WizardDraftSchema'yı GEÇER (tam saha örneği, kum+su birlikte)", () => {
    const headers = [...HEADERS, "SuKesri", "Kum"];
    const sheet: ParsedSheet = { headers, rows: [["Hat-Tam", 12, "STD", 300, 80, 55, 5, 20, 50]] };
    const { drafts } = buildComponentsFromLineListRows(sheet, { ...MAPPING, waterCutPercent: 7, sandRateKgDay: 8 });
    expect(() => WizardDraftSchema.parse(drafts[0])).not.toThrow();
  });
});
