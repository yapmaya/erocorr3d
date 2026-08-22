// apps/web/tests/input/parseLineList.test.ts

import { describe, expect, it } from "vitest";
import { buildOperatingCasesFromRows, type ParsedSheet } from "../../src/features/input/importExcel/parseLineList";
import { createDefaultOperatingCase } from "../../src/features/input/defaultDraft";

describe("buildOperatingCasesFromRows", () => {
  const baseCase = createDefaultOperatingCase("Baz Senaryo");

  it("eşlenen sütunları uygular, eşlenmeyenler baz senaryodan gelir", () => {
    const sheet: ParsedSheet = {
      headers: ["Ad", "Gün", "Basınç", "CO2"],
      rows: [
        ["Kış Modu", 91, 60, 2.5],
        ["Yaz Modu", 274, 40, 0.1],
      ],
    };
    const mapping = { name: 0, durationDaysPerYear: 1, pressureBara: 2, co2MolePercent: 3 };
    const cases = buildOperatingCasesFromRows(sheet, mapping, baseCase);

    expect(cases).toHaveLength(2);
    expect(cases[0].name).toBe("Kış Modu");
    expect(cases[0].durationDaysPerYear).toBe(91);
    expect(cases[0].process.pressureBara).toBe(60);
    expect(cases[0].chemistry.co2MolePercent).toBe(2.5);
    // Eşlenmeyen alan (temperatureC) baz senaryodan KORUNUR.
    expect(cases[0].process.temperatureC).toBe(baseCase.process.temperatureC);
    expect(cases[1].name).toBe("Yaz Modu");
  });

  it("boş hücreler baz değeri korur, üzerine yazmaz", () => {
    const sheet: ParsedSheet = { headers: ["Ad", "Basınç"], rows: [["Senaryo A", ""]] };
    const cases = buildOperatingCasesFromRows(sheet, { name: 0, pressureBara: 1 }, baseCase);
    expect(cases[0].process.pressureBara).toBe(baseCase.process.pressureBara);
  });

  it("eşleme yoksa satır sırasına göre otomatik isim üretir", () => {
    const sheet: ParsedSheet = { headers: ["X"], rows: [[1], [2]] };
    const cases = buildOperatingCasesFromRows(sheet, {}, baseCase);
    expect(cases[0].name).toBe("İçe Aktarılan Senaryo 1");
    expect(cases[1].name).toBe("İçe Aktarılan Senaryo 2");
  });
});
