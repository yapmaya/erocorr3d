// packages/engine/src/fluids/friction.ts
//
// Boru içi tek-fazlı akış için sürtünme faktörü, Reynolds sayısı ve duvar
// kayma gerilmesi hesapları.
//
// Modeller:
//   Re = ρ·u·D/μ                                          (Reynolds sayısı)
//   f_laminer = 64/Re                                      (Re<2300, TAM/analitik — Hagen-Poiseuille)
//   Colebrook-White (1939, Re>4000): 1/√f = -2log10(ε/(3.7D) + 2.51/(Re√f))  [DARCY f, iteratif/Newton-Raphson]
//   Churchill (1977, TÜM rejimler):  f = 8[(8/Re)^12 + 1/(Θ1+Θ2)^1.5]^(1/12)  [DARCY f, kapalı form]
//     Θ1 = {-2.457·ln[(7/Re)^0.9 + 0.27·ε/D]}^16, Θ2 = (37530/Re)^16
//
// Kaynak: Colebrook, C.F., "Turbulent flow in pipes, with particular
// reference to the transition region between smooth and rough pipe laws",
// J. Inst. Civil Engineers, 11(4), 1939; Churchill, S.W., Chemical
// Engineering, Kasım 1977 — her iki denklem de bu oturumda Wikipedia
// "Darcy friction factor formulae" genel referans derlemesi VE White,
// F.M. "Fluid Mechanics" (7. baskı) ders kitabından (Numerade/Chegg
// üzerinden ikincil doğrulama) ÇAPRAZ DOĞRULANDI — bkz.
// registry/coefficients/friction.ts.
//
// ⚠ DARCY vs FANNING SÜRTÜNME FAKTÖRÜ AYRIMI (KRİTİK): Bu dosyadaki TÜM
// fonksiyonlar DARCY (Darcy-Weisbach) sürtünme faktörünü (f_D) döndürür —
// bu, ΔP/L = f_D/D · ρu²/2 basınç düşümü denkleminde kullanılan biçimdir.
// Duvar kayma gerilmesi formülü τ = f_D/8 · ρ·u² 'dür (bu, force-balance
// ile bu oturumda BAĞIMSIZ olarak türetildi: τ·πDL = ΔP·πD²/4 ⇒
// τ = ΔP·D/(4L); ΔP/L yerine Darcy-Weisbach ifadesi konursa τ=f_D·ρu²/8
// elde edilir). Bu, master talimattaki "τ=0.5×f×ρ×u²" formülüyle
// MATEMATİKSEL OLARAK AYNIDIR — talimattaki "f" FANNING sürtünme faktörü
// (f_F=f_D/4) anlamındadır (0.5×f_F=0.5×f_D/4=f_D/8). Karışıklığı önlemek
// için bu dosya yalnızca DARCY f ile çalışır ve computeWallShearStressPa
// bu dönüşümü içeride kendisi yapar.
//
// Girdi/çıktı birimleri: SI (kg/m³, m/s, m, Pa·s) → f boyutsuz, τ (Pa).
//
// Geçerlilik aralığı: Colebrook-White yalnızca Re>4000 (türbülans) için
// TANIMLIDIR; Churchill TÜM Re aralığında (laminer dahil) kullanılabilir
// ve Re→0 limitinde otomatik olarak tam laminer sonuca (f=64/Re) yakınsar.
// 2300<Re<4000 geçiş bölgesinde HİÇBİR korelasyon kesin değildir — bu
// aralıkta hesap yapılır ama validityWarnings eklenir.
//
// Bilinen sınırlamalar: yalnızca dairesel kesitli, tam gelişmiş (fully
// developed), tek-fazlı akış için geçerlidir; giriş etkileri, yerel kayıplar
// (dirsek/vana vb.) ve iki-fazlı akış sürtünme çarpanları KAPSAM DIŞIDIR.

