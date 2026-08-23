// packages/engine/src/types/enums.ts
//
// Kapalı liste (enum) alanlar ve TR/EN etiket sözlükleri.
//
// NOT: Yalnızca proje talimatında AÇIKÇA sabit bir değer listesi verilen
// alanlar burada enum olarak tanımlanmıştır (ör. trimType, flowDirection).
// Talimatta değer listesi verilmeyen alanlar (ör. ValveGeometry.bodyStyle,
// seatMaterial, trimMaterial, stemType, packingType) serbest metin (z.string())
// olarak bırakılmıştır — kapalı bir liste olmadığı hâlde uydurma bir enum
// tanımlamak KDP'nin "uydurma yok" ilkesine aykırı olurdu.

import { z } from "zod";

export interface LocalizedLabel {
  tr: string;
  en: string;
}

// ─────────────────────────────────────────────────────────────────────────
// ComponentType
// ─────────────────────────────────────────────────────────────────────────

export const ComponentTypeEnum = z.enum([
  "STRAIGHT_PIPE",
  "ELBOW_90",
  "ELBOW_45",
  "BEND_LONG_RADIUS",
  "BEND_SHORT_RADIUS",
  "MITER_BEND",
  "TEE_BLIND",
  "TEE_SWEEPING",
  "TEE_BRANCH",
  "REDUCER_CONCENTRIC",
  "REDUCER_ECCENTRIC",
  "WELDOLET",
  "WELD_JOINT",
  "FLANGE_WELD_NECK",
  "GATE_VALVE",
  "GLOBE_VALVE",
  "BALL_VALVE_FULL",
  "BALL_VALVE_REDUCED",
  "BUTTERFLY_VALVE",
  "CHECK_VALVE_SWING",
  "CHECK_VALVE_LIFT",
  "CHECK_VALVE_DUAL_PLATE",
  "PLUG_VALVE",
  "NEEDLE_VALVE",
  "CHOKE_VALVE",
  "CONTROL_VALVE_GLOBE",
  "CONTROL_VALVE_CAGE",
  "PRESSURE_SAFETY_VALVE",
  "RESTRICTION_ORIFICE",
]);
export type ComponentType = z.infer<typeof ComponentTypeEnum>;

export const COMPONENT_TYPE_LABELS: Record<ComponentType, LocalizedLabel> = {
  STRAIGHT_PIPE: { tr: "Düz Boru", en: "Straight Pipe" },
  ELBOW_90: { tr: "90° Dirsek", en: "90° Elbow" },
  ELBOW_45: { tr: "45° Dirsek", en: "45° Elbow" },
  BEND_LONG_RADIUS: { tr: "Uzun Radyuslu Bükme", en: "Long Radius Bend" },
  BEND_SHORT_RADIUS: { tr: "Kısa Radyuslu Bükme", en: "Short Radius Bend" },
  MITER_BEND: { tr: "Gönye (Miter) Bükme", en: "Miter Bend" },
  TEE_BLIND: { tr: "Kör Te", en: "Blind Tee" },
  TEE_SWEEPING: { tr: "Yumuşak Geçişli Te", en: "Sweeping Tee" },
  TEE_BRANCH: { tr: "Dallanma Te", en: "Branch Tee" },
  REDUCER_CONCENTRIC: { tr: "Eş Merkezli Redüksiyon", en: "Concentric Reducer" },
  REDUCER_ECCENTRIC: { tr: "Dış Merkezli Redüksiyon", en: "Eccentric Reducer" },
  WELDOLET: { tr: "Weldolet", en: "Weldolet" },
  WELD_JOINT: { tr: "Kaynak Bağlantısı", en: "Weld Joint" },
  FLANGE_WELD_NECK: { tr: "Kaynak Boyunlu Flanş", en: "Weld Neck Flange" },
  GATE_VALVE: { tr: "Sürgülü Vana", en: "Gate Valve" },
  GLOBE_VALVE: { tr: "Glob Vana", en: "Globe Valve" },
  BALL_VALVE_FULL: { tr: "Tam Geçişli Küresel Vana", en: "Full-Bore Ball Valve" },
  BALL_VALVE_REDUCED: { tr: "Daraltılmış Geçişli Küresel Vana", en: "Reduced-Bore Ball Valve" },
  BUTTERFLY_VALVE: { tr: "Kelebek Vana", en: "Butterfly Valve" },
  CHECK_VALVE_SWING: { tr: "Çırpma Tip Çekvalf", en: "Swing Check Valve" },
  CHECK_VALVE_LIFT: { tr: "Kaldırmalı Çekvalf", en: "Lift Check Valve" },
  CHECK_VALVE_DUAL_PLATE: { tr: "Çift Plakalı Çekvalf", en: "Dual Plate Check Valve" },
  PLUG_VALVE: { tr: "Tapa Vana", en: "Plug Valve" },
  NEEDLE_VALVE: { tr: "İğne Vana", en: "Needle Valve" },
  CHOKE_VALVE: { tr: "Choke (Kısma) Vana", en: "Choke Valve" },
  CONTROL_VALVE_GLOBE: { tr: "Glob Tip Kontrol Vanası", en: "Globe Control Valve" },
  CONTROL_VALVE_CAGE: { tr: "Kafesli (Cage) Kontrol Vanası", en: "Cage-Guided Control Valve" },
  PRESSURE_SAFETY_VALVE: { tr: "Basınç Emniyet Vanası", en: "Pressure Safety Valve" },
  RESTRICTION_ORIFICE: { tr: "Kısıcı Orifis", en: "Restriction Orifice" },
};

