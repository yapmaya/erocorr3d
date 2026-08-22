// packages/engine/src/fluids/flowRegime.ts
//
// Yatay/eğimli boru içinde gaz-sıvı iki-fazlı akış rejimi sınıflandırması ve
// sıvı tutulumu (holdup) hesabı — Beggs-Brill (1973) korelasyonu.
//
// ⚠ KAPSAM NOTU: bu modül başlangıçta Taitel-Dukler (1976) İÇİN planlandı.
// KDP kural 4 gereği neden Beggs-Brill'e geçildiği ayrıntılı olarak
// registry/coefficients/flowRegime.ts dosya başı yorumunda belgelenmiştir —
// özetle: Taitel-Dukler'in birincil denklemlerine (Wiley paywall + görüntü
// olarak gömülü PDF formülleri) bu oturumda güvenilir şekilde erişilemedi;
// Beggs-Brill AYNI mühendislik amacına hizmet eden, TAM olarak
// kaynaklanabilen (üç bağımsız kaynakla çapraz doğrulanmış) bir alternatiftir.
//
// Modeller:
//   λL (no-slip holdup) = Vsl/(Vsl+Vsg)
//   NFR (Froude sayısı) = Vm²/(g·D)
//   NLV (sıvı hız sayısı) = Vsl·(ρL/(g·σ))^0.25
//   Rejim sınırları: L1=316λL^0.302, L2=9.252e-4·λL^-2.4684, L3=0.10·λL^-1.4516,
//                    L4=0.5·λL^-6.738
//   Yatay tutulum: HL(0) = a·λL^b/NFR^c  (rejime göre a,b,c)
//   Eğim düzeltmesi: HL(θ) = HL(0)·ψ, ψ=1+C[sin(1.8θ)-0.333sin³(1.8θ)],
//                    C=(1-λL)·ln(d·λL^e·NLV^f·NFR^g)  (rejime + yöne göre d,e,f,g)
//   Geçiş (TRANSITION) bölgesi: HL = [(L3-NFR)·HL,seg + (NFR-L2)·HL,int]/(L3-L2)
//
// Kaynak: Beggs, H.D.; Brill, J.P., "A Study of Two-Phase Flow in Inclined
// Pipes", JPT, Mayıs 1973, s.607-617. Tüm sabitler
// packages/engine/src/registry/coefficients/flowRegime.ts içinde, üç
// bağımsız kaynakla çapraz doğrulanmış olarak belgelenmiştir. ψ formülündeki
// açı biriminin (derece→radyan, 1.8 çarpanının radyan DEĞERİNE mi yoksa
// derece değerine mi uygulandığı) belirsizliği, açık kaynaklı bir Julia
// implementasyonu (PressureDrop.jl) okunarak ÇÖZÜLDÜ: açı ÖNCE radyana
// çevrilir, SONRA 1.8 ile çarpılır (iki sıralama matematiksel olarak
// eşdeğerdir, ancak derece tabanlı bir sin() ile karıştırılmamalıdır).
//
// Girdi/çıktı birimleri: SI (m/s, m, kg/m³, N/m, derece [yalnızca eğim
// açısı]) → holdup boyutsuz (0-1).
//
// Geçerlilik aralığı: Beggs-Brill, -90°...+90° eğim aralığında (yatay dahil)
// geliştirilmiştir; orijinal deneyler ~1-2.5cm çaplı akrilik borularda
// yapılmıştır — büyük çaplı sanayi borularına ekstrapolasyon literatürde
// yaygın kabul görse de bilinen bir belirsizlik kaynağıdır.
//
// Bilinen sınırlamalar: (1) yalnızca gaz-sıvı iki-fazlı akış içindir (üç-fazlı
// gaz-yağ-su akışı bu modelde tek bir "sıvı" fazı olarak ele alınmalıdır —
// su/yağ oranına göre karma sıvı özellikleri çağıran taraf tarafından
// sağlanmalıdır); (2) dalgalı/sarsıntılı (terrain-induced slugging) etkiler
// bu korelasyonda YOKTUR.

