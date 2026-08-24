// apps/web/src/features/report/pdf/buildPdfDocDefinition.ts
//
// SAF fonksiyon: `ReportData` → pdfmake `TDocumentDefinitions`. DOM'a hiç
// dokunmaz (yalnızca JSON-benzeri bir belge tanımı üretir) — bu yüzden
// Vitest ile SAF bir fonksiyon gibi test edilebilir (bkz. tests/report/
// buildPdfDocDefinition.test.ts). Gerçek PDF render/indirme
// generatePdfReport.ts'te (SAF DEĞİL) yapılır.
//
// 16 bölüm master görev madde A'daki sırayı izler. HİÇBİR sayı/kaynak
// burada İCAT EDİLMEZ — yalnızca `ReportData` (reportData.ts, KENDİSİ zaten
// var olan türetmeleri okur) içindeki alanlar biçimlendirilir.

import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import { COMPONENT_TYPE_LABELS, ORIENTATION_LABELS, INSTALLATION_LABELS } from "@erocorr3d/engine";
import type { ReportData } from "../reportData";
import { PDF_STYLES, buildHeader, buildFooter } from "./pdfStyles";
import {
  SECTION_TITLES,
  INTRODUCTION_BODY,
  SCOPE_BODY,
  DEFINITIONS,
  REFERENCES_LABEL,
  ENGINEERING_DISCLAIMER,
  HEATMAP_MISSING_NOTE,
  MONITORING_NO_CTL_ATL,
  monitoringRecommendationFor,
  pick,
} from "./pdfText";

function h1(text: string): Content {
  return { text, style: "h1", tocItem: true };
}

function h2(text: string): Content {
  return { text, style: "h2" };
}

const COEFFICIENT_VALUE_MAX_CHARS = 200;

/**
 * Bazı katsayıların `value`si (ör. NORSOK Kt/f(pH) tabloları) çok büyük
 * nesneler/dizilerdir — PDF'te ham JSON.stringify'ını basmak TEK bir hücreyi
 * birkaç SAYFAya çıkarabilir (gerçek testte gözlemlendi). Bilgi
 * KAYBOLMAZ — tam değer HER ZAMAN Excel raporunun "Katsayı Defteri"
 * sayfasında ve Katsayı Kayıt Defteri sayfasında (CSV dışa aktarım) mevcuttur;
 * burada yalnızca PDF hücresi için KISALTILMIŞ bir özet üretilir.
 */
function formatCoefficientValueForPdf(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.length <= COEFFICIENT_VALUE_MAX_CHARS) return json;
  if (Array.isArray(value)) return `[${value.length} elemanlı tablo — tam değer Excel raporunda/Katsayı Kayıt Defteri'nde]`;
  if (typeof value === "object" && value !== null) return `{...} karmaşık tablo — tam değer Excel raporunda/Katsayı Kayıt Defteri'nde`;
  return `${json.slice(0, COEFFICIENT_VALUE_MAX_CHARS)}…`;
}

function simpleTable(header: string[], rows: (string | number)[][], widths?: (string | number)[]): Content {
  const body: TableCell[][] = [
    header.map((h) => ({ text: h, style: "tableHeader" }) as TableCell),
    ...rows.map((row) => row.map((cell) => ({ text: String(cell), style: "tableCell" }) as TableCell)),
  ];
  return {
    table: { headerRows: 1, widths: widths ?? header.map(() => "*"), body },
    layout: "lightHorizontalLines",
    margin: [0, 2, 0, 8],
  };
}

function buildCover(data: ReportData): Content[] {
  const { settings } = data;
  const lang = settings.reportLanguage;
  const dateLabel = data.generatedAt.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US");
  const blocks: Content[] = [];
  if (settings.logoDataUrl) {
    blocks.push({ image: settings.logoDataUrl, width: 90, margin: [0, 0, 0, 20] });
  }
  blocks.push(
    { text: settings.companyName || "—", fontSize: 12, color: "#606060", margin: [0, 0, 0, 40] },
    { text: settings.projectName || "—", style: "coverTitle" },
    { text: pick(SECTION_TITLES.coverSubtitle, lang), style: "coverSubtitle" },
    simpleTable(
      lang === "tr" ? ["Doküman No", "Revizyon", "Tarih"] : ["Document No", "Revision", "Date"],
      [[settings.documentNo || "—", settings.revision || "0", dateLabel]],
    ),
    {
      margin: [0, 30, 0, 0],
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            lang === "tr" ? "Hazırlayan" : "Prepared by",
            lang === "tr" ? "Kontrol Eden" : "Checked by",
            lang === "tr" ? "Onaylayan" : "Approved by",
          ].map((t) => ({ text: t, style: "tableHeader" }) as TableCell),
          [settings.preparedBy || "—", settings.checkedBy || "—", settings.approvedBy || "—"].map(
            (t) => ({ text: t, style: "tableCell", margin: [0, 10, 0, 10] }) as TableCell,
          ),
        ],
      },
      layout: "lightHorizontalLines",
    },
    { text: pick(ENGINEERING_DISCLAIMER, lang), style: "small", margin: [0, 60, 0, 0], italics: true },
    { text: "", pageBreak: "after" },
  );
  return blocks;
}

