// packages/engine/src/spatial/index.ts
//
// spatial/ modülünün giriş noktası: computeDamageField(component, results,
// elapsedYears, resolution) → SpatialDamageField.
//
// Skaler "mm/yıl" hızını bileşen yüzeyinde bir HASAR ALANINA çevirir:
//   damage(u,v) = Σ_mekanizma [ hız_m × süre × f_m(u,v) ]
// Her aktif (isApplicable=true) MechanismResult, KENDİ spatialSignatureId'si
// (types/results.ts'in bizzat bu spatial katman için taşıdığı alan) ile
// pipeFittings.ts'teki (veya vana ise valves.ts'teki) doğru imzaya
// yönlendirilir.
//
// MİMARİ NOT: bu projede henüz corrosion/erosion hesap fonksiyonlarını
// gerçek MechanismResult[] nesnelerine dönüştüren bir "orkestrasyon" katmanı
// YOKTUR (her hesap modülü kendi CorrosionRateResult/ErosionResult/
// RiskScoreResult şeklini döndürür). Bu fonksiyon MechanismResult'ı GİRDİ
// olarak kabul eder ve `governingParameters` bag'inden (zaten şemanın kendi
// "Sonucu belirleyen ana parametreler" alanı) mekansal imzanın ihtiyaç
// duyduğu ek runtime değerlerini (parçacık çapı, sıvı tutulumu, açıklık%
// vb.) okur — hangi anahtarların beklendiği her switch dalında belgelenir.
// Bu köprüyü (hesap sonuçlarını governingParameters'ı dolduracak şekilde
// üretmek) kurmak GELECEK bir oturumun işidir.

import type { ComponentType } from "../types/enums";
import type { Geometry } from "../types/geometry";
import type { MechanismResult, SpatialDamageField } from "../types/results";
import { DamageField, type DamageContribution, type DamageShapeFn } from "./fields";
import {
  buildBendIntradosSecondaryShape,
  buildBlcStratifiedShape,
  buildCuiExternalBandsShape,
  buildDeadlegStagnantShape,
  buildElbowExtradosImpingementShape,
  buildMicBottomPatchyShape,
  buildOrificeDownstreamJetShape,
  buildReducerThroatDownstreamShape,
  buildTeeBlindImpactShape,
  buildTeeBranchSharpEdgeShape,
  buildTlcCondensationShape,
  buildUdcSedimentBedShape,
  buildUniformFullBoreShape,
  buildWeldRootTurbulenceShape,
  getBendIntradosSecondaryRelativeSeverity,
  type PipeFittingSignatureId,
} from "./pipeFittings";
import { computeValveDamageField } from "./valves";

export * from "./fields";
export * from "./pipeFittings";
export * from "./valves";
export * from "./flowFieldLite";
export * from "./sampling";
export * from "./timeScaling";

// data/valveCatalog.ts'in kapsadığı 15 vana tipiyle BİREBİR aynı liste (bkz. o dosyanın
// ComponentTypeEnum'daki 15 vana tipi üzerinden kurduğu katalog) — tek bir yerde YİNELENMEDEN
// tutmak için ayrı bir "hangi tipler vanadır" listesi bu projede henüz merkezi değil; burada
// spatial/valves.ts'e YÖNLENDİRME kararı için gereken TEK kopyadır.
const VALVE_COMPONENT_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
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

export interface DamageFieldResolution {
  resolutionU: number;
  resolutionV: number;
}

const DEFAULT_RESOLUTION: DamageFieldResolution = { resolutionU: 96, resolutionV: 64 };
const DEFAULT_OPENING_PERCENT = 100;

function isPipeFittingSignatureId(id: string): id is PipeFittingSignatureId {
  return [
    "BLC_STRATIFIED",
    "TLC_CONDENSATION",
    "UNIFORM_FULL_BORE",
    "ELBOW_EXTRADOS_IMPINGEMENT",
    "BEND_INTRADOS_SECONDARY",
    "TEE_BLIND_IMPACT",
    "TEE_BRANCH_SHARP_EDGE",
    "REDUCER_THROAT_DOWNSTREAM",
    "WELD_ROOT_TURBULENCE",
    "DEADLEG_STAGNANT",
    "ORIFICE_DOWNSTREAM_JET",
    "MIC_BOTTOM_PATCHY",
    "UDC_SEDIMENT_BED",
    "CUI_EXTERNAL_BANDS",
  ].includes(id);
}

/**
 * Bir imza kimliğini, bileşen geometrisi ve mekanizma sonucunun
 * `governingParameters` bag'ini kullanarak somut bir DamageShapeFn'e
 * çevirir. Her dal, beklediği governingParameters anahtarlarını yorumda
 * belgeler; anahtar YOKSA fiziksel olarak makul bir varsayılan kullanılır
 * (her imza fonksiyonunun kendi JSDoc'unda belgelendiği gibi).
 */
