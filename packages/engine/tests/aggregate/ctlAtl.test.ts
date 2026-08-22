// packages/engine/tests/aggregate/ctlAtl.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { computeCtlAtl } from "../../src/aggregate/ctlAtl";

describe("computeCtlAtl — Tablo 10-4 sınır değerleri", () => {
  it("oran tam 0.5 → NEGLIGIBLE (dahil, ≤ kuralı)", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 0.5, selectedCorrosionAllowanceMm: 1 }).category).toBe("NEGLIGIBLE");
  });

  it("oran 0.5'in az üzerinde → LOW", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 0.51, selectedCorrosionAllowanceMm: 1 }).category).toBe("LOW");
  });

  it("oran tam 1.0 → LOW (dahil, ≤ kuralı)", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 1.0, selectedCorrosionAllowanceMm: 1 }).category).toBe("LOW");
  });

  it("oran 1.0'ın az üzerinde → MEDIUM", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 1.01, selectedCorrosionAllowanceMm: 1 }).category).toBe("MEDIUM");
  });

  it("oran tam 4.0 → MEDIUM (dahil, ≤ kuralı)", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 4.0, selectedCorrosionAllowanceMm: 1 }).category).toBe("MEDIUM");
  });

  it("oran 4.0'ın az üzerinde → HIGH", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 4.01, selectedCorrosionAllowanceMm: 1 }).category).toBe("HIGH");
  });

  it("0 oranı → NEGLIGIBLE, yeşil renk", () => {
    const result = computeCtlAtl({ predictedTotalCorrosionMm: 0, selectedCorrosionAllowanceMm: 1 });
    expect(result.category).toBe("NEGLIGIBLE");
    expect(result.colorTr).toBe("yeşil");
  });

  it("HIGH kategori kırmızı renk taşır ve uyarı üretir", () => {
    const result = computeCtlAtl({ predictedTotalCorrosionMm: 10, selectedCorrosionAllowanceMm: 1 });
    expect(result.colorTr).toBe("kırmızı");
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("NEGLIGIBLE kategori uyarı üretmez", () => {
    const result = computeCtlAtl({ predictedTotalCorrosionMm: 0.1, selectedCorrosionAllowanceMm: 1 });
    expect(result.validityWarnings.length).toBe(0);
  });

  it("geçersiz girdi için hata fırlatır", () => {
    expect(() => computeCtlAtl({ predictedTotalCorrosionMm: -1, selectedCorrosionAllowanceMm: 1 })).toThrowError();
    expect(() => computeCtlAtl({ predictedTotalCorrosionMm: 1, selectedCorrosionAllowanceMm: 0 })).toThrowError();
  });

  it("her sonuç mühendislik uyarısını döndürür", () => {
    expect(computeCtlAtl({ predictedTotalCorrosionMm: 1, selectedCorrosionAllowanceMm: 2 }).disclaimer).toContain(
      "mühendislik tahminidir",
    );
  });
});

describe("ctlAtl — KDP kayıt defteri entegrasyonu", () => {
  it("kategori sınırları kayıtlıdır ve HIGH confidence taşır (birincil BOTAŞ Tablo 10-4)", () => {
    const entry = listCoefficients().find((c) => c.id === "ctlAtl.categoryThresholds");
    expect(entry?.confidence).toBe("HIGH");
    expect(entry?.source.type).toBe("PROJECT_DOCUMENT");
  });
});
