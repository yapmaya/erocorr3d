// packages/engine/src/aggregate/ctlAtl.ts
//
// CTL/ATL oranı — "korozyon olasılığı" (likelihood of corrosion) göstergesi.
// CTL (Corroded Total Loss, tahmini toplam korozyon — bkz. aggregate/
// metalLoss.ts::computeTotalMetalLoss) / ATL (Allowance Total Loss, seçilen
// korozyon payı) oranı, sistemin tasarım ömrü içinde arızasız kalıp
// kalmayacağının kaba bir göstergesidir.
//
// ÖNEMLİ İSİMLENDİRME NOTU: bu dosyanın ESKİ (bu oturumdan önceki) taslağı
// CTL/ATL'yi "Critical Thickness Limit / Alarm Thickness Limit" (et kalınlığı
// eşikleri) olarak yorumluyordu — bu YANLIŞ bir varsayımdı. Kaynak dokümanın (kimliği izlenebilirlik amacıyla anonim tutulan iç proje dokümanı) kendi kısaltmalar listesi CTL="Corroded
// total loss", ATL="Allowance total loss" olarak TANIMLAR — tamamen farklı
// bir kavram (metal kaybı / korozyon payı ORANI, et kalınlığı eşiği DEĞİL).
// Dosya adı (mevcut kod tabanındaki diğer dosyalarla aynı isimlendirme
// gerekçesiyle) KORUNDU, ancak içerik BAŞTAN yazıldı.
//
// Kaynak: kullanıcının kendi iç proje dokümanının bir tablosu (bkz. registry/coefficients/
// ctlAtl.ts) — kimliği izlenebilirlik amacıyla anonim tutuluyor.

import { getCoefficient } from "../registry";
import type { CtlAtlCategoryThresholds } from "../registry/coefficients/ctlAtl";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";

export type CtlAtlCategory = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

export interface CtlAtlInput {
  /** Tahmini toplam korozyon (CTL) — ör. aggregate/metalLoss.ts::computeTotalMetalLoss(...).totalServiceLifeCorrosionMm.p50 (mm) */
  predictedTotalCorrosionMm: number;
  /** Seçilen korozyon payı (ATL, mm) */
  selectedCorrosionAllowanceMm: number;
}

export interface CtlAtlResult {
  ratio: number;
  category: CtlAtlCategory;
  categoryLabelTr: string;
  /** Tablo 10-4'ün "Approximate Impact on System Life" sütununun Türkçe çevirisi */
  impactOnSystemLifeTr: string;
  colorTr: "yeşil" | "sarı" | "turuncu" | "kırmızı";
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

const CATEGORY_LABELS_TR: Record<CtlAtlCategory, string> = {
  NEGLIGIBLE: "İHMAL EDİLEBİLİR",
  LOW: "DÜŞÜK",
  MEDIUM: "ORTA",
  HIGH: "YÜKSEK",
};

const CATEGORY_COLORS: Record<CtlAtlCategory, CtlAtlResult["colorTr"]> = {
  NEGLIGIBLE: "yeşil",
  LOW: "sarı",
  MEDIUM: "turuncu",
  HIGH: "kırmızı",
};

const CATEGORY_IMPACT_TR: Record<CtlAtlCategory, string> = {
  NEGLIGIBLE: "Sistem, gerekenden daha uzun süre arızasız kalacaktır (ömürden UZUN dayanır).",
  LOW: "Sistem, tasarım ömrüne arızasız ulaşacaktır.",
  MEDIUM: "Önlem alınmazsa sistem, tasarım ömrünün yalnızca %25'ine ulaştığında arızalanabilir.",
  HIGH: "Önlem alınmazsa sistem, tasarım ömrünün %25'ine ulaşmadan ÖNCE arızalanacaktır.",
};

/**
 * CTL/ATL oranını ve kategorisini hesaplar.
 *
 * Model adı: kullanıcının kendi iç proje dokümanının bir tablosu, "Evaluation of the
 * Likelihood of Corrosion Categories" (bkz. registry/coefficients/ctlAtl.ts) — kimliği izlenebilirlik amacıyla anonim tutuluyor.
 * Girdi/çıktı birimleri: mm → çıktı boyutsuz oran.
 * Geçerlilik aralığı: kaynak dokümanda açık bir üst/alt sınır belirtilmemiş
 * — oran tanım gereği ≥0'dır.
 * Bilinen sınırlamalar: bu oran, TEK bir merkezi (P50) tahmine dayanan
 * DETERMİNİSTİK bir gösterge niteliğindedir — P10/P90 belirsizlik bandını
 * yansıtmaz (çağıran taraf isterse ayrıca P10/P90 için de bu fonksiyonu
 * çağırabilir).
 */
export function computeCtlAtl(input: CtlAtlInput): CtlAtlResult {
  if (input.predictedTotalCorrosionMm < 0) {
    throw new Error("Tahmini toplam korozyon negatif olamaz.");
  }
  if (input.selectedCorrosionAllowanceMm <= 0) {
    throw new Error("Seçilen korozyon payı pozitif olmalıdır.");
  }

  const thresholds = getCoefficient<CtlAtlCategoryThresholds>("ctlAtl.categoryThresholds").value;
  const ratio = input.predictedTotalCorrosionMm / input.selectedCorrosionAllowanceMm;

  let category: CtlAtlCategory;
  if (ratio <= thresholds.negligibleMax) {
    category = "NEGLIGIBLE";
  } else if (ratio <= thresholds.lowMax) {
    category = "LOW";
  } else if (ratio <= thresholds.mediumMax) {
    category = "MEDIUM";
  } else {
    category = "HIGH";
  }

  const validityWarnings: ValidityWarning[] = [];
  if (category === "HIGH" || category === "MEDIUM") {
    validityWarnings.push({
      parameter: "CTL/ATL oranı",
      value: ratio,
      min: 0,
      max: thresholds.lowMax,
      unit: "-",
      message: `CTL/ATL=${ratio.toFixed(2)} — ${CATEGORY_IMPACT_TR[category]}`,
    });
  }

  return {
    ratio,
    category,
    categoryLabelTr: CATEGORY_LABELS_TR[category],
    impactOnSystemLifeTr: CATEGORY_IMPACT_TR[category],
    colorTr: CATEGORY_COLORS[category],
    confidence: getCoefficient("ctlAtl.categoryThresholds").confidence,
    validityWarnings,
    sourcesUsed: ["ctlAtl.categoryThresholds"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