function buildPipeFittingShape(
  signatureId: PipeFittingSignatureId,
  component: Geometry,
  governingParameters: Record<string, number>,
): DamageShapeFn {
  switch (signatureId) {
    case "BLC_STRATIFIED":
      // beklenen: governingParameters.liquidHoldupFraction
      return buildBlcStratifiedShape({ liquidHoldupFraction: governingParameters.liquidHoldupFraction ?? 0.3 });
    case "TLC_CONDENSATION":
      return buildTlcCondensationShape({
        peakAxialFraction: governingParameters.tlcPeakAxialFraction,
        axialSigmaFraction: governingParameters.tlcAxialSigmaFraction,
      });
    case "UNIFORM_FULL_BORE":
      return buildUniformFullBoreShape();
    case "ELBOW_EXTRADOS_IMPINGEMENT":
      // beklenen: component.bendRadiusRatio (Geometry'den), opsiyonel governingParameters.particleDiameterM
      return buildElbowExtradosImpingementShape({
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
        particleDiameterM: governingParameters.particleDiameterM,
        pipeIdM: component.idMm / 1000,
      });
    case "BEND_INTRADOS_SECONDARY":
      return buildBendIntradosSecondaryShape({
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
      });
    case "TEE_BLIND_IMPACT":
      return buildTeeBlindImpactShape();
    case "TEE_BRANCH_SHARP_EDGE":
      return buildTeeBranchSharpEdgeShape({ branchAxialFraction: governingParameters.branchAxialFraction });
    case "REDUCER_THROAT_DOWNSTREAM":
      return buildReducerThroatDownstreamShape({ throatAxialFraction: governingParameters.throatAxialFraction });
    case "WELD_ROOT_TURBULENCE":
      return buildWeldRootTurbulenceShape({ weldAxialFraction: governingParameters.weldAxialFraction });
    case "DEADLEG_STAGNANT":
      return buildDeadlegStagnantShape();
    case "ORIFICE_DOWNSTREAM_JET":
      return buildOrificeDownstreamJetShape({ orificeAxialFraction: governingParameters.orificeAxialFraction });
    case "MIC_BOTTOM_PATCHY":
      return buildMicBottomPatchyShape({ seed: governingParameters.micPatchSeed });
    case "UDC_SEDIMENT_BED":
      return buildUdcSedimentBedShape();
    case "CUI_EXTERNAL_BANDS":
      return buildCuiExternalBandsShape();
  }
}

/**
 * Bir bileşenin yüzeyi üzerindeki uzamsal (3B) hasar dağılımını hesaplar —
 * "hasar nerede" sorusunun matematiksel cevabı.
 *
 * Vana tipleri (ComponentTypeEnum'daki 15 vana): spatial/valves.ts'in bölge-
 * bazlı yerleşimine devredilir (results[0]'ın P50 hızı taban hız olarak
 * kullanılır — birden fazla mekanizma varsa TOPLAMLARI; governingParameters.openingPercent
 * varsa kullanılır, yoksa %100/tam açık varsayılır).
 *
 * Boru/fitting tipleri: her AKTİF (isApplicable=true) sonucun
 * spatialSignatureId'si pipeFittings.ts'teki karşılığına yönlendirilir ve
 * DamageField'a hız×süre ile biriktirilir (bkz. fields.ts::DamageField.accumulate).
 * Tanınmayan/haritalanmamış bir spatialSignatureId SESSİZCE atlanmaz —
 * hata fırlatılır (bkz. testler).
 */
export function computeDamageField(
  component: Geometry,
  results: MechanismResult[],
  elapsedYears: number,
  resolution: DamageFieldResolution = DEFAULT_RESOLUTION,
): SpatialDamageField {
  if (elapsedYears < 0) {
    throw new Error("elapsedYears negatif olamaz.");
  }

  const applicableResults = results.filter((r) => r.isApplicable);

  if (VALVE_COMPONENT_TYPES.has(component.componentType)) {
    const totalRateP50 = applicableResults.reduce((sum, r) => sum + r.rateP50, 0);
    const totalRateP10 = applicableResults.reduce((sum, r) => sum + r.rateP10, 0);
    const totalRateP90 = applicableResults.reduce((sum, r) => sum + r.rateP90, 0);
    const openingPercent = applicableResults[0]?.governingParameters.openingPercent ?? DEFAULT_OPENING_PERCENT;
    return computeValveDamageField(
      component.componentType,
      { p10: totalRateP10, p50: totalRateP50, p90: totalRateP90 },
      elapsedYears,
      openingPercent,
      resolution,
    );
  }

  const field = new DamageField(resolution.resolutionU, resolution.resolutionV, "CYLINDRICAL_UV");
  const contributions: DamageContribution[] = [];

  for (const result of applicableResults) {
    const signatureId = result.spatialSignatureId;
    if (!isPipeFittingSignatureId(signatureId)) {
      throw new Error(
        `"${result.mechanismId}" sonucunun spatialSignatureId'si ("${signatureId}") tanınan bir boru/fitting ` +
          "imzası değil — spatial/pipeFittings.ts'e eklenmeli veya sonuç yanlış yapılandırılmış.",
      );
    }
    const shapeFn = buildPipeFittingShape(signatureId, component, result.governingParameters);
    contributions.push({ mechanismId: result.mechanismId, shapeFn, rateMmPerYear: result.rateP50 });

    if (signatureId === "ELBOW_EXTRADOS_IMPINGEMENT") {
      // Dean-vorteksi ikincil bölgesi, extrados sonucunun KÜÇÜK bir kesri olarak AYRI bir katkı — bkz.
      // pipeFittings.ts::getBendIntradosSecondaryRelativeSeverity notu.
      const secondaryShape = buildBendIntradosSecondaryShape({
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
      });
      contributions.push({
        mechanismId: `${result.mechanismId}.intradosSecondary`,
        shapeFn: secondaryShape,
        rateMmPerYear: result.rateP50 * getBendIntradosSecondaryRelativeSeverity(),
      });
    }
  }

  field.accumulate(contributions, elapsedYears);
  return field.toSpatialDamageField();
}
