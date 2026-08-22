// packages/engine/src/uncertainty/percentiles.ts

export interface UncertaintyBand {
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Merkezi (model) tahmini etrafında çarpımsal bir belirsizlik bandı üretir.
 *
 * SÖZLEŞME: Bu proje P10/P50/P90'ı istatistiksel yüzdelik anlamında kullanır
 * (P90 = %90 ihtimalle gerçek değerin bu sayının altında kalacağı, yani
 * KORUYUCU/YÜKSEK tahmin; P10 = iyimser/DÜŞÜK tahmin). Bu, petrol
 * rezervlerinde yaygın olan TERS P10/P90 kuralından (P90=düşük, P10=yüksek)
 * FARKLIDIR — kod ve UI'da bu sözleşmeye sadık kalınmalıdır.
 *
 * @param centralValue Model merkezi (P50) tahmini
 * @param factor Bandın genişliği (>=1). P90 = centralValue×factor, P10 = centralValue/factor.
 */
export function applyMultiplicativeUncertaintyBand(
  centralValue: number,
  factor: number,
): UncertaintyBand {
  if (factor < 1) {
    throw new Error("Belirsizlik bandı çarpanı 1'den küçük olamaz.");
  }
  if (centralValue < 0) {
    throw new Error("Merkezi değer negatif olamaz.");
  }
  return {
    p10: centralValue / factor,
    p50: centralValue,
    p90: centralValue * factor,
  };
}