function buildRevisionHistory(data: ReportData): Content[] {
  const { settings } = data;
  const lang = settings.reportLanguage;
  const header = lang === "tr" ? ["Rev", "Tarih", "Açıklama", "Kim"] : ["Rev", "Date", "Description", "By"];
  const rows = settings.revisionHistory.map((r) => [r.rev, r.date, lang === "tr" ? r.descriptionTr : r.descriptionEn, r.by]);
  return [h1(pick(SECTION_TITLES.revisionHistory, lang)), rows.length > 0 ? simpleTable(header, rows) : { text: "—", style: "body" }];
}

function buildIntroScopeReferencesDefinitions(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const allSourceRefs = new Set<string>();
  for (const section of data.components) {
    for (const caseAssessment of section.entry.assessment.perCase) {
      for (const mechanism of caseAssessment.mechanismResults) {
        for (const ref of mechanism.sourceRefs) allSourceRefs.add(ref);
      }
    }
  }

  const definitionRows = DEFINITIONS.map((d) => [d.term, lang === "tr" ? d.definitionTr : d.definitionEn]);

  return [
    h1(pick(SECTION_TITLES.introduction, lang)),
    { text: pick(INTRODUCTION_BODY, lang), style: "body" },
    h1(pick(SECTION_TITLES.scope, lang)),
    { text: pick(SCOPE_BODY, lang), style: "body" },
    h1(pick(SECTION_TITLES.references, lang)),
    { text: pick(REFERENCES_LABEL, lang), style: "body", margin: [0, 0, 0, 6] },
    allSourceRefs.size > 0
      ? { ul: [...allSourceRefs], style: "body" }
      : { text: "—", style: "body" },
    h1(pick(SECTION_TITLES.definitions, lang)),
    simpleTable(lang === "tr" ? ["Terim", "Tanım"] : ["Term", "Definition"], definitionRows, [80, "*"]),
  ];
}

function buildDesignData(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.designData, lang))];
  for (const section of data.components) {
    const { entry } = section;
    const g = entry.geometry;
    const p = entry.operatingProfile;
    blocks.push(h2(entry.componentLabel));
    blocks.push(
      simpleTable(
        lang === "tr" ? ["Alan", "Değer"] : ["Field", "Value"],
        [
          [lang === "tr" ? "Bileşen Tipi" : "Component Type", lang === "tr" ? COMPONENT_TYPE_LABELS[g.componentType].tr : COMPONENT_TYPE_LABELS[g.componentType].en],
          ["NPS", `${g.npsInch}"`],
          [lang === "tr" ? "Cetvel" : "Schedule", g.schedule],
          [lang === "tr" ? "Dış Çap" : "Outer Diameter", `${g.odMm} mm`],
          [lang === "tr" ? "Et Kalınlığı" : "Wall Thickness", `${g.wallThicknessMm} mm`],
          [lang === "tr" ? "İç Çap" : "Inner Diameter", `${g.idMm} mm`],
          [lang === "tr" ? "Uzunluk" : "Length", `${g.lengthMm} mm`],
          [lang === "tr" ? "Yönelim" : "Orientation", lang === "tr" ? ORIENTATION_LABELS[g.orientation].tr : ORIENTATION_LABELS[g.orientation].en],
          [lang === "tr" ? "Tesis Yöntemi" : "Installation", lang === "tr" ? INSTALLATION_LABELS[g.installation].tr : INSTALLATION_LABELS[g.installation].en],
          [lang === "tr" ? "Tasarım Ömrü" : "Design Life", `${p.designLifeYears} ${lang === "tr" ? "yıl" : "years"}`],
          [lang === "tr" ? "Korozyon Payı" : "Corrosion Allowance", `${p.corrosionAllowanceMm} mm`],
          [lang === "tr" ? "İşletme Senaryosu Sayısı" : "Operating Case Count", String(p.cases.length)],
        ],
        [180, "*"],
      ),
    );
  }
  return blocks;
}

