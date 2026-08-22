// packages/engine/src/fluids/prEos.ts
//
// Peng-Robinson (1976) kübik hâl denklemi (equation of state).
//
// Model: P = RT/(V-b) - aα(T)/(V²+2bV-b²)
//   Z³ - (1-B)Z² + (A-3B²-2B)Z - (AB-B²-B³) = 0
//   A = aα·P/(R²T²), B = b·P/(RT)
//   a = Ωa·R²Tc²/Pc, b = Ωb·RTc/Pc
//   α(T) = [1 + κ(1-√Tr)]², κ = c0 + c1·ω - c2·ω² (ω≤0.49 için geçerli)
// Karışım kuralı (van der Waals, iki-parametreli):
//   (aα)mix = ΣΣ yi·yj·√[(aα)i·(aα)j]·(1-kij),  bmix = Σ yi·bi
//
// Kaynak: Peng, D.-Y.; Robinson, D.B., Ind. Eng. Chem. Fundam. 15(1), 1976,
// s.59-64. Tüm evrensel sabitler ve bileşen kritik özellikleri (Tc, Pc, ω)
// packages/engine/src/registry/coefficients/{prEos,naturalGasComponents}.ts
// içinde KDP'ye uygun şekilde kaynaklıdır.
//
// Girdi/çıktı birimleri: SI (K, Pa, kg/mol) → çıktı Z (boyutsuz), molar
// hacim (m³/mol), yoğunluk (kg/m³).
//
// Geçerlilik aralığı: PR EOS, hafif-orta ağırlıklı hidrokarbonlar ve tipik
// doğal gaz kirleticileri (CO2, N2, H2S, iz miktarda su buharı) için genel
// amaçlı bir kübik denklemdir; kritik nokta yakınında (Tr→1, Pr→1) ve ağır
// (C7+) bileşenler için doğruluğu azalır. κ formülü yalnızca ω≤0.49 için
// türetilmiştir (bu projedeki tüm bileşenler bu sınırın altındadır).
//
// Bilinen sınırlamalar: (1) kutupsal bileşenler (özellikle su) için ikili
// etkileşim parametreleri sınırlı/doğrulanmamış kaynaklıdır (bkz.
// registry/coefficients/prEos.ts notları) — su içeren karışımlarda sonuç
// dikkatle yorumlanmalıdır; (2) sıvı fazı molar hacim/yoğunluk tahmini,
// kübik EOS'ların bilinen zayıf noktasıdır (literatürde yaygın olarak
// hacim öteleme/"volume translation" düzeltmesi önerilir — bu dosyada
// UYGULANMAMIŞTIR, yalnızca ham PR molar hacmi döndürülür); (3) yalnızca
// tek-faz Z faktörü hesaplanır, faz dengesi (flash) hesabı KAPSAM DIŞIDIR.

import { getCoefficient } from "../registry";
import {
  HYDROCARBON_COMPONENT_IDS,
  type NaturalGasComponentId,
  type NaturalGasComponentProperties,
} from "../registry/coefficients/naturalGasComponents";

export type EosPhase = "VAPOR" | "LIQUID";

export interface PrEosInput {
  /** Akışkan sıcaklığı (K) */
  temperatureK: number;
  /** Akışkan basıncı (Pa) */
  pressurePa: number;
  /** Kritik sıcaklık (K) */
  criticalTemperatureK: number;
  /** Kritik basınç (Pa) */
  criticalPressurePa: number;
  /** Pitzer asentrik faktörü ω */
  acentricFactor: number;
}

export interface PrEosResult {
  /** Sıkıştırılabilirlik faktörü Z (boyutsuz) */
  compressibilityFactor: number;
  /** Molar hacim (m³/mol) */
  molarVolumeM3PerMol: number;
  /** Hesaplanan faz (istenen faz köküne göre seçildi) */
  phase: EosPhase;
}

const HYDROCARBON_ID_SET = new Set<NaturalGasComponentId>(HYDROCARBON_COMPONENT_IDS);

function universalGasConstant(): number {
  return getCoefficient<number>("prEos.universalGasConstant").value;
}

/**
 * α(T) sıcaklık düzeltme fonksiyonunu hesaplar: α = [1 + κ(1-√Tr)]².
 *
 * @param temperatureK Akışkan sıcaklığı (K)
 * @param criticalTemperatureK Kritik sıcaklık (K)
 * @param acentricFactor Pitzer asentrik faktörü ω (≤0.49 için geçerli formül)
 */
