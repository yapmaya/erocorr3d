// packages/engine/tests/validation/registryAudit.test.ts
//
// Kayıt defterindeki UNVERIFIED (doğrulanmamış) katsayı sayısını raporlar.
//
// ÖNEMLİ TASARIM NOTU: Vitest'in "sarı/uyarı" diye bir test durumu YOKTUR —
// yalnızca geçti/kaldı vardır. Bu yüzden bu test, UNVERIFIED sayısı >0 olsa
// DAHİ YAPISAL OLARAK HER ZAMAN YEŞİL kalır (denetim fonksiyonunun doğru
// çalışıp çalışmadığını doğrular, katsayıların doğrulanmış OLMASINI değil).
// Asıl sarı/yeşil görsel uyarı, npm run validate ile üretilen HTML raporunda
// gösterilir (bkz. scripts/generateValidationReport.mjs) — bu, "kaç
// katsayının hâlâ doğrulanması gerekiyor" sorusunun görünür kalması için
// bilinçli bir tasarım tercihidir, bir eksiklik değildir.

import { describe, expect, it } from "vitest";
// Tam barrel'dan (../../src/index) import edilir, YALNIZCA ../../src/registry'den
// DEĞİL: src/data/*.ts (materials, valveCatalog, pipeGrades, pipeSchedules,
// mechanisms) KENDİ registerCoefficient() çağrılarını taşır (registry/coefficients/
// index.ts'in ALL_COEFFICIENTS listesinin DIŞINDA) — bu betik yalnızca registry/
// modülünü import etseydi bu ~94 katalog girdisi (malzeme/vana/boru cetveli/
// mekanizma tanımı) sayılmaz, denetim EKSİK olurdu. Tam barrel, gerçek
// uygulamanın (apps/web, @erocorr3d/engine üzerinden) göreceği durumla AYNIDIR.
import { listByConfidence, listCoefficients, registryStats } from "../../src/index";

describe("Kayıt Defteri Denetimi (KDP)", () => {
  it("kayıt defteri boş değildir (motor en az bir katsayı kaydetmiştir)", () => {
    expect(listCoefficients().length).toBeGreaterThan(0);
  });

  it("her katsayı KDP şemasının zorunlu alanlarını taşır", () => {
    for (const coefficient of listCoefficients()) {
      expect(coefficient.id).toBeTruthy();
      expect(coefficient.source.citation).toBeTruthy();
      expect(["HIGH", "MEDIUM", "LOW", "UNVERIFIED"]).toContain(coefficient.confidence);
    }
  });

  it("UNVERIFIED katsayı sayısını raporlar (test her koşulda geçer — bkz. dosya başı not)", () => {
    const unverified = listByConfidence("UNVERIFIED");
    const stats = registryStats();

    if (unverified.length > 0) {
      const listTr = unverified.map((c) => `  - ${c.id} (${c.module}): ${c.notes}`).join("\n");
      console.warn(
        `[KDP DENETİMİ] ${unverified.length} UNVERIFIED katsayı bulundu (toplam ${stats.total} katsayının ` +
          `içinde):\n${listTr}\nBu, npm run validate raporunda SARI olarak işaretlenecektir.`,
      );
    }

    // Yapısal doğrulama: sayı negatif olamaz, toplamla tutarlı olmalıdır.
    expect(unverified.length).toBeGreaterThanOrEqual(0);
    expect(unverified.length).toBeLessThanOrEqual(stats.total);
    expect(stats.byConfidence.UNVERIFIED).toBe(unverified.length);
  });
});
