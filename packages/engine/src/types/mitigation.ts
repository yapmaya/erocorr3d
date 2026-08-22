// packages/engine/src/types/mitigation.ts

import { z } from "zod";
import { InternalLiningEnum } from "./enums";

/**
 * Korozyon/erozyon azaltma (mitigation) önlemleri. İnhibitör alanları
 * yalnızca inhibitorUsed=true iken doldurulabilir (bkz. superRefine) —
 * "İnhibitör faydası yalnızca açıkça belirtilen hatlarda uygulanır" kuralının
 * şema düzeyinde karşılığı.
 */
export const MitigationSchema = z
  .object({
    inhibitorUsed: z.boolean().describe("Kimyasal korozyon inhibitörü kullanılıyor mu"),
    inhibitorAvailabilityPercent: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("İnhibitör kullanılabilirlik oranı (%) — yalnızca inhibitorUsed=true iken"),
    inhibitorEfficiencyPercent: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("İnhibitör verimliliği (%) — yalnızca inhibitorUsed=true iken"),
    biocideUsed: z.boolean().describe("Biyosit kullanılıyor mu (MIC önlemi)"),
    o2ScavengerUsed: z.boolean().describe("Oksijen tutucu (O2 scavenger) kullanılıyor mu"),
    internalLining: InternalLiningEnum.describe("İç kaplama/astar tipi"),
    externalCoating: z
      .string()
      .min(1)
      .optional()
      .describe("Dış kaplama tipi (serbest metin, ör. \"3LPE\", \"3LPP\")"),
    cathodicProtection: z.boolean().describe("Katodik koruma mevcut mu"),
    insulationChlorideLeachable: z
      .boolean()
      .optional()
      .describe("İzolasyon malzemesi klorür sızdırabilir mi (CUI riski için)"),
  })
  .describe("Korozyon/erozyon azaltma önlemleri")
  .superRefine((mitigation, ctx) => {
    if (!mitigation.inhibitorUsed) {
      if (mitigation.inhibitorAvailabilityPercent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inhibitorAvailabilityPercent"],
          message: "inhibitorUsed=false iken inhibitorAvailabilityPercent belirtilemez.",
        });
      }
      if (mitigation.inhibitorEfficiencyPercent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inhibitorEfficiencyPercent"],
          message: "inhibitorUsed=false iken inhibitorEfficiencyPercent belirtilemez.",
        });
      }
    }
  });

export type Mitigation = z.infer<typeof MitigationSchema>;
