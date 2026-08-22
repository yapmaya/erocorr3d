// apps/web/src/features/input/schema.ts
//
// Girdi sihirbazının TEK taslak şeması. Motorun kendi Zod şemalarını
// (GeometrySchema/ValveGeometrySchema/MitigationSchema/OperatingProfileSchema)
// DOĞRUDAN kullanır — bunları UI'da tekrar yazmak hem KDP'nin "tek kaynak"
// ruhuna aykırı olur hem de iki yerde senkron tutma riski doğurur (bkz.
// motorun kendi superRefine kuralları: idMm<odMm, kum varsa parçacık
// alanları zorunlu, senaryo toplamı≤365 gün, inhibitör alanları vb. — hepsi
// buradan MİRAS alınır).
//
// Vana desteği: `geometry` alanı HER ZAMAN (kategori ne olursa olsun) ortak
// boru/fitting alanlarını taşır; `valveGeometry` yalnızca kategori=VALVE
// iken doludur ve TÜM ValveGeometry alanlarını (geometry'nin ortak
// alanları DAHİL) taşır — motora/önizlemeye gönderilecek "gerçek" nesne
// budur. İki alanın ortak kısmı senkron tutulur (bkz. InputWizard.tsx'in
// valveGeometry→geometry senkron efekti); bu dosya yalnızca ŞEMAYI tanımlar.

import { z } from "zod";
import {
  GeometrySchema,
  MitigationSchema,
  OperatingProfileSchema,
  ValveGeometrySchema,
} from "@erocorr3d/engine";

export const ComponentCategoryEnum = z.enum(["PIPE_FITTING", "VALVE"]);
export type ComponentCategory = z.infer<typeof ComponentCategoryEnum>;

export const UncertaintyDistributionEnum = z.enum(["NORMAL", "UNIFORM", "TRIANGULAR", "LOGNORMAL"]);
export type UncertaintyDistribution = z.infer<typeof UncertaintyDistributionEnum>;

/**
 * Adım 8'in "hangi girdi belirsiz + hangi dağılım" bilgisi. Bu oturumda
 * `uncertainty/monteCarlo.ts`'e BAĞLANMAZ (bkz. master plan'ın kapsam
 * kararı #3) — yalnızca taslakla birlikte saklanır, gelecekteki bir Monte
 * Carlo entegrasyonu için.
 */
export const UncertainFieldNoteSchema = z.object({
  id: z.string().min(1),
  fieldLabelTr: z.string().min(1).describe("Belirsiz kabul edilen girdinin Türkçe adı"),
  distribution: UncertaintyDistributionEnum,
  notesTr: z.string().describe("Kullanıcının serbest metin notu (ör. tahmin kaynağı)"),
});
export type UncertainFieldNote = z.infer<typeof UncertainFieldNoteSchema>;

export const WizardDraftSchema = z.object({
  id: z.string().min(1),
  componentLabel: z.string().min(1).describe("Bileşen/hat adı — raporlarda ve 3B görünümde kullanılır"),
  componentCategory: ComponentCategoryEnum,
  geometry: GeometrySchema,
  valveGeometry: ValveGeometrySchema.optional(),
  mitigation: MitigationSchema,
  operatingProfile: OperatingProfileSchema,
  activeStep: z.number().int().min(1).max(8),
  activeCaseIndex: z.number().int().min(0),
  uncertainNotes: z.array(UncertainFieldNoteSchema),
  updatedAt: z.number(),
});

export type WizardDraft = z.infer<typeof WizardDraftSchema>;

export const WIZARD_STEP_COUNT = 8;

export interface WizardStepDef {
  step: number;
  id: string;
  titleTr: string;
}

export const WIZARD_STEPS: WizardStepDef[] = [
  { step: 1, id: "component", titleTr: "Bileşen Seçimi" },
  { step: 2, id: "geometry", titleTr: "Geometri" },
  { step: 3, id: "process", titleTr: "Proses Koşulları" },
  { step: 4, id: "chemistry", titleTr: "Akışkan Kimyası" },
  { step: 5, id: "solids", titleTr: "Katı Partikül" },
  { step: 6, id: "protection", titleTr: "Koruma ve İşletme" },
  { step: 7, id: "scenarios", titleTr: "İşletme Senaryoları" },
  { step: 8, id: "uncertainty", titleTr: "Belirsizlik (opsiyonel)" },
];
