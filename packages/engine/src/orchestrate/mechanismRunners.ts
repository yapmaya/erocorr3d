// packages/engine/src/orchestrate/mechanismRunners.ts
//
// Tek bir (Geometry, Mitigation, OperatingCase) üçlüsü için, TEK bir hasar
// mekanizmasını gerçek hesap fonksiyonuna (corrosion/*, erosion/*) bağlayıp
// bir MechanismResult (sayısal mm/yıl) ya da QualitativeRiskFinding (yalnızca
// risk skoru) üreten çalıştırıcılar. assessComponent.ts bunları bir araya
// getirir.
//
// TASARIM KARARI — hangi mekanizmalar mm/yıl üretir: yalnızca gerçekten
// sayısal bir CorrosionRateResult/ErosionResult döndüren mekanizmalar
// (CO2_SWEET, TOP_OF_LINE, EROSION_SAND, EROSION_DROPLET,
// EROSION_CORROSION_SYNERGY, ATMOSPHERIC_MARINE) ısı haritasına
// (SpatialDamageField) katılır. Geri kalanı (H2S/MIC/UDC/OXYGEN/CUI/gömülü
// dış korozyon) yalnızca bir RiskScoreResult üretir — KDP'nin "uydurma yok"
// ilkesi gereği bu risk skorları bir mm/yıl değerine ZORLANMAZ (bkz.
// orchestrate/types.ts::QualitativeRiskFinding).
//
// UYDURULMAYAN, ÇAĞIRAN TARAFTAN GELMESİ GEREKEN girdiler (AssessComponentOptions
// ile opsiyonel — sağlanmazsa ilgili mekanizma HESAPLANMAZ, sessizce
// atlanmaz, assumptionsTr'ye not düşülür): TLC'nin U₀ genel ısı transfer
// katsayısı, sinerjinin referans çarpma hızı, atmosferik dış korozyonun
// ISO 9223 kategorisi/kıyı mesafesi — bunların hiçbiri literatürde jenerik
// bir "varsayılan" değere sahip değildir (bkz. ilgili modüllerin kendi
// JSDoc'ları), bu yüzden bu orkestratör bunları İCAT ETMEZ.

import { getMechanism } from "../data/mechanisms";
import type { Geometry } from "../types/geometry";
import type { Mitigation } from "../types/mitigation";
import type { OperatingCase } from "../types/operating";
import type { ProcessConditions } from "../types/process";
import type { MechanismResult, TraceStep } from "../types/results";
import type { DnvMaterialClass } from "../registry/coefficients/dnvO501";
import type { Iso9223Category } from "../registry/coefficients/externalEnvironment";
import type { CuiMaterialFamily } from "../corrosion/cui";
import type { WaterType } from "../corrosion/mic";
import type { ErosionResult } from "../erosion/types";

import { isDryGas } from "../corrosion/rules";
import { selectCo2Model } from "../corrosion/modelRouter";
import { buildNorsokM506InputFromCase, computeNorsokM506Rate } from "../corrosion/norsokM506";
import { computeDeWaardRate } from "../corrosion/deWaard";
import { computeTlcRate } from "../corrosion/tlc";
import { computeCo2Fugacity } from "../corrosion/norsok";
import { computeNorsokInSituPh } from "../corrosion/norsokPh";
import { assessH2sSourRisk } from "../corrosion/h2s";
import { assessMicRisk } from "../corrosion/mic";
import { assessUnderDepositRisk } from "../corrosion/udc";
import { assessOxygenCorrosionRisk } from "../corrosion/o2";
import { assessCuiRisk } from "../corrosion/cui";
import { assessAtmosphericExternalRisk } from "../corrosion/externalEnvironment";
import type { RiskScoreResult } from "../corrosion/types";

import { selectDnvErosionModel } from "../erosion/index";
import {
  computeBendErosionRate,
  computeBlindTeeErosionRate,
  computeChokeValveErosionRate,
  computeDnvO501ErosionRate,
  computeDownstreamWeldErosionRate,
  computeMiterBendErosionRate,
  computeReducerErosionRate,
  computeRestrictionOrificeErosionRate,
  computeStraightPipeErosionRate,
  computeTeeBranchErosionRate,
  computeWeldReinforcementErosionRate,
} from "../erosion/dnvO501";
import { assessDropletErosionRisk } from "../erosion/dropletErosion";

import { computeMixtureViscosityPaS } from "../fluids/mixtureProperties";
import { computeFrictionFactor, computeReynoldsNumber, computeWallShearStressPa } from "../fluids/friction";

import { computeSynergy } from "../synergy/synergy";

import { resolvePipeFittingSpatialSignature, type SpatialRoutingResult } from "./spatialSignatureRouting";
import { resolveSourceCitations, toMechanismConfidence, type QualitativeRiskFinding } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Paylaşılan yardımcılar
// ─────────────────────────────────────────────────────────────────────────

/** Çelik yoğunluğu — malzeme bilgisi verilmediğinde kullanılan fiziksel sabit (KDP kapsamı dışı, su yoğunluğu gibi tanımsal bir madde özelliği). */
const STEEL_DENSITY_KG_M3 = 7850;
/** Erozyon hedef malzeme sınıfı — malzeme seçimi bilgisi verilmediğinde varsayılan (bkz. registry/coefficients/dnvO501.ts::DnvMaterialClass). */
const DEFAULT_MATERIAL_CLASS: DnvMaterialClass = "CS";

