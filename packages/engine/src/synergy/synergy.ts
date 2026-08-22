// packages/engine/src/synergy/synergy.ts
//
// Erozyon-korozyon SİNERJİSİ: Toplam = Saf Korozyon + Saf Erozyon + Sinerji
// (ASTM G119 çerçevesi, T=C+E+S — bkz. registry/coefficients/synergy.ts).
//
// ⚠⚠⚠ BU ALAN LİTERATÜRDE TAM OTURMAMIŞTIR — HER SONUÇ confidence=MEDIUM
// veya LOW TAŞIR, ARAYÜZDE HER ZAMAN AÇIKÇA BELİRTİLMELİDİR ⚠⚠⚠
//
// Mekanizma (bkz. dosya başı registry yorumu — bu oturumda ARAŞTIRILDI ve
// sezgisel beklenti KISMEN DÜZELTİLDİ): partikül çarpması koruyucu FeCO3/
// oksit filmini sıyırır, altındaki taze metal yeniden (hızlanmış) korozyona
// uğrar. AMA: akışkan kayma gerilmesi TEK BAŞINA bu filmi sıyıramaz (film
// yapışma direnci ~10^7 Pa mertebesinde, tipik akış kayma gerilmesinden
// ~5 mertebe BÜYÜK — bkz. synergy.filmAdhesionStressPa notları). Bu yüzden
// computeFilmRemovalFactor() parçacık çarpmasını (lokalize, yüksek anlık
// enerji) BASKIN terim, kayma gerilmesini İKİNCİL/sınırlı bir terim olarak
// ele alır — bu, master-context'in "f(kayma gerilmesi, partikül kinetik
// enerjisi, film dayanımı)" formülasyonunu bilerek ASİMETRİK uygular.

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";

export interface FilmRemovalFactorInput {
  /** Akışkanın boru cidarına uyguladığı duvar kayma gerilmesi (Pa) */
  wallShearStressPa: number;
  /** Parçacık çarpma hızı (m/s) — DNV RP-O501/dnvO501.ts tipi hesaplardan (Up) alınabilir */
  particleImpactVelocityMs: number;
  /**
   * Bu sistem/malzeme çifti için "önemli film sıyırma" başlangıcı kabul
   * edilen referans parçacık çarpma hızı — HİÇBİR jenerik/literatür kaynaklı
   * değer bulunamadı (bu oturumda özel olarak arandı), bu yüzden ZORUNLU bir
   * girdidir (Kc/σmr ile AYNI KDP gerekçesi — data/valveCatalog.ts, erosion/
   * valveHydraulics.ts) — mühendisin kendi sistem/malzeme deneyimine veya
   * saha verisine dayanarak sağlaması gerekir, uydurulmaz.
   */
  referenceImpactVelocityMs: number;
}

/**
 * Film sıyırma faktörünü (0-1, yüzeyin "taze/korumasız" kabul edilen
 * kesri) hesaplar.
 *
 * Model: filmRemovalFactor = shearTerm + impactTerm (0-1'e kırpılır).
 *   shearTerm = min(τ/film_yapışma_direnci, 0.1) — üst sınır %10'da
 *   TUTULUR çünkü bu oturumda bulunan araştırma, akışkan kayma gerilmesinin
 *   (tipik ~10²Pa) TEK BAŞINA filmi sıyırmaya (~10^7Pa gerekir) YETERSİZ
 *   olduğunu gösteriyor — küçük katkı yalnızca "zaten hasarlı film
 *   kenarlarını aşındırma/temizleme" etkisini temsil eder.
 *   impactTerm = min(V/Vref, 1) × 0.9 — BASKIN terim, parçacık çarpmasının
 *   lokalize/anlık yüksek basıncı (su-darbesi tipi mekanizma, bu fonksiyonda
 *   AYRICA türetilmez, yalnızca hız oranıyla KABA temsil edilir).
 *
 * Girdi/çıktı birimleri: Pa, m/s → çıktı boyutsuz (0-1).
 * Bilinen sınırlamalar: bkz. dosya başı yorumu — confidence her zaman
 * MEDIUM/LOW'dur (bkz. registry/coefficients/synergy.ts).
 */