import { getCoefficient } from "../registry";
import type { ChurchillConstants, ReynoldsThresholds } from "../registry/coefficients/friction";
import type { ValidityWarning } from "../corrosion/types";

export type FlowRegimeClassificationByReynolds = "LAMINAR" | "TRANSITIONAL" | "TURBULENT";

/**
 * Reynolds sayısını hesaplar: Re = ρ·u·D/μ.
 *
 * @param densityKgM3 Akışkan yoğunluğu (kg/m³)
 * @param velocityMs Ortalama akış hızı (m/s)
 * @param diameterM Boru iç çapı (m)
 * @param dynamicViscosityPaS Dinamik viskozite (Pa·s)
 */
export function computeReynoldsNumber(
  densityKgM3: number,
  velocityMs: number,
  diameterM: number,
  dynamicViscosityPaS: number,
): number {
  if (densityKgM3 <= 0 || diameterM <= 0 || dynamicViscosityPaS <= 0) {
    throw new Error("Yoğunluk, çap ve viskozite pozitif olmalıdır.");
  }
  if (velocityMs < 0) {
    throw new Error("Hız negatif olamaz.");
  }
  return (densityKgM3 * velocityMs * diameterM) / dynamicViscosityPaS;
}

/**
 * Reynolds sayısına göre akış rejimini (laminer/geçiş/türbülans) sınıflandırır.
 * Eşikler: bkz. registry/coefficients/friction.ts::friction.reynoldsThresholds.
 */
export function classifyFlowRegimeByReynolds(reynoldsNumber: number): FlowRegimeClassificationByReynolds {
  const { laminarMax, turbulentMin } = getCoefficient<ReynoldsThresholds>("friction.reynoldsThresholds").value;
  if (reynoldsNumber < laminarMax) return "LAMINAR";
  if (reynoldsNumber > turbulentMin) return "TURBULENT";
  return "TRANSITIONAL";
}

function validateReAndRoughness(reynoldsNumber: number, relativeRoughness: number): void {
  if (reynoldsNumber <= 0) {
    throw new Error("Reynolds sayısı pozitif olmalıdır.");
  }
  if (relativeRoughness < 0) {
    throw new Error("Bağıl pürüzlülük (ε/D) negatif olamaz.");
  }
}

/**
 * Colebrook-White (1939) denklemini Newton-Raphson iterasyonuyla çözer.
 *
 * Model adı: Colebrook-White (1939) örtük (implicit) DARCY sürtünme faktörü
 * denklemi.
 * Girdi/çıktı birimleri: boyutsuz (Re, ε/D) → boyutsuz DARCY f.
 * Geçerlilik aralığı: yalnızca Re>4000 (türbülans) için tanımlıdır —
 * Re≤4000 girdisinde hesap YAPILMAZ, hata fırlatılır (laminer/geçiş
 * bölgesi için computeFrictionFactorChurchill veya f=64/Re kullanılmalıdır).
 * Bilinen sınırlamalar: örtük denklem, başlangıç tahmini olarak Swamee-Jain
 * açık yaklaşımı kullanılır; en fazla 50 iterasyonda 1e-12 toleransla
 * yakınsamazsa hata fırlatılır (pratikte 3-5 iterasyonda yakınsar).
 *
 * @param reynoldsNumber Reynolds sayısı (Re>4000)
 * @param relativeRoughness Bağıl pürüzlülük ε/D (boyutsuz)
 */