import { getCoefficient } from "../registry";
import type {
  BeggsBrillBoundaryConstants,
  BeggsBrillHorizontalHoldupRow,
  BeggsBrillInclinationRow,
  BeggsBrillPattern,
  PsiFormulaConstants,
} from "../registry/coefficients/flowRegime";
import type { ValidityWarning } from "../corrosion/types";
import { computeMixtureVelocityFromSuperficial } from "./mixtureProperties";

/** TAM/kesin fiziksel sabit (standart yerçekimi ivmesi) — KDP araştırması gerektirmez. */
const STANDARD_GRAVITY_M_S2 = 9.80665;

export type FlowPatternClassification = BeggsBrillPattern | "TRANSITION";

/** λL (no-slip/kayma-yok sıvı tutulumu) = Vsl/(Vsl+Vsg). */
export function computeNoSlipLiquidHoldup(
  superficialLiquidVelocityMs: number,
  superficialGasVelocityMs: number,
): number {
  if (superficialLiquidVelocityMs < 0 || superficialGasVelocityMs < 0) {
    throw new Error("Yüzeysel hızlar negatif olamaz.");
  }
  const mixtureVelocityMs = superficialLiquidVelocityMs + superficialGasVelocityMs;
  if (mixtureVelocityMs === 0) {
    throw new Error("Karışım hızı (Vsl+Vsg) sıfır olamaz.");
  }
  return superficialLiquidVelocityMs / mixtureVelocityMs;
}

/** Froude sayısı NFR = Vm²/(g·D). */
export function computeFroudeNumber(mixtureVelocityMs: number, pipeInternalDiameterM: number): number {
  if (pipeInternalDiameterM <= 0) {
    throw new Error("Boru iç çapı pozitif olmalıdır.");
  }
  if (mixtureVelocityMs < 0) {
    throw new Error("Karışım hızı negatif olamaz.");
  }
  return mixtureVelocityMs ** 2 / (STANDARD_GRAVITY_M_S2 * pipeInternalDiameterM);
}

/** Sıvı hız sayısı NLV = Vsl·(ρL/(g·σ))^0.25. */
export function computeLiquidVelocityNumber(
  superficialLiquidVelocityMs: number,
  liquidDensityKgM3: number,
  surfaceTensionNPerM: number,
): number {
  if (superficialLiquidVelocityMs < 0) {
    throw new Error("Yüzeysel sıvı hızı negatif olamaz.");
  }
  if (liquidDensityKgM3 <= 0 || surfaceTensionNPerM <= 0) {
    throw new Error("Sıvı yoğunluğu ve yüzey gerilimi pozitif olmalıdır.");
  }
  return superficialLiquidVelocityMs * (liquidDensityKgM3 / (STANDARD_GRAVITY_M_S2 * surfaceTensionNPerM)) ** 0.25;
}

/**
 * Beggs-Brill akış rejimi sınıflandırmasını yapar (λL, NFR haritası).
 *
 * Model adı: Beggs-Brill (1973) akış rejimi haritası.
 * Girdi/çıktı birimleri: boyutsuz.
 */
export function classifyBeggsBrillFlowPattern(
  noSlipLiquidHoldup: number,
  froudeNumber: number,
): FlowPatternClassification {
  if (noSlipLiquidHoldup <= 0 || noSlipLiquidHoldup >= 1) {
    throw new Error("λL (no-slip sıvı tutulumu) (0, 1) aralığında olmalıdır.");
  }
  const b = getCoefficient<BeggsBrillBoundaryConstants>("flowRegime.beggsBrillBoundaryConstants").value;
  const l1 = b.l1Coefficient * noSlipLiquidHoldup ** b.l1Exponent;
  const l2 = b.l2Coefficient * noSlipLiquidHoldup ** b.l2Exponent;
  const l3 = b.l3Coefficient * noSlipLiquidHoldup ** b.l3Exponent;
  const l4 = b.l4Coefficient * noSlipLiquidHoldup ** b.l4Exponent;

  if (noSlipLiquidHoldup < 0.01) {
    return froudeNumber < l1 ? "SEGREGATED" : "DISTRIBUTED";
  }
  if (froudeNumber < l2) return "SEGREGATED";
  if (froudeNumber <= l3) return "TRANSITION";
  if (noSlipLiquidHoldup < 0.4) {
    return froudeNumber <= l1 ? "INTERMITTENT" : "DISTRIBUTED";
  }
  return froudeNumber <= l4 ? "INTERMITTENT" : "DISTRIBUTED";
}