function buildMechanismsAndMethodology(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.mechanisms, lang))];

  const methodologyRows = new Map<string, string>(); // modelUsed -> sourceRefs joined

  for (const section of data.components) {
    blocks.push(h2(section.entry.componentLabel));
    for (const caseAssessment of section.entry.assessment.perCase) {
      const rows = caseAssessment.mechanismResults.map((m) => [
        lang === "tr" ? m.nameTr : m.nameEn,
        m.isApplicable ? (lang === "tr" ? "Evet" : "Yes") : (lang === "tr" ? "Hayır" : "No"),
        m.confidence,
      ]);
      blocks.push({ text: caseAssessment.caseName, style: "body", bold: true, margin: [0, 4, 0, 2] });
      blocks.push(simpleTable(lang === "tr" ? ["Mekanizma", "Uygulanabilir", "Güven"] : ["Mechanism", "Applicable", "Confidence"], rows));
      for (const m of caseAssessment.mechanismResults) {
        if (m.isApplicable) methodologyRows.set(m.modelUsed, m.sourceRefs.join("; "));
      }
    }
  }

  blocks.push(h1(pick(SECTION_TITLES.methodology, lang)));
  blocks.push(
    simpleTable(
      lang === "tr" ? ["Model", "Kaynak"] : ["Model", "Source"],
      [...methodologyRows.entries()].map(([model, source]) => [model, source]),
      [150, "*"],
    ),
  );
  return blocks;
}

function buildResultsAndUncertainty(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.results, lang))];

  blocks.push(
    simpleTable(
      lang === "tr"
        ? ["Bileşen", "SLC İnhibitörsüz (mm)", "Birincil Malzeme", "CTL/ATL", "Güven"]
        : ["Component", "SLC Uninhibited (mm)", "Primary Material", "CTL/ATL", "Confidence"],
      data.components.map((s) => [
        s.tableRow.componentLabel,
        s.tableRow.slcUninhibitedMm.toFixed(2),
        s.tableRow.primaryMaterialTr,
        s.tableRow.ctlAtl ? `${s.tableRow.ctlAtl.ratio.toFixed(2)} · ${s.tableRow.ctlAtl.categoryLabelTr}` : "—",
        s.tableRow.confidence,
      ]),
    ),
  );

  blocks.push(h1(pick(SECTION_TITLES.uncertainty, lang)));
  blocks.push(
    simpleTable(
      lang === "tr" ? ["Bileşen", "P10 (mm)", "P50 (mm)", "P90 (mm)"] : ["Component", "P10 (mm)", "P50 (mm)", "P90 (mm)"],
      data.components.map((s) => {
        const band = s.entry.assessment.metalLoss.totalServiceLifeCorrosionMm;
        return [s.entry.componentLabel, band.p10.toFixed(2), band.p50.toFixed(2), band.p90.toFixed(2)];
      }),
    ),
  );
  blocks.push({ text: pick(ENGINEERING_DISCLAIMER, lang), style: "disclaimerBanner", margin: [0, 4, 0, 0] });
  return blocks;
}

function buildMaterialSelection(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.materialSelection, lang))];
  for (const section of data.components) {
    blocks.push(h2(section.entry.componentLabel));
    blocks.push({ text: section.materialDetail.primaryMaterialTr, style: "body", bold: true });
    blocks.push({ text: section.materialDetail.rationaleTr, style: "body", margin: [0, 2, 0, 4] });
    if (section.materialDetail.alternativeMaterialsTr.length > 0) {
      blocks.push({ text: lang === "tr" ? "Alternatifler:" : "Alternatives:", style: "body", bold: true });
      blocks.push({ ul: section.materialDetail.alternativeMaterialsTr, style: "body" });
    }
    if (section.materialDetail.additionalRequirementsTr.length > 0) {
      blocks.push({ text: lang === "tr" ? "Ek Gereklilikler:" : "Additional Requirements:", style: "body", bold: true, margin: [0, 4, 0, 0] });
      blocks.push({ ul: section.materialDetail.additionalRequirementsTr, style: "body" });
    }
  }
  return blocks;
}

