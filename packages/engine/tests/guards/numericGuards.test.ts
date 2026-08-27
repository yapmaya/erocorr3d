// packages/engine/tests/guards/numericGuards.test.ts

import { describe, expect, it } from "vitest";
import { assertFinite } from "../../src/guards/numericGuards";

describe("assertFinite", () => {
  it("sonlu bir sayı için atmaz", () => {
    expect(() => assertFinite(30, "Tasarım ömrü")).not.toThrow();
    expect(() => assertFinite(0, "Tasarım ömrü")).not.toThrow();
    expect(() => assertFinite(-5, "Tasarım ömrü")).not.toThrow();
  });

  it("NaN için açık Türkçe hata fırlatır", () => {
    expect(() => assertFinite(Number.NaN, "Tasarım ömrü")).toThrowError(/Tasarım ömrü sonlu bir sayı olmalıdır/);
  });

  it("+Infinity ve -Infinity için açık hata fırlatır", () => {
    expect(() => assertFinite(Number.POSITIVE_INFINITY, "elapsedYears")).toThrowError(/sonlu bir sayı olmalıdır/);
    expect(() => assertFinite(Number.NEGATIVE_INFINITY, "elapsedYears")).toThrowError(/sonlu bir sayı olmalıdır/);
  });

  it("hata mesajı etiketi ve alınan değeri taşır", () => {
    expect(() => assertFinite(Number.NaN, "İşletme günü")).toThrowError('İşletme günü sonlu bir sayı olmalıdır (alınan: NaN).');
  });
});
