// apps/web/tests/viewer3d/hotspotDetail.test.ts

import { describe, expect, it } from "vitest";
import type { Hotspot } from "@erocorr3d/engine";
import { buildDemoHotspotDetail } from "../../src/features/viewer3d/hotspots/hotspotDetail";
import { DEMO_SCENARIOS } from "../../src/features/viewer3d/timeSlider/demoTimeDependentField";

const [SCENARIO] = DEMO_SCENARIOS;

const SAMPLE_HOTSPOT: Hotspot = {
  u: 0.2,
  v: 0.3,
  valueMm: 4,
  clockPosition: 5,
  descriptionTr: "Eksenel konum u=0.20, saat 5",
};

describe("buildDemoHotspotDetail", () => {
  it("hotspot ve senaryo bilgisini birebir taşır", () => {
    const detail = buildDemoHotspotDetail(SAMPLE_HOTSPOT, SCENARIO, 10);
    expect(detail.hotspot).toBe(SAMPLE_HOTSPOT);
    expect(detail.scenarioLabelTr).toBe(SCENARIO.labelTr);
    expect(detail.rateMmPerYear).toBe(SCENARIO.peakRateMmPerYear);
  });

  it("kalan et = wtMm - valueMm", () => {
    const detail = buildDemoHotspotDetail(SAMPLE_HOTSPOT, SCENARIO, 10);
    expect(detail.remainingWallMm).toBeCloseTo(6, 10);
  });

  it("hasar et kalınlığını AŞARSA kalan et 0'da taban yapar (negatif olmaz)", () => {
    const detail = buildDemoHotspotDetail({ ...SAMPLE_HOTSPOT, valueMm: 15 }, SCENARIO, 10);
    expect(detail.remainingWallMm).toBe(0);
  });

  it("modelUsed/sourceRefs/validityWarnings dürüstçe 'sentetik/demo' ifadesi içerir (fabrikasyon değil)", () => {
    const detail = buildDemoHotspotDetail(SAMPLE_HOTSPOT, SCENARIO, 10);
    expect(detail.modelUsed).toMatch(/SENTETİK/);
    expect(detail.sourceRefs.some((s) => /sentetik|demo/i.test(s))).toBe(true);
    expect(detail.validityWarnings.some((w) => /mühendislik tahmini DEĞİLDİR/.test(w))).toBe(true);
  });

  it("en az bir kaynak atfı ve bir geçerlilik uyarısı içerir (boş dizi değil)", () => {
    const detail = buildDemoHotspotDetail(SAMPLE_HOTSPOT, SCENARIO, 10);
    expect(detail.sourceRefs.length).toBeGreaterThan(0);
    expect(detail.validityWarnings.length).toBeGreaterThan(0);
  });

  it("wtMm<=0 için hata fırlatır", () => {
    expect(() => buildDemoHotspotDetail(SAMPLE_HOTSPOT, SCENARIO, 0)).toThrow();
  });
});
