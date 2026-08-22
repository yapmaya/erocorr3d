// packages/engine/src/orchestrate/assessComponent.ts
//
// Tek bir işletme senaryosu (OperatingCase) için TÜM hasar mekanizmalarını
// çalıştırıp gerçek MechanismResult[] (+ nitel risk bulguları) üreten
// orkestratör — bu projede daha önce hiç kurulmamış olan, corrosion/erosion
// hesap fonksiyonlarını gerçek sonuçlara bağlayan köprü (bkz. spatial/
// index.ts dosya başı yorumu).

import type { Geometry } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import type { OperatingCase } from "../types/operating";
import type { MechanismResult } from "../types/results";
import {
  deriveDryGasAndFreeWater,
  computeSharedInSituPh,
  runAtmosphericExternalMechanism,
  runCo2AndTlcMechanisms,
  runCuiFinding,
  runDropletErosionMechanism,
  runH2sFinding,
  runMicFinding,
  runOxygenFinding,
  runSandErosionMechanism,
  runSynergyMechanism,
  runUdcFinding,
  type AssessComponentOptions,
} from "./mechanismRunners";
import type { QualitativeRiskFinding } from "./types";

// Vana tipleri (ComponentTypeEnum'daki 15 vana) BU orkestratörün kapsamı
// DIŞINDADIR — spatial/valves.ts'in KENDİ bölge-bazlı yerleşimi (erosion/
// valveHydraulics.ts::computeValveZoneDamage üzerinden) tamamen AYRI bir
// mekanizma-çalıştırma modeli gerektirir (bkz. spatial/index.ts'in
// VALVE_COMPONENT_TYPES ayrımı — bu proje henüz merkezi bir "hangi tipler
// vanadır" listesi tutmuyor, her dosya kendi kopyasını taşır). Bu fonksiyon
// bir vana ile çağrılırsa, spatialSignatureRouting.ts'in derinliklerinde
// belirsiz bir hatayla ÇÖKMEK yerine ERKEN ve AÇIK bir hata verir.
const VALVE_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  "GATE_VALVE",
  "GLOBE_VALVE",
  "BALL_VALVE_FULL",
  "BALL_VALVE_REDUCED",
  "BUTTERFLY_VALVE",
  "CHECK_VALVE_SWING",
  "CHECK_VALVE_LIFT",
  "CHECK_VALVE_DUAL_PLATE",
  "PLUG_VALVE",
  "NEEDLE_VALVE",
  "CHOKE_VALVE",
  "CONTROL_VALVE_GLOBE",
  "CONTROL_VALVE_CAGE",
  "PRESSURE_SAFETY_VALVE",
  "RESTRICTION_ORIFICE",
]);

export interface MechanismAssessment {
  mechanismResults: MechanismResult[];
  qualitativeRiskFindings: QualitativeRiskFinding[];
  /** Veri eksikliği nedeniyle DEĞERLENDİRİLEMEYEN mekanizmalar veya yapılan basitleştirici varsayımlar — asla sessizce atlanmaz. */
  assumptionsTr: string[];
}

/**
 * Bir bileşen + azaltma önlemleri + TEK bir işletme senaryosu için, uygulanan
 * TÜM hasar mekanizmalarını çalıştırıp birleşik bir değerlendirme üretir.
 *
 * Kapsam (bu orkestratörün ilk sürümü): sayısal (mm/yıl) mekanizmalar —
 * CO2 (tatlı) korozyonu (+tetiklenirse TLC), kum erozyonu (DNV-RP-O501),
 * damlacık erozyonu (tarama), erozyon-korozyon sinerjisi (opsiyonel),
 * atmosferik dış korozyon (opsiyonel). Nitel (yalnızca risk skoru)
 * mekanizmalar — H2S/SSC, MIC, birikinti altı korozyonu, oksijen korozyonu,
 * (yalıtımlıysa) CUI. Gömülü dış korozyon, galvanik korozyon ve pitting/
 * crevice/CSCC bu sürümde HENÜZ BAĞLANMADI (sırasıyla: toprak/CP verisi,
 * komşu malzeme bilgisi, MaterialSpec bu Geometry/OperatingCase/Mitigation
 * üçlüsünde henüz taşınmıyor) — assumptionsTr bunu açıkça belirtir.
 */
