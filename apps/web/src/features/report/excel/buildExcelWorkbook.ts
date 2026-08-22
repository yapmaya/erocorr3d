// apps/web/src/features/report/excel/buildExcelWorkbook.ts
//
// SAF fonksiyon: `ReportData` → `XLSX.WorkBook`, 7 sayfa (master görev madde
// B). `xlsx`'in AoA (array-of-arrays) API'si (`aoa_to_sheet`) kullanılır —
// `apps/web/src/features/input/importExcel/parseLineList.ts`'teki AYNI
// import stiliyle.
//
// BİLİNEN SINIRLAMA (kullanıcıya plan onayında bildirildi): topluluk `xlsx`
// paketi hücre stilleme/koşullu biçimlendirme VEYA gömülü resim/grafik
// desteklemiyor. Bu yüzden:
//  - CTL/ATL "renklendirmesi" gerçek hücre rengi DEĞİL, motorun KENDİ
//    `colorTr` alanına dayanan bir METİN etiketidir (ör. "0.42 · DÜŞÜK (sarı)").
//  - "Grafikler" sayfası gömülü resim DEĞİL, 8 grafiğin ham sayısal
//    verisidir (kullanıcı isterse Excel'in kendi grafik aracıyla çizebilir).

import * as XLSX from "xlsx";
import type { ReportData } from "../reportData";

function ctlAtlLabel(row: ReportData["components"][number]["tableRow"]): string {
  if (!row.ctlAtl) return "—";
  return `${row.ctlAtl.ratio.toFixed(2)} · ${row.ctlAtl.categoryLabelTr} (${row.ctlAtl.colorTr})`;
}

