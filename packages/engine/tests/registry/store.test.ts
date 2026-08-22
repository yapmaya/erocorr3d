// packages/engine/tests/registry/store.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Coefficient } from "../../src/registry/types";
import {
  getCoefficient,
  getUsageCount,
  getUsedUnverified,
  listByConfidence,
  listByModule,
  listCoefficients,
  registerCoefficient,
  registryStats,
  resetRegistryForTests,
} from "../../src/registry/store";

function makeCoefficient(overrides: Partial<Coefficient> = {}): Coefficient {
  return {
    id: "test.sample",
    module: "test",
    value: 42,
    unit: "-",
    description: "Test amaçlı örnek katsayı",
    source: {
      type: "STANDARD",
      citation: "Test kaynağı",
      accessedDate: "2026-08-11",
    },
    crossChecked: true,
    crossCheckSources: [],
    confidence: "HIGH",
    notes: "",
    ...overrides,
  };
}

describe("registry/store", () => {
  beforeEach(() => {
    resetRegistryForTests();
  });

  it("registerCoefficient + getCoefficient round-trip çalışır", () => {
    registerCoefficient(makeCoefficient());
    const result = getCoefficient<number>("test.sample");
    expect(result.value).toBe(42);
    expect(result.confidence).toBe("HIGH");
  });

  it("aynı id ile ikinci kayıt hata fırlatır", () => {
    registerCoefficient(makeCoefficient());
    expect(() => registerCoefficient(makeCoefficient())).toThrowError(/zaten kayıt defterinde/i);
  });

  it("bilinmeyen bir kimlik için Türkçe hata fırlatır", () => {
    expect(() => getCoefficient("olmayan.katsayi")).toThrowError(/kayıt defterinde/i);
  });

  it("UNVERIFIED bir katsayı okunduğunda konsola uyarı basar", () => {
    registerCoefficient(makeCoefficient({ id: "test.unverified", confidence: "UNVERIFIED" }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getCoefficient("test.unverified");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("KDP UYARISI");
    warnSpy.mockRestore();
  });

  it("HIGH/MEDIUM/LOW bir katsayı okunduğunda konsola uyarı BASMAZ", () => {
    registerCoefficient(makeCoefficient({ id: "test.high", confidence: "HIGH" }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getCoefficient("test.high");
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("getCoefficient her çağrıda kullanım sayacını artırır", () => {
    registerCoefficient(makeCoefficient());
    expect(getUsageCount("test.sample")).toBe(0);
    getCoefficient("test.sample");
    getCoefficient("test.sample");
    getCoefficient("test.sample");
    expect(getUsageCount("test.sample")).toBe(3);
  });

  it("getUsedUnverified yalnızca verilen listedeki UNVERIFIED katsayıları döndürür", () => {
    registerCoefficient(makeCoefficient({ id: "a", confidence: "HIGH" }));
    registerCoefficient(makeCoefficient({ id: "b", confidence: "UNVERIFIED" }));
    registerCoefficient(makeCoefficient({ id: "c", confidence: "UNVERIFIED" }));
    registerCoefficient(makeCoefficient({ id: "d", confidence: "LOW" }));

    const used = getUsedUnverified(["a", "b", "c", "d", "olmayan"]);
    expect(used.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("listByModule yalnızca istenen modüldeki katsayıları döndürür", () => {
    registerCoefficient(makeCoefficient({ id: "a", module: "norsok" }));
    registerCoefficient(makeCoefficient({ id: "b", module: "deWaard" }));
    const norsokOnly = listByModule("norsok");
    expect(norsokOnly).toHaveLength(1);
    expect(norsokOnly[0].id).toBe("a");
  });

  it("listByConfidence yalnızca istenen güven seviyesindeki katsayıları döndürür", () => {
    registerCoefficient(makeCoefficient({ id: "a", confidence: "UNVERIFIED" }));
    registerCoefficient(makeCoefficient({ id: "b", confidence: "HIGH" }));
    const unverified = listByConfidence("UNVERIFIED");
    expect(unverified).toHaveLength(1);
    expect(unverified[0].id).toBe("a");
  });

  it("listCoefficients tüm kayıtlı katsayıları döndürür", () => {
    registerCoefficient(makeCoefficient({ id: "a" }));
    registerCoefficient(makeCoefficient({ id: "b" }));
    expect(listCoefficients()).toHaveLength(2);
  });

  it("registryStats toplam sayı ve güven/modül dağılımını doğru hesaplar", () => {
    registerCoefficient(makeCoefficient({ id: "a", module: "norsok", confidence: "HIGH" }));
    registerCoefficient(makeCoefficient({ id: "b", module: "norsok", confidence: "UNVERIFIED" }));
    registerCoefficient(makeCoefficient({ id: "c", module: "deWaard", confidence: "MEDIUM" }));

    const stats = registryStats();
    expect(stats.total).toBe(3);
    expect(stats.byConfidence).toEqual({ HIGH: 1, MEDIUM: 1, LOW: 0, UNVERIFIED: 1 });
    expect(stats.byModule).toEqual({ norsok: 2, deWaard: 1 });
  });
});
