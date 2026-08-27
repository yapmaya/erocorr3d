// packages/engine/src/guards/numericGuards.ts
//
// Motorun DIŞA AÇIK giriş noktalarındaki (assessComponentScenario ->
// runMechanismAssessment -> aggregate/metalLoss.ts::computeTotalMetalLoss,
// spatial/index.ts::computeDamageField) mevcut sayısal korumalar (`if (x <=
// 0) throw ...`) NaN'ı SESSİZCE geçiriyordu — JavaScript'te `NaN <= 0`,
// `NaN < 0`, `NaN > 365` HER ZAMAN false döner. Motorun DIŞARI açık iki
// gerçek giriş yolu da (features/input/computeAssessment.ts,
// features/projects/batchAnalysis.ts) zaten Zod ile .parse() yaptığı için
// bu SENARYOLAR bugün kullanıcı tarafından TETİKLENEMEZ — bu yalnızca
// şemayı atlayan gelecekteki bir çağırana (CLI, test, başka bir uygulama)
// karşı derinlemesine savunmadır.
//
// Motorun geri kalanındaki ~230 `throw new Error` korumasına KASITLI OLARAK
// dokunulmadı (bkz. proje düzeltme notları) — yalnızca yukarıdaki isimli
// giriş noktalarında YENİ bir `assertFinite(...)` çağrısı, MEVCUT aralık
// kontrolünün HEMEN ÖNÜNE eklendi; hiçbir mevcut hata mesajı DEĞİŞTİRİLMEDİ.

/**
 * `value` sonlu değilse (NaN veya ±Infinity) açık bir Türkçe hatayla
 * reddeder. Aralık/işaret kontrolü YAPMAZ — çağıran taraf bunu kendi
 * (zaten var olan) kontrolüyle AYRICA yapar; bu yardımcı yalnızca çıplak
 * karşılaştırmaların (`<`, `<=`, `>`) sessizce atladığı NaN/Infinity
 * durumunu yakalar.
 */
export function assertFinite(value: number, labelTr: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${labelTr} sonlu bir sayı olmalıdır (alınan: ${value}).`);
  }
}
