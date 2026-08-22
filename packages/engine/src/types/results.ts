// packages/engine/src/types/results.ts

import { z } from "zod";
import { LikelihoodCategoryEnum, MechanismConfidenceEnum, SpatialParameterizationEnum } from "./enums";

/**
 * Bir hesaplamanın tek bir adımını belgeler — izlenebilirlik (traceability)
 * için. Amaç: bir sonuca nasıl ulaşıldığının, hangi katsayıların (registry
 * kimlikleriyle) kullanıldığının adım adım geriye izlenebilmesi.
 */
export const TraceStepSchema = z.object({
  stepName: z.string().min(1).describe("Adım adı"),
  formula: z.string().min(1).describe("Kullanılan formülün okunabilir gösterimi"),
  inputs: z.record(z.string(), z.number()).describe("Adımın girdi değerleri"),
  output: z.number().describe("Adımın çıktı değeri"),
  unit: z.string().describe("Çıktının birimi"),
  coefficientIds: z
    .array(z.string())
    .describe("Bu adımda kullanılan registry katsayı kimlikleri"),
});

export type TraceStep = z.infer<typeof TraceStepSchema>;

/**
 * Tek bir hasar mekanizmasının (ör. NORSOK CO2 korozyonu) bir işletme
 * senaryosu için sonucu. rateMmPerYear, merkezi (P50) tahminle aynı
 * anlamdadır ama ayrı bir alan olarak tutulur (UI'da tek bakışta gösterilecek
 * "birincil" değer).
 */
export const MechanismResultSchema = z.object({
  mechanismId: z.string().min(1).describe("Mekanizma kimliği (ör. \"corrosion.norsok\")"),
  nameTr: z.string().min(1).describe("Türkçe mekanizma adı"),
  nameEn: z.string().min(1).describe("İngilizce mekanizma adı"),
  rateMmPerYear: z.number().min(0).describe("Birincil (merkezi) hız tahmini (mm/yıl)"),
  rateP10: z.number().min(0).describe("P10 (iyimser) hız tahmini (mm/yıl)"),
  rateP50: z.number().min(0).describe("P50 (merkezi) hız tahmini (mm/yıl)"),
  rateP90: z.number().min(0).describe("P90 (koruyucu/yüksek) hız tahmini (mm/yıl)"),
  isApplicable: z.boolean().describe("Bu mekanizma bu senaryoda geçerli mi"),
  confidence: MechanismConfidenceEnum.describe("Modelin geçerlilik aralığına uyum güveni"),
  modelUsed: z.string().min(1).describe("Kullanılan model adı (ör. \"NORSOK M-506\")"),
  sourceRefs: z.array(z.string()).describe("Kaynak atıfları"),
  validityWarnings: z.array(z.string()).describe("Geçerlilik aralığı dışı uyarıları"),
  governingParameters: z
    .record(z.string(), z.number())
    .describe("Sonucu belirleyen ana parametreler"),
  spatialSignatureId: z
    .string()
    .min(1)
    .describe("İlişkili SpatialDamageField kimliği"),
  calculationTrace: z.array(TraceStepSchema).describe("Hesaplama izi (traceability)"),
});

export type MechanismResult = z.infer<typeof MechanismResultSchema>;

/**
 * Bir işletme senaryosu için tüm mekanizma sonuçları.
 */
export const PerCaseResultSchema = z.object({
  caseName: z.string().min(1).describe("İlişkili OperatingCase adı"),
  mechanismResults: z.array(MechanismResultSchema).describe("Bu senaryodaki mekanizma sonuçları"),
});

export type PerCaseResult = z.infer<typeof PerCaseResultSchema>;

/**
 * Bir bileşen için tüm senaryolar üzerinden birleştirilmiş nihai değerlendirme.
 */
