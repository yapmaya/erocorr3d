// apps/web/tests/report/buildExcelWorkbook.test.ts

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildReportData } from "../../src/features/report/reportData";
import { buildExcelWorkbook, EXCEL_SHEET_NAMES } from "../../src/features/report/excel/buildExcelWorkbook";
import { buildTestAssessmentHistoryEntry, buildTestReportSettings } from "./testFixtures";

describe("buildExcelWorkbook", () => {
  const entry = buildTestAssessmentHistoryEntry();
  const data = buildReportData({
    entries: [entry],
    settings: buildTestReportSettings(),
    inServiceInspectionPossible: false,
    heatmapPngDataUrl: null,
    chartPngs: {},
  });
  const workbook = buildExcelWorkbook(data);

  it("7 sayfayı doğru sırayla üretir", () => {
    expect(workbook.SheetNames).toEqual([...EXCEL_SHEET_NAMES]);
  });

  it("Girdi sayfası bileşen etiketini taşır", () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Girdi"]!);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["Bileşen"]).toBe(entry.componentLabel);
  });

  it("Sonuç Özeti sayfası deriveTableRow ile TUTARLI SLC değeri taşır", () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Sonuç Özeti"]!);
    expect(rows).toHaveLength(1);
    expect(rows[0]!["SLC İnhibitörsüz (mm)"]).toBeCloseTo(data.components[0]!.tableRow.slcUninhibitedMm, 3);
  });

  it("Katsayı Defteri sayfası registry'nin TAMAMını kapsar", () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Katsayı Defteri"]!);
    expect(rows).toHaveLength(data.allCoefficients.length);
  });

  it("Hasar Alanı Ham Verisi sayfası spatialGridRows ile AYNI satır sayısına sahiptir", () => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Hasar Alanı Ham Verisi"]!);
    expect(rows).toHaveLength(data.spatialGridRows.length);
  });
});
