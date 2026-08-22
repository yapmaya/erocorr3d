// apps/web/tests/shaders/colorbarScale.test.ts

import { describe, expect, it } from "vitest";
import { COLORBAR_SCALE_MODES, mapValueToBarPosition } from "../../src/shaders/colorbarScale";

describe("mapValueToBarPosition", () => {
  it.each(COLORBAR_SCALE_MODES)("min değeri her modda 0 konumuna, max değeri 1 konumuna eşlenir (%s)", (mode) => {
    expect(mapValueToBarPosition(0, 0, 10, mode)).toBeCloseTo(0, 6);
    expect(mapValueToBarPosition(10, 0, 10, mode)).toBeCloseTo(1, 6);
  });

  it("LINEAR ve PERCENT aynı pozisyonu üretir (sadece etiket biçimi farklı)", () => {
    for (const value of [0, 2.5, 5, 7.5, 10]) {
      expect(mapValueToBarPosition(value, 0, 10, "LINEAR")).toBeCloseTo(mapValueToBarPosition(value, 0, 10, "PERCENT"), 9);
    }
  });

  it("LOG modu monoton artan bir eğri üretir (LINEAR'dan farklı olabilir)", () => {
    const positions = [1, 3, 5, 7, 9].map((v) => mapValueToBarPosition(v, 0, 10, "LOG"));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it.each(COLORBAR_SCALE_MODES)("aralık dışı değerler [0,1]'e kırpılır (%s)", (mode) => {
    expect(mapValueToBarPosition(-100, 0, 10, mode)).toBe(0);
    expect(mapValueToBarPosition(100, 0, 10, mode)).toBe(1);
  });

  it("min===max (sıfır aralık) durumunda çökmez, 0 döner", () => {
    for (const mode of COLORBAR_SCALE_MODES) {
      expect(mapValueToBarPosition(5, 5, 5, mode)).toBe(0);
    }
  });

  it("LOG modu minValue<=0 olsa da (kaydırmalı log) çökmez", () => {
    expect(() => mapValueToBarPosition(0, -5, 10, "LOG")).not.toThrow();
    expect(mapValueToBarPosition(-5, -5, 10, "LOG")).toBeCloseTo(0, 6);
    expect(mapValueToBarPosition(10, -5, 10, "LOG")).toBeCloseTo(1, 6);
  });
});