export const AssessmentResultSchema = z.object({
  componentId: z.string().min(1).describe("Bileşen kimliği"),
  perCaseResults: z.array(PerCaseResultSchema).describe("Senaryo başına sonuçlar"),
  governingCase: z.string().min(1).describe("En kötü durumu belirleyen (governing) senaryo adı"),
  totalMetalLossMm: z.number().min(0).describe("Toplam metal kaybı, merkezi tahmin (mm)"),
  totalMetalLossP10: z.number().min(0).describe("Toplam metal kaybı, P10 (mm)"),
  totalMetalLossP90: z.number().min(0).describe("Toplam metal kaybı, P90 (mm)"),
  requiredCaMm: z.number().min(0).describe("Gerekli korozyon payı (mm)"),
  ctlAtlRatio: z.number().min(0).describe("CTL/ATL oranı (risk göstergesi)"),
  likelihoodCategory: LikelihoodCategoryEnum.describe("Olasılık kategorisi"),
  remainingLifeYears: z.number().min(0).describe("Kalan servis ömrü tahmini (yıl)"),
  recommendedMaterial: z.string().min(1).describe("Önerilen malzeme kimliği"),
  alternativeMaterials: z.array(z.string()).describe("Alternatif malzeme kimlikleri"),
  unverifiedCoefficientsUsed: z
    .array(z.string())
    .describe("Bu sonuçta kullanılan UNVERIFIED katsayı kimlikleri (sarı rozet için)"),
  warnings: z.array(z.string()).describe("Genel uyarılar"),
  assumptions: z.array(z.string()).describe("Yapılan varsayımlar"),
});

export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;

/**
 * Isı haritasında öne çıkan bir yerel hasar noktası.
 */
export const HotspotSchema = z.object({
  u: z.number().min(0).max(1).describe("Parametrik U koordinatı (0-1)"),
  v: z.number().min(0).max(1).describe("Parametrik V koordinatı (0-1)"),
  valueMm: z.number().min(0).describe("Bu noktadaki hasar değeri (mm)"),
  descriptionTr: z.string().min(1).describe("Türkçe konum açıklaması"),
  clockPosition: z
    .number()
    .min(1)
    .max(12)
    .describe("Dairesel konum, saat pozisyonu (1-12)"),
});

export type Hotspot = z.infer<typeof HotspotSchema>;

/**
 * Bir bileşenin yüzeyi üzerindeki uzamsal (3B) hasar dağılımı — ısı haritası
 * görselleştirmesinin veri kaynağı.
 */
export const SpatialDamageFieldSchema = z
  .object({
    parameterization: SpatialParameterizationEnum.describe("Yüzey parametrizasyon yöntemi"),
    resolutionU: z.number().int().positive().describe("U yönünde çözünürlük (nokta sayısı)"),
    resolutionV: z.number().int().positive().describe("V yönünde çözünürlük (nokta sayısı)"),
    valuesMm: z
      .instanceof(Float32Array)
      .describe("resolutionU × resolutionV boyutunda hasar değerleri (mm), satır-öncelikli"),
    maxValueMm: z.number().min(0).describe("Maksimum hasar değeri (mm)"),
    maxLocation: z
      .object({
        u: z.number().min(0).max(1).describe("Maksimum noktanın U koordinatı (0-1)"),
        v: z.number().min(0).max(1).describe("Maksimum noktanın V koordinatı (0-1)"),
        descriptionTr: z.string().min(1).describe("Türkçe konum açıklaması"),
        clockPosition: z.number().min(1).max(12).describe("Dairesel konum, saat pozisyonu (1-12)"),
      })
      .describe("Maksimum hasarın konumu"),
    hotspots: z.array(HotspotSchema).describe("Öne çıkan yerel hasar noktaları"),
  })
  .describe("Uzamsal hasar dağılım alanı")
  .superRefine((field, ctx) => {
    const expectedLength = field.resolutionU * field.resolutionV;
    if (field.valuesMm.length !== expectedLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valuesMm"],
        message: `valuesMm uzunluğu (${field.valuesMm.length}), resolutionU × resolutionV (${expectedLength}) ile eşleşmiyor.`,
      });
    }
  });

export type SpatialDamageField = z.infer<typeof SpatialDamageFieldSchema>;
