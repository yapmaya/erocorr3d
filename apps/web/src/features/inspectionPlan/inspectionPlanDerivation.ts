// apps/web/src/features/inspectionPlan/inspectionPlanDerivation.ts
//
// Muayene Planı sekmesinin TEK türetme kaynağı — `resultsDerivation.ts`'in
// AYNI ilkesi: motorun ZATEN üretmiş olduğu `ScenarioAssessment`i (bkz.
// store/assessmentHistoryStore.ts) alır, `@erocorr3d/engine`'in aggregate/
// fonksiyonlarını (selectCriticalMonitoringPoints, computeInspectionInterval,
// buildRbiLiteRiskMatrix, recommendMitigations, compareLifecycleCost) ÇAĞIRIR
// — yeni bir hesap İCAT ETMEZ. Bilerek SAF fonksiyonlardır (store'da
// SAKLANMAZ).

import {
  buildRbiLiteRiskMatrix,
  computeAsmeB318DesignWallThickness,
  computeInspectionInterval,
  getMaterial,
  getPipeGrade,
  mapConsequenceLevelToApi570PipingClass,
  recommendMitigations,
  selectCriticalMonitoringPoints,
  compareLifecycleCost,
  type CriticalMonitoringPointsResult,
  type InspectionIntervalResult,
  type LifecycleCostAssumptions,
  type LifecycleCostComparisonResult,
  type MitigationRecommendationsResult,
  type OperatingCase,
  type RbiLiteRiskMatrixResult,
} from "@erocorr3d/engine";
import type { AssessmentHistoryEntry } from "../../store/assessmentHistoryStore";
import { DEFAULT_PIPE_GRADE_ID } from "../viewer2d/dataSource";
import { deriveCtlAtl } from "../results/resultsDerivation";

const PA_PER_BAR = 1e5; // tanımsal SI önek dönüşümü — dataSource.ts/mechanismRunners.ts ile AYNI kullanım, KDP kapsamı dışı.

/** CS malzeme referansı — aggregate/materialSelection.ts'in KENDİ CS baseline id'siyle AYNI (relativeCostIndex=1.0). */
const CS_MATERIAL_ID = "cs-a106-grb";
/** "CRA'ya geçiş" seçeneğinin temsili malzemesi — aggregate/materialSelection.ts'in kendi CRA-yükseltme baseline'ıyla (316L) AYNI. */
const CRA_MATERIAL_ID = "ss-316-316l";

function findGoverningOperatingCase(entry: AssessmentHistoryEntry): OperatingCase {
  return (
    entry.operatingProfile.cases.find((c) => c.name === entry.assessment.governingCaseName) ??
    entry.operatingProfile.cases[0]
  );
}

function findGoverningCaseAssessment(entry: AssessmentHistoryEntry) {
  const found = entry.assessment.perCase.find((c) => c.caseName === entry.assessment.governingCaseName);
  if (!found) {
    throw new Error(`Belirleyici senaryo ("${entry.assessment.governingCaseName}") perCase içinde bulunamadı.`);
  }
  return found;
}

export interface InspectionPlanBundle {
  cmp: CriticalMonitoringPointsResult;
  riskMatrix: RbiLiteRiskMatrixResult;
  inspectionInterval: InspectionIntervalResult;
  mitigations: MitigationRecommendationsResult;
}

/**
 * Muayene Planı sekmesinin dört bölümünü (CMP, risk matrisi, muayene
 * aralığı, azaltma önerileri) birlikte türetir — RBI-lite sonuç skoru HEM
 * risk matrisinde HEM API 570 Piping Class türetiminde (muayene aralığı
 * tavanı için) kullanıldığından, iki modülün TUTARLI aynı girdilerle
 * çağrılabilmesi için tek bir fonksiyonda birleştirilir.
 *
 * @param yearsInService Bileşenin BUGÜNE kadar (asOfDate itibarıyla) kaç yıl
 * işletmede olduğu — motorun geri kalanı bunu taşımaz (ScenarioAssessment
 * her zaman t=0'dan tasarım ömrü sonuna kadar hesaplanır), bu yüzden
 * Muayene Planı'na özgü bir girdi olarak burada alınır (varsayılan 0 = yeni
 * bileşen).
 */
