// packages/engine/src/orchestrate/spatialSignatureRouting.ts
//
// (mekanizma "arketipi" × bileşen tipi) → spatial/pipeFittings.ts'in somut
// PipeFittingSignatureId'sine + governingParameters bag'ine yönlendirme
// kararı.
//
// KDP notu: bu SAYISAL bir katsayı DEĞİL, bir YÖNLENDİRME kararıdır —
// corrosion/rules.ts, corrosion/modelRouter.ts, erosion/index.ts::
// selectDnvErosionModel ile AYNI statüde (proje mühendislik kararı, kayıt
// defteri kapsamı DIŞINDA, yayımlanmış bir sabit değildir).
//
// data/mechanisms.ts'in KENDİ spatialSignatureId alanı (ör. "BOTTOM_6_OCLOCK",
// "TOP_12_OCLOCK", "DOWNSTREAM_OF_RESTRICTION") bileşen GEOMETRİSİNDEN
// BAĞIMSIZ, arketipik/tipik hasar deseni etiketleridir — o katalog bir
// bileşenin somut geometrisini BİLMEZ. spatial/pipeFittings.ts'in 14 imzası
// ise GEOMETRİ-ÖZGÜdür (dirsek/te/redüksiyon/kaynak/düz boru farklı şekiller
// alır). Bu dosya, bir mekanizmanın hangi "ARKETİP"e ait olduğuna göre
// (SpatialArchetype), ÇAĞRILDIĞI bileşenin componentType'ına bakarak somut
// bir geometri imzası seçer.
//
// Vana tipleri (ComponentTypeEnum'daki 15 vana) BU dosyanın kapsamı
// DIŞINDADIR — spatial/valves.ts'in kendi bölge-bazlı yerleşimi kullanılır
// (bkz. spatial/index.ts'in VALVE_COMPONENT_TYPES ayrımı, orchestrate/
// assessComponent.ts'in AYNI ayrımı tekrar etmesi kaçınılmazdır — tek bir
// merkezi "hangi tipler vanadır" listesi bu projede henüz yok, bkz.
// spatial/index.ts'in kendi notu).

import type { ComponentType } from "../types/enums";
import type { Geometry } from "../types/geometry";
import type { PipeFittingSignatureId } from "../spatial/pipeFittings";

/**
 * Bir mekanizmanın ısı haritasındaki hasar deseninin GENEL karakteri —
 * data/mechanisms.ts'teki mekanizmaları, uzamsal davranışlarına göre küçük
 * bir grup arketipe indirger.
 */
export type SpatialArchetype =
  /** Stratifiye akışta boru ALTINDA/dip su fazında biriken korozyon (düz boruda), fitting'lerde türbülanslı genel incelme */
  | "BULK_LIQUID_OR_TURBULENT_THINNING"
  /** Boru ÜST yüzeyinde (12 yönü) buhar yoğuşması — mekanizma zaten geometriden bağımsız, TEK imza */
  | "TOP_OF_LINE_CONDENSATION"
  /** Parçacık/damlacık çarpması, akış yönü değişen/daralan HER noktada — dirsek/te/redüksiyon/orifis/düz boru şekli değişir */
  | "IMPINGEMENT"
  /** Dış yüzeyde, dağınık/bantlı desen (atmosferik/CUI benzeri) */
  | "EXTERNAL_DISTRIBUTED";

export interface SpatialRoutingResult {
  signatureId: PipeFittingSignatureId;
  governingParameters: Record<string, number>;
}

export interface SpatialRoutingContext {
  liquidHoldupFraction?: number;
  particleDiameterM?: number;
  flowRegime?: string;
}

const STRATIFIED_FLOW_REGIMES: ReadonlySet<string> = new Set(["STRATIFIED_SMOOTH", "STRATIFIED_WAVY"]);

/**
 * Akış-yönü-değişen/daralan fitting tiplerinin ortak geometri imza haritası
 * — hem türbülanslı genel incelme (CO2 vb.) hem çarpma/impingement
 * (erozyon) arketipleri AYNI fiziksel konumu (dirsek dışbükeyi, kör Te
 * ucu, redüksiyon boğazı, kaynak kökü) paylaşır, bu yüzden TEK bir harita.
 */
const FITTING_SIGNATURE_MAP: Partial<Record<ComponentType, PipeFittingSignatureId>> = {
  STRAIGHT_PIPE: "UNIFORM_FULL_BORE",
  ELBOW_90: "ELBOW_EXTRADOS_IMPINGEMENT",
  ELBOW_45: "ELBOW_EXTRADOS_IMPINGEMENT",
  BEND_LONG_RADIUS: "ELBOW_EXTRADOS_IMPINGEMENT",
  BEND_SHORT_RADIUS: "ELBOW_EXTRADOS_IMPINGEMENT",
  MITER_BEND: "ELBOW_EXTRADOS_IMPINGEMENT",
  TEE_BLIND: "TEE_BLIND_IMPACT",
  TEE_SWEEPING: "TEE_BRANCH_SHARP_EDGE",
  TEE_BRANCH: "TEE_BRANCH_SHARP_EDGE",
  REDUCER_CONCENTRIC: "REDUCER_THROAT_DOWNSTREAM",
  REDUCER_ECCENTRIC: "REDUCER_THROAT_DOWNSTREAM",
  RESTRICTION_ORIFICE: "ORIFICE_DOWNSTREAM_JET",
  WELDOLET: "WELD_ROOT_TURBULENCE",
  WELD_JOINT: "WELD_ROOT_TURBULENCE",
  FLANGE_WELD_NECK: "WELD_ROOT_TURBULENCE",
};

