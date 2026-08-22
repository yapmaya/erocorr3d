// apps/web/src/features/results/resultsDerivation.ts
//
// Sonuç tablosunun (ve özet kartlarının) satır verisini üretir. Motorun
// ZATEN üretmiş olduğu `ScenarioAssessment`i (bkz. store/
// assessmentHistoryStore.ts) alır, `aggregate/ctlAtl.ts` +
// `aggregate/materialSelection.ts`'i ÇAĞIRIR — yeni bir hesap İCAT ETMEZ.
// Bilerek SAF fonksiyonlardır (store'da SAKLANMAZ) ki türetme mantığı
// değişirse eski geçmiş girdileri "bayatlamasın" (bkz. onaylı plan'ın
// mimari notu).
//
// "Alternatif malzemenin kendi CTL/ATL'i" HESAPLANMAZ (bkz. onaylı plan'ın
// kapsam kararı #3) — motor CRA/alternatif malzemeler için AYRI bir
// korozyon hızı modeli TAŞIMIYOR, yalnızca CS (karbon çelik) modellenmiş.
// İkinci bir sayısal oran UYDURMAK yerine `ctlAtlAlternativeApplicable:
// false` ile bu açıkça işaretlenir.

import {
  computeCtlAtl,
  getUsedUnverified,
  selectPipingMaterial,
  worstConfidence,
  type Coefficient,
  type ConfidenceLevel,
  type CtlAtlResult,
  type MaterialSelectionResult,
  type ScenarioAssessment,
} from "@erocorr3d/engine";
import type { AssessmentHistoryEntry } from "../../store/assessmentHistoryStore";

/**
 * `ScenarioAssessment`'in TÜM senaryolarındaki TÜM mekanizmaların
 * `calculationTrace[].coefficientIds`'ini tekilleştirerek toplar. Bu,
 * "doğrulanmamış katsayı" rozetinin TEK gerçek veri kaynağıdır (bkz.
 * registry/store.ts'in "erişim geçmişi tutmuyor" kısıtı — mekanizma
 * çalıştırıcıları artık her UYGULANAN sonuç için gerçek bir iz bırakıyor,
 * bkz. orchestrate/mechanismRunners.ts::synthesizeSingleStepTrace).
 */
export function collectCoefficientIdsFromAssessment(assessment: ScenarioAssessment): string[] {
  const ids = new Set<string>();
  for (const caseAssessment of assessment.perCase) {
    for (const mechanism of caseAssessment.mechanismResults) {
      for (const step of mechanism.calculationTrace) {
        for (const id of step.coefficientIds) ids.add(id);
      }
    }
  }
  return [...ids];
}

/** Bir değerlendirmede kullanılan, confidence="UNVERIFIED" katsayıları döndürür. */
export function deriveUnverifiedCoefficients(assessment: ScenarioAssessment): Coefficient[] {
  return getUsedUnverified(collectCoefficientIdsFromAssessment(assessment));
}

/**
 * CTL/ATL — `metalLoss.totalServiceLifeCorrosionMm.p50` (CTL) ile taslağın
 * kendi `corrosionAllowanceMm`'i (ATL) üzerinden. Korozyon payı 0 girilmişse
 * (şema buna izin verir, `computeCtlAtl` ise pozitif ister) `null` döner —
 * sahte bir oran UYDURULMAZ.
 */
export function deriveCtlAtl(entry: Pick<AssessmentHistoryEntry, "assessment" | "operatingProfile">): CtlAtlResult | null {
  if (entry.operatingProfile.corrosionAllowanceMm <= 0) return null;
  return computeCtlAtl({
    predictedTotalCorrosionMm: entry.assessment.metalLoss.totalServiceLifeCorrosionMm.p50,
    selectedCorrosionAllowanceMm: entry.operatingProfile.corrosionAllowanceMm,
  });
}

export function deriveMaterialRecommendation(
  entry: { assessment: Pick<ScenarioAssessment, "metalLoss"> },
  inServiceInspectionPossible: boolean,
): MaterialSelectionResult {
  return selectPipingMaterial({
    requiredCorrosionAllowanceMm: entry.assessment.metalLoss.totalServiceLifeCorrosionMm.p50,
    inServiceInspectionPossible,
  });
}

export interface ResultsTableRow {
  entryId: string;
  componentLabel: string;
  /** SLC (Service Life Corrosion), inhibitorUsed=false ZORLANARAK yeniden hesaplanmış, mm (P50). */
  slcUninhibitedMm: number;
  /** SLC, taslakta AYARLANDIĞI HALİYLE — yalnızca inhibitör GERÇEKTEN yapılandırılmışsa dolu, aksi halde `null` ("Girilmedi"). */
  slcInhibitedMm: number | null;
  primaryMaterialTr: string;
  ctlAtl: CtlAtlResult | null;
  alternativeMaterialTr: string | null;
  /** Alternatif malzemenin KENDİ CTL/ATL'i — motor CRA korozyon hızı modellemediği için her zaman false (bkz. dosya başı notu). */
  ctlAtlAlternativeApplicable: false;
  confidence: ConfidenceLevel;
  commentTr: string;
  unverifiedCoefficients: Coefficient[];
  computedAt: number;
}

export interface DeriveTableRowOptions {
  inServiceInspectionPossible: boolean;
}

export function deriveTableRow(entry: AssessmentHistoryEntry, options: DeriveTableRowOptions): ResultsTableRow {
  const ctlAtl = deriveCtlAtl(entry);
  const material = deriveMaterialRecommendation(entry, options.inServiceInspectionPossible);
  const unverifiedCoefficients = deriveUnverifiedCoefficients(entry.assessment);
  const confidenceLevels: ConfidenceLevel[] = [material.confidence];
  if (ctlAtl) confidenceLevels.push(ctlAtl.confidence);

  return {
    entryId: entry.id,
    componentLabel: entry.componentLabel,
    slcUninhibitedMm: entry.uninhibitedAssessment.metalLoss.totalServiceLifeCorrosionMm.p50,
    slcInhibitedMm: entry.mitigation.inhibitorUsed ? entry.assessment.metalLoss.totalServiceLifeCorrosionMm.p50 : null,
    primaryMaterialTr: material.primaryMaterialTr,
    ctlAtl,
    alternativeMaterialTr: material.alternativeMaterialsTr[0] ?? null,
    ctlAtlAlternativeApplicable: false,
    confidence: worstConfidence(confidenceLevels),
    commentTr: material.rationaleTr,
    unverifiedCoefficients,
    computedAt: entry.computedAt,
  };
}