export function deriveInspectionPlanBundle(entry: AssessmentHistoryEntry, asOfDate: Date, yearsInService = 0): InspectionPlanBundle {
  const cmp = selectCriticalMonitoringPoints(entry.assessment, entry.geometry, 5);

  const governingOperatingCase = findGoverningOperatingCase(entry);
  const governingCaseAssessment = findGoverningCaseAssessment(entry);
  const h2sFinding = governingCaseAssessment.qualitativeRiskFindings.find((f) => f.mechanismId === "H2S_SOUR");

  const ctlAtl = deriveCtlAtl(entry);
  const likelihoodCategory = ctlAtl?.category ?? "MEDIUM";

  const riskMatrix = buildRbiLiteRiskMatrix(likelihoodCategory, {
    h2sRiskLevel: h2sFinding?.isMechanismActive ? h2sFinding.riskLevel : null,
    governingPressureBara: governingOperatingCase.process.pressureBara,
    locationClass: entry.geometry.locationClass,
    environmentalSensitivity: entry.geometry.environmentalSensitivity,
  });

  const grade = getPipeGrade(DEFAULT_PIPE_GRADE_ID);
  const tMinResult = computeAsmeB318DesignWallThickness(
    governingOperatingCase.process.pressureBara * PA_PER_BAR,
    entry.geometry.odMm / 1000,
    grade.smysPa,
    entry.geometry.locationClass,
    governingOperatingCase.process.temperatureC,
    entry.operatingProfile.corrosionAllowanceMm / 1000,
  );
  const tMinMm = tMinResult.designWallThicknessM * 1000;
  const elapsedLossMm = entry.assessment.metalLoss.totalAnnualLossMmPerYear.p50 * yearsInService;
  const currentWallMarginMm = entry.geometry.wallThicknessMm - elapsedLossMm - tMinMm;

  const inspectionInterval = computeInspectionInterval({
    currentWallMarginMm,
    annualLossRateMmPerYear: entry.assessment.metalLoss.totalAnnualLossMmPerYear,
    api570PipingClass: mapConsequenceLevelToApi570PipingClass(riskMatrix.consequence.level),
    ctlAtlCategory: ctlAtl?.category ?? null,
    asOfDate,
  });

  const mitigations = recommendMitigations(entry.assessment, entry.mitigation);

  return { cmp, riskMatrix, inspectionInterval, mitigations };
}

/**
 * CRA'ya geçiş vs CS+inhibitör+izleme yaşam döngüsü maliyet karşılaştırması
 * (master görev madde 5). CRA'nın KENDİ muayene aralığı bu motorda AYRICA
 * modellenmedi (motor CRA için ayrı bir korozyon hızı taşımıyor — bkz.
 * resultsDerivation.ts'in "ctlAtlAlternativeApplicable: false" notu ile AYNI
 * kısıt) — bu yüzden CRA seçeneği de CS ile AYNI (muhafazakâr YÖNDE, gerçekte
 * CRA genellikle DAHA UZUN aralığa izin verir, düşük tahmin değil) muayene
 * aralığını kullanır.
 */
export function deriveLifecycleCostComparison(
  inspectionIntervalYears: number,
  assumptionOverrides?: Partial<LifecycleCostAssumptions>,
): LifecycleCostComparisonResult {
  const csMaterial = getMaterial(CS_MATERIAL_ID);
  const craMaterial = getMaterial(CRA_MATERIAL_ID);

  return compareLifecycleCost(
    [
      {
        labelTr: `Karbon Çelik (CS, ${csMaterial.displayNameTr}) + İnhibitör + İzleme`,
        relativeCapexCostIndex: csMaterial.relativeCostIndex,
        inhibitorUsed: true,
        continuousMonitoringApplied: true,
        inspectionIntervalYears,
      },
      {
        labelTr: `CRA'ya Geçiş (${craMaterial.displayNameTr})`,
        relativeCapexCostIndex: craMaterial.relativeCostIndex,
        inhibitorUsed: false,
        continuousMonitoringApplied: false,
        inspectionIntervalYears,
      },
    ],
    assumptionOverrides,
  );
}
