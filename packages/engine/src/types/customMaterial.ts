// packages/engine/src/types/customMaterial.ts
//
// Kullanıcının kendi eklediği malzeme adayı. KDP NOTU: bu bir registry
// katsayısı DEĞİLDİR (registerCoefficient'a KAYDEDİLMEZ) — kullanıcının
// kendi projesinden getirdiği, dış kaynakla çapraz doğrulanmamış bir
// veridir. `sourceNoteTr` kullanıcının KENDİ gerekçesidir, bir standart/
// makale atfı DEĞİLDİR; bu yüzden bu veri motorun malzeme önerisine
// eklendiğinde (bkz. aggregate/materialSelection.ts::selectPipingMaterial)
// HER ZAMAN "doğrulanmamış" olarak etiketlenir ve asla birincil öneriyi
// belirleyen §10.3.2 merdivenini veya onun confidence'ını DEĞİŞTİRMEZ.

import { z } from "zod";

export const CustomMaterialSchema = z
  .object({
    id: z.string().min(1),
    nameTr: z.string().min(1).describe("Malzemenin kullanıcı tarafından verilen adı"),
    notesTr: z.string().describe("Malzeme özellikleri/uygunluk notu (serbest metin)"),
    sourceNoteTr: z
      .string()
      .min(1)
      .describe("Kullanıcının bu malzemeyi neden uygun gördüğüne dair KENDİ gerekçesi — bir standart/makale atfı DEĞİLDİR"),
    minRequiredCaMm: z.number().min(0).describe("Bu malzemenin alternatif olarak önerileceği minimum gerekli korozyon payı (mm)"),
    maxRequiredCaMm: z.number().min(0).nullable().describe("Üst sınır — null ise üst sınır yok"),
    relativeCostIndex: z.number().positive().nullable().describe("CS=1.0 referans göreli maliyet (kullanıcı tahmini, varsa)"),
  })
  .describe("Kullanıcı tanımlı malzeme adayı (KDP: UNVERIFIED)")
  .superRefine((material, ctx) => {
    if (material.maxRequiredCaMm !== null && material.maxRequiredCaMm < material.minRequiredCaMm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxRequiredCaMm"],
        message: "maxRequiredCaMm, minRequiredCaMm'den küçük olamaz.",
      });
    }
  });

export type CustomMaterial = z.infer<typeof CustomMaterialSchema>;

/** `requiredCaMm`, malzemenin uygun gördüğü [minRequiredCaMm, maxRequiredCaMm] aralığına düşüyor mu. */
export function isCustomMaterialApplicable(material: CustomMaterial, requiredCaMm: number): boolean {
  if (requiredCaMm < material.minRequiredCaMm) return false;
  if (material.maxRequiredCaMm !== null && requiredCaMm > material.maxRequiredCaMm) return false;
  return true;
}
