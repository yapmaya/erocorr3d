// packages/engine/src/spatial/timeScaling.ts
//
// DamageField.addContribution'ın kendi formülü (hız×süre×şekil, bkz.
// fields.ts dosya başı yorumu) elapsedYears'a göre DOĞRUSALDIR — bu yüzden
// TEK bir OperatingCase içinde, t yılındaki hasar alanı, tasarım-ömrü-sonu
// (elapsedYears=designLifeYears) alanının BASİT bir ÖLÇEKLEMESİDİR.
// computeDamageField'ı HER zaman-kaydırıcı hareketinde yeniden çağırmaya
// GEREK YOKTUR — bu, apps/web'in zaman kaydırıcısının performans-kritik
// yolu için gereklidir (tek bir ağır hesap, sonra ucuz ölçekleme).

import type { Hotspot, SpatialDamageField } from "../types/results";

/**
 * fullLifeField'ı (elapsedYears=designLifeYears'ta hesaplanmış) verilen bir
 * oranla (targetElapsedYears/designLifeYears) DOĞRUSAL olarak ölçekler.
 *
 * Geçerlilik: yalnızca TEK bir OperatingCase içindeki, ZATEN hesaplanmış bir
 * alan için geçerlidir (hız×süre modeli doğrusaldır) — senaryolar ARASI
 * geçiş etkileri (ör. bir modda oluşan filmin bir SONRAKİ modu geçici
 * koruması) bu projenin metal kaybı modelinde ZATEN yoktur (bkz. aggregate/
 * metalLoss.ts'in kendi "senaryolar arasında BAĞIMSIZLIK varsayılır" notu)
 * — bu fonksiyon o varsayımı TEKRAR ETMEZ, yalnızca ONA dayanır.
 */
export function scaleSpatialDamageField(fullLifeField: SpatialDamageField, factor: number): SpatialDamageField {
  if (factor < 0) {
    throw new Error("Ölçekleme oranı negatif olamaz.");
  }
  const valuesMm = new Float32Array(fullLifeField.valuesMm.length);
  for (let i = 0; i < valuesMm.length; i++) {
    valuesMm[i] = fullLifeField.valuesMm[i] * factor;
  }
  const hotspots: Hotspot[] = fullLifeField.hotspots.map((h) => ({ ...h, valueMm: h.valueMm * factor }));
  return {
    ...fullLifeField,
    valuesMm,
    maxValueMm: fullLifeField.maxValueMm * factor,
    hotspots,
  };
}