export interface AtmosphericContext {
  knownIso9223Category?: Iso9223Category;
  distanceFromCoastKm?: number;
  coatingPresent: boolean;
  coatingConditionGood?: boolean;
}

export interface AssessComponentOptions {
  /** TLC'nin genel ısı transfer katsayısı U₀ (W/(m²·K)) — verilmezse TLC tetiklense bile HESAPLANMAZ (uydurulmaz, bkz. tlc.ts'in kendi notu). */
  overallHeatTransferCoefficientWm2K?: number;
  /** Erozyon-korozyon sinerjisi için referans çarpma hızı (m/s) — verilmezse sinerji HESAPLANMAZ (bkz. synergy.ts'in kendi ZORUNLU/uydurulamaz girdi notu). */
  synergyReferenceImpactVelocityMs?: number;
  /** Atmosferik dış korozyon bağlamı — verilmezse ABOVE_GROUND bileşenlerde dahi bu mekanizma ATLANIR. */
  atmosphericContext?: AtmosphericContext;
  /** Malzeme sertliği (HRC) — H2S/SSC sertlik uygunluğu değerlendirmesi için. */
  materialHardnessHrc?: number;
  /** CUI değerlendirmesi için malzeme ailesi — verilmezse CARBON_STEEL varsayılır (dokümante edilir). */
  cuiMaterialFamily?: CuiMaterialFamily;
}

function deriveDryGasAndFreeWater(process: ProcessConditions): { isDryGasFlow: boolean; freeWaterPresent: boolean } {
  const isDryGasFlow = isDryGas(process.temperatureC, process.waterDewpointC);
  return { isDryGasFlow, freeWaterPresent: !isDryGasFlow && process.isFreeWaterPresent };
}

/**
 * Bu senaryo için TEK, paylaşılan bir toplu (bulk) in-situ pH tahmini
 * hesaplar — CO2 modeli VE H2S risk değerlendirmesi AYNI pH'ı kullanır
 * (birbirinden hafifçe farklı, tutarsız birden fazla pH tahmini üretmek
 * yerine tek bir kaynak). Ölçülmüş bir pH varsa (chemistry.phMeasured) o
 * TERCİH edilir; yoksa NORSOK'un pH alt-modülü (norsokPh.ts, ⚠K1/K2
 * UNVERIFIED, bkz. o dosya) ile hesaplanır.
 */
function computeSharedInSituPh(operatingCase: OperatingCase): number | undefined {
  const { process, chemistry } = operatingCase;
  if (chemistry.phMeasured !== undefined) {
    return chemistry.phMeasured;
  }
  if (chemistry.co2MolePercent <= 0) {
    return undefined;
  }
  const temperatureK = process.temperatureC + 273.15;
  const totalPressureBar = process.pressureBara;
  const co2PartialPressureBar = (chemistry.co2MolePercent / 100) * totalPressureBar;
  const co2FugacityBar = computeCo2Fugacity(co2PartialPressureBar, totalPressureBar, temperatureK);
  const result = computeNorsokInSituPh({
    temperatureK,
    totalPressurePa: totalPressureBar * 1e5,
    co2FugacityPa: co2FugacityBar * 1e5,
    bicarbonateMgL: chemistry.bicarbonateMgL,
    organicAcidMgL: chemistry.aceticAcidMgL,
    chlorideMgL: chemistry.chlorideMgL,
    isWaterFeSaturated: chemistry.isWaterFeSaturated,
  });
  // norsokPh.ts'in K1/K2 UNVERIFIED denge sabitleri, çok düşük bikarbonat/yüksek
  // CO2 kombinasyonlarında matematiksel olarak [0,14] ARALIĞI DIŞINA taşabilir
  // (fiziksel olarak anlamsız) — bu değer yalnızca NİTEL (H2S/MIC risk skoru)
  // kullanım içindir, gösterim amaçlı [0,14]'e KIRPILIR. CO2 hız modelleri
  // (NORSOK M-506/de Waard) BU kırpılmış tahmini KULLANMAZ — kendi güvenli
  // dahili pH hesabını (ham girdilerden, Zod doğrulamalı) kendileri yapar
  // (bkz. runCo2AndTlcMechanisms — pH asla dışarıdan zorlanmaz).
  return Math.min(14, Math.max(0, result.pH));
}

/**
 * Boru duvarı kayma gerilmesini bu senaryonun akış koşullarından hesaplar —
 * akış yoksa (Vm=0) 0 döner (Reynolds tanımsız olurdu). NORSOK M-506 ve
 * de Waard dalları AYNI değeri paylaşır (bkz. aşağıdaki iki çağrı yeri).
 * Dışa aktarılır — `features/results/` (apps/web) Tornado/Monte Carlo
 * sarmalayıcıları GERÇEK motor girdisini üretmek için bunu DOĞRUDAN
 * çağırır, kendi kopyasını İCAT ETMEZ.
 */
function computeSharedWallShearStressPa(component: Geometry, process: ProcessConditions): number {
  if (process.mixtureVelocityMs <= 0) return 0;
  const diameterM = component.idMm / 1000;
  const mixtureViscosityPaS = computeMixtureViscosityPaS(
    process.liquidHoldupFraction,
    process.liquidViscosityPaS,
    process.gasViscosityPaS,
  );
  const reynoldsNumber = computeReynoldsNumber(process.mixtureDensityKgM3, process.mixtureVelocityMs, diameterM, mixtureViscosityPaS);
  const relativeRoughness = component.roughnessMm / 1000 / diameterM;
  const friction = computeFrictionFactor({ reynoldsNumber, relativeRoughness });
  return computeWallShearStressPa(friction.frictionFactor, process.mixtureDensityKgM3, process.mixtureVelocityMs);
}

