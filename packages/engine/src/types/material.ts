// packages/engine/src/types/material.ts

import { z } from "zod";

/**
 * Bir malzeme sınıfının (ör. Karbon Çelik, 316L, Duplex 2205) mühendislik
 * özellikleri. Bu şema yalnızca VERİ SÖZLEŞMESİDİR — belirli bir malzemenin
 * pren/cptC gibi alanlarına gerçek sayısal değer atanması ayrı bir adımda,
 * KDP'ye uygun kaynaklarla (malzeme veri sayfaları, ASTM/NACE standartları)
 * yapılacaktır (bkz. packages/engine/src/data/materials.ts — henüz boş).
 */
export const MaterialSpecSchema = z.object({
  materialId: z.string().min(1).describe("Benzersiz malzeme kimliği"),
  family: z.string().min(1).describe("Malzeme ailesi (ör. \"Carbon Steel\", \"Duplex 2205\")"),
  displayNameTr: z.string().min(1).describe("Türkçe görünen ad"),
  displayNameEn: z.string().min(1).describe("İngilizce görünen ad"),
  pren: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Çukurlaşma Direnç Eşdeğer Sayısı (PREN) — yalnızca paslanmaz/duplex ailelerde"),
  cptC: z.number().min(-273).max(1200).optional().describe("Kritik çukurlaşma sıcaklığı (°C)"),
  cctC: z.number().min(-273).max(1200).optional().describe("Kritik çatlak (crevice) sıcaklığı (°C)"),
  csccLimitC: z
    .number()
    .min(-273)
    .max(1200)
    .optional()
    .describe("Klorürlü gerilmeli korozyon çatlaması (CSCC) sıcaklık sınırı (°C)"),
  minDesignTempC: z.number().min(-273).max(1200).describe("Minimum tasarım sıcaklığı (°C)"),
  maxServiceTempC: z.number().min(-273).max(1200).describe("Maksimum servis sıcaklığı (°C)"),
  coatingRequiredAboveC: z
    .number()
    .min(-273)
    .max(1200)
    .optional()
    .describe("Üzerinde kaplama zorunlu olan sıcaklık eşiği (°C)"),
  relativeCostIndex: z
    .number()
    .positive()
    .max(200)
    .describe("Karbon çeliğe göre bağıl maliyet endeksi (CS = 1.0)"),
  densityKgM3: z
    .number()
    .min(800)
    .max(25000)
    .describe("Yoğunluk (kg/m³) — metaller ~7500+, termoplastikler ~900-1500 aralığındadır"),
  notesTr: z.string().describe("Türkçe mühendislik notları"),
});

export type MaterialSpec = z.infer<typeof MaterialSpecSchema>;
