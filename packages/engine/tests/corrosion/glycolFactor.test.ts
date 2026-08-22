// packages/engine/tests/corrosion/glycolFactor.test.ts

import { describe, expect, it } from "vitest";
import { computeGlycolReductionFactor } from "../../src/corrosion/glycolFactor";

describe("computeGlycolReductionFactor", () => {
  it("glikol yoksa (%0) faktör 1'dir (azaltma yok)", () => {
    expect(computeGlycolReductionFactor(0)).toBeCloseTo(1, 6);
  });

  it("standardın kendi formülünü doğru uygular: %50 glikolde 10^(1.6*(log10(50)-2))", () => {
    const expected = 10 ** (1.6 * (Math.log10(50) - 2));
    expect(computeGlycolReductionFactor(50)).toBeCloseTo(expected, 10);
  });

  it("%95 ve üzerinde sabit 0.008 döndürür", () => {
    expect(computeGlycolReductionFactor(95)).toBe(0.008);
    expect(computeGlycolReductionFactor(99)).toBe(0.008);
    expect(computeGlycolReductionFactor(100)).toBe(0.008);
  });

  it("%95 sınırının hemen altında, 0.008'e yakın (süreklilik) bir değer verir", () => {
    const justBelow = computeGlycolReductionFactor(94.99);
    expect(justBelow).toBeGreaterThan(0.007);
    expect(justBelow).toBeLessThan(0.009);
  });

  it("glikol yüzdesi arttıkça azaltma faktörü monotonik olarak azalır", () => {
    const f10 = computeGlycolReductionFactor(10);
    const f50 = computeGlycolReductionFactor(50);
    const f90 = computeGlycolReductionFactor(90);
    expect(f10).toBeGreaterThan(f50);
    expect(f50).toBeGreaterThan(f90);
  });

  it("aralık dışı (negatif veya >100) girdi için hata fırlatır", () => {
    expect(() => computeGlycolReductionFactor(-1)).toThrowError();
    expect(() => computeGlycolReductionFactor(101)).toThrowError();
  });
});