/**
 * Bir mekanizma çalıştırıcısının ZATEN elinde bulundurduğu (ama şimdiye
 * kadar `calculationTrace: []` bırakılarak atılan) `sourcesUsed`/`modelUsed`/
 * hız verisinden TEK ADIMLIK gerçek bir `TraceStep` üretir — yeni bir
 * hesap/katsayı İCAT ETMEZ, yalnızca zaten hesaplanmış olanı izlenebilir
 * kılar. Bu, satır bazlı "doğrulanmamış katsayı kullanıldı" rozetinin
 * (bkz. features/results/, apps/web) YANLIŞ NEGATİF vermemesi için gerekli
 * — `MechanismResult.calculationTrace[].coefficientIds` bu rozetin TEK
 * güvenilir kaynağıdır (bkz. registry/store.ts'in "erişim geçmişi tutmuyor"
 * kısıtı). Mekanizma gerçekten UYGULANMADIYSA (bkz.
 * `buildZeroRateMechanismResult`) bilerek KULLANILMAZ — orada hesaplanan
 * hiçbir şey yoktur, sahte bir adım eklemek yanıltıcı olurdu.
 */
function synthesizeSingleStepTrace(params: {
  modelUsed: string;
  outputMmPerYear: number;
  coefficientIds: string[];
  inputs: Record<string, number>;
}): TraceStep[] {
  return [
    {
      stepName: "Hesap",
      formula: params.modelUsed,
      inputs: params.inputs,
      output: params.outputMmPerYear,
      unit: "mm/yıl",
      coefficientIds: params.coefficientIds,
    },
  ];
}

function buildZeroRateMechanismResult(params: {
  mechanismId: string;
  reasonTr: string;
  routing: SpatialRoutingResult;
}): MechanismResult {
  const catalog = getMechanism(params.mechanismId);
  return {
    mechanismId: params.mechanismId,
    nameTr: catalog.nameTr,
    nameEn: catalog.nameEn,
    rateMmPerYear: 0,
    rateP10: 0,
    rateP50: 0,
    rateP90: 0,
    isApplicable: false,
    confidence: "HIGH",
    modelUsed: "-",
    sourceRefs: [],
    validityWarnings: [params.reasonTr],
    governingParameters: params.routing.governingParameters,
    spatialSignatureId: params.routing.signatureId,
    calculationTrace: [],
  };
}