/**
 * "BULK_LIQUID_OR_TURBULENT_THINNING" arketipi (ör. CO2/H2S genel korozyonu)
 * — düz boruda stratifiye akışta dip-biriken (BLC_STRATIFIED) DIŞINDA, HER
 * bileşen tipinde (fitting dahil) ISLAK YÜZEYİN TAMAMINA yayılır: bu, bir
 * DARBE/impingement mekanizması DEĞİL, akışkanın kimyasal olarak temas
 * ettiği HER noktada işleyen genel bir incelme sürecidir — dirseğin
 * extrados'una veya te'nin dal ağzına ÖZEL bir tercihi yoktur (bkz. bu
 * dosyanın SpatialArchetype JSDoc'u: "fitting'lerde türbülanslı GENEL
 * incelme"). Önceden bu arketip YANLIŞLIKLA `resolveImpingementSignature`
 * ile AYNI (dar/lokalize) fitting imzasını paylaşıyordu — sonuç: bir dirsekte
 * CO2 korozyonu, erozyon impingement'ıyla AYNI dar extrados bandına
 * sıkışıyor, ısı haritasının geri kalanı neredeyse sıfır değer alıyordu
 * (tarayıcıda GERÇEK RENDER'da yakalanan gerçek bir hata — bkz. usePipeGeometry.ts'in
 * bileşen tipini artık gerçekten render etmesiyle ORTAYA ÇIKTI, önceden ana
 * görüntüleyici HER ZAMAN düz boru çizdiği için UNIFORM_FULL_BORE zaten
 * doğru görünüyordu).
 */
function resolveBulkLiquidSignature(component: Geometry, ctx: SpatialRoutingContext): SpatialRoutingResult {
  if (component.componentType === "STRAIGHT_PIPE" && ctx.flowRegime && STRATIFIED_FLOW_REGIMES.has(ctx.flowRegime)) {
    return {
      signatureId: "BLC_STRATIFIED",
      governingParameters: { liquidHoldupFraction: ctx.liquidHoldupFraction ?? 0.3 },
    };
  }
  return { signatureId: "UNIFORM_FULL_BORE", governingParameters: {} };
}

/**
 * "IMPINGEMENT" arketipi (parçacık/damlacık çarpması) — akış yönü
 * değişen/daralan NOKTAYA göre LOKALİZE olur, bu yüzden bileşen tipine özgü
 * dar imzayı (dirsek extrados'u, kör te ucu, redüksiyon boğazı, kaynak kökü)
 * kullanmaya devam eder; düz boruda (yön değişimi yok) UNIFORM_FULL_BORE'a düşer.
 */
function resolveImpingementSignature(component: Geometry, ctx: SpatialRoutingContext): SpatialRoutingResult {
  const signatureId = FITTING_SIGNATURE_MAP[component.componentType];
  if (!signatureId) {
    throw new Error(
      `"${component.componentType}" bileşen tipi için boru/fitting uzamsal imza eşlemesi tanımlı değil ` +
        "(vana tipiyse spatial/valves.ts kullanılmalı, yeni bir fitting tipiyse bu dosyaya eklenmelidir).",
    );
  }

  const governingParameters: Record<string, number> = {};
  if (signatureId === "ELBOW_EXTRADOS_IMPINGEMENT") {
    governingParameters.bendRadiusRatio = component.bendRadiusRatio ?? 1.5;
    if (ctx.particleDiameterM !== undefined) {
      governingParameters.particleDiameterM = ctx.particleDiameterM;
    }
  }
  return { signatureId, governingParameters };
}

/**
 * Bir mekanizmayı, verilen bileşen üzerinde somut bir spatial/
 * pipeFittings.ts imzasına ve o imzanın ihtiyaç duyduğu governingParameters
 * bag'ine çevirir.
 *
 * @param archetype Mekanizmanın uzamsal karakteri (bkz. SpatialArchetype)
 * @param component Bileşen geometrisi (VANA OLAMAZ — bkz. dosya başı notu)
 * @param ctx İmzanın ihtiyaç duyabileceği runtime değerleri (mekanizma
 * çalıştırıcısından gelir — ör. NORSOK/erozyon hesabının kendi girdileri)
 */
export function resolvePipeFittingSpatialSignature(
  archetype: SpatialArchetype,
  component: Geometry,
  ctx: SpatialRoutingContext = {},
): SpatialRoutingResult {
  switch (archetype) {
    case "TOP_OF_LINE_CONDENSATION":
      return { signatureId: "TLC_CONDENSATION", governingParameters: {} };

    case "EXTERNAL_DISTRIBUTED":
      // Bilinen sınırlama: bu proje henüz İÇ/DIŞ yüzeyi ayrı iki
      // SpatialDamageField olarak MODELLEMİYOR (tek bir (u,v) alanı,
      // bileşenin görünür dış yüzeyine render edilir) — dış korozyon bu
      // yüzden İÇ mekanizmalarla AYNI alana (yaklaşık/temsili olarak)
      // katkıda bulunur. CUI_EXTERNAL_BANDS, mevcut 14 imza arasında dış/
      // dağınık bir desene EN YAKIN olanıdır.
      return { signatureId: "CUI_EXTERNAL_BANDS", governingParameters: {} };

    case "BULK_LIQUID_OR_TURBULENT_THINNING":
      return resolveBulkLiquidSignature(component, ctx);

    case "IMPINGEMENT":
      return resolveImpingementSignature(component, ctx);
  }
}
