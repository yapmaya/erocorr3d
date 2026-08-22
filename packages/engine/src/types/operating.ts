// packages/engine/src/types/operating.ts

import { z } from "zod";
import { FluidChemistrySchema, ProcessConditionsSchema, SolidsDataSchema } from "./process";

/**
 * Bir işletme senaryosu (ör. "Kış Çekiş Modu", 91 gün/yıl): belirli proses
 * koşulları, akışkan kimyası ve katı madde verisiyle tanımlanır.
 */
export const OperatingCaseSchema = z.object({
  name: z.string().min(1).describe("Senaryo adı"),
  description: z.string().describe("Senaryo açıklaması"),
  durationDaysPerYear: z
    .number()
    .min(0)
    .max(365)
    .describe("Bu senaryonun yılda kaç gün geçerli olduğu"),
  process: ProcessConditionsSchema.describe("Proses koşulları"),
  chemistry: FluidChemistrySchema.describe("Akışkan kimyası"),
  solids: SolidsDataSchema.describe("Katı parçacık verisi"),
});

export type OperatingCase = z.infer<typeof OperatingCaseSchema>;

/**
 * Bir bileşenin tüm servis ömrü boyunca karşılaşacağı işletme senaryolarının
 * bütünü. Senaryoların toplam gün sayısı 365'i geçemez (bkz. superRefine) —
 * "kısmi çalışma toplam metal kaybını orantılı azaltır" kuralının önkoşulu.
 */
export const OperatingProfileSchema = z
  .object({
    designLifeYears: z.number().positive().max(100).describe("Tasarım ömrü (yıl)"),
    corrosionAllowanceMm: z.number().min(0).max(50).describe("Korozyon payı (mm)"),
    cases: z.array(OperatingCaseSchema).min(1).describe("İşletme senaryoları listesi"),
  })
  .describe("İşletme profili")
  .superRefine((profile, ctx) => {
    const totalDays = profile.cases.reduce((sum, c) => sum + c.durationDaysPerYear, 0);
    if (totalDays > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cases"],
        message: `Senaryoların toplam süresi (${totalDays} gün) 365 günü geçemez.`,
      });
    }
  });

export type OperatingProfile = z.infer<typeof OperatingProfileSchema>;
