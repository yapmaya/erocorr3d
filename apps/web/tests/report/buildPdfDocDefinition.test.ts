// apps/web/tests/report/buildPdfDocDefinition.test.ts
//
// Gerçek PDF render/binary test EDİLMEZ (DOM'suz JSON yapı testi) — bkz.
// buildPdfDocDefinition.ts'in dosya başı notu.

import { describe, expect, it } from "vitest";
import type { Content } from "pdfmake/interfaces";
import { buildReportData } from "../../src/features/report/reportData";
import { buildPdfDocDefinition } from "../../src/features/report/pdf/buildPdfDocDefinition";
import { buildTestAssessmentHistoryEntry, buildTestReportSettings } from "./testFixtures";

function flattenContent(content: Content[]): Content[] {
  return content;
}

describe("buildPdfDocDefinition", () => {
  const entry = buildTestAssessmentHistoryEntry();

  function build(lang: "tr" | "en") {
    const settings = { ...buildTestReportSettings(), reportLanguage: lang };
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });
    return { data, doc: buildPdfDocDefinition(data) };
  }

  it("header/footer fonksiyonlarını üretir ve çağrılabilirler", () => {
    const { doc } = build("tr");
    expect(typeof doc.header).toBe("function");
    expect(typeof doc.footer).toBe("function");
    // @ts-expect-error test amaçlı serbest çağrı — DynamicContent imzası (currentPage, pageCount, pageSize)
    const headerContent = doc.header(1, 3, { width: 595, height: 842, orientation: "portrait" });
    expect(headerContent).toBeTruthy();
  });

  it("içerik dizisi boş DEĞİLDİR ve A4 sayfa boyutunu kullanır", () => {
    const { doc } = build("tr");
    expect(doc.pageSize).toBe("A4");
    expect(Array.isArray(doc.content)).toBe(true);
    expect(flattenContent(doc.content as Content[]).length).toBeGreaterThan(10);
  });

  it("EK B satır sayısı usedCoefficients ile eşleşir (allCoefficients İLE DEĞİL — tam registry PDF'i 177 sayfaya çıkarıyordu, bkz. reportData.ts'in dosya başı notu)", () => {
    const { data, doc } = build("tr");
    expect(data.usedCoefficients.length).toBeLessThan(data.allCoefficients.length);
    const content = doc.content as Content[];
    const appendixBTable = content.find(
      (c): c is Content & { table: { body: unknown[][] } } =>
        typeof c === "object" && c !== null && "table" in c && Array.isArray((c as { table?: { body?: unknown[] } }).table?.body) && (c as { table: { body: unknown[] } }).table.body.length === data.usedCoefficients.length + 1,
    );
    expect(appendixBTable).toBeTruthy();
  });

  it("EK B'deki büyük tablo-şeklindeki katsayı değerleri KISALTILIR (bilgi kaybı yok — Excel'de tam hali var), küçük değerler AYNEN kalır", () => {
    const { data, doc } = build("tr");
    const bigValueCoefficient = data.usedCoefficients.find((c) => JSON.stringify(c.value).length > 200);
    // Bu fixture'da büyük bir tablo değeri (ör. NORSOK Kt/f(pH) tabloları) bulunmalı — yoksa bu test anlamsızlaşır.
    expect(bigValueCoefficient).toBeDefined();
    const docString = JSON.stringify(doc.content);
    expect(docString).not.toContain(JSON.stringify(bigValueCoefficient!.value));
    expect(docString).toContain("Katsayı Kayıt Defteri");

    const smallValueCoefficient = data.usedCoefficients.find((c) => JSON.stringify(c.value).length <= 200);
    expect(smallValueCoefficient).toBeDefined();
    expect(docString).toContain(JSON.stringify(smallValueCoefficient!.value));
  });

  it("EN dilinde üretildiğinde kapak alt başlığı İngilizce olur", () => {
    const { doc } = build("en");
    expect(JSON.stringify(doc.content)).toContain("Corrosion / Erosion Assessment Report");
  });

  it("TR dilinde üretildiğinde kapak alt başlığı Türkçe olur", () => {
    const { doc } = build("tr");
    expect(JSON.stringify(doc.content)).toContain("Korozyon / Erozyon Değerlendirme Raporu");
  });
});