function computeHorizontalHoldup(pattern: BeggsBrillPattern, noSlipLiquidHoldup: number, froudeNumber: number): number {
  const rows = getCoefficient<BeggsBrillHorizontalHoldupRow[]>("flowRegime.beggsBrillHorizontalHoldup").value;
  const row = rows.find((r) => r.pattern === pattern);
  if (!row) {
    throw new Error(`"${pattern}" için yatay tutulum katsayısı bulunamadı.`);
  }
  const holdup = (row.a * noSlipLiquidHoldup ** row.b) / froudeNumber ** row.c;
  // Beggs-Brill'in kendi kısıtı: HL(0) >= λL (kayma her zaman tutulumu artırır).
  return Math.max(holdup, noSlipLiquidHoldup);
}

function computeInclinationFactor(
  pattern: BeggsBrillPattern,
  noSlipLiquidHoldup: number,
  liquidVelocityNumber: number,
  froudeNumber: number,
  inclinationDeg: number,
): number {
  if (inclinationDeg === 0) return 1;

  let row: BeggsBrillInclinationRow;
  if (inclinationDeg > 0) {
    const rows = getCoefficient<BeggsBrillInclinationRow[]>("flowRegime.beggsBrillInclinationUphill").value;
    const found = rows.find((r) => r.pattern === pattern);
    if (!found) throw new Error(`"${pattern}" için yokuş-yukarı eğim düzeltme katsayısı bulunamadı.`);
    row = found;
  } else {
    row = getCoefficient<BeggsBrillInclinationRow>("flowRegime.beggsBrillInclinationDownhill").value;
  }

  let correctionC: number;
  if (row.d === 1 && row.e === 0 && row.f === 0 && row.g === 0) {
    correctionC = 0; // DISTRIBUTED (yokuş yukarı): düzeltme yok.
  } else {
    correctionC =
      (1 - noSlipLiquidHoldup) *
      Math.log(
        row.d *
          noSlipLiquidHoldup ** row.e *
          liquidVelocityNumber ** row.f *
          froudeNumber ** row.g,
      );
    if (inclinationDeg < 0) {
      // Kaynakta belirtilen kısıt: yokuş-aşağı akışta C negatif olamaz.
      correctionC = Math.max(correctionC, 0);
    }
  }

  const psiConstants = getCoefficient<PsiFormulaConstants>("flowRegime.psiFormulaConstants").value;
  const angleRad = (inclinationDeg * Math.PI) / 180;
  const sinTerm = Math.sin(psiConstants.angleMultiplier * angleRad);
  return 1 + correctionC * (sinTerm - psiConstants.cubicTermCoefficient * sinTerm ** 3);
}

export interface BeggsBrillHoldupInput {
  superficialLiquidVelocityMs: number;
  superficialGasVelocityMs: number;
  pipeInternalDiameterM: number;
  liquidDensityKgM3: number;
  /** Sıvı-gaz yüzey gerilimi (N/m) — ör. su-doğal gaz ~0.02-0.07, ham petrol-gaz ~0.001-0.03 mertebesinde */
  surfaceTensionNPerM: number;
  /** Boru eğim açısı, yataydan (derece): 0=yatay, >0=yokuş yukarı, <0=yokuş aşağı */
  inclinationDeg: number;
}

export interface BeggsBrillHoldupResult {
  liquidHoldupFraction: number;
  noSlipLiquidHoldup: number;
  froudeNumber: number;
  flowPattern: FlowPatternClassification;
  validityWarnings: ValidityWarning[];
}

