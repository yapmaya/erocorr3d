// packages/engine/src/corrosion/pittingCreviceCscc.ts
//
// Çukurlaşma (pitting) / aralık (crevice) / klorürlü gerilmeli korozyon
// çatlaması (CSCC) KARAR mantığı — "bu sıcaklıkta bu malzeme kaplanmalı mı"
// türü bir malzeme seçimi kararı üretir.
//
// Bu dosya YENİ bir sayısal korozyon modeli İÇERMEZ — malzemenin kendi
// PREN/CPT/CCT/CSCC sınırları ZATEN data/materials.ts'te (ayrı bir oturumda,
// KDP-sourced) kayıtlıdır; bu modül yalnızca servis sıcaklığını/klorür
// varlığını bu sınırlarla KARŞILAŞTIRAN karar mantığıdır (corrosion/
// modelRouter.ts ile AYNI statüde — "hangi eşiği aştık" kararı KDP kaydı
// GEREKTİRMEZ, eşiklerin KENDİSİ zaten ayrı ayrı sourced'dır).
//
// İç (INTERNAL) ve dış (EXTERNAL) ortam AYRI mekanizma kimlikleriyle
// (data/mechanisms.ts::PITTING_INTERNAL/CREVICE_INTERNAL/CSCC_INTERNAL vs.
// EXTERNAL_PITTING/EXTERNAL_CSCC) belgelenmiştir — bu fonksiyon, hangi
// mekanizma setinin geçerli olduğunu `environment` girdisiyle belirler ama
// hesap mantığı ikisi için de AYNIDIR (kaynak metinlerin kendisi de bunu
// doğruluyor: EXTERNAL_CSCC "aynı temel elektrokimya" diyor).

import { getCoefficient } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, classifyRiskScore, type RiskLevel, type ValidityWarning } from "./types";
import type { MaterialSpec } from "../types/material";

export interface PittingCreviceCsccInput {
  material: MaterialSpec;
  serviceTemperatureC: number;
  environment: "INTERNAL" | "EXTERNAL";
  chloridePresent: boolean;
  chlorideConcentrationPpm?: number;
  /** Aralık (crevice) korozyonu İÇİN gerçek bir dar geometrik aralık (conta, birikinti altı vb.) mevcut mu */
  creviceGeometryPresent: boolean;
  /** Çekme gerilmesi (kalıntı veya uygulanan) — sağlanmazsa, gerçek bileşenlerde neredeyse her zaman bir miktar kalıntı gerilme olduğu varsayılır */
  tensileStressPresent?: boolean;
  dissolvedOxygenOrOxidantPresent?: boolean;
}

