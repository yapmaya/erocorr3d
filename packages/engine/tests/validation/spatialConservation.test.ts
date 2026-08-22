// packages/engine/tests/validation/spatialConservation.test.ts
//
// "Hasar alanı integrali = ortalama hız" — projenin temel uzamsal modelinin
// (bkz. spatial/fields.ts dosya başı yorumu) KÜTLE KORUNUMU ilkesini
// uçtan uca (gerçek MechanismResult[] → computeDamageField) doğrular:
//   damage(u,v) = Σ_mekanizma[hız_m × süre × f_m(u,v)], ∫∫f_m dudv ≈ 1
// ⇒ ızgara ORTALAMASI ≈ Σ_mekanizma[hız_m] × süre — dağılımın ŞEKLİNDEN
// (hangi hotspot deseni seçildiğinden) BAĞIMSIZ olarak.
//
// spatial/fields.ts::DamageField.computeMeanValueMm() zaten bu testin
// "doğrudan girdisi" olarak belgelenmiş (bkz. o metodun kendi yorumu) —
// burada computeDamageField()'ın döndürdüğü SpatialDamageField.valuesMm
// üzerinden AYNI ortalamayı elle hesaplıyoruz (computeDamageField bir
// DamageField ÖRNEĞİ değil, onun .toSpatialDamageField() çıktısını döner).

import { describe, expect, it } from "vitest";
import { referenceLine1 } from "../../src/fixtures/referenceFacility";
import { runMechanismAssessment } from "../../src/orchestrate/assessComponent";
import { computeDamageField } from "../../src/spatial/index";

function meanValueMm(valuesMm: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < valuesMm.length; i++) sum += valuesMm[i];
  return sum / valuesMm.length;
}

describe("Kütle korunumu — ızgara ortalaması = Σ(hız) × süre", () => {
  it("Stream 1030 çekiş senaryosu: gerçek mekanizma sonuçlarıyla üretilen alan, korunumu sağlar", () => {
    const operatingCase = referenceLine1.operatingProfile.cases[0]!; // Kış Çekiş Modu
    const assessment = runMechanismAssessment(
      referenceLine1.geometry,
      referenceLine1.mitigation,
      operatingCase,
      {},
    );
    const applicableResults = assessment.mechanismResults.filter((r) => r.isApplicable);
    expect(applicableResults.length).toBeGreaterThan(0); // Test anlamsız olmasın diye — en az bir aktif mekanizma şart

    const expectedTotalRateMmPerYear = applicableResults.reduce((sum, r) => sum + r.rateP50, 0);
    const elapsedYears = 5;
    const expectedMeanMm = expectedTotalRateMmPerYear * elapsedYears;

    // İnce ızgara (200×200) — normalizeShapeFn'in kendi iç normalizasyon
    // çözünürlüğüne (400) yakın, ayrıklaştırma hatasını küçültmek için
    // görselleştirme varsayılanından (96×64) daha yüksek seçildi.
    const field = computeDamageField(referenceLine1.geometry, assessment.mechanismResults, elapsedYears, {
      resolutionU: 200,
      resolutionV: 200,
    });

    const actualMeanMm = meanValueMm(field.valuesMm);

    // %5 bağıl tolerans: orta-nokta Riemann ayrıklaştırma hatası içindir,
    // gerçek bir hesap sapması DEĞİLDİR.
    expect(actualMeanMm).toBeGreaterThan(0);
    expect(Math.abs(actualMeanMm - expectedMeanMm) / expectedMeanMm).toBeLessThan(0.05);
  });

  it("elapsedYears=0 iken alan tamamen sıfırdır (kütle korunumunun dejenere hali)", () => {
    const operatingCase = referenceLine1.operatingProfile.cases[0]!;
    const assessment = runMechanismAssessment(
      referenceLine1.geometry,
      referenceLine1.mitigation,
      operatingCase,
      {},
    );
    const field = computeDamageField(referenceLine1.geometry, assessment.mechanismResults, 0, {
      resolutionU: 50,
      resolutionV: 50,
    });
    expect(meanValueMm(field.valuesMm)).toBe(0);
  });
});