export function computeFrictionFactorColebrookWhite(
  reynoldsNumber: number,
  relativeRoughness: number,
): number {
  validateReAndRoughness(reynoldsNumber, relativeRoughness);
  const { turbulentMin } = getCoefficient<ReynoldsThresholds>("friction.reynoldsThresholds").value;
  if (reynoldsNumber <= turbulentMin) {
    throw new Error(
      `Colebrook-White denklemi yalnızca türbülanslı akış için (Re>${turbulentMin}) tanımlıdır ` +
        `(verilen Re=${reynoldsNumber}). Laminer/geçiş bölgesi için Churchill korelasyonu kullanın.`,
    );
  }

  // Swamee-Jain açık yaklaşımıyla başlangıç tahmini (iyi bilinen, hızlı yakınsama sağlar).
  const swameeJain =
    0.25 / Math.log10(relativeRoughness / 3.7 + 5.74 / reynoldsNumber ** 0.9) ** 2;
  let x = 1 / Math.sqrt(swameeJain);

  const maxIterations = 50;
  const tolerance = 1e-12;
  for (let i = 0; i < maxIterations; i += 1) {
    const arg = relativeRoughness / 3.7 + (2.51 * x) / reynoldsNumber;
    const fValue = x + 2 * Math.log10(arg);
    const derivative = 1 + (2 / Math.LN10) * (2.51 / reynoldsNumber) / arg;
    const step = fValue / derivative;
    x -= step;
    if (Math.abs(step) < tolerance) {
      return 1 / x ** 2;
    }
  }
  throw new Error("Colebrook-White denklemi Newton-Raphson iterasyonuyla yakınsamadı.");
}

/**
 * Churchill (1977) tek-denklem sürtünme faktörü korelasyonunu hesaplar —
 * laminer, geçiş ve türbülans rejimlerinin TAMAMINDA geçerlidir (Re→0
 * limitinde otomatik olarak tam laminer f=64/Re sonucuna yakınsar).
 *
 * Model adı: Churchill (1977) korelasyonu.
 * Girdi/çıktı birimleri: boyutsuz (Re, ε/D) → boyutsuz DARCY f.
 * Geçerlilik aralığı: tüm Re>0 için tanımlıdır (kapalı form, iterasyon
 * gerektirmez).
 * Bilinen sınırlamalar: Colebrook-White'a göre türbülans bölgesinde
 * tipik olarak %1-2 içinde uyumludur (literatürde yaygın olarak "Colebrook-
 * White ile karşılaştırılabilir sonuç verir" şeklinde belgelenir) ancak
 * DAHA HIZLI (iterasyonsuz) hesaplanır.
 */
export function computeFrictionFactorChurchill(reynoldsNumber: number, relativeRoughness: number): number {
  validateReAndRoughness(reynoldsNumber, relativeRoughness);
  const c = getCoefficient<ChurchillConstants>("friction.churchillConstants").value;

  const theta1 =
    (-c.theta1LnConstant *
      Math.log(
        (7 / reynoldsNumber) ** c.theta1ReynoldsExponent + c.theta1RoughnessCoefficient * relativeRoughness,
      )) **
    c.theta1OuterExponent;
  const theta2 = (c.theta2ReynoldsConstant / reynoldsNumber) ** c.theta2OuterExponent;

  return (
    8 *
    ((8 / reynoldsNumber) ** c.reynoldsLaminarExponent + 1 / (theta1 + theta2) ** c.sumExponent) **
      c.outerExponent
  );
}

export type FrictionFactorMethod = "COLEBROOK_WHITE" | "CHURCHILL";

export interface FrictionFactorInput {
  reynoldsNumber: number;
  relativeRoughness: number;
  /** Hesap yöntemi — belirtilmezse otomatik seçilir (bkz. computeFrictionFactor JSDoc) */
  method?: FrictionFactorMethod;
}

export interface FrictionFactorResult {
  /** DARCY sürtünme faktörü (boyutsuz) */
  frictionFactor: number;
  regime: FlowRegimeClassificationByReynolds;
  methodUsed: FrictionFactorMethod | "LAMINAR_EXACT";
  validityWarnings: ValidityWarning[];
}

