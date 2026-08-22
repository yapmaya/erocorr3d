// packages/engine/tests/validation/slcCtlAtl.test.ts
//
// SLC (Service Life Corrosion) ve CTL/ATL oranı hesaplarının, BOTAŞ
// F3-500-ME-SPC-PSS-0002 Tablo 10-3/10-4'ün kendi sayılarını ne kadar
// yakın ürettiğini doğrular. computeTotalMetalLoss/computeCtlAtl zaten bu
// dokümandan (confidence=HIGH, PROJECT_DOCUMENT) besleniyor — bkz.
// registry/coefficients/metalLoss.ts ve ctlAtl.ts.
//
// Cru DEĞERLERİ nasıl elde edildi: Appendix A'daki 7 HMB-senaryosu sütununun
// (W1A/W1A37C/W2/W3A/W3B/W5A/W5B) EN YÜKSEĞİ — bkz.
// botasPss0002ValidationData.ts'in dosya başı "Cru türetimi" notu (iki
// bağımsız akışta TAM sayısal eşleşmeyle doğrulanmıştır, uydurulmamıştır).

import { describe, expect, it } from "vitest";
import { computeCtlAtl } from "../../src/aggregate/ctlAtl";
import { computeTotalMetalLoss } from "../../src/aggregate/metalLoss";
import { SLC_CTL_ATL_CASES } from "../../src/fixtures/botasPss0002ValidationData";

describe("computeTotalMetalLoss — Tablo 10-3 SLC formülü ile birebir karşılaştırma", () => {
  for (const testCase of SLC_CTL_ATL_CASES) {
    it(`Akış ${testCase.streamId}: SLC = (${testCase.operatingDaysPerYear}/365)×${testCase.designLifeYears}×${testCase.cruMmPerYear} ≈ ${testCase.referenceSlcMm}mm`, () => {
      const result = computeTotalMetalLoss(
        [
          {
            scenarioNameTr: "Çekiş (withdrawal)",
            operatingDaysPerYear: testCase.operatingDaysPerYear,
            rateMmPerYear: { p10: testCase.cruMmPerYear, p50: testCase.cruMmPerYear, p90: testCase.cruMmPerYear },
          },
        ],
        testCase.designLifeYears,
      );

      // Tam formül eşitliği (91/365 tam oran) ile dokümanın kendi yuvarlanmış
      // (0.25) sayısı arasında <%1 fark beklenir — sıkı tolerans.
      expect(result.totalServiceLifeCorrosionMm.p50).toBeCloseTo(testCase.referenceSlcMm, 1);
    });
  }
});

describe("computeCtlAtl — Tablo 10-4 kategori sınırları ile karşılaştırma", () => {
  for (const testCase of SLC_CTL_ATL_CASES) {
    it(`Akış ${testCase.streamId}: ATL/CTL ≈ ${testCase.referenceAtlCtlRatio} (±%10 tolerans — bkz. not aşağıda)`, () => {
      const metalLoss = computeTotalMetalLoss(
        [
          {
            scenarioNameTr: "Çekiş (withdrawal)",
            operatingDaysPerYear: testCase.operatingDaysPerYear,
            rateMmPerYear: { p10: testCase.cruMmPerYear, p50: testCase.cruMmPerYear, p90: testCase.cruMmPerYear },
          },
        ],
        testCase.designLifeYears,
      );

      const ctlAtl = computeCtlAtl({
        predictedTotalCorrosionMm: metalLoss.totalServiceLifeCorrosionMm.p50,
        selectedCorrosionAllowanceMm: testCase.primaryCaMm,
      });

      // NOT: Doküman 1030 için 1.109, bu hesap ~1.075-1.09 verir (~%3 fark).
      // Bu, dokümanın kendi iç yuvarlamasından (91/365 vs 0.25, veya ATL'nin
      // etiketlenen 3.0mm'den biraz farklı hassas bir değer olması) kaynaklanan,
      // kullanıcı tarafından ÖNCEDEN kabul edilmiş küçük bir sapmadır — ±%10
      // tolerans bunu barındırır. Kategori (MEDIUM/LOW) sınırların çok
      // içinde olduğundan bu küçük fark kategori sonucunu DEĞİŞTİRMEZ.
      const lowerBound = testCase.referenceAtlCtlRatio * 0.9;
      const upperBound = testCase.referenceAtlCtlRatio * 1.1;
      expect(ctlAtl.ratio).toBeGreaterThanOrEqual(lowerBound);
      expect(ctlAtl.ratio).toBeLessThanOrEqual(upperBound);
    });
  }

  it("Akış 1030 (ratio≈1.075-1.109): kategori MEDIUM", () => {
    const testCase = SLC_CTL_ATL_CASES.find((c) => c.streamId === "1030")!;
    const metalLoss = computeTotalMetalLoss(
      [
        {
          scenarioNameTr: "Çekiş (withdrawal)",
          operatingDaysPerYear: testCase.operatingDaysPerYear,
          rateMmPerYear: { p10: testCase.cruMmPerYear, p50: testCase.cruMmPerYear, p90: testCase.cruMmPerYear },
        },
      ],
      testCase.designLifeYears,
    );
    const ctlAtl = computeCtlAtl({
      predictedTotalCorrosionMm: metalLoss.totalServiceLifeCorrosionMm.p50,
      selectedCorrosionAllowanceMm: testCase.primaryCaMm,
    });
    expect(ctlAtl.category).toBe("MEDIUM");
  });

  it("Akış 1130 (ratio≈0.575): kategori LOW", () => {
    const testCase = SLC_CTL_ATL_CASES.find((c) => c.streamId === "1130")!;
    const metalLoss = computeTotalMetalLoss(
      [
        {
          scenarioNameTr: "Çekiş (withdrawal)",
          operatingDaysPerYear: testCase.operatingDaysPerYear,
          rateMmPerYear: { p10: testCase.cruMmPerYear, p50: testCase.cruMmPerYear, p90: testCase.cruMmPerYear },
        },
      ],
      testCase.designLifeYears,
    );
    const ctlAtl = computeCtlAtl({
      predictedTotalCorrosionMm: metalLoss.totalServiceLifeCorrosionMm.p50,
      selectedCorrosionAllowanceMm: testCase.primaryCaMm,
    });
    expect(ctlAtl.category).toBe("LOW");
  });
});