/**
 * Beggs-Brill (1973) korelasyonuyla sıvı tutulumunu (holdup) ve akış
 * rejimini hesaplar.
 *
 * Model adı: Beggs-Brill (1973).
 * Girdi/çıktı birimleri: bkz. dosya başı yorumu.
 * Geçerlilik aralığı: -90°...+90° eğim; bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeBeggsBrillHoldup(input: BeggsBrillHoldupInput): BeggsBrillHoldupResult {
  if (input.inclinationDeg < -90 || input.inclinationDeg > 90) {
    throw new Error("Eğim açısı -90° ile +90° arasında olmalıdır.");
  }

  const noSlipLiquidHoldup = computeNoSlipLiquidHoldup(
    input.superficialLiquidVelocityMs,
    input.superficialGasVelocityMs,
  );
  const mixtureVelocityMs = computeMixtureVelocityFromSuperficial(
    input.superficialGasVelocityMs,
    input.superficialLiquidVelocityMs,
  );
  const froudeNumber = computeFroudeNumber(mixtureVelocityMs, input.pipeInternalDiameterM);
  const liquidVelocityNumber = computeLiquidVelocityNumber(
    input.superficialLiquidVelocityMs,
    input.liquidDensityKgM3,
    input.surfaceTensionNPerM,
  );

  const flowPattern = classifyBeggsBrillFlowPattern(noSlipLiquidHoldup, froudeNumber);
  const validityWarnings: ValidityWarning[] = [];

  const holdupFor = (pattern: BeggsBrillPattern): number => {
    const horizontal = computeHorizontalHoldup(pattern, noSlipLiquidHoldup, froudeNumber);
    const psi = computeInclinationFactor(
      pattern,
      noSlipLiquidHoldup,
      liquidVelocityNumber,
      froudeNumber,
      input.inclinationDeg,
    );
    return Math.min(Math.max(horizontal * psi, 0), 1);
  };

  let liquidHoldupFraction: number;
  if (flowPattern === "TRANSITION") {
    const b = getCoefficient<BeggsBrillBoundaryConstants>("flowRegime.beggsBrillBoundaryConstants").value;
    const l2 = b.l2Coefficient * noSlipLiquidHoldup ** b.l2Exponent;
    const l3 = b.l3Coefficient * noSlipLiquidHoldup ** b.l3Exponent;
    const holdupSegregated = holdupFor("SEGREGATED");
    const holdupIntermittent = holdupFor("INTERMITTENT");
    liquidHoldupFraction =
      ((l3 - froudeNumber) * holdupSegregated + (froudeNumber - l2) * holdupIntermittent) / (l3 - l2);
  } else {
    liquidHoldupFraction = holdupFor(flowPattern);
  }

  return { liquidHoldupFraction, noSlipLiquidHoldup, froudeNumber, flowPattern, validityWarnings };
}

export interface FlowPatternMapPoint {
  noSlipLiquidHoldup: number;
  l1: number;
  l2: number;
  l3: number;
  l4: number;
}

/**
 * UI'da akış rejimi haritasını çizmek için λL=1e-3...1 aralığında (log
 * ölçekte) L1-L4 sınır eğrilerinin koordinatlarını üretir.
 *
 * @param pointCount Üretilecek nokta sayısı (varsayılan 100)
 */
export function computeFlowPatternMapCurves(pointCount = 100): FlowPatternMapPoint[] {
  if (pointCount < 2) {
    throw new Error("Nokta sayısı en az 2 olmalıdır.");
  }
  const b = getCoefficient<BeggsBrillBoundaryConstants>("flowRegime.beggsBrillBoundaryConstants").value;
  const logMin = Math.log10(1e-3);
  const logMax = Math.log10(1);
  const points: FlowPatternMapPoint[] = [];
  for (let i = 0; i < pointCount; i += 1) {
    const logLambda = logMin + ((logMax - logMin) * i) / (pointCount - 1);
    const lambda = 10 ** logLambda;
    points.push({
      noSlipLiquidHoldup: lambda,
      l1: b.l1Coefficient * lambda ** b.l1Exponent,
      l2: b.l2Coefficient * lambda ** b.l2Exponent,
      l3: b.l3Coefficient * lambda ** b.l3Exponent,
      l4: b.l4Coefficient * lambda ** b.l4Exponent,
    });
  }
  return points;
}