export function computeFilmRemovalFactor(input: FilmRemovalFactorInput): number {
  if (input.wallShearStressPa < 0) {
    throw new Error("Duvar kayma gerilmesi negatif olamaz.");
  }
  if (input.particleImpactVelocityMs < 0) {
    throw new Error("Parçacık çarpma hızı negatif olamaz.");
  }
  if (input.referenceImpactVelocityMs <= 0) {
    throw new Error("Referans çarpma hızı pozitif olmalıdır.");
  }
  const filmAdhesionStressPa = getCoefficient<number>("synergy.filmAdhesionStressPa").value;
  const shearTerm = Math.min(input.wallShearStressPa / filmAdhesionStressPa, 0.1);
  const impactTerm = Math.min(input.particleImpactVelocityMs / input.referenceImpactVelocityMs, 1) * 0.9;
  return Math.min(shearTerm + impactTerm, 1);
}

export type SynergyRegime = "PASİF" | "KOROZYON_HAKİM" | "EROZYON_HAKİM" | "SİNERJİK";

const PASSIVE_RATE_THRESHOLD_MM_YR = 0.01;
const DOMINANCE_RATIO = 2;

/**
 * Saf korozyon/erozyon hızlarına göre ayrık bir rejim belirler.
 *
 * Eşikler (2× baskınlık oranı, 0.01mm/yıl pasif eşiği) bu PROJENİN KENDİ
 * raporlama kabulüdür (KDP kapsamı dışı — erosion/valveHydraulics.ts'teki
 * GÜVENLİ/YAKLAŞIYOR/... ayrıklaştırmalarıyla aynı mantık).
 */
export function determineSynergyRegime(
  pureCorrosionRateMmYr: number,
  pureErosionRateMmYr: number,
  synergyRateMmYr: number,
): SynergyRegime {
  if (pureCorrosionRateMmYr <= PASSIVE_RATE_THRESHOLD_MM_YR && pureErosionRateMmYr <= PASSIVE_RATE_THRESHOLD_MM_YR) {
    return "PASİF";
  }
  const others = pureErosionRateMmYr + synergyRateMmYr;
  if (others === 0 || pureCorrosionRateMmYr > DOMINANCE_RATIO * others) {
    return "KOROZYON_HAKİM";
  }
  const othersForErosion = pureCorrosionRateMmYr + synergyRateMmYr;
  if (othersForErosion === 0 || pureErosionRateMmYr > DOMINANCE_RATIO * othersForErosion) {
    return "EROZYON_HAKİM";
  }
  return "SİNERJİK";
}

export interface SynergyInput {
  /** Saf korozyon hızı C — kendi mekanizma modülünden (ör. norsokM506, deWaard) hesaplanmış merkezi (P50) değer */
  pureCorrosionRateMmYr: number;
  /** Saf erozyon hızı E — kendi mekanizma modülünden (ör. dnvO501, api14e) hesaplanmış merkezi (P50) değer */
  pureErosionRateMmYr: number;
  wallShearStressPa: number;
  particleImpactVelocityMs: number;
  referenceImpactVelocityMs: number;
}