// ─────────────────────────────────────────────────────────────────────────
// Orientation / Installation
// ─────────────────────────────────────────────────────────────────────────

export const OrientationEnum = z.enum(["HORIZONTAL", "VERTICAL_UP", "VERTICAL_DOWN", "INCLINED"]);
export type Orientation = z.infer<typeof OrientationEnum>;

export const ORIENTATION_LABELS: Record<Orientation, LocalizedLabel> = {
  HORIZONTAL: { tr: "Yatay", en: "Horizontal" },
  VERTICAL_UP: { tr: "Dikey Yukarı Akış", en: "Vertical Up" },
  VERTICAL_DOWN: { tr: "Dikey Aşağı Akış", en: "Vertical Down" },
  INCLINED: { tr: "Eğimli", en: "Inclined" },
};

export const InstallationEnum = z.enum(["ABOVE_GROUND", "BURIED", "SUBSEA"]);
export type Installation = z.infer<typeof InstallationEnum>;

export const INSTALLATION_LABELS: Record<Installation, LocalizedLabel> = {
  ABOVE_GROUND: { tr: "Yer Üstü", en: "Above Ground" },
  BURIED: { tr: "Gömülü", en: "Buried" },
  SUBSEA: { tr: "Deniz Altı", en: "Subsea" },
};

// ─────────────────────────────────────────────────────────────────────────
// LocationClass (ASME B31.8 §840.2 nüfus yoğunluğu sınıfı, 1-4) —
// mechanicalIntegrity/b31g.ts'in ZATEN kullandığı 1|2|3|4 tipiyle AYNI
// (bkz. registry/coefficients/b31g.ts::b31g.locationClassDesignFactor'ın
// kendi TR açıklamaları) — burada Geometry şemasının GERÇEK bir girdi alanı
// olarak taşınabilmesi için z.union olarak tanımlanır.
// ─────────────────────────────────────────────────────────────────────────

export const LocationClassEnum = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type LocationClassValue = z.infer<typeof LocationClassEnum>;

export const LOCATION_CLASS_LABELS: Record<LocationClassValue, LocalizedLabel> = {
  1: { tr: "Sınıf 1 — Kırsal/seyrek yerleşim (offshore dahil)", en: "Class 1 — Rural/sparse (incl. offshore)" },
  2: { tr: "Sınıf 2 — Şehir çeperi/orta yoğunlukta yerleşim", en: "Class 2 — Suburban/medium density" },
  3: { tr: "Sınıf 3 — Yoğun yerleşim (banliyö)", en: "Class 3 — Dense settlement" },
  4: { tr: "Sınıf 4 — Çok katlı bina yoğunluğu (şehir merkezi)", en: "Class 4 — High-rise density (urban core)" },
};

