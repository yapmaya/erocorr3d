// packages/engine/tests/synergy/synergy.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { computeFilmRemovalFactor, computeSynergy, determineSynergyRegime } from "../../src/synergy/synergy";

describe("computeFilmRemovalFactor", () => {
  it("kayma gerilmesi tek başına asla yüksek bir faktör vermez (araştırma bulgusu: yetersiz)", () => {
    // Film yapışma direnci ~1e7 Pa — gerçekçi bir akış kayma gerilmesi (ör. 500 Pa) bile
    // shearTerm'i %0.1'e sabitler (min(500/1e7,0.1)=0.00005), darbe hızı 0 iken toplam ≈0.
    const factor = computeFilmRemovalFactor({
      wallShearStressPa: 500,
      particleImpactVelocityMs: 0,
      referenceImpactVelocityMs: 20,
    });
    expect(factor).toBeLessThan(0.01);
  });

  it("parçacık çarpma hızı referans hıza ulaştığında faktör baskın olarak artar", () => {
    const factor = computeFilmRemovalFactor({
      wallShearStressPa: 0,
      particleImpactVelocityMs: 20,
      referenceImpactVelocityMs: 20,
    });
    expect(factor).toBeCloseTo(0.9, 5);
  });

  it("referans hızın üzerinde 1'e kırpılır", () => {
    const factor = computeFilmRemovalFactor({
      wallShearStressPa: 1e7,
      particleImpactVelocityMs: 100,
      referenceImpactVelocityMs: 20,
    });
    expect(factor).toBeLessThanOrEqual(1);
  });

  it("geçersiz girdi için hata fırlatır", () => {
    expect(() =>
      computeFilmRemovalFactor({ wallShearStressPa: -1, particleImpactVelocityMs: 1, referenceImpactVelocityMs: 1 }),
    ).toThrowError();
    expect(() =>
      computeFilmRemovalFactor({ wallShearStressPa: 1, particleImpactVelocityMs: 1, referenceImpactVelocityMs: 0 }),
    ).toThrowError();
  });
});

describe("determineSynergyRegime", () => {
  it("her ikisi de ihmal edilebilirse PASİF döner", () => {
    expect(determineSynergyRegime(0.001, 0.001, 0)).toBe("PASİF");
  });

  it("korozyon baskınsa KOROZYON_HAKİM döner", () => {
    expect(determineSynergyRegime(1.0, 0.05, 0.05)).toBe("KOROZYON_HAKİM");
  });

  it("erozyon baskınsa EROZYON_HAKİM döner", () => {
    expect(determineSynergyRegime(0.05, 1.0, 0.05)).toBe("EROZYON_HAKİM");
  });

  it("mertebeler karşılaştırılabilirse SİNERJİK döner", () => {
    expect(determineSynergyRegime(0.5, 0.5, 0.3)).toBe("SİNERJİK");
  });
});

describe("computeSynergy", () => {
  const baseInput = {
    pureCorrosionRateMmYr: 0.5,
    pureErosionRateMmYr: 0.5,
    wallShearStressPa: 100,
    particleImpactVelocityMs: 15,
    referenceImpactVelocityMs: 20,
  };

  it("saf hızların ikisi de ihmal edilebilirse toplam≈0 ve rejim PASİF döner", () => {
    const result = computeSynergy({ ...baseInput, pureCorrosionRateMmYr: 0, pureErosionRateMmYr: 0 });
    expect(result.regime).toBe("PASİF");
    expect(result.totalRateMmPerYear.p50).toBeCloseTo(0, 5);
  });

  it("T = C + E + S cebirsel özdeşliği HER ZAMAN sağlanır", () => {
    const result = computeSynergy(baseInput);
    expect(result.totalRateMmPerYear.p50).toBeCloseTo(
      result.pureCorrosionRateMmYr + result.pureErosionRateMmYr + result.synergyRateMmYr.p50,
      6,
    );
  });

  it("sinerji katkısı toplamın her zaman %0-70'i arasındadır (registry aralığı)", () => {
    const result = computeSynergy(baseInput);
    expect(result.synergyFractionOfTotal).toBeGreaterThanOrEqual(0);
    expect(result.synergyFractionOfTotal).toBeLessThanOrEqual(0.7);
  });

  it("daha yüksek parçacık çarpma hızı sinerji katkısını ve toplam hızı artırır", () => {
    const low = computeSynergy({ ...baseInput, particleImpactVelocityMs: 2 });
    const high = computeSynergy({ ...baseInput, particleImpactVelocityMs: 20 });
    expect(high.synergyFractionOfTotal).toBeGreaterThan(low.synergyFractionOfTotal);
    expect(high.totalRateMmPerYear.p50).toBeGreaterThan(low.totalRateMmPerYear.p50);
  });

  it("her sonuç MEDIUM veya LOW confidence taşır (asla HIGH — literatür oturmamış)", () => {
    const result = computeSynergy(baseInput);
    expect(["MEDIUM", "LOW", "UNVERIFIED"]).toContain(result.confidence);
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    expect(computeSynergy(baseInput).disclaimer).toContain("mühendislik tahminidir");
  });

  it("geçersiz girdi için hata fırlatır", () => {
    expect(() => computeSynergy({ ...baseInput, pureCorrosionRateMmYr: -1 })).toThrowError();
  });
});

describe("synergy — KDP kayıt defteri entegrasyonu", () => {
  it("ASTM G119 çerçevesi HIGH confidence taşır (tanımsal yapı)", () => {
    const entry = listCoefficients().find((c) => c.id === "synergy.astmG119Framework");
    expect(entry?.confidence).toBe("HIGH");
  });

  it("sinerji katkı oranı aralığı LOW confidence taşır (görev tanımından, bağımsız doğrulanmadı)", () => {
    const entry = listCoefficients().find((c) => c.id === "synergy.contributionFractionRange");
    expect(entry?.confidence).toBe("LOW");
  });

  it("film yapışma direnci MEDIUM confidence taşır (2 bağımsız başlık, tam metne erişilemedi)", () => {
    const entry = listCoefficients().find((c) => c.id === "synergy.filmAdhesionStressPa");
    expect(entry?.confidence).toBe("MEDIUM");
  });
});