function buildHeatmapAndCharts(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.heatmap, lang))];
  blocks.push(
    data.heatmapPngDataUrl
      ? { image: data.heatmapPngDataUrl, width: 420, margin: [0, 4, 0, 8] }
      : { text: pick(HEATMAP_MISSING_NOTE, lang), style: "small" },
  );

  blocks.push(h1(pick(SECTION_TITLES.charts, lang)));
  const chartEntries = Object.entries(data.chartPngs);
  if (chartEntries.length === 0) {
    blocks.push({ text: lang === "tr" ? "Rapor üretilirken hiçbir grafik yakalanmadı." : "No charts were captured when the report was generated.", style: "small" });
  } else {
    for (const [label, dataUrl] of chartEntries) {
      blocks.push({ text: label, style: "body", bold: true, margin: [0, 6, 0, 2] });
      blocks.push({ image: dataUrl, width: 420, margin: [0, 0, 0, 8] });
    }
  }
  return blocks;
}

function buildMonitoring(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.monitoring, lang))];
  for (const section of data.components) {
    blocks.push(h2(section.entry.componentLabel));
    const text = section.tableRow.ctlAtl ? monitoringRecommendationFor(section.tableRow.ctlAtl.category) : MONITORING_NO_CTL_ATL;
    blocks.push({ text: pick(text, lang), style: "body" });
  }
  return blocks;
}

function buildAppendices(data: ReportData): Content[] {
  const lang = data.settings.reportLanguage;
  const blocks: Content[] = [h1(pick(SECTION_TITLES.appendixA, lang))];
  blocks.push(
    simpleTable(
      lang === "tr"
        ? ["Bileşen", "Senaryo", "Mekanizma", "#", "Adım", "Formül", "Çıktı", "Katsayılar"]
        : ["Component", "Case", "Mechanism", "#", "Step", "Formula", "Output", "Coefficients"],
      data.rawTraceRows.map((r) => [
        r.componentLabel,
        r.caseName,
        lang === "tr" ? r.mechanismNameTr : r.mechanismNameEn,
        r.stepIndex,
        r.stepName,
        r.formula,
        `${r.output} ${r.unit}`,
        r.coefficientIds,
      ]),
      [50, 50, 60, 14, 60, "*", 45, 60],
    ),
  );

  blocks.push(h1(pick(SECTION_TITLES.appendixB, lang)));
  blocks.push({
    text:
      lang === "tr"
        ? `Bu listede yalnızca bu rapordaki bileşenlerin hesabında GERÇEKTEN kullanılan katsayılar yer alır (${data.usedCoefficients.length} / ${data.allCoefficients.length} kayıtlı katsayı). Kayıt defterinin tamamı Excel raporunun "Katsayı Defteri" sayfasındadır.`
        : `This list contains only the coefficients ACTUALLY used in this report's components (${data.usedCoefficients.length} / ${data.allCoefficients.length} registered coefficients). The full registry is available in the "Katsayı Defteri" sheet of the Excel report.`,
    style: "small",
    margin: [0, 0, 0, 4],
  });
  blocks.push(
    simpleTable(
      lang === "tr" ? ["ID", "Değer", "Birim", "Açıklama", "Kaynak", "Güven"] : ["ID", "Value", "Unit", "Description", "Source", "Confidence"],
      data.usedCoefficients.map((c) => [c.id, formatCoefficientValueForPdf(c.value), c.unit, c.description, c.source.citation, c.confidence]),
      [90, 40, 30, "*", "*", 45],
    ),
  );
  return blocks;
}

export function buildPdfDocDefinition(data: ReportData): TDocumentDefinitions {
  const { settings } = data;
  const lang = settings.reportLanguage;

  const content: Content[] = [
    ...buildCover(data),
    ...buildRevisionHistory(data),
    { toc: { title: h2(pick(SECTION_TITLES.toc, lang)) }, pageBreak: "after" } as Content,
    ...buildIntroScopeReferencesDefinitions(data),
    ...buildDesignData(data),
    ...buildMechanismsAndMethodology(data),
    ...buildResultsAndUncertainty(data),
    ...buildMaterialSelection(data),
    ...buildHeatmapAndCharts(data),
    ...buildMonitoring(data),
    ...buildAppendices(data),
  ];

  return {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 40],
    header: buildHeader(settings, lang),
    footer: buildFooter(lang),
    styles: PDF_STYLES,
    defaultStyle: { fontSize: 9.5 },
    content,
    info: {
      title: `${settings.projectName || "EroCorr3D"} — ${pick(SECTION_TITLES.coverSubtitle, lang)}`,
      author: settings.preparedBy || undefined,
    },
  };
}