function buildInputSheet(data: ReportData): XLSX.WorkSheet {
  const header = [
    "Bileşen",
    "Bileşen Tipi",
    "NPS (in)",
    "Cetvel",
    "Dış Çap (mm)",
    "Et Kalınlığı (mm)",
    "İç Çap (mm)",
    "Uzunluk (mm)",
    "Tasarım Ömrü (yıl)",
    "Korozyon Payı (mm)",
    "Senaryo Sayısı",
  ];
  const rows = data.components.map((s) => {
    const { geometry: g, operatingProfile: p } = s.entry;
    return [
      s.entry.componentLabel,
      g.componentType,
      g.npsInch,
      g.schedule,
      g.odMm,
      g.wallThicknessMm,
      g.idMm,
      g.lengthMm,
      p.designLifeYears,
      p.corrosionAllowanceMm,
      p.cases.length,
    ];
  });
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildResultSummarySheet(data: ReportData): XLSX.WorkSheet {
  const header = ["Bileşen", "SLC İnhibitörsüz (mm)", "SLC İnhibitörlü (mm)", "Birincil Malzeme", "CTL/ATL", "Alternatif Malzeme", "Güven", "Doğrulanmamış Katsayı Sayısı"];
  const rows = data.components.map((s) => [
    s.tableRow.componentLabel,
    Number(s.tableRow.slcUninhibitedMm.toFixed(3)),
    s.tableRow.slcInhibitedMm === null ? "" : Number(s.tableRow.slcInhibitedMm.toFixed(3)),
    s.tableRow.primaryMaterialTr,
    ctlAtlLabel(s.tableRow),
    s.tableRow.alternativeMaterialTr ?? "",
    s.tableRow.confidence,
    s.tableRow.unverifiedCoefficients.length,
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildMechanismDetailSheet(data: ReportData): XLSX.WorkSheet {
  const header = ["Bileşen", "Senaryo", "Mekanizma", "Uygulanabilir", "P10 (mm/yıl)", "P50 (mm/yıl)", "P90 (mm/yıl)", "Model", "Güven", "Kaynaklar"];
  const rows: (string | number)[][] = [];
  for (const section of data.components) {
    for (const caseAssessment of section.entry.assessment.perCase) {
      for (const m of caseAssessment.mechanismResults) {
        rows.push([
          section.entry.componentLabel,
          caseAssessment.caseName,
          m.nameTr,
          m.isApplicable ? "Evet" : "Hayır",
          Number(m.rateP10.toFixed(4)),
          Number(m.rateP50.toFixed(4)),
          Number(m.rateP90.toFixed(4)),
          m.modelUsed,
          m.confidence,
          m.sourceRefs.join("; "),
        ]);
      }
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildScenarioSheet(data: ReportData): XLSX.WorkSheet {
  const header = ["Bileşen", "Senaryo", "İşletme Günü/Yıl", "Yıllık Kayıp P50 (mm/yıl)", "Belirleyici Senaryo Mu"];
  const rows: (string | number)[][] = [];
  for (const section of data.components) {
    const governing = section.entry.assessment.governingCaseName;
    for (const scenario of section.entry.assessment.metalLoss.scenarioAnnualLosses) {
      rows.push([
        section.entry.componentLabel,
        scenario.scenarioNameTr,
        scenario.operatingDaysPerYear,
        Number(scenario.annualLossMmPerYear.p50.toFixed(4)),
        scenario.scenarioNameTr === governing ? "Evet" : "Hayır",
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildSpatialFieldSheet(data: ReportData): XLSX.WorkSheet {
  const header = ["Bileşen", "Senaryo", "u", "v", "Saat Konumu", "Hasar (mm)"];
  const rows = data.spatialGridRows.map((r) => [r.componentLabel, r.caseName, r.u, r.v, r.clockPosition, r.valueMm]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildCoefficientRegistrySheet(data: ReportData): XLSX.WorkSheet {
  const header = ["ID", "Değer", "Birim", "Açıklama", "Kaynak Tipi", "Kaynak Atfı", "Çapraz Kontrol", "Güven", "Not"];
  const rows = data.allCoefficients.map((c) => [
    c.id,
    JSON.stringify(c.value),
    c.unit,
    c.description,
    c.source.type,
    c.source.citation,
    c.crossChecked ? "Evet" : "Hayır",
    c.confidence,
    c.notes,
  ]);
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

function buildChartsSheet(data: ReportData): XLSX.WorkSheet {
  // Gömülü resim DESTEKLENMİYOR (dosya başı notu) — mekanizma detayından
  // türetilmiş ham sayısal seri: bileşen × senaryo × mekanizma → P50 hızı.
  // Bu, sonuç panelindeki "Mekanizma Kırılımı" grafiğinin AYNI kaynak verisidir.
  const header = ["Bileşen", "Senaryo", "Mekanizma", "P50 (mm/yıl)"];
  const rows: (string | number)[][] = [];
  for (const section of data.components) {
    for (const caseAssessment of section.entry.assessment.perCase) {
      for (const m of caseAssessment.mechanismResults.filter((mech) => mech.isApplicable)) {
        rows.push([section.entry.componentLabel, caseAssessment.caseName, m.nameTr, Number(m.rateP50.toFixed(4))]);
      }
    }
  }
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

export const EXCEL_SHEET_NAMES = ["Girdi", "Sonuç Özeti", "Mekanizma Detayı", "Senaryo Bazlı", "Hasar Alanı Ham Verisi", "Katsayı Defteri", "Grafikler"] as const;

export function buildExcelWorkbook(data: ReportData): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildInputSheet(data), EXCEL_SHEET_NAMES[0]);
  XLSX.utils.book_append_sheet(workbook, buildResultSummarySheet(data), EXCEL_SHEET_NAMES[1]);
  XLSX.utils.book_append_sheet(workbook, buildMechanismDetailSheet(data), EXCEL_SHEET_NAMES[2]);
  XLSX.utils.book_append_sheet(workbook, buildScenarioSheet(data), EXCEL_SHEET_NAMES[3]);
  XLSX.utils.book_append_sheet(workbook, buildSpatialFieldSheet(data), EXCEL_SHEET_NAMES[4]);
  XLSX.utils.book_append_sheet(workbook, buildCoefficientRegistrySheet(data), EXCEL_SHEET_NAMES[5]);
  XLSX.utils.book_append_sheet(workbook, buildChartsSheet(data), EXCEL_SHEET_NAMES[6]);
  return workbook;
}