// ─────────────────────────────────────────────────────────────────────────
// EnvironmentalSensitivity — RBI-lite "çevresel etki" ekseni ve Muayene
// Planı için sahanın niteliksel çevresel hassasiyeti. Motor içinde
// türetilebilecek bir veri YOK (su kaynağına yakınlık, ekolojik hassas alan
// vb. hiçbir şemada taşınmıyor) — kullanıcının doğrudan işaretlemesi
// gerekir, bu yüzden kapalı bir liste olarak tanımlanır (KDP'nin "uydurma
// yok" ilkesiyle tutarlı: sayısal bir eşik İCAT EDİLMİYOR, yalnızca
// niteliksel bir sınıflandırma sunuluyor).
// ─────────────────────────────────────────────────────────────────────────

export const EnvironmentalSensitivityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type EnvironmentalSensitivity = z.infer<typeof EnvironmentalSensitivityEnum>;

export const ENVIRONMENTAL_SENSITIVITY_LABELS: Record<EnvironmentalSensitivity, LocalizedLabel> = {
  LOW: { tr: "Düşük (kuru/ıssız saha)", en: "Low (dry/remote site)" },
  MEDIUM: { tr: "Orta", en: "Medium" },
  HIGH: { tr: "Yüksek (su kaynağına/yerleşime/ekolojik hassas alana yakın)", en: "High (near water/settlement/sensitive habitat)" },
};

// ─────────────────────────────────────────────────────────────────────────
// FlowRegime
// ─────────────────────────────────────────────────────────────────────────

export const FlowRegimeEnum = z.enum([
  "STRATIFIED_SMOOTH",
  "STRATIFIED_WAVY",
  "SLUG",
  "ANNULAR",
  "MIST",
  "BUBBLE",
  "CHURN",
]);
export type FlowRegime = z.infer<typeof FlowRegimeEnum>;

export const FLOW_REGIME_LABELS: Record<FlowRegime, LocalizedLabel> = {
  STRATIFIED_SMOOTH: { tr: "Tabakalı Düzgün Akış", en: "Stratified Smooth" },
  STRATIFIED_WAVY: { tr: "Tabakalı Dalgalı Akış", en: "Stratified Wavy" },
  SLUG: { tr: "Tıkaç (Slug) Akışı", en: "Slug Flow" },
  ANNULAR: { tr: "Halkasal Akış", en: "Annular Flow" },
  MIST: { tr: "Sis (Mist) Akışı", en: "Mist Flow" },
  BUBBLE: { tr: "Kabarcıklı Akış", en: "Bubble Flow" },
  CHURN: { tr: "Çalkantılı (Churn) Akış", en: "Churn Flow" },
};

// ─────────────────────────────────────────────────────────────────────────
// InternalLining
// ─────────────────────────────────────────────────────────────────────────

export const InternalLiningEnum = z.enum([
  "NONE",
  "EPOXY_PHENOLIC",
  "GLASS_FLAKE",
  "PE",
  "PTFE",
  "CRA_CLAD",
  "WELD_OVERLAY",
]);
export type InternalLining = z.infer<typeof InternalLiningEnum>;

export const INTERNAL_LINING_LABELS: Record<InternalLining, LocalizedLabel> = {
  NONE: { tr: "Yok", en: "None" },
  EPOXY_PHENOLIC: { tr: "Epoksi Fenolik Kaplama", en: "Epoxy Phenolic Lining" },
  GLASS_FLAKE: { tr: "Cam Pulu (Glass Flake) Kaplama", en: "Glass Flake Lining" },
  PE: { tr: "Polietilen (PE) Kaplama", en: "Polyethylene (PE) Lining" },
  PTFE: { tr: "PTFE Kaplama", en: "PTFE Lining" },
  CRA_CLAD: { tr: "Korozyona Dayanıklı Alaşım (CRA) Kaplama", en: "Corrosion-Resistant Alloy (CRA) Clad" },
  WELD_OVERLAY: { tr: "Kaynak Dolgu (Overlay) Kaplama", en: "Weld Overlay" },
};

// ─────────────────────────────────────────────────────────────────────────
// ValveGeometry alt-enum'ları
// ─────────────────────────────────────────────────────────────────────────

export const TrimTypeEnum = z.enum(["STANDARD", "MULTISTAGE", "ANTI_CAVITATION", "LOW_NOISE"]);
export type TrimType = z.infer<typeof TrimTypeEnum>;

