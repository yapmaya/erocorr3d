// packages/engine/tests/aggregate/metalLoss.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { computeScenarioAnnualLoss, computeTotalMetalLoss } from "../../src/aggregate/metalLoss";

describe("computeScenarioAnnualLoss", () => {
  it("tam yıl (365 gün) çalışan senaryoda düzeltme uygulanmaz", () => {
    const result = computeScenarioAnnualLoss({
      scenarioNameTr: "Sürekli çalışma",
      operatingDaysPerYear: 365,
      rateMmPerYear: { p10: 0.1, p50: 0.2, p90: 0.4 },
    });
    expect(result.annualLossMmPerYear).toEqual({ p10: 0.1, p50: 0.2, p90: 0.4 });
  });

  it("kısmi çalışma oranında düzeltme uygulanır", () => {
    const result = computeScenarioAnnualLoss({
      scenarioNameTr: "Çekiş modu",
      operatingDaysPerYear: 91,
      rateMmPerYear: { p10: 0.1, p50: 0.2, p90: 0.4 },
    });
    expect(result.annualLossMmPerYear.p50).toBeCloseTo(0.2 * (91 / 365), 6);
  });
});

describe("computeTotalMetalLoss — PSS-0002 örnek doğrulama (91 gün/yıl, 30 yıl tasarım ömrü)", () => {
  it("SLC = (91/365) × 30 × CR, dokümanın kendi §10.2 örneğiyle BİREBİR eşleşir", () => {
    const cr = 1.0; // mm/yıl, birim korozyon hızı — sonucu elle doğrulamak kolay olsun diye
    const result = computeTotalMetalLoss(
      [{ scenarioNameTr: "Çekiş modu (withdrawal)", operatingDaysPerYear: 91, rateMmPerYear: { p10: cr, p50: cr, p90: cr } }],
      30,
    );
    const expectedSlc = (91 / 365) * 30 * cr;
    expect(result.totalServiceLifeCorrosionMm.p50).toBeCloseTo(expectedSlc, 6);
    expect(expectedSlc).toBeCloseTo(0.25 * 30 * cr, 1); // dokümanın kendi yuvarlamasıyla (91/365≈0.25) tutarlı
  });

  it("birden fazla senaryo TOPLANIR", () => {
    const result = computeTotalMetalLoss(
      [
        { scenarioNameTr: "Çekiş modu", operatingDaysPerYear: 91, rateMmPerYear: { p10: 0.5, p50: 1.0, p90: 2.0 } },
        { scenarioNameTr: "Enjeksiyon modu", operatingDaysPerYear: 274, rateMmPerYear: { p10: 0.1, p50: 0.2, p90: 0.4 } },
      ],
      20,
    );
    const expectedAnnualP50 = 1.0 * (91 / 365) + 0.2 * (274 / 365);
    expect(result.totalAnnualLossMmPerYear.p50).toBeCloseTo(expectedAnnualP50, 6);
    expect(result.totalServiceLifeCorrosionMm.p50).toBeCloseTo(expectedAnnualP50 * 20, 6);
  });

  it("en yüksek yıllık katkıyı yapan senaryo 'belirleyici senaryo' olarak işaretlenir", () => {
    const result = computeTotalMetalLoss(
      [
        { scenarioNameTr: "Düşük risk", operatingDaysPerYear: 365, rateMmPerYear: { p10: 0.01, p50: 0.01, p90: 0.01 } },
        { scenarioNameTr: "Yüksek risk (belirleyici)", operatingDaysPerYear: 100, rateMmPerYear: { p10: 1, p50: 3, p90: 5 } },
      ],
      30,
    );
    expect(result.governingScenarioNameTr).toBe("Yüksek risk (belirleyici)");
  });

  it("P10/P50/P90 bantları da AYRI AYRI toplanır", () => {
    const result = computeTotalMetalLoss(
      [{ scenarioNameTr: "Tek senaryo", operatingDaysPerYear: 365, rateMmPerYear: { p10: 0.1, p50: 0.3, p90: 0.9 } }],
      10,
    );
    expect(result.totalServiceLifeCorrosionMm.p10).toBeCloseTo(1.0, 6);
    expect(result.totalServiceLifeCorrosionMm.p50).toBeCloseTo(3.0, 6);
    expect(result.totalServiceLifeCorrosionMm.p90).toBeCloseTo(9.0, 6);
  });

  it("toplam işletme günü 365'i aşarsa uyarı verir", () => {
    const result = computeTotalMetalLoss(
      [
        { scenarioNameTr: "A", operatingDaysPerYear: 300, rateMmPerYear: { p10: 0.1, p50: 0.1, p90: 0.1 } },
        { scenarioNameTr: "B", operatingDaysPerYear: 200, rateMmPerYear: { p10: 0.1, p50: 0.1, p90: 0.1 } },
      ],
      10,
    );
    expect(result.validityWarnings.some((w) => w.parameter === "Toplam işletme günü")).toBe(true);
  });

  it("boş senaryo listesi veya geçersiz tasarım ömrü için hata fırlatır", () => {
    expect(() => computeTotalMetalLoss([], 30)).toThrowError();
    expect(() =>
      computeTotalMetalLoss([{ scenarioNameTr: "A", operatingDaysPerYear: 91, rateMmPerYear: { p10: 0.1, p50: 0.1, p90: 0.1 } }], 0),
    ).toThrowError();
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    const result = computeTotalMetalLoss(
      [{ scenarioNameTr: "A", operatingDaysPerYear: 91, rateMmPerYear: { p10: 0.1, p50: 0.1, p90: 0.1 } }],
      30,
    );
    expect(result.disclaimer).toContain("mühendislik tahminidir");
  });
});

describe("metalLoss — KDP kayıt defteri entegrasyonu", () => {
  it("SLC formülü kayıtlıdır ve HIGH confidence taşır (birincil BOTAŞ dokümanı)", () => {
    const entry = listCoefficients().find((c) => c.id === "metalLoss.slcFormula");
    expect(entry?.confidence).toBe("HIGH");
    expect(entry?.source.type).toBe("PROJECT_DOCUMENT");
  });
});
