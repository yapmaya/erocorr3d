// apps/web/src/features/report/reportData.ts
//
// PDF ve Excel rapor üreticilerinin ORTAK veri kaynağı. SAF fonksiyon: aynı
// (entries, settings, görsel) girdisi → aynı ReportData çıktısı, yan etki
// yok (dosya indirme YOK — bkz. pdf/generatePdfReport.ts ve
// excel/generateExcelReport.ts, o iki dosya bu modülün SONRASINDA çalışır).
//
// KDP UYUMU: bu dosya HİÇBİR yeni katsayı/formül İCAT ETMEZ — yalnızca
// zaten hesaplanmış `AssessmentHistoryEntry`'leri (assessmentHistoryStore.ts)
// ve registry'nin KENDİ `listCoefficients()`ini okur. Sonuç sütunları
// `resultsDerivation.ts::deriveTableRow` İLE AYNI türetme kaynağını kullanır
// — Sonuç Tablosu (A) ile raporun sayıları TUTARSIZ OLAMAZ.

import { listCoefficients, vToClockPosition, type Coefficient } from "@erocorr3d/engine";
import type { AssessmentHistoryEntry } from "../../store/assessmentHistoryStore";
import type { ReportSettings } from "./reportSettingsTypes";
import { deriveTableRow, deriveMaterialRecommendation, type ResultsTableRow } from "../results/resultsDerivation";

export interface ReportComponentSection {
  entry: AssessmentHistoryEntry;
  tableRow: ResultsTableRow;
  /** `deriveMaterialRecommendation`in TAM sonucu (rationaleTr/additionalRequirementsTr dahil — tabloda kısaltılmış görünen bilginin tam hali). */
  materialDetail: ReturnType<typeof deriveMaterialRecommendation>;
}

export interface RawTraceStepRow {
  componentLabel: string;
  caseName: string;
  mechanismNameTr: string;
  stepIndex: number;
  stepName: string;
  formula: string;
  inputs: string;
  output: number;
  unit: string;
  coefficientIds: string;
}

export interface SpatialGridRow {
  componentLabel: string;
  caseName: string;
  u: number;
  v: number;
  clockPosition: number;
  valueMm: number;
}

export interface ReportData {
  settings: ReportSettings;
  generatedAt: Date;
  components: ReportComponentSection[];
  /**
   * Registry'nin TAMAMI (271+ kayıt) — Excel'in "Katsayı Defteri" sayfası
   * bunu kullanır (sayfa/uzunluk sorunu YOK, tam denetim kaydı olarak
   * değerlidir).
   */
  allCoefficients: Coefficient[];
  /**
   * YALNIZCA bu rapordaki bileşenlerin GERÇEKTEN kullandığı katsayılar
   * (calculationTrace'lerden tekilleştirilmiş) — PDF'in EK B'si bunu
   * kullanır. Gerçek testte (bkz. commit geçmişi): tam registry'yi PDF'e
   * dökmek TEK bir düz boru için 177 sayfaya çıkıyordu (bazı katsayı
   * değerleri koca JSON tablolar) — kullanıcı onayıyla PDF bu listeye
   * daraltıldı, Excel'in tam defteri KORUNDU.
   */
  usedCoefficients: Coefficient[];
  rawTraceRows: RawTraceStepRow[];
  spatialGridRows: SpatialGridRow[];
  heatmapPngDataUrl: string | null;
  chartPngs: Record<string, string>;
}

const SPATIAL_GRID_SAMPLE_STEP_U = 4; // ızgarayı 4'te 1 örnekle (96×64 tam ızgara Excel'de ~6000 satır — okunabilir kalması için seyrekleştirilir, İCAT edilen bir değer DEĞİL, yalnızca dışa aktarım seyrekleştirmesi)
const SPATIAL_GRID_SAMPLE_STEP_V = 4;

function buildRawTraceRows(entries: AssessmentHistoryEntry[]): RawTraceStepRow[] {
  const rows: RawTraceStepRow[] = [];
  for (const entry of entries) {
    for (const caseAssessment of entry.assessment.perCase) {
      for (const mechanism of caseAssessment.mechanismResults) {
        mechanism.calculationTrace.forEach((step, index) => {
          rows.push({
            componentLabel: entry.componentLabel,
            caseName: caseAssessment.caseName,
            mechanismNameTr: mechanism.nameTr,
            stepIndex: index + 1,
            stepName: step.stepName,
            formula: step.formula,
            inputs: Object.entries(step.inputs)
              .map(([k, v]) => `${k}=${v}`)
              .join("; "),
            output: step.output,
            unit: step.unit,
            coefficientIds: step.coefficientIds.join("; "),
          });
        });
      }
    }
  }
  return rows;
}

/** `buildRawTraceRows` İLE AYNI iterasyon yapısı — coefficientIds'leri tekilleştirerek toplar (ikinci bir hesap İCAT ETMEZ, aynı calculationTrace verisini okur). */
function collectUsedCoefficientIds(entries: AssessmentHistoryEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    for (const caseAssessment of entry.assessment.perCase) {
      for (const mechanism of caseAssessment.mechanismResults) {
        for (const step of mechanism.calculationTrace) {
          for (const id of step.coefficientIds) ids.add(id);
        }
      }
    }
  }
  return ids;
}

function buildSpatialGridRows(entries: AssessmentHistoryEntry[]): SpatialGridRow[] {
  const rows: SpatialGridRow[] = [];
  for (const entry of entries) {
    for (const caseAssessment of entry.assessment.perCase) {
      const field = caseAssessment.spatialDamageFieldFullLife;
      for (let iv = 0; iv < field.resolutionV; iv += SPATIAL_GRID_SAMPLE_STEP_V) {
        for (let iu = 0; iu < field.resolutionU; iu += SPATIAL_GRID_SAMPLE_STEP_U) {
          const u = (iu + 0.5) / field.resolutionU;
          const v = (iv + 0.5) / field.resolutionV;
          const valueMm = field.valuesMm[iv * field.resolutionU + iu] ?? 0;
          rows.push({
            componentLabel: entry.componentLabel,
            caseName: caseAssessment.caseName,
            u: Number(u.toFixed(4)),
            v: Number(v.toFixed(4)),
            clockPosition: vToClockPosition(v),
            valueMm: Number(valueMm.toFixed(4)),
          });
        }
      }
    }
  }
  return rows;
}

export interface BuildReportDataOptions {
  entries: AssessmentHistoryEntry[];
  settings: ReportSettings;
  inServiceInspectionPossible: boolean;
  heatmapPngDataUrl: string | null;
  chartPngs: Record<string, string>;
}

export function buildReportData(options: BuildReportDataOptions): ReportData {
  const { entries, settings, inServiceInspectionPossible, heatmapPngDataUrl, chartPngs } = options;

  const components: ReportComponentSection[] = entries.map((entry) => ({
    entry,
    tableRow: deriveTableRow(entry, { inServiceInspectionPossible }),
    materialDetail: deriveMaterialRecommendation(entry, inServiceInspectionPossible),
  }));

  const allCoefficients = listCoefficients();
  const usedIds = collectUsedCoefficientIds(entries);

  return {
    settings,
    generatedAt: new Date(),
    components,
    allCoefficients,
    usedCoefficients: allCoefficients.filter((c) => usedIds.has(c.id)),
    rawTraceRows: buildRawTraceRows(entries),
    spatialGridRows: buildSpatialGridRows(entries),
    heatmapPngDataUrl,
    chartPngs,
  };
}
