// apps/web/tests/report/reportData.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "@erocorr3d/engine";
import { buildReportData } from "../../src/features/report/reportData";
import { deriveTableRow, deriveCtlAtl } from "../../src/features/results/resultsDerivation";
import { buildTestAssessmentHistoryEntry, buildTestReportSettings } from "./testFixtures";

describe("buildReportData", () => {
  const entry = buildTestAssessmentHistoryEntry();
  const settings = buildTestReportSettings();

  it("resultsDerivation.deriveTableRow İLE AYNI sayıları üretir (ikinci bir hesap İCAT ETMEZ)", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });

    const expectedRow = deriveTableRow(entry, { inServiceInspectionPossible: false });
    expect(data.components).toHaveLength(1);
    expect(data.components[0]!.tableRow.slcUninhibitedMm).toBe(expectedRow.slcUninhibitedMm);
    expect(data.components[0]!.tableRow.primaryMaterialTr).toBe(expectedRow.primaryMaterialTr);
    expect(data.components[0]!.tableRow.confidence).toBe(expectedRow.confidence);

    const expectedCtlAtl = deriveCtlAtl(entry);
    expect(data.components[0]!.tableRow.ctlAtl?.ratio).toBe(expectedCtlAtl?.ratio);
  });

  it("allCoefficients registry'nin TAMAMını taşır (Excel'in Katsayı Defteri sayfası için)", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });
    expect(data.allCoefficients.length).toBe(listCoefficients().length);
  });

  it("usedCoefficients yalnızca GERÇEKTEN calculationTrace'te geçen katsayıları içerir (allCoefficients'in ÖZ ALT KÜMESİ, PDF'in EK B'si için)", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });
    const referencedIds = new Set(data.rawTraceRows.flatMap((r) => r.coefficientIds.split("; ").filter(Boolean)));
    expect(data.usedCoefficients.length).toBeGreaterThan(0);
    expect(data.usedCoefficients.length).toBeLessThan(data.allCoefficients.length);
    expect(data.usedCoefficients.every((c) => referencedIds.has(c.id))).toBe(true);
    expect(referencedIds.size).toBe(data.usedCoefficients.length);
  });

  it("rawTraceRows, mekanizmaların calculationTrace'ini KAYIPSIZ döker", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });
    const expectedStepCount = entry.assessment.perCase.reduce(
      (sum, c) => sum + c.mechanismResults.reduce((s, m) => s + m.calculationTrace.length, 0),
      0,
    );
    expect(data.rawTraceRows).toHaveLength(expectedStepCount);
  });

  it("spatialGridRows boş DEĞİLDİR ve u/v [0,1) aralığındadır", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: null,
      chartPngs: {},
    });
    expect(data.spatialGridRows.length).toBeGreaterThan(0);
    for (const row of data.spatialGridRows) {
      expect(row.u).toBeGreaterThanOrEqual(0);
      expect(row.u).toBeLessThan(1);
      expect(row.v).toBeGreaterThanOrEqual(0);
      expect(row.v).toBeLessThan(1);
    }
  });

  it("heatmapPngDataUrl/chartPngs verildiği GİBİ taşınır (uydurulmaz)", () => {
    const data = buildReportData({
      entries: [entry],
      settings,
      inServiceInspectionPossible: false,
      heatmapPngDataUrl: "data:image/png;base64,AAA",
      chartPngs: { "Mekanizma Kırılımı": "data:image/png;base64,BBB" },
    });
    expect(data.heatmapPngDataUrl).toBe("data:image/png;base64,AAA");
    expect(data.chartPngs["Mekanizma Kırılımı"]).toBe("data:image/png;base64,BBB");
  });
});