export function computeAlpha(
  temperatureK: number,
  criticalTemperatureK: number,
  acentricFactor: number,
): number {
  if (temperatureK <= 0 || criticalTemperatureK <= 0) {
    throw new Error("Sıcaklık ve kritik sıcaklık pozitif olmalıdır.");
  }
  const c0 = getCoefficient<number>("prEos.kappaFormula.c0").value;
  const c1 = getCoefficient<number>("prEos.kappaFormula.c1").value;
  const c2 = getCoefficient<number>("prEos.kappaFormula.c2").value;
  const kappa = c0 + c1 * acentricFactor - c2 * acentricFactor ** 2;
  const reducedTemperature = temperatureK / criticalTemperatureK;
  return (1 + kappa * (1 - Math.sqrt(reducedTemperature))) ** 2;
}

/** Saf bileşen PR 'a' ve 'b' parametrelerini (a: Pa·m⁶/mol², b: m³/mol) hesaplar. */
function computePureAB(
  criticalTemperatureK: number,
  criticalPressurePa: number,
): { aC: number; b: number } {
  if (criticalPressurePa <= 0) {
    throw new Error("Kritik basınç pozitif olmalıdır.");
  }
  const r = universalGasConstant();
  const omegaA = getCoefficient<number>("prEos.omegaA").value;
  const omegaB = getCoefficient<number>("prEos.omegaB").value;
  const aC = (omegaA * r ** 2 * criticalTemperatureK ** 2) / criticalPressurePa;
  const b = (omegaB * r * criticalTemperatureK) / criticalPressurePa;
  return { aC, b };
}

/**
 * İki bileşen arasındaki varsayılan ikili etkileşim parametresini (kij)
 * kayıt defterinden getirir. Çağıran taraf, bilinen daha iyi bir değer
 * varsa `binaryInteractionOverrides` ile bunu ezebilir (bkz.
 * computeMixtureCompressibilityFactor).
 */
export function getBinaryInteractionParameter(
  componentA: NaturalGasComponentId,
  componentB: NaturalGasComponentId,
): number {
  if (componentA === componentB) return 0;
  if (HYDROCARBON_ID_SET.has(componentA) && HYDROCARBON_ID_SET.has(componentB)) {
    return getCoefficient<number>("prEos.kij.hydrocarbonPairsDefault").value;
  }
  const other = componentA === "H2O" ? componentB : componentB === "H2O" ? componentA : undefined;
  if (other !== undefined) {
    const table = getCoefficient<Partial<Record<string, number>>>("prEos.kij.waterPairs").value;
    const known = table[other];
    if (known !== undefined) return known;
  }
  return getCoefficient<number>("prEos.kij.unresolvedDefault").value;
}

/**
 * Kübik denklem Z³ + a2Z² + a1Z + a0 = 0'ın TÜM reel köklerini bulur
 * (trigonometrik/Cardano yöntemi — iteratif değil, kapalı form).
 */
export function solveCubicReal(a2: number, a1: number, a0: number): number[] {
  const p = a1 - a2 ** 2 / 3;
  const q = (2 * a2 ** 3) / 27 - (a2 * a1) / 3 + a0;
  const shift = -a2 / 3;
  const discriminant = (q / 2) ** 2 + (p / 3) ** 3;

  if (Math.abs(p) < 1e-14 && Math.abs(q) < 1e-14) {
    return [shift];
  }

  if (discriminant > 0) {
    const sqrtDisc = Math.sqrt(discriminant);
    const cubeRoot = (x: number) => Math.sign(x) * Math.abs(x) ** (1 / 3);
    const u = cubeRoot(-q / 2 + sqrtDisc);
    const v = cubeRoot(-q / 2 - sqrtDisc);
    return [u + v + shift];
  }

  // Üç reel kök (discriminant <= 0): trigonometrik yöntem.
  const rCoeff = Math.sqrt(-(p ** 3) / 27);
  const phi = Math.acos(Math.min(1, Math.max(-1, -q / (2 * rCoeff))));
  const magnitude = 2 * Math.sqrt(-p / 3);
  const roots = [0, 1, 2].map((k) => magnitude * Math.cos((phi - 2 * Math.PI * k) / 3) + shift);
  return roots.sort((x, y) => x - y);
}

/**
 * Verilen A, B (boyutsuz PR parametreleri) için Z köklerinden fiziksel
 * olarak geçerli (Z>B) olanları seçer ve istenen faze göre uygun kökü
 * döndürür (VAPOR→en büyük, LIQUID→en küçük geçerli kök).
 */