/**
 * DARCY sürtünme faktörünü hesaplar — rejime göre otomatik yöntem seçimi:
 * laminer (Re<2300) için tam analitik f=64/Re; geçiş/türbülans için
 * çağıranın seçtiği yöntem (varsayılan: Churchill, çünkü tüm rejimlerde
 * geçerli ve iterasyonsuzdur; Colebrook-White yalnızca method="COLEBROOK_WHITE"
 * ile AÇIKÇA istenirse ve Re>4000 ise kullanılır).
 *
 * Model adı: bkz. computeFrictionFactorColebrookWhite / computeFrictionFactorChurchill.
 * Girdi/çıktı birimleri: boyutsuz.
 * Geçerlilik aralığı: bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: 2300<Re<4000 geçiş bölgesinde hesap yapılır ama
 * validityWarnings eklenir (hiçbir korelasyon bu bölgede kesin değildir).
 */
export function computeFrictionFactor(input: FrictionFactorInput): FrictionFactorResult {
  const { reynoldsNumber, relativeRoughness } = input;
  validateReAndRoughness(reynoldsNumber, relativeRoughness);
  const { laminarMax, turbulentMin } = getCoefficient<ReynoldsThresholds>("friction.reynoldsThresholds").value;
  const regime = classifyFlowRegimeByReynolds(reynoldsNumber);
  const validityWarnings: ValidityWarning[] = [];

  if (regime === "LAMINAR") {
    return {
      frictionFactor: 64 / reynoldsNumber,
      regime,
      methodUsed: "LAMINAR_EXACT",
      validityWarnings,
    };
  }

  if (regime === "TRANSITIONAL") {
    validityWarnings.push({
      parameter: "Reynolds sayısı",
      value: reynoldsNumber,
      min: laminarMax,
      max: turbulentMin,
      unit: "-",
      message:
        `Reynolds sayısı (${reynoldsNumber.toFixed(0)}) geçiş bölgesinde (${laminarMax}-${turbulentMin}) — ` +
        "bu aralıkta hiçbir sürtünme faktörü korelasyonu kesin değildir, sonuç yalnızca kaba bir tahmindir.",
    });
  }

  const method: FrictionFactorMethod = input.method ?? "CHURCHILL";
  if (method === "COLEBROOK_WHITE") {
    if (regime === "TRANSITIONAL") {
      // Colebrook-White Re<=4000 için tanımsız; geçiş bölgesinde Churchill'e düş.
      return {
        frictionFactor: computeFrictionFactorChurchill(reynoldsNumber, relativeRoughness),
        regime,
        methodUsed: "CHURCHILL",
        validityWarnings,
      };
    }
    return {
      frictionFactor: computeFrictionFactorColebrookWhite(reynoldsNumber, relativeRoughness),
      regime,
      methodUsed: "COLEBROOK_WHITE",
      validityWarnings,
    };
  }

  return {
    frictionFactor: computeFrictionFactorChurchill(reynoldsNumber, relativeRoughness),
    regime,
    methodUsed: "CHURCHILL",
    validityWarnings,
  };
}

/**
 * Boru duvarı kayma gerilmesini hesaplar: τ = f_Darcy/8 × ρ × u².
 *
 * bkz. dosya başı yorumu "DARCY vs FANNING" notu — bu formül master
 * talimattaki τ=0.5×f×ρ×u² (Fanning f) ile matematiksel olarak AYNIDIR.
 *
 * @param darcyFrictionFactor computeFrictionFactor'dan gelen DARCY f (boyutsuz)
 * @param densityKgM3 Akışkan yoğunluğu (kg/m³)
 * @param velocityMs Ortalama akış hızı (m/s)
 */
export function computeWallShearStressPa(
  darcyFrictionFactor: number,
  densityKgM3: number,
  velocityMs: number,
): number {
  if (darcyFrictionFactor < 0) {
    throw new Error("Sürtünme faktörü negatif olamaz.");
  }
  if (densityKgM3 <= 0) {
    throw new Error("Yoğunluk pozitif olmalıdır.");
  }
  if (velocityMs < 0) {
    throw new Error("Hız negatif olamaz.");
  }
  return (darcyFrictionFactor / 8) * densityKgM3 * velocityMs ** 2;
}
