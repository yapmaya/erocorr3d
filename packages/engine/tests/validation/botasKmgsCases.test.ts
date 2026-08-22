// packages/engine/tests/validation/botasKmgsCases.test.ts
//
// Motorun CO2 (tatlı) korozyon hesabının, BOTAŞ F3-500-ME-SPC-PSS-0002'nin
// Appendix A tablosunda yayımlanmış GERÇEK proje sonuçlarıyla mühendislik
// açısından makul bir aralıkta örtüşüp örtüşmediğini doğrular.
//
// KABUL KRİTERİ: hesaplanan değer, referansın ±%30'u içinde. Tam eşleşme
// BEKLENMEZ — farklı yazılım (BOTAŞ'ın kendi iç aracı) ve GERÇEK H&MB girdi
// verisi (bu oturumda bulunamadı, bkz. fixture dosyasının kaynak notu) yerine
// temsili girdi kullanılıyor. Bir vaka toleransı aşarsa, hata mesajı
// fixture'daki "temsili girdi" notunu ve akışın kendi açıklamasını otomatik
// içerir — "neden sapma var" sorusuna doğrudan cevap verir.
//
// KAPSAM DIŞI (bilinçli): Stream 1400/4000 (kuru gaz sınıflandırması) — bkz.
// dryGas.test.ts'in kendi, ayrı ve dokümante sapma notu.

import { describe, expect, it } from "vitest";
import {
  APPENDIX_A_VALIDATION_CASES,
  computeEngineCo2RateMmPerYear,
  PSS0002_CITATION,
} from "../../src/fixtures/botasPss0002ValidationData";

const TOLERANCE_FRACTION = 0.3;

describe(`BOTAŞ Appendix A doğrulaması (${PSS0002_CITATION})`, () => {
  for (const testCase of APPENDIX_A_VALIDATION_CASES) {
    const label =
      `Akış ${testCase.streamId} (${testCase.descriptionTr}) — ` +
      `%${testCase.nativeGasCase.nativeGasPercent} doğal gaz / ${testCase.nativeGasCase.appendixAColumn}`;

    it(`${label}: hesaplanan CO2 hızı referansın ±%30'u içinde`, () => {
      const calculatedMmPerYear = computeEngineCo2RateMmPerYear(testCase);
      const reference = testCase.referenceMmPerYear;
      const lowerBound = reference * (1 - TOLERANCE_FRACTION);
      const upperBound = reference * (1 + TOLERANCE_FRACTION);

      const failureContextTr =
        `${label}\n` +
        `  Referans (Appendix A, s.53-55): ${reference.toFixed(3)} mm/yıl\n` +
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