function toQualitativeFinding(mechanismId: string, risk: RiskScoreResult): QualitativeRiskFinding {
  const catalog = getMechanism(mechanismId);
  const rationaleTr =
    risk.factorContributions.length > 0
      ? risk.factorContributions
          .map((f) => `${f.factorTr} (${f.points >= 0 ? "+" : ""}${f.points} puan): ${f.rationaleTr}`)
          .join(" ")
      : risk.disclaimer;
  return {
    mechanismId,
    nameTr: catalog.nameTr,
    isMechanismActive: risk.isMechanismActive,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    rationaleTr,
    sourceRefs: resolveSourceCitations(risk.sourcesUsed),
    confidence: toMechanismConfidence(risk.confidence),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CO2 + TLC (birincil iç korozyon çifti)
// ─────────────────────────────────────────────────────────────────────────

export interface Co2AndTlcRunnerResult {
  results: MechanismResult[];
  wallShearStressPa: number;
  assumptionsTr: string[];
}

/**
 * CO2 (tatlı) korozyonu + (tetiklenirse) hat üstü korozyonu (TLC) sonuçlarını
 * üretir. Model seçimi corrosion/modelRouter.ts::selectCo2Model'e (kuru gaz/
 * serbest su/stratifiye+sıcak kararı) AYNEN devredilir — burada TEKRAR
 * EDİLMEZ.
 */
export function runCo2AndTlcMechanisms(
  component: Geometry,
  mitigation: Mitigation,
  operatingCase: OperatingCase,
  options: AssessComponentOptions,
): Co2AndTlcRunnerResult {
  const { process, chemistry } = operatingCase;
  const assumptionsTr: string[] = [];
  const decision = selectCo2Model({
    temperatureC: process.temperatureC,
    waterDewpointC: process.waterDewpointC,
    ambientTemperatureC: process.ambientTemperatureC,
    isFreeWaterPresent: process.isFreeWaterPresent,
    waterCutPercent: process.waterCutPercent,
    flowRegime: process.flowRegime,
  });

  const spatialCtx = { liquidHoldupFraction: process.liquidHoldupFraction, flowRegime: process.flowRegime };
  const results: MechanismResult[] = [];

  if (decision.primaryModel === "NONE_DRY_GAS") {
    const routing = resolvePipeFittingSpatialSignature("BULK_LIQUID_OR_TURBULENT_THINNING", component, spatialCtx);
    results.push(buildZeroRateMechanismResult({ mechanismId: "CO2_SWEET", reasonTr: decision.rationaleTr, routing }));
    return { results, wallShearStressPa: 0, assumptionsTr };
  }

  const wallShearStressPa = computeSharedWallShearStressPa(component, process);
  const temperatureK = process.temperatureC + 273.15;
  const totalPressurePa = process.pressureBara * 1e5;
  const co2PartialPressurePa = (chemistry.co2MolePercent / 100) * totalPressurePa;
  const h2sPartialPressurePa = (chemistry.h2sPpmMole / 1e6) * totalPressurePa;
  const waterDewPointK = process.waterDewpointC + 273.15;
  const routing = resolvePipeFittingSpatialSignature("BULK_LIQUID_OR_TURBULENT_THINNING", component, spatialCtx);

  let co2Result: MechanismResult;
  const catalog = getMechanism("CO2_SWEET");

  if (decision.primaryModel === "NORSOK_M506") {
    const norsok = computeNorsokM506Rate(buildNorsokM506InputFromCase(mitigation, operatingCase, wallShearStressPa));
    co2Result = {
      mechanismId: "CO2_SWEET",
      nameTr: catalog.nameTr,
      nameEn: catalog.nameEn,
      rateMmPerYear: norsok.rateMmPerYear.p50,
      rateP10: norsok.rateMmPerYear.p10,
      rateP50: norsok.rateMmPerYear.p50,
      rateP90: norsok.rateMmPerYear.p90,
      isApplicable: norsok.rateMmPerYear.p50 > 0,
      confidence: toMechanismConfidence(norsok.confidence),
      modelUsed: "NORSOK M-506 Rev.2 (2005)",
      sourceRefs: resolveSourceCitations(norsok.sourcesUsed),
      validityWarnings: [decision.rationaleTr, ...norsok.validityWarnings.map((w) => w.message)],
      governingParameters: { ...routing.governingParameters, wallShearStressPa, phUsed: norsok.phUsed },
      spatialSignatureId: routing.signatureId,
      calculationTrace: norsok.calculationTrace,
    };
  } else {
    const deWaard = computeDeWaardRate({
      temperatureK,
      totalPressurePa,
      co2PartialPressurePa,
      // deWaard.ts kendi Zod şeması taşımaz (plain TS arayüzü) — yine de tutarlılık
      // için pH burada da yalnızca GERÇEKTEN ÖLÇÜLMÜŞSE geçirilir; verilmezse
      // deWaard kendi tasarım gereği FpH=1 (pH etkisi yok) kabul eder (bkz.
      // deWaard.ts'in kendi DeWaardInput.pH JSDoc'u).
      pH: chemistry.phMeasured,
      liquidVelocityMs: process.superficialLiquidVelocityMs > 0 ? process.superficialLiquidVelocityMs : undefined,
      pipeInternalDiameterM: component.idMm / 1000,
      glycolWeightPercent: chemistry.glycolWeightPercent > 0 ? chemistry.glycolWeightPercent : undefined,
      isCondensationOnlyScenario: true,
      waterDewPointK,
      waterCutPercent: process.waterCutPercent,
      condensationExpected: true,
      inhibited: mitigation.inhibitorUsed,
      inhibitorEfficiencyPercent: mitigation.inhibitorEfficiencyPercent,
    });
    co2Result = {
      mechanismId: "CO2_SWEET",
      nameTr: `${catalog.nameTr} — Yoğuşma Taraması`,
      nameEn: `${catalog.nameEn} — Condensation Screening`,
      rateMmPerYear: deWaard.rateMmPerYear.p50,
      rateP10: deWaard.rateMmPerYear.p10,
      rateP50: deWaard.rateMmPerYear.p50,
      rateP90: deWaard.rateMmPerYear.p90,
      isApplicable: deWaard.rateMmPerYear.p50 > 0,
      confidence: toMechanismConfidence(deWaard.confidence),
      modelUsed: "de Waard-Milliams (1991) + Fcond yoğuşma taraması",
      sourceRefs: resolveSourceCitations(deWaard.sourcesUsed),
      validityWarnings: [decision.rationaleTr, ...deWaard.validityWarnings.map((w) => w.message)],
      governingParameters: { ...routing.governingParameters, wallShearStressPa },
      spatialSignatureId: routing.signatureId,
      calculationTrace: synthesizeSingleStepTrace({
        modelUsed: "de Waard-Milliams (1991) + Fcond yoğuşma taraması",
        outputMmPerYear: deWaard.rateMmPerYear.p50,
        coefficientIds: deWaard.sourcesUsed,
        inputs: { ...routing.governingParameters, wallShearStressPa },
      }),
    };
  }
  results.push(co2Result);

  if (decision.shouldAlsoComputeTlc) {
    if (options.overallHeatTransferCoefficientWm2K === undefined) {
      assumptionsTr.push(
        "Hat üstü korozyonu (TLC) tetikleyici koşulları sağlandı ama HESAPLANMADI — genel ısı transfer " +
          "katsayısı (U₀) sağlanmadı (bkz. tlc.ts'in kendi ZORUNLU/uydurulamaz girdi notu).",
      );
    } else {
      const tlcRouting = resolvePipeFittingSpatialSignature("TOP_OF_LINE_CONDENSATION", component, spatialCtx);
      const tlc = computeTlcRate({
        fluidTemperatureK: temperatureK,
        ambientTemperatureK: process.ambientTemperatureC + 273.15,
        totalPressurePa,
        co2PartialPressurePa,
        overallHeatTransferCoefficientWm2K: options.overallHeatTransferCoefficientWm2K,
        isStratifiedFlow: true,
        hasHeatLossToAmbient: true,
        organicAcidMgL: chemistry.aceticAcidMgL,
        inhibited: mitigation.inhibitorUsed,
        inhibitorEfficiencyPercent: mitigation.inhibitorEfficiencyPercent,
      });
      const tlcCatalog = getMechanism("TOP_OF_LINE");
      results.push({
        mechanismId: "TOP_OF_LINE",
        nameTr: tlcCatalog.nameTr,
        nameEn: tlcCatalog.nameEn,
        rateMmPerYear: tlc.rateMmPerYear.p50,
        rateP10: tlc.rateMmPerYear.p10,
        rateP50: tlc.rateMmPerYear.p50,
        rateP90: tlc.rateMmPerYear.p90,
        isApplicable: tlc.rateMmPerYear.p50 > 0,
        confidence: toMechanismConfidence(tlc.confidence),
        modelUsed: "WCR (ısı dengesi) + de Waard nomogram kinetik limit",
        sourceRefs: resolveSourceCitations(tlc.sourcesUsed),
        validityWarnings: tlc.validityWarnings.map((w) => w.message),
        governingParameters: {
          ...tlcRouting.governingParameters,
          waterCondensationRateGm2s: tlc.waterCondensationRateGm2s,
          filmPh: tlc.filmPh,
        },
        spatialSignatureId: tlcRouting.signatureId,
        calculationTrace: synthesizeSingleStepTrace({
          modelUsed: "WCR (ısı dengesi) + de Waard nomogram kinetik limit",
          outputMmPerYear: tlc.rateMmPerYear.p50,
          coefficientIds: tlc.sourcesUsed,
          inputs: { ...tlcRouting.governingParameters, waterCondensationRateGm2s: tlc.waterCondensationRateGm2s, filmPh: tlc.filmPh },
        }),
      });
    }
  }

  return { results, wallShearStressPa, assumptionsTr };
}

// ─────────────────────────────────────────────────────────────────────────
// Erozyon — kum (DNV-RP-O501)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Kum erozyonu hızını, bileşen tipine göre DNV-RP-O501'in doğru geometri
 * alt-prosedürüne yönlendirerek hesaplar (erosion/index.ts::
 * selectDnvErosionModel — TEK karar kaynağı, burada tekrar edilmez).
 * Bu proje henüz redüksiyon/orifis çıkış çapını veya kaynak dikişi
 * yüksekliğini AYRI geometri alanları olarak TUTMUYOR — bu durumlarda
 * TEMSİLİ (dokümante edilmiş, DOĞRULANMAMIŞ) bir varsayım kullanılır.
 */
export function runSandErosionMechanism(component: Geometry, operatingCase: OperatingCase): MechanismResult {
  const { solids, process } = operatingCase;
  const particleDiameterM = solids.particleDiameterUm !== undefined ? solids.particleDiameterUm * 1e-6 : undefined;
  const spatialCtx = { particleDiameterM };

  if (solids.sandRateKgDay <= 0) {
    const routing = resolvePipeFittingSpatialSignature("IMPINGEMENT", component, spatialCtx);
    return buildZeroRateMechanismResult({
      mechanismId: "EROSION_SAND",
      reasonTr: "Kum debisi 0 — katı parçacık erozyonu mekanizması bu senaryoda geçerli değil.",
      routing,
    });
  }

  const pipeIdM = component.idMm / 1000;
  const sandMassFlowRateKgS = solids.sandRateKgDay / 86400;
  const diameterM = particleDiameterM as number; // sandRateKgDay>0 iken şema tarafından ZORUNLU kılınır
  const particleDensityKgM3 = solids.particleDensityKgM3 as number;
  const impactVelocityMs = process.mixtureVelocityMs;
  const mixtureViscosityPaS = computeMixtureViscosityPaS(
    process.liquidHoldupFraction,
    process.liquidViscosityPaS,
    process.gasViscosityPaS,
  );
  const orientation = component.orientation === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
  const extraValidityWarnings: string[] = [];

  const selection = selectDnvErosionModel(component.componentType);
  let erosion: ErosionResult;

  switch (selection.modelId) {
    case "STRAIGHT_PIPE":
      erosion = computeStraightPipeErosionRate({ sandMassFlowRateKgS, impactVelocityMs, pipeIdM, orientation });
      break;
    case "BEND":
      erosion = computeBendErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        mixtureViscosityPaS,
        particleDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    case "MITER_BEND":
      erosion = computeMiterBendErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        mixtureViscosityPaS,
        particleDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    case "BLIND_TEE":
      erosion = computeBlindTeeErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        mixtureViscosityPaS,
        particleDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    case "TEE_BRANCH":
      erosion = computeTeeBranchErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        bendRadiusRatio: component.bendRadiusRatio ?? 1.5,
        bendSweepAngleDeg: component.bendAngleDeg,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        mixtureViscosityPaS,
        particleDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    case "REDUCER":
    case "RESTRICTION_ORIFICE":
    case "CHOKE_VALVE": {
      // Geometry şeması redüksiyon/orifis/choke ÇIKIŞ çapını AYRI bir alan
      // olarak tutmuyor — outletNps varsa NPS oranı ID oranına YAKLAŞIK
      // eşitlenir (et kalınlığı farkı ihmal edilir), yoksa TEMSİLİ %20
      // daralma varsayılır. DOĞRULANMAMIŞ bir basitleştirmedir.
      const downstreamRatio = component.outletNps !== undefined ? component.outletNps / component.npsInch : 0.8;
      const downstreamIdM = pipeIdM * Math.min(Math.max(downstreamRatio, 0.1), 0.95);
      extraValidityWarnings.push(
        `Redüksiyon/orifis çıkış çapı geometri şemasında ayrı bir alan değil — ${(downstreamRatio * 100).toFixed(0)}% ` +
          "iç çap oranı varsayılarak TEMSİLİ olarak türetildi (DOĞRULANMAMIŞ basitleştirme).",
      );
      const reducerInput = {
        sandMassFlowRateKgS,
        upstreamVelocityMs: impactVelocityMs,
        upstreamIdM: pipeIdM,
        downstreamIdM,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      };
      erosion =
        selection.modelId === "REDUCER"
          ? computeReducerErosionRate(reducerInput)
          : selection.modelId === "RESTRICTION_ORIFICE"
            ? computeRestrictionOrificeErosionRate(reducerInput)
            : computeChokeValveErosionRate(reducerInput);
      break;
    }
    case "WELD_REINFORCEMENT":
      erosion = computeWeldReinforcementErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        particleDiameterM: diameterM,
        mixtureDensityKgM3: process.mixtureDensityKgM3,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    case "DOWNSTREAM_WELD": {
      // Kaynak dikişi yüksekliği geometri şemasında YOK — tipik boru kaynağı
      // takviye yüksekliği mertebesinde (1,5mm) TEMSİLİ varsayıldı.
      const assumedWeldHeightM = 0.0015;
      extraValidityWarnings.push(
        `Kaynak dikişi yüksekliği geometri şemasında yok — ${assumedWeldHeightM * 1000}mm TEMSİLİ (DOĞRULANMAMIŞ) varsayıldı.`,
      );
      erosion = computeDownstreamWeldErosionRate({
        sandMassFlowRateKgS,
        impactVelocityMs,
        pipeIdM,
        weldHeightM: assumedWeldHeightM,
        materialClass: DEFAULT_MATERIAL_CLASS,
      });
      break;
    }
    default: {
      // GENERIC_KERNEL_ONLY (vana tipleri) veya NOT_MODELED: yalnızca temel
      // Eq.8.1 çekirdeği, hedef alanı boru kesitinin TEMSİLİ %10'u kabul
      // edilerek (impingement bölgesi tüm kesiti kaplamaz) uygulanır —
      // DOĞRULANMAMIŞ bir basitleştirmedir.
      const targetAreaM2 = Math.PI * (pipeIdM / 2) ** 2 * 0.1;
      const assumedImpactAngleDeg = 45;
      extraValidityWarnings.push(
        `"${component.componentType}" için DNV-RP-O501'de özel bir geometri alt-modeli yok — temel Eq.8.1 ` +
          "çekirdeği, TEMSİLİ hedef alan (boru kesitinin %10'u) ve çarpma açısıyla (45°) uygulandı " +
          "(DOĞRULANMAMIŞ basitleştirme).",
      );
      const base = computeDnvO501ErosionRate({
        sandMassFlowRateKgS,
        impactAngleDeg: assumedImpactAngleDeg,
        impactVelocityMs,
        targetAreaM2,
        targetMaterialDensityKgM3: STEEL_DENSITY_KG_M3,
        materialClass: DEFAULT_MATERIAL_CLASS,
        particleDiameterMicron: solids.particleDiameterUm,
      });
      erosion = {
        ...base,
        modelUsed: `${selection.functionNameTr} (temsili hedef alan varsayımıyla)`,
        maxLocationDescriptionTr: "Bileşene özgü DNV alt-modeli yok — temel Eq.8.1 çekirdeği temsili hedef alanla uygulandı.",
        angularPositionDeg: null,
        axialPositionFraction: 0.5,
        particleImpactAngleDeg: assumedImpactAngleDeg,
        particleVelocityMs: impactVelocityMs,
        isAboveApi14eLimit: null,
        calculationTrace: [],
      };
      break;
    }
  }

  const routing = resolvePipeFittingSpatialSignature("IMPINGEMENT", component, spatialCtx);
  const catalog = getMechanism("EROSION_SAND");
  return {
    mechanismId: "EROSION_SAND",
    nameTr: catalog.nameTr,
    nameEn: catalog.nameEn,
    rateMmPerYear: erosion.rateMmPerYear.p50,
    rateP10: erosion.rateMmPerYear.p10,
    rateP50: erosion.rateMmPerYear.p50,
    rateP90: erosion.rateMmPerYear.p90,
    isApplicable: erosion.rateMmPerYear.p50 > 0,
    confidence: toMechanismConfidence(erosion.confidence),
    modelUsed: erosion.modelUsed,
    sourceRefs: resolveSourceCitations(erosion.sourcesUsed),
    validityWarnings: [...erosion.validityWarnings.map((w) => w.message), ...extraValidityWarnings],
    governingParameters: {
      ...routing.governingParameters,
      particleImpactAngleDeg: erosion.particleImpactAngleDeg,
      particleVelocityMs: erosion.particleVelocityMs,
    },
    spatialSignatureId: routing.signatureId,
    calculationTrace: erosion.calculationTrace,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Erozyon — sıvı damlacığı (tarama, gösterge hız)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Damlacık erozyonu riskini değerlendirir. "Sürüklenen serbest sıvı" varlığı
 * bu senaryonun akış rejiminden TÜRETİLİR (MIST/ANNULAR rejimlerinde
 * yüksek-hızlı gaz akışı damlacık sürükler) — bu, dropletErosion.ts'in
 * kendi dosya başı notunun ("çağıran taraf yalnızca serbest sıvı/damlacık
 * VARSA çağırmalı") uyguladığı bir proje kararıdır.
 */
export function runDropletErosionMechanism(component: Geometry, operatingCase: OperatingCase): MechanismResult {
  const { process } = operatingCase;
  const entrainedLiquidPresent =
    process.isFreeWaterPresent && (process.flowRegime === "MIST" || process.flowRegime === "ANNULAR");
  const risk = assessDropletErosionRisk({ actualGasVelocityMs: process.superficialGasVelocityMs, entrainedLiquidPresent });
  const rate = risk.indicativeRateMmPerYear ?? { p10: 0, p50: 0, p90: 0 };
  const routing = resolvePipeFittingSpatialSignature("IMPINGEMENT", component, {});
  const catalog = getMechanism("EROSION_DROPLET");
  return {
    mechanismId: "EROSION_DROPLET",
    nameTr: catalog.nameTr,
    nameEn: catalog.nameEn,
    rateMmPerYear: rate.p50,
    rateP10: rate.p10,
    rateP50: rate.p50,
    rateP90: rate.p90,
    isApplicable: rate.p50 > 0,
    confidence: toMechanismConfidence(risk.confidence),
    modelUsed: "DNV-RP-O501 damlacık erozyonu tarama eşiği (eşik üstü gösterge hız — bkz. validityWarnings)",
    sourceRefs: resolveSourceCitations(risk.sourcesUsed),
    validityWarnings: [risk.screeningOnlyNoteTr, ...risk.validityWarnings.map((w) => w.message)],
    governingParameters: { ...routing.governingParameters, velocityToLimitRatio: risk.velocityToLimitRatio },
    spatialSignatureId: routing.signatureId,
    calculationTrace: synthesizeSingleStepTrace({
      modelUsed: "DNV-RP-O501 damlacık erozyonu tarama eşiği (eşik üstü gösterge hız — bkz. validityWarnings)",
      outputMmPerYear: rate.p50,
      coefficientIds: risk.sourcesUsed,
      inputs: { ...routing.governingParameters, velocityToLimitRatio: risk.velocityToLimitRatio },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Erozyon-korozyon sinerjisi (opsiyonel — referans hız verilmezse null)
// ─────────────────────────────────────────────────────────────────────────

export function runSynergyMechanism(
  component: Geometry,
  pureCorrosionRateMmYr: number,
  pureErosionRateMmYr: number,
  wallShearStressPa: number,
  particleImpactVelocityMs: number,
  options: AssessComponentOptions,
): MechanismResult | null {
  if (options.synergyReferenceImpactVelocityMs === undefined) return null;
  if (pureCorrosionRateMmYr <= 0 || pureErosionRateMmYr <= 0) return null;

  const synergy = computeSynergy({
    pureCorrosionRateMmYr,
    pureErosionRateMmYr,
    wallShearStressPa,
    particleImpactVelocityMs,
    referenceImpactVelocityMs: options.synergyReferenceImpactVelocityMs,
  });
  const routing = resolvePipeFittingSpatialSignature("IMPINGEMENT", component, {});
  const catalog = getMechanism("EROSION_CORROSION_SYNERGY");
  return {
    // NOT: bu sonuç yalnızca EK sinerji katkısını (S) taşır — Toplam T=C+E+S
    // zaten ayrı ayrı izlenen CO2_SWEET (C) ve EROSION_SAND (E) sonuçlarına
    // BU katkının EKLENMESİYLE elde edilir (computeDamageField tüm applicable
    // sonuçları TOPLAR) — S'yi C/E'nin ÜZERİNE yazmak ÇİFT SAYIM olur.
    mechanismId: "EROSION_CORROSION_SYNERGY",
    nameTr: catalog.nameTr,
    nameEn: catalog.nameEn,
    rateMmPerYear: synergy.synergyRateMmYr.p50,
    rateP10: synergy.synergyRateMmYr.p10,
    rateP50: synergy.synergyRateMmYr.p50,
    rateP90: synergy.synergyRateMmYr.p90,
    isApplicable: synergy.synergyRateMmYr.p50 > 0,
    confidence: toMechanismConfidence(synergy.confidence),
    modelUsed: "ASTM G119 T=C+E+S ayrıştırması (yalnızca S bileşeni — bkz. not)",
    sourceRefs: resolveSourceCitations(synergy.sourcesUsed),
    validityWarnings: synergy.validityWarnings.map((w) => w.message),
    governingParameters: {
      ...routing.governingParameters,
      filmRemovalFactor: synergy.filmRemovalFactor,
      synergyFractionOfTotal: synergy.synergyFractionOfTotal,
    },
    spatialSignatureId: routing.signatureId,
    calculationTrace: synthesizeSingleStepTrace({
      modelUsed: "ASTM G119 T=C+E+S ayrıştırması (yalnızca S bileşeni — bkz. not)",
      outputMmPerYear: synergy.synergyRateMmYr.p50,
      coefficientIds: synergy.sourcesUsed,
      inputs: {
        ...routing.governingParameters,
        filmRemovalFactor: synergy.filmRemovalFactor,
        synergyFractionOfTotal: synergy.synergyFractionOfTotal,
      },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Atmosferik dış korozyon (opsiyonel — bağlam verilmezse null)
// ─────────────────────────────────────────────────────────────────────────

export function runAtmosphericExternalMechanism(component: Geometry, options: AssessComponentOptions): MechanismResult | null {
  if (component.installation !== "ABOVE_GROUND") return null;
  if (!options.atmosphericContext) return null;

  const risk = assessAtmosphericExternalRisk(options.atmosphericContext);
  if (!risk.conditionalRateRangeMmPerYear) return null;

  const routing = resolvePipeFittingSpatialSignature("EXTERNAL_DISTRIBUTED", component, {});
  const catalog = getMechanism("ATMOSPHERIC_MARINE");
  return {
    mechanismId: "ATMOSPHERIC_MARINE",
    nameTr: catalog.nameTr,
    nameEn: catalog.nameEn,
    rateMmPerYear: risk.conditionalRateRangeMmPerYear.p50,
    rateP10: risk.conditionalRateRangeMmPerYear.p10,
    rateP50: risk.conditionalRateRangeMmPerYear.p50,
    rateP90: risk.conditionalRateRangeMmPerYear.p90,
    isApplicable: true,
    confidence: toMechanismConfidence(risk.confidence),
    modelUsed: "ISO 9223:2012 Tablo 2 (karbon çeliği)",
    sourceRefs: resolveSourceCitations(risk.sourcesUsed),
    validityWarnings: risk.validityWarnings.map((w) => w.message),
    governingParameters: routing.governingParameters,
    spatialSignatureId: routing.signatureId,
    calculationTrace: synthesizeSingleStepTrace({
      modelUsed: "ISO 9223:2012 Tablo 2 (karbon çeliği)",
      outputMmPerYear: risk.conditionalRateRangeMmPerYear.p50,
      coefficientIds: risk.sourcesUsed,
      inputs: routing.governingParameters,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Nitel (yalnızca risk skoru) mekanizmalar
// ─────────────────────────────────────────────────────────────────────────

export function runH2sFinding(
  operatingCase: OperatingCase,
  sharedInSituPh: number | undefined,
  freeWaterPresent: boolean,
  options: AssessComponentOptions,
): QualitativeRiskFinding {
  const { process, chemistry } = operatingCase;
  const risk = assessH2sSourRisk({
    totalPressureKpa: process.pressureBara * 100, // 1 bar = 100 kPa (tanımsal birim dönüşümü, KDP kapsamı dışı)
    h2sMoleFraction: chemistry.h2sPpmMole / 1e6,
    co2MoleFraction: chemistry.co2MolePercent / 100,
    inSituPh: sharedInSituPh ?? 7,
    materialHardnessHrc: options.materialHardnessHrc,
    freeWaterPresent,
  });
  return toQualitativeFinding("H2S_SOUR", risk);
}

export function runMicFinding(
  operatingCase: OperatingCase,
  sharedInSituPh: number | undefined,
  freeWaterPresent: boolean,
  mitigation: Mitigation,
  assumptionsTr: string[],
): QualitativeRiskFinding {
  const { process, chemistry } = operatingCase;
  const waterType: WaterType = "PRODUCED_WATER";
  if (freeWaterPresent) {
    assumptionsTr.push(
      "MIC değerlendirmesi için su tipi/durgunluk bilgisi girdi şemasında yok — üretim suyu (PRODUCED_WATER) " +
        "ve durgun-olmayan akış TEMSİLİ olarak varsayıldı; gerçek risk (özellikle ölü bacak/durgun bölgelerde) DAHA YÜKSEK olabilir.",
    );
  }
  const risk = assessMicRisk({
    temperatureC: process.temperatureC,
    inSituPh: sharedInSituPh ?? 7,
    freeWaterPresent,
    isStagnantOrDeadLeg: false,
    waterType,
    biocideProgramActive: mitigation.biocideUsed,
  });
  void chemistry;
  return toQualitativeFinding("MIC", risk);
}

export function runUdcFinding(operatingCase: OperatingCase, freeWaterPresent: boolean): QualitativeRiskFinding {
  const { process, chemistry, solids } = operatingCase;
  const risk = assessUnderDepositRisk({
    actualVelocityMs: process.mixtureVelocityMs,
    depositFormingSolidsPresent: solids.sandRateKgDay > 0 || solids.sandPpmw > 0,
    isLowPointOrDeadLeg: false,
    aggressiveWaterChemistryPresent: chemistry.h2sPpmMole > 0 || chemistry.co2MolePercent > 0,
    freeWaterPresent,
  });
  return toQualitativeFinding("UNDER_DEPOSIT", risk);
}

export function runOxygenFinding(
  operatingCase: OperatingCase,
  freeWaterPresent: boolean,
  isDryGasFlow: boolean,
): QualitativeRiskFinding {
  const { process, chemistry } = operatingCase;
  const risk = assessOxygenCorrosionRisk({
    dissolvedOxygenPpb: chemistry.o2Ppb,
    rapidTemperatureRiseLocation: false,
    flowVelocityMs: process.mixtureVelocityMs,
    freeWaterPresent,
    isDryGas: isDryGasFlow,
  });
  return toQualitativeFinding("OXYGEN", risk);
}

export function runCuiFinding(
  component: Geometry,
  operatingCase: OperatingCase,
  mitigation: Mitigation,
  options: AssessComponentOptions,
  assumptionsTr: string[],
): QualitativeRiskFinding {
  assumptionsTr.push(
    "CUI değerlendirmesi siklik servis/buhar bariyeri durumu/kritik konum bilgisi olmadan, İYİMSER " +
      "(hepsi 'hayır/yok') varsayımlarla yapıldı — gerçek risk DAHA YÜKSEK olabilir.",
  );
  const risk = assessCuiRisk({
    isInsulated: component.isInsulated,
    materialFamily: options.cuiMaterialFamily ?? "CARBON_STEEL",
    operatingTemperatureC: operatingCase.process.temperatureC,
    isCyclicService: false,
    vaporBarrierDamaged: false,
    isCriticalCuiLocation: false,
    insulationChlorideLeachRisk: mitigation.insulationChlorideLeachable,
  });
  return toQualitativeFinding("CUI", risk);
}

export { deriveDryGasAndFreeWater, computeSharedInSituPh, computeSharedWallShearStressPa };
