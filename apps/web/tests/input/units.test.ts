// apps/web/tests/input/units.test.ts

import { describe, expect, it } from "vitest";
import { fromDisplayValue, toDisplayValue, unitLabel } from "../../src/features/input/units";

describe("units", () => {
  it("SI sisteminde değer değişmeden döner", () => {
    expect(toDisplayValue("PRESSURE", 50, "SI")).toBe(50);
    expect(fromDisplayValue("PRESSURE", 50, "SI")).toBe(50);
  });

  it("basınç bara->psia dönüşümü ve geri dönüşümü tutarlıdır", () => {
    const bara = 70;
    const psia = toDisplayValue("PRESSURE", bara, "IMPERIAL");
    expect(psia).toBeCloseTo(1015.26, 1);
    expect(fromDisplayValue("PRESSURE", psia, "IMPERIAL")).toBeCloseTo(bara, 6);
  });

  it("sıcaklık °C->°F dönüşümü doğrudur (0°C=32°F, 100°C=212°F)", () => {
    expect(toDisplayValue("TEMPERATURE", 0, "IMPERIAL")).toBeCloseTo(32, 6);
    expect(toDisplayValue("TEMPERATURE", 100, "IMPERIAL")).toBeCloseTo(212, 6);
    expect(fromDisplayValue("TEMPERATURE", 212, "IMPERIAL")).toBeCloseTo(100, 6);
  });

  it("uzunluk mm->inç dönüşümü doğrudur (25.4mm=1inç)", () => {
    expect(toDisplayValue("LENGTH_MM", 25.4, "IMPERIAL")).toBeCloseTo(1, 6);
  });

  it("unitLabel doğru etiketleri döner", () => {
    expect(unitLabel("PRESSURE", "SI")).toBe("bara");
    expect(unitLabel("PRESSURE", "IMPERIAL")).toBe("psia");
  });

  it("round-trip: herhangi bir SI değeri Imperial'a çevrilip geri çevrildiğinde korunur", () => {
    const quantities = ["PRESSURE", "TEMPERATURE", "LENGTH_MM", "VELOCITY", "DENSITY", "MASS_FLOW", "VISCOSITY"] as const;
    for (const q of quantities) {
      const original = 12.3456;
      const roundTripped = fromDisplayValue(q, toDisplayValue(q, original, "IMPERIAL"), "IMPERIAL");
      expect(roundTripped).toBeCloseTo(original, 6);
    }
  });
});
