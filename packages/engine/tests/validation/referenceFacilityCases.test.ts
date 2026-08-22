// packages/engine/tests/validation/referenceFacilityCases.test.ts
//
// Motorun CO2 (tatlı) korozyon hesabının, kaynak dokümanın (kimliği
// izlenebilirlik amacıyla anonim tutulan iç proje dokümanı) Appendix A
// tablosunda yayımlanmış GERÇEK proje sonuçlarıyla mühendislik açısından
// makul bir aralıkta örtüşüp örtüşmediğini doğrular.
//
// KABUL KRİTERİ: hesaplanan değer, referansın ±%30'u içinde. Tam eşleşme
// BEKLENMEZ — farklı yazılım (kaynak kurumun kendi iç aracı) ve GERÇEK H&MB
// girdi verisi (bu oturumda bulunamadı, bkz. fixture dosyasının kaynak notu)
// yerine temsili girdi kullanılıyor. Bir vaka toleransı aşarsa, hata mesajı
// fixture'daki "temsili girdi" notunu ve akışın kendi açıklamasını otomatik
// içerir — "neden sapma var" sorusuna doğrudan cevap verir.
//
// KAPSAM DIŞI (bilinçli): kuru gaz sınıflandırmalı akışlar — bkz.
// dryGas.test.ts'in kendi, ayrı ve dokümante sapma notu.
//
// BİLİNEN, KALICI OLARAK DOKÜMANTE EDİLMİŞ 2 SAPMA (2026-08-22 itibarıyla,
// 12 vakadan 10'u ±%30 içinde): Hat L2/W3A ve Hat L3/W1A toleransı aşıyor
// VE düzeltilmeyecek — bkz. referenceFacilityValidationData.ts'in
// buildRepresentativeWetGasCase üzerindeki "REPRESENTATIVE_TEMPERATURE_C"
// notu. Özet: bu oturumda yapılan duyarlılık analizi, Hat L3'ün kendi
// içinde W1A'nın YÜKSELMESİ, W5A'nın ise DÜŞMESİ gerektiğini gösterdi — aynı
// akış için birbirine ZIT yönde düzeltme. Tek bir temsili parametre seti
// (sıcaklık, hız, ne denenirse) ikisini AYNI ANDA karşılayamaz; bu, gerçek
// H&MB (Heat & Material Balance) verisinde bu iki HMB-senaryosu arasında
// bizim şu an modelleyemediğimiz gerçek bir fark olduğunun İŞARETİDİR, motor
// hatası değildir. "Hangi parametre 12/12 verir" diye aramak burada KDP'nin
// yasakladığı şeye (sonuca göre veri uydurmaya) denk gelir — bu yüzden
// BİLEREK yapılmadı. Gerçek çözüm, kaynak kurumun Process Design Report'unun
// (bu oturumda bulunamadı) gerçek verisidir.

import { describe, expect, it } from "vitest";
import {
  APPENDIX_A_VALIDATION_CASES,
  computeEngineCo2RateMmPerYear,
  PSS0002_CITATION,
} from "../../src/fixtures/referenceFacilityValidationData";

const TOLERANCE_FRACTION = 0.3;

describe(`Referans Tesis Appendix A doğrulaması (${PSS0002_CITATION})`, () => {
  for (const testCase of APPENDIX_A_VALIDATION_CASES) {
    const label =
      `Hat ${testCase.streamId} (${testCase.descriptionTr}) — ` +
      `%${testCase.nativeGasCase.nativeGasPercent} doğal gaz / ${testCase.nativeGasCase.appendixAColumn}`;

    it(`${label}: hesaplanan CO2 hızı referansın ±%30'u içinde`, () => {
      const calculatedMmPerYear = computeEngineCo2RateMmPerYear(testCase);
      const reference = testCase.referenceMmPerYear;
      const lowerBound = reference * (1 - TOLERANCE_FRACTION);
      const upperBound = reference * (1 + TOLERANCE_FRACTION);

      const failureContextTr =
        `${label}\n` +
        `  Referans (kaynak dokümanın Appendix A tablosu): ${reference.toFixed(3)} mm/yıl\n` +
        `  Hesaplanan (motor, temsili girdilerle): ${calculatedMmPerYear.toFixed(3)} mm/yıl\n` +
        `  Kabul aralığı (±%30): [${lowerBound.toFixed(3)}, ${upperBound.toFixed(3)}]\n` +
        "  Olası sebep: bu senaryonun sıcaklık/basınç/hız girdileri TEMSİLİDİR " +
        "(gerçek H&MB raporu bu oturumda bulunamadı) — yalnızca CO2 mol%'si ve " +
        "ıslak/kuru sınıflandırması dokümandan gerçektir.";

      expect(calculatedMmPerYear, failureContextTr).toBeGreaterThanOrEqual(lowerBound);
      expect(calculatedMmPerYear, failureContextTr).toBeLessThanOrEqual(upperBound);
    });
  }

  it("toplamda 4 akış × 3 senaryo = 12 vaka değerlendirildi", () => {
    expect(APPENDIX_A_VALIDATION_CASES).toHaveLength(12);
  });
});