export function runMechanismAssessment(
  component: Geometry,
  mitigation: Mitigation,
  operatingCase: OperatingCase,
  options: AssessComponentOptions = {},
): MechanismAssessment {
  if (VALVE_COMPONENT_TYPES.has(component.componentType)) {
    throw new Error(
      `"${component.componentType}" bir VANA tipidir — runMechanismAssessment bu sürümde yalnızca boru/fitting ` +
        "bileşenlerini destekler (vana mekanizma orkestrasyonu, spatial/valves.ts'in AYRI bölge-bazlı modeliyle " +
        "gelecek bir fazda ele alınmalıdır).",
    );
  }
  const { process } = operatingCase;
  const { isDryGasFlow, freeWaterPresent } = deriveDryGasAndFreeWater(process);
  const sharedInSituPh = freeWaterPresent ? computeSharedInSituPh(operatingCase) : undefined;

  const assumptionsTr: string[] = [];
  const mechanismResults: MechanismResult[] = [];

  const co2AndTlc = runCo2AndTlcMechanisms(component, mitigation, operatingCase, options);
  mechanismResults.push(...co2AndTlc.results);
  assumptionsTr.push(...co2AndTlc.assumptionsTr);

  const sandErosion = runSandErosionMechanism(component, operatingCase);
  mechanismResults.push(sandErosion);

  const dropletErosion = runDropletErosionMechanism(component, operatingCase);
  mechanismResults.push(dropletErosion);

  const co2Result = co2AndTlc.results.find((r) => r.mechanismId === "CO2_SWEET");
  if (co2Result && co2Result.rateP50 > 0 && sandErosion.rateP50 > 0) {
    const synergy = runSynergyMechanism(
      component,
      co2Result.rateP50,
      sandErosion.rateP50,
      co2AndTlc.wallShearStressPa,
      process.mixtureVelocityMs,
      options,
    );
    if (synergy) {
      mechanismResults.push(synergy);
    } else {
      assumptionsTr.push(
        "Erozyon-korozyon sinerjisi DEĞERLENDİRİLMEDİ — synergyReferenceImpactVelocityMs seçeneği " +
          "sağlanmadı (bkz. synergy.ts'in ZORUNLU/uydurulamaz girdi notu).",
      );
    }
  }

  const atmospheric = runAtmosphericExternalMechanism(component, options);
  if (atmospheric) {
    mechanismResults.push(atmospheric);
  } else if (component.installation === "ABOVE_GROUND") {
    assumptionsTr.push(
      "Atmosferik dış korozyon DEĞERLENDİRİLMEDİ — ISO 9223 kategorisi/kıyı mesafesi bilgisi sağlanmadı.",
    );
  }
  if (component.installation === "BURIED") {
    assumptionsTr.push(
      "Gömülü dış korozyon (toprak direnci/katodik koruma) bu orkestratörün ilk sürümünde HENÜZ BAĞLANMADI " +
        "(corrosion/externalEnvironment.ts::assessBuriedExternalRisk mevcut ama girdi olarak toprak/CP verisi " +
        "bu OperatingCase/Mitigation şemasında henüz taşınmıyor).",
    );
  }
  assumptionsTr.push(
    "Galvanik korozyon ve pitting/crevice/CSCC risk değerlendirmeleri bu orkestratörün ilk sürümünde " +
      "BAĞLANMADI — sırasıyla komşu malzeme çifti bilgisi ve MaterialSpec bu Geometry/OperatingCase/" +
      "Mitigation üçlüsünde henüz taşınmıyor.",
  );

  const qualitativeRiskFindings: QualitativeRiskFinding[] = [
    runH2sFinding(operatingCase, sharedInSituPh, freeWaterPresent, options),
    runMicFinding(operatingCase, sharedInSituPh, freeWaterPresent, mitigation, assumptionsTr),
    runUdcFinding(operatingCase, freeWaterPresent),
    runOxygenFinding(operatingCase, freeWaterPresent, isDryGasFlow),
  ];
  if (component.isInsulated) {
    qualitativeRiskFindings.push(runCuiFinding(component, operatingCase, mitigation, options, assumptionsTr));
  }

  return { mechanismResults, qualitativeRiskFindings, assumptionsTr };
}
