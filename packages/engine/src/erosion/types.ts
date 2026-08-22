// packages/engine/src/erosion/types.ts
//
// erosion/ modülündeki TÜM hesap fonksiyonlarının paylaştığı ortak çıktı
// sözleşmesi. corrosion/types.ts'teki CorrosionRateResult ile KASITLI
// olarak AYNI ŞEKİLDE tutulur (rateMmPerYear/confidence/validityWarnings/
// sourcesUsed/disclaimer) ama erozyona özgü ek alanlar taşır: hangi model
// kullanıldığı (bir bileşen için birden fazla erozyon alt-modeli olabilir),
// parçacık çarpma açısı/hızı, hasarın bileşen üzerindeki 3B konumu (ısı
// haritası katmanı bu alanları doğrudan tüketecek) ve API 14E tarama
// kriterinin aşılıp aşılmadığı.
//
// calculationTrace, types/results.ts'teki (Zod ile şemalanmış, projenin
// geri kalanında MechanismResult'ın da kullandığı) TraceStep tipini
// yeniden kullanır — paralel bir izlenebilirlik şeması icat ETMEZ.

import { getCoefficient } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import type { TraceStep } from "../types/results";

export type { ValidityWarning } from "../corrosion/types";
export { ENGINEERING_DISCLAIMER_TR } from "../corrosion/types";

import type { ValidityWarning } from "../corrosion/types";

/**
 * Bir bileşen üzerinde hasarın maksimum olduğu konumun tanımı — 3B ısı
 * haritası katmanının doğrudan tüketeceği alanlar.
 *
 * angularPositionDeg: dairesel (çevresel) konum, 0°=iç yarıçap/alt taraf
 * konvansiyonu ÇAĞIRAN TARAFIN geometri yerleşimine bağlıdır; simetrik
 * geometrilerde (ör. blind tee, düz boru) anlamsızdır → null.
 * axialPositionFraction: bileşen ekseni boyunca göreli konum (0=giriş,
 * 1=çıkış); nokta-tipi hasarlarda (ör. dirsek çıkışı) tek bir değere sabittir.
 */
export interface ErosionDamageLocation {
  maxLocationDescriptionTr: string;
  angularPositionDeg: number | null;
  axialPositionFraction: number;
}

export interface ErosionResult extends ErosionDamageLocation {
  rateMmPerYear: UncertaintyBand;
  /** Kullanılan model/alt-prosedürün kısa adı (ör. "DNV-RP-O501 §8.4 Dirsek") */
  modelUsed: string;
  particleImpactAngleDeg: number;
  particleVelocityMs: number;
  /** API 14E tarama hızı aşıldı mı — çağıran taraf ayrıca hesaplamadıysa null */
  isAboveApi14eLimit: boolean | null;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  calculationTrace: TraceStep[];
  disclaimer: string;
}

/**
 * DNV RP O501 Eq. 8.12/8.33/8.37 — parçacık boyutu ve karışım yoğunluğu
 * düzeltme faktörü C2. Kaynak ışın dikişi (8.3.1), redüksiyon (8.6) ve
 * sıyırma probu (8.8) alt-prosedürlerinde AYNI formülle üç kez tekrarlanır
 * — burada TEK bir paylaşılan yardımcı fonksiyon olarak tutulur.
 *
 * @param particleDiameterM Parçacık çapı dp (m)
 * @param mixtureDensityKgM3 Karışım yoğunluğu ρm (kg/m³)
 */
export function computeParticleSizeDensityCorrectionC2(
  particleDiameterM: number,
  mixtureDensityKgM3: number,
): number {
  if (particleDiameterM < 0) {
    throw new Error("Parçacık çapı negatif olamaz.");
  }
  if (mixtureDensityKgM3 <= 0) {
    throw new Error("Karışım yoğunluğu pozitif olmalıdır.");
  }
  const denominatorConstant = getCoefficient<number>(
    "dnvO501.particleSizeDensityCorrection.denominatorConstant",
  ).value;
  const ratio = (1e6 * particleDiameterM) / (denominatorConstant * Math.sqrt(mixtureDensityKgM3));
  return ratio < 1 ? ratio : 1;
}
