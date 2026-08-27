// apps/web/src/features/projects/ec3dSchema.ts
//
// `.ec3d` dosya biçiminin Zod doğrulaması. `WizardDraftSchema`/
// `Geometry|Mitigation|OperatingProfileSchema`/`SpatialDamageFieldSchema`
// MOTORUN/sihirbazın KENDİ şemalarıdır — burada TEKRAR YAZILMAZ.
//
// İSTİSNA — `LenientMechanismResultSchema`: motorun KENDİ
// `MechanismResultSchema`'sı `calculationTrace[].inputs`/`output` için katı
// `z.number()` ister (NaN'ı REDDEDER — bkz. Zod'un `z.number()`nin NaN'ı
// kendi başına ayrı bir tip saydığı davranışı). Ama motor GERÇEKTEN bazı
// adımlarda NaN üretebiliyor (ör. glikol oranı sıfırken bir bölme adımı —
// gözlemlenmiş gerçek veri, bkz. testler) — bu motorun KENDİ karar verdiği
// bir davranıştır, burada DEĞİŞTİRİLMEZ/"düzeltilmez". Bu dosya yalnızca
// dosya biçimi doğrulamasını bu GERÇEĞE göre gevşetir (KDP kapsamı DIŞI —
// hesap mantığı değil, JSON dosya biçimi doğrulaması); `ec3dJsonReviver`
// (ec3dSerialization.ts) JSON'daki NaN sentinel'ini gerçek `NaN`'a
// döndürdükten SONRA bu şema çalışır.

import { z } from "zod";
import { GeometrySchema, MitigationSchema, OperatingProfileSchema, SpatialDamageFieldSchema } from "@erocorr3d/engine";
import { WizardDraftSchema } from "../input/schema";

const finiteOrNan = z.union([z.number(), z.nan()]);
const ConfidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]);
const UncertaintyBandSchema = z.object({ p10: z.number(), p50: z.number(), p90: z.number() });

const TraceStepSchema = z.object({
  stepName: z.string().min(1),
  formula: z.string().min(1),
  inputs: z.record(z.string(), finiteOrNan),
  output: finiteOrNan,
  unit: z.string(),
  coefficientIds: z.array(z.string()),
});

const LenientMechanismResultSchema = z.object({
  mechanismId: z.string().min(1),
  nameTr: z.string().min(1),
  nameEn: z.string().min(1),
  // `finiteOrNan`: motor, mekanizma UYGULANMADIĞINDA (isApplicable=false) hız
  // alanlarını da NaN ile işaretleyebilir — `calculationTrace` ile AYNI
  // gerekçe (bkz. dosya başı notu).
  rateMmPerYear: finiteOrNan,
  rateP10: finiteOrNan,
  rateP50: finiteOrNan,
  rateP90: finiteOrNan,
  isApplicable: z.boolean(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  modelUsed: z.string().min(1),
  sourceRefs: z.array(z.string()),
  validityWarnings: z.array(z.string()),
  // `finiteOrNan` (KRİTİK): CO2 mekanizması erken sonlandığında (co2MolePercent
  // = 0 veya waterCutPercent = 0 — İKİSİ DE tamamen olağan mühendislik
  // durumları) motor `governingParameters.phUsed` alanına NaN yazar (bkz.
  // corrosion/norsokM506.ts::zeroResult, "pH kullanılmadı" işareti). Katı
  // `z.number()` bunu REDDEDİYORDU ve kullanıcının KENDİ dışa aktardığı
  // proje dosyası geri okunamıyordu (sessiz veri kaybı).
  governingParameters: z.record(z.string(), finiteOrNan),
  spatialSignatureId: z.string().min(1),
  calculationTrace: z.array(TraceStepSchema),
});

const QualitativeRiskFindingSchema = z.object({
  mechanismId: z.string(),
  nameTr: z.string(),
  isMechanismActive: z.boolean(),
  riskScore: z.number(),
  riskLevel: z.enum(["DÜŞÜK", "ORTA", "YÜKSEK", "ÇOK_YÜKSEK"]),
  rationaleTr: z.string(),
  sourceRefs: z.array(z.string()),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

const CaseAssessmentSchema = z.object({
  caseName: z.string(),
  mechanismResults: z.array(LenientMechanismResultSchema),
  qualitativeRiskFindings: z.array(QualitativeRiskFindingSchema),
  spatialDamageFieldFullLife: SpatialDamageFieldSchema,
  assumptionsTr: z.array(z.string()),
});

const ScenarioAnnualLossSchema = z.object({
  scenarioNameTr: z.string(),
  operatingDaysPerYear: z.number(),
  annualLossMmPerYear: UncertaintyBandSchema,
});

const ValidityWarningSchema = z.object({
  parameter: z.string(),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  unit: z.string(),
  message: z.string(),
});

const MetalLossResultSchema = z.object({
  scenarioAnnualLosses: z.array(ScenarioAnnualLossSchema),
  totalAnnualLossMmPerYear: UncertaintyBandSchema,
  designLifeYears: z.number(),
  totalServiceLifeCorrosionMm: UncertaintyBandSchema,
  governingScenarioNameTr: z.string(),
  confidence: ConfidenceLevelSchema,
  validityWarnings: z.array(ValidityWarningSchema),
  sourcesUsed: z.array(z.string()),
  disclaimer: z.string(),
});

const ScenarioAssessmentSchema = z.object({
  componentLabel: z.string(),
  perCase: z.array(CaseAssessmentSchema),
  metalLoss: MetalLossResultSchema,
  governingCaseName: z.string(),
});

const AssessmentRunRecordSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  componentId: z.string().min(1),
  componentLabel: z.string().min(1),
  computedAt: z.number(),
  engineVersion: z.string().min(1),
  geometry: GeometrySchema,
  mitigation: MitigationSchema,
  operatingProfile: OperatingProfileSchema,
  assessment: ScenarioAssessmentSchema,
  uninhibitedAssessment: ScenarioAssessmentSchema,
});

const ProjectComponentRecordSchema = WizardDraftSchema.and(z.object({ projectId: z.string().min(1) }));

const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  client: z.string(),
  facility: z.string(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  revision: z.string(),
});

export const Ec3dFileSchema = z.object({
  formatVersion: z.number(),
  exportedAt: z.number(),
  project: ProjectRecordSchema,
  components: z.array(ProjectComponentRecordSchema),
  assessmentRuns: z.array(AssessmentRunRecordSchema),
});

export type Ec3dFileParsed = z.infer<typeof Ec3dFileSchema>;
