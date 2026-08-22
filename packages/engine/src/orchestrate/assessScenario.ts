// packages/engine/src/orchestrate/assessScenario.ts
//
// assessComponent.ts'in TEK senaryo değerlendirmesini, bir bileşenin TÜM
// işletme profili (OperatingProfile — birden fazla OperatingCase) üzerinden
// birleştirir: her senaryo için gerçek MechanismResult[] → computeDamageField
// (spatial/index.ts, ZATEN var olan ısı-haritası üretici) → SpatialDamageField,
// artı tüm senaryoların birleşik toplam metal kaybı (aggregate/metalLoss.ts).
//
// Bu, projenin daha önce açık bıraktığı "MechanismResult[]→SpatialDamageField
// üretim/orkestrasyon katmanı" boşluğunu UÇTAN UCA kapatan giriş noktasıdır:
// artık viewer3d, sentetik demo veri yerine BU fonksiyonun ürettiği GERÇEK
// hesaplanmış SpatialDamageField'ı tüketebilir.

import { computeDamageField, type DamageFieldResolution } from "../spatial/index";
import { computeTotalMetalLoss, type MetalLossScenario } from "../aggregate/metalLoss";
import type { Geometry } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import type { OperatingProfile } from "../types/operating";
import { runMechanismAssessment } from "./assessComponent";
import type { AssessComponentOptions } from "./mechanismRunners";
import type { CaseAssessment, ScenarioAssessment } from "./types";

/**
 * Bir bileşen + azaltma önlemleri + TÜM işletme profili için birleşik
 * değerlendirme üretir: her senaryonun kendi gerçek SpatialDamageField'ı
 * (tasarım ömrünün TAMAMI kadar biriktirilmiş) VE senaryolar arası
 * birleşik toplam metal kaybı (kısmi çalışma düzeltmesi dahil — bkz.
 * aggregate/metalLoss.ts, corrosion/rules.ts::applyPartialOperationFactor).
 *
 * Her CaseAssessment.spatialDamageFieldFullLife, viewer3d'nin zaman
 * kaydırıcısı için YETERLİ değildir tek başına — zaman kaydırıcısı ARA bir
 * yıl için alan istediğinde çağıran taraf computeDamageField'ı (bu fonksiyonun
 * kendisinin de kullandığı, spatial/index.ts'ten re-export edilen) aynı
 * mechanismResults ile FARKLI bir elapsedYears değeriyle tekrar çağırmalıdır
 * (bkz. apps/web/src/features/viewer3d/botas/botasFieldSampling.ts).
 */
export function assessComponentScenario(
  component: Geometry,
  mitigation: Mitigation,
  operatingProfile: OperatingProfile,
  options: AssessComponentOptions = {},
  componentLabel: string = component.componentType,
  resolution?: DamageFieldResolution,
): ScenarioAssessment {
  const perCase: CaseAssessment[] = operatingProfile.cases.map((operatingCase) => {
    const assessment = runMechanismAssessment(component, mitigation, operatingCase, options);
    const spatialDamageFieldFullLife = computeDamageField(
      component,
      assessment.mechanismResults,
      operatingProfile.designLifeYears,
      resolution,
    );
    return {
      caseName: operatingCase.name,
      mechanismResults: assessment.mechanismResults,
      qualitativeRiskFindings: assessment.qualitativeRiskFindings,
      spatialDamageFieldFullLife,
      assumptionsTr: assessment.assumptionsTr,
    };
  });

  const metalLossScenarios: MetalLossScenario[] = perCase.map((caseAssessment, index) => {
    const totalRateP10 = caseAssessment.mechanismResults
      .filter((r) => r.isApplicable)
      .reduce((sum, r) => sum + r.rateP10, 0);
    const totalRateP50 = caseAssessment.mechanismResults
      .filter((r) => r.isApplicable)
      .reduce((sum, r) => sum + r.rateP50, 0);
    const totalRateP90 = caseAssessment.mechanismResults
      .filter((r) => r.isApplicable)
      .reduce((sum, r) => sum + r.rateP90, 0);
    return {
      scenarioNameTr: caseAssessment.caseName,
      operatingDaysPerYear: operatingProfile.cases[index].durationDaysPerYear,
      rateMmPerYear: { p10: totalRateP10, p50: totalRateP50, p90: totalRateP90 },
    };
  });

  const metalLoss = computeTotalMetalLoss(metalLossScenarios, operatingProfile.designLifeYears);

  return {
    componentLabel,
    perCase,
    metalLoss,
    governingCaseName: metalLoss.governingScenarioNameTr,
  };
}