function selectPhysicalRoot(a: number, b: number, phase: EosPhase): number {
  const roots = solveCubicReal(-(1 - b), a - 3 * b ** 2 - 2 * b, -(a * b - b ** 2 - b ** 3));
  const valid = roots.filter((z) => z > b && z > 0);
  if (valid.length === 0) {
    throw new Error(
      "Verilen basınç/sıcaklık koşullarında fiziksel olarak geçerli bir Z kökü bulunamadı (Z>B şartı sağlanmadı).",
    );
  }
  return phase === "VAPOR" ? Math.max(...valid) : Math.min(...valid);
}

/**
 * Saf bir bileşen için Peng-Robinson sıkıştırılabilirlik faktörünü (Z) ve
 * molar hacmini hesaplar.
 *
 * Model adı: Peng-Robinson (1976) hâl denklemi, saf bileşen.
 * Girdi/çıktı birimleri: bkz. dosya başı yorumu.
 * Geçerlilik aralığı: ω≤0.49 (κ formülü); bkz. dosya başı yorumu.
 * Bilinen sınırlamalar: bkz. dosya başı yorumu.
 */
export function computeCompressibilityFactor(input: PrEosInput, phase: EosPhase = "VAPOR"): PrEosResult {
  if (input.temperatureK <= 0 || input.pressurePa <= 0) {
    throw new Error("Sıcaklık ve basınç pozitif olmalıdır.");
  }
  const r = universalGasConstant();
  const alpha = computeAlpha(input.temperatureK, input.criticalTemperatureK, input.acentricFactor);
  const { aC, b } = computePureAB(input.criticalTemperatureK, input.criticalPressurePa);
  const aAlpha = aC * alpha;

  const bigA = (aAlpha * input.pressurePa) / (r ** 2 * input.temperatureK ** 2);
  const bigB = (b * input.pressurePa) / (r * input.temperatureK);

  const z = selectPhysicalRoot(bigA, bigB, phase);
  const molarVolumeM3PerMol = (z * r * input.temperatureK) / input.pressurePa;

  return { compressibilityFactor: z, molarVolumeM3PerMol, phase };
}

export interface NaturalGasComponentFraction {
  componentId: NaturalGasComponentId;
  /** Mol kesri (0-1) */
  moleFraction: number;
}

export interface PrEosMixtureInput {
  temperatureK: number;
  pressurePa: number;
  composition: NaturalGasComponentFraction[];
  phase?: EosPhase;
  /**
   * Belirli çiftler için kayıt defteri varsayılanını ezen kij değerleri.
   * Anahtar formatı: "A_B" (bileşen id'leri alfabetik sırayla, alt çizgiyle).
   */
  binaryInteractionOverrides?: Partial<Record<string, number>>;
  /**
   * Kullanıcı manuel bir yoğunluk değeri girdiyse hesap ATLANIR ve bu değer
   * doğrudan döndürülür (mühendislik override — master talimatın "kullanıcı
   * isterse manuel değer girip hesabı atlayabilsin" kuralı).
   */
  manualDensityOverrideKgM3?: number;
}

export interface PrEosMixtureResult {
  compressibilityFactor: number;
  molarVolumeM3PerMol: number;
  molarMassKgPerMol: number;
  densityKgM3: number;
  phase: EosPhase;
  /** Hesapta kullanılan kayıt defteri kimlikleri (denetim için) */
  sourcesUsed: string[];
  /** true ise manualDensityOverrideKgM3 kullanıldı, EOS hesabı atlandı */
  isManualOverride: boolean;
}

function pairKey(a: NaturalGasComponentId, b: NaturalGasComponentId): string {
  return [a, b].sort().join("_");
}

function lookupComponent(componentId: NaturalGasComponentId): NaturalGasComponentProperties {
  return getCoefficient<NaturalGasComponentProperties>(`naturalGasComponents.${componentId}`).value;
}

/**
 * Doğal gaz karışımı için Peng-Robinson sıkıştırılabilirlik faktörünü ve
 * yoğunluğunu van der Waals karışım kuralıyla hesaplar.
 *
 * Model adı: Peng-Robinson (1976) hâl denklemi + van der Waals iki-parametreli
 * karışım kuralı.
 * Girdi/çıktı birimleri: bkz. dosya başı yorumu.
 * Geçerlilik aralığı: karışımdaki her bileşenin kendi ω≤0.49 sınırı içinde
 * olması gerekir (bu projenin bileşen kütüphanesindeki tüm bileşenler
 * bu sınırı sağlar).
 * Bilinen sınırlamalar: bkz. dosya başı yorumu; ayrıca kij kaynak durumu
 * için bkz. registry/coefficients/prEos.ts.
 */