export interface PittingCreviceCsccResult {
  isPittingRisk: boolean;
  isCreviceRisk: boolean;
  isCsccRisk: boolean;
  chlorideContextRiskLevel: RiskLevel | null;
  coatingRecommended: boolean;
  recommendationTr: string;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

/**
 * Çukurlaşma/aralık/CSCC risklerini ve kaplama gerekliliğini malzemenin
 * KENDİ (materials.ts'te KDP-sourced) sınırlarıyla servis koşullarını
 * karşılaştırarak değerlendirir.
 *
 * Model adı: karar mantığı (bkz. dosya başı yorumu) — yeni bir hesap modeli
 * DEĞİLDİR, materials.ts'in pren/cptC/cctC/csccLimitC/coatingRequiredAboveC
 * alanlarını KULLANIR.
 * Girdi/çıktı birimleri: °C, ppm → çıktı boolean bayraklar + Türkçe tavsiye.
 * Bilinen sınırlamalar: PREN/CPT/CCT kavramları YALNIZCA paslanmaz/duplex
 * ailelerinde anlamlıdır (materials.ts'te bu alanlar metalik-olmayan/CS
 * malzemeler için tanımsızdır — bu durumda ilgili risk her zaman false
 * döner ve bir validityWarning eklenir).
 */
export function assessPittingCreviceCsccRisk(input: PittingCreviceCsccInput): PittingCreviceCsccResult {
  const validityWarnings: ValidityWarning[] = [];
  const sourcesUsed: string[] = [];
  const usedConfidences: ConfidenceLevel[] = ["HIGH"];
  const tensileStressPresent = input.tensileStressPresent ?? true;

  if (input.material.pren === undefined) {
    validityWarnings.push({
      parameter: "PREN",
      value: 0,
      min: 0,
      max: 100,
      unit: "-",
      message: `"${input.material.displayNameTr}" için PREN tanımsız — PREN/CPT/CCT kavramları yalnızca paslanmaz/duplex alaşımlarda anlamlıdır, çukurlaşma/aralık riski bu malzeme için değerlendirilemedi.`,
    });
  }

  const isPittingRisk =
    input.chloridePresent && input.material.cptC !== undefined && input.serviceTemperatureC > input.material.cptC;
  if (input.chloridePresent && input.material.cptC === undefined) {
    validityWarnings.push({
      parameter: "CPT",
      value: 0,
      min: -273,
      max: 1200,
      unit: "°C",
      message: `"${input.material.displayNameTr}" için kritik çukurlaşma sıcaklığı (CPT) tanımsız — çukurlaşma riski değerlendirilemedi.`,
    });
  }

  const isCreviceRisk =
    input.chloridePresent &&
    input.creviceGeometryPresent &&
    input.material.cctC !== undefined &&
    input.serviceTemperatureC > input.material.cctC;

  const isCsccRisk =
    input.chloridePresent &&
    tensileStressPresent &&
    input.material.csccLimitC !== undefined &&
    input.serviceTemperatureC > input.material.csccLimitC;

  const coatingRecommended =
    input.material.coatingRequiredAboveC !== undefined && input.serviceTemperatureC > input.material.coatingRequiredAboveC;

  let chlorideContextRiskLevel: RiskLevel | null = null;
  if (input.chlorideConcentrationPpm !== undefined) {
    const bands = getCoefficient<{ lowMaxPpm: number; moderateMaxPpm: number; highMaxPpm: number }>(
      "pittingCreviceCscc.genericChlorideRiskBandsPpm",
    ).value;
    sourcesUsed.push("pittingCreviceCscc.genericChlorideRiskBandsPpm");
    usedConfidences.push(getCoefficient("pittingCreviceCscc.genericChlorideRiskBandsPpm").confidence);
    let points: number;
    if (input.chlorideConcentrationPpm <= bands.lowMaxPpm) points = 10;
    else if (input.chlorideConcentrationPpm <= bands.moderateMaxPpm) points = 40;
    else if (input.chlorideConcentrationPpm <= bands.highMaxPpm) points = 70;
    else points = 95;
    chlorideContextRiskLevel = classifyRiskScore(points);
    validityWarnings.push({
      parameter: "Klorür konsantrasyonu (bağlamsal)",
      value: input.chlorideConcentrationPpm,
      min: 0,
      max: bands.highMaxPpm,
      unit: "ppm",
      message:
        "Bu jenerik klorür bandı yalnızca BAĞLAMSAL bir göstergedir (LOW confidence, alaşım ailesinden " +
        "bağımsız) — asıl karar malzemenin kendi CPT/CCT/CSCC sınırının servis sıcaklığıyla karşılaştırılmasıdır.",
    });
  }

  const activeRisks: string[] = [];
  if (isPittingRisk) activeRisks.push("çukurlaşma");
  if (isCreviceRisk) activeRisks.push("aralık (crevice)");
  if (isCsccRisk) activeRisks.push("klorürlü gerilmeli korozyon çatlaması (CSCC)");

  let recommendationTr: string;
  if (activeRisks.length === 0 && !coatingRecommended) {
    recommendationTr = `"${input.material.displayNameTr}" bu servis sıcaklığında (${input.serviceTemperatureC}°C, ${input.environment === "INTERNAL" ? "iç" : "dış"} ortam) mevcut girdilerle değerlendirilen risklerin hiçbirini AŞMIYOR.`;
  } else {
    const parts: string[] = [];
    if (activeRisks.length > 0) {
      parts.push(
        `"${input.material.displayNameTr}", ${input.serviceTemperatureC}°C servis sıcaklığında (${input.environment === "INTERNAL" ? "iç" : "dış"} ortam) ${activeRisks.join(", ")} riski AŞIYOR — malzemenin kendi eşik sıcaklığının (CPT/CCT/CSCC) ÜZERİNDE çalışıyor.`,
      );
    }
    if (coatingRecommended) {
      parts.push(
        `Servis sıcaklığı, kaplama gerektiren eşiği (${input.material.coatingRequiredAboveC}°C) aşıyor — KAPLAMA (veya daha dirençli bir alaşıma yükseltme) ÖNERİLİR.`,
      );
    }
    recommendationTr = parts.join(" ");
  }

  return {
    isPittingRisk,
    isCreviceRisk,
    isCsccRisk,
    chlorideContextRiskLevel,
    coatingRecommended,
    recommendationTr,
    confidence: usedConfidences.every((c) => c === "HIGH") ? "HIGH" : usedConfidences.includes("LOW") ? "LOW" : "MEDIUM",
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