export interface SynergyResult {
  /** T = C+E+S */
  totalRateMmPerYear: UncertaintyBand;
  pureCorrosionRateMmYr: number;
  pureErosionRateMmYr: number;
  /** S (merkezi tahmin ve bant) */
  synergyRateMmYr: UncertaintyBand;
  /** S/T oranı (0-1) */
  synergyFractionOfTotal: number;
  filmRemovalFactor: number;
  regime: SynergyRegime;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

/**
 * Erozyon-korozyon sinerjisini ASTM G119 çerçevesiyle (T=C+E+S) hesaplar.
 *
 * Model adı: ASTM G119 T=C+E+S ayrıştırması + bu oturumda araştırılan film
 * sıyırma mekanizması (bkz. dosya başı yorumu) + master-context'in verdiği
 * %20-70 sinerji katkı aralığı (bkz. registry notları, LOW confidence).
 * Girdi/çıktı birimleri: mm/yıl, Pa, m/s → çıktı mm/yıl (UncertaintyBand).
 * Bilinen sınırlamalar: HER ZAMAN confidence=MEDIUM veya LOW — bu alan
 * literatürde tam oturmamıştır (bkz. dosya başı yorumu).
 */
export function computeSynergy(input: SynergyInput): SynergyResult {
  if (input.pureCorrosionRateMmYr < 0 || input.pureErosionRateMmYr < 0) {
    throw new Error("Saf korozyon/erozyon hızları negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];
  const filmRemovalFactor = computeFilmRemovalFactor({
    wallShearStressPa: input.wallShearStressPa,
    particleImpactVelocityMs: input.particleImpactVelocityMs,
    referenceImpactVelocityMs: input.referenceImpactVelocityMs,
  });

  const [, maxSynergyFraction] = getCoefficient<[number, number]>("synergy.contributionFractionRange").value;
  const synergyFractionOfTotal = filmRemovalFactor * maxSynergyFraction;

  const sourcesUsed = [
    "synergy.astmG119Framework",
    "synergy.filmAdhesionStressPa",
    "synergy.contributionFractionRange",
  ];
  const usedConfidences: ConfidenceLevel[] = [
    getCoefficient("synergy.astmG119Framework").confidence,
    getCoefficient("synergy.filmAdhesionStressPa").confidence,
    getCoefficient("synergy.contributionFractionRange").confidence,
  ];

  const baseSum = input.pureCorrosionRateMmYr + input.pureErosionRateMmYr;
  // T = (C+E)/(1-f), S = T-C-E — bkz. dosya başı yorumu (S/T=f cebirsel türetimi)
  const totalCentralMmYr = synergyFractionOfTotal < 1 ? baseSum / (1 - synergyFractionOfTotal) : baseSum;
  const synergyCentralMmYr = totalCentralMmYr - baseSum;

  const uncertaintyFactor = getCoefficient<number>("uncertainty.defaultMultiplicativeBandFactor").value;
  sourcesUsed.push("uncertainty.defaultMultiplicativeBandFactor");
  usedConfidences.push(getCoefficient("uncertainty.defaultMultiplicativeBandFactor").confidence);

  const regime = determineSynergyRegime(input.pureCorrosionRateMmYr, input.pureErosionRateMmYr, synergyCentralMmYr);

  if (baseSum <= PASSIVE_RATE_THRESHOLD_MM_YR) {
    validityWarnings.push({
      parameter: "Saf korozyon+erozyon hızı",
      value: baseSum,
      min: 0,
      max: PASSIVE_RATE_THRESHOLD_MM_YR,
      unit: "mm/yıl",
      message: "Hem saf korozyon hem saf erozyon hızı ihmal edilebilir düzeyde — sinerji mekanizması PASİF kabul edildi.",
    });
  } else {
    validityWarnings.push({
      parameter: "Sinerji katkı oranı",
      value: synergyFractionOfTotal,
      min: 0.2,
      max: 0.7,
      unit: "-",
      message:
        "Erozyon-korozyon sinerjisi bu oturumda araştırıldı ama literatürde TAM OTURMAMIŞ bir alandır — " +
        "sinerji katkı oranı (S/T) ve film sıyırma faktörü formülü MEDIUM/LOW confidence taşır, tek bir " +
        "'kesin' sayı olarak SUNULMAMALIDIR. Bkz. registry/coefficients/synergy.ts notları.",
    });
  }

  return {
    totalRateMmPerYear: applyMultiplicativeUncertaintyBand(totalCentralMmYr, uncertaintyFactor),
    pureCorrosionRateMmYr: input.pureCorrosionRateMmYr,
    pureErosionRateMmYr: input.pureErosionRateMmYr,
    synergyRateMmYr: applyMultiplicativeUncertaintyBand(Math.max(synergyCentralMmYr, 0), uncertaintyFactor),
    synergyFractionOfTotal,
    filmRemovalFactor,
    regime,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