export function computeMixtureCompressibilityFactor(input: PrEosMixtureInput): PrEosMixtureResult {
  const totalMoleFraction = input.composition.reduce((sum, c) => sum + c.moleFraction, 0);
  if (Math.abs(totalMoleFraction - 1) > 1e-6) {
    throw new Error(
      `Bileşim mol kesirlerinin toplamı 1 olmalıdır (verilen toplam: ${totalMoleFraction.toFixed(6)}).`,
    );
  }
  if (input.temperatureK <= 0 || input.pressurePa <= 0) {
    throw new Error("Sıcaklık ve basınç pozitif olmalıdır.");
  }

  const phase = input.phase ?? "VAPOR";
  const r = universalGasConstant();
  const sourcesUsed = new Set<string>([
    "prEos.universalGasConstant",
    "prEos.omegaA",
    "prEos.omegaB",
    "prEos.kappaFormula.c0",
    "prEos.kappaFormula.c1",
    "prEos.kappaFormula.c2",
  ]);

  if (input.manualDensityOverrideKgM3 !== undefined) {
    const molarMassKgPerMol = input.composition.reduce((sum, c) => {
      sourcesUsed.add(`naturalGasComponents.${c.componentId}`);
      return sum + c.moleFraction * lookupComponent(c.componentId).molarMassKgPerMol;
    }, 0);
    return {
      compressibilityFactor: NaN,
      molarVolumeM3PerMol: molarMassKgPerMol / input.manualDensityOverrideKgM3,
      molarMassKgPerMol,
      densityKgM3: input.manualDensityOverrideKgM3,
      phase,
      sourcesUsed: [...sourcesUsed],
      isManualOverride: true,
    };
  }

  const components = input.composition.map((fraction) => {
    const props = lookupComponent(fraction.componentId);
    sourcesUsed.add(`naturalGasComponents.${fraction.componentId}`);
    const alpha = computeAlpha(input.temperatureK, props.criticalTemperatureK, props.acentricFactor);
    const { aC, b } = computePureAB(props.criticalTemperatureK, props.criticalPressurePa);
    return { fraction, props, aAlpha: aC * alpha, b };
  });

  let aAlphaMix = 0;
  for (const ci of components) {
    for (const cj of components) {
      const overrideKey = pairKey(ci.fraction.componentId, cj.fraction.componentId);
      const kij =
        input.binaryInteractionOverrides?.[overrideKey] ??
        getBinaryInteractionParameter(ci.fraction.componentId, cj.fraction.componentId);
      if (!input.binaryInteractionOverrides?.[overrideKey]) {
        const isHc = HYDROCARBON_ID_SET.has(ci.fraction.componentId) && HYDROCARBON_ID_SET.has(cj.fraction.componentId);
        sourcesUsed.add(
          ci.fraction.componentId === cj.fraction.componentId
            ? "prEos.kij.hydrocarbonPairsDefault"
            : isHc
              ? "prEos.kij.hydrocarbonPairsDefault"
              : ci.fraction.componentId === "H2O" || cj.fraction.componentId === "H2O"
                ? "prEos.kij.waterPairs"
                : "prEos.kij.unresolvedDefault",
        );
      }
      aAlphaMix +=
        ci.fraction.moleFraction *
        cj.fraction.moleFraction *
        Math.sqrt(ci.aAlpha * cj.aAlpha) *
        (1 - kij);
    }
  }

  const bMix = components.reduce((sum, c) => sum + c.fraction.moleFraction * c.b, 0);
  const molarMassKgPerMol = components.reduce(
    (sum, c) => sum + c.fraction.moleFraction * c.props.molarMassKgPerMol,
    0,
  );

  const bigA = (aAlphaMix * input.pressurePa) / (r ** 2 * input.temperatureK ** 2);
  const bigB = (bMix * input.pressurePa) / (r * input.temperatureK);

  const z = selectPhysicalRoot(bigA, bigB, phase);
  const molarVolumeM3PerMol = (z * r * input.temperatureK) / input.pressurePa;
  const densityKgM3 = molarMassKgPerMol / molarVolumeM3PerMol;

  return {
    compressibilityFactor: z,
    molarVolumeM3PerMol,
    molarMassKgPerMol,
    densityKgM3,
    phase,
    sourcesUsed: [...sourcesUsed],
    isManualOverride: false,
  };
}