export const TRIM_TYPE_LABELS: Record<TrimType, LocalizedLabel> = {
  STANDARD: { tr: "Standart Trim", en: "Standard Trim" },
  MULTISTAGE: { tr: "Çok Kademeli Trim", en: "Multistage Trim" },
  ANTI_CAVITATION: { tr: "Kavitasyon Önleyici Trim", en: "Anti-Cavitation Trim" },
  LOW_NOISE: { tr: "Düşük Gürültülü Trim", en: "Low-Noise Trim" },
};

export const FlowDirectionEnum = z.enum(["OVER_SEAT", "UNDER_SEAT"]);
export type FlowDirection = z.infer<typeof FlowDirectionEnum>;

export const FLOW_DIRECTION_LABELS: Record<FlowDirection, LocalizedLabel> = {
  OVER_SEAT: { tr: "Oturak Üzerinden Akış", en: "Flow Over Seat" },
  UNDER_SEAT: { tr: "Oturak Altından Akış", en: "Flow Under Seat" },
};

export const PRESSURE_CLASS_VALUES = [150, 300, 600, 900, 1500, 2500] as const;
export const PressureClassEnum = z.union([
  z.literal(150),
  z.literal(300),
  z.literal(600),
  z.literal(900),
  z.literal(1500),
  z.literal(2500),
]);
export type PressureClass = z.infer<typeof PressureClassEnum>;

// ─────────────────────────────────────────────────────────────────────────
// AssessmentResult.likelihoodCategory
// ─────────────────────────────────────────────────────────────────────────

export const LikelihoodCategoryEnum = z.enum(["NEGLIGIBLE", "LOW", "MEDIUM", "HIGH"]);
export type LikelihoodCategory = z.infer<typeof LikelihoodCategoryEnum>;

export const LIKELIHOOD_CATEGORY_LABELS: Record<LikelihoodCategory, LocalizedLabel> = {
  NEGLIGIBLE: { tr: "İhmal Edilebilir", en: "Negligible" },
  LOW: { tr: "Düşük", en: "Low" },
  MEDIUM: { tr: "Orta", en: "Medium" },
  HIGH: { tr: "Yüksek", en: "High" },
};

// ─────────────────────────────────────────────────────────────────────────
// MechanismResult.confidence
//
// NOT: registry'deki ConfidenceLevel'dan (registry/types.ts) kasıtlı olarak
// FARKLI bir tiptir — burada "UNVERIFIED" yok, çünkü doğrulanmamış katsayı
// kullanımı ayrı bir alanla (AssessmentResult.unverifiedCoefficientsUsed)
// izleniyor. MechanismResult.confidence yalnızca modelin GEÇERLİLİK
// ARALIĞINA ne kadar uyduğunu HIGH/MEDIUM/LOW olarak özetler.
// ─────────────────────────────────────────────────────────────────────────

export const MechanismConfidenceEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type MechanismConfidence = z.infer<typeof MechanismConfidenceEnum>;

export const MECHANISM_CONFIDENCE_LABELS: Record<MechanismConfidence, LocalizedLabel> = {
  HIGH: { tr: "Yüksek", en: "High" },
  MEDIUM: { tr: "Orta", en: "Medium" },
  LOW: { tr: "Düşük", en: "Low" },
};

// ─────────────────────────────────────────────────────────────────────────
// SpatialDamageField.parameterization
// ─────────────────────────────────────────────────────────────────────────

export const SpatialParameterizationEnum = z.enum([
  "CYLINDRICAL_UV",
  "TORUS_UV",
  "LATHE_PROFILE",
  "CUSTOM_MESH",
]);
export type SpatialParameterization = z.infer<typeof SpatialParameterizationEnum>;

export const SPATIAL_PARAMETERIZATION_LABELS: Record<SpatialParameterization, LocalizedLabel> = {
  CYLINDRICAL_UV: { tr: "Silindirik (U-V) Parametrizasyon", en: "Cylindrical (U-V) Parameterization" },
  TORUS_UV: { tr: "Torus (U-V) Parametrizasyon", en: "Torus (U-V) Parameterization" },
  LATHE_PROFILE: { tr: "Döndürme (Lathe) Profili", en: "Lathe Profile" },
  CUSTOM_MESH: { tr: "Özel Mesh", en: "Custom Mesh" },
};
