// packages/engine/tests/corrosion/modelRouter.test.ts

import { describe, expect, it } from "vitest";
import { selectCo2Model, type Co2ModelRouterInput } from "../../src/corrosion/modelRouter";

function baseInput(overrides: Partial<Co2ModelRouterInput> = {}): Co2ModelRouterInput {
  return {
    temperatureC: 60,
    waterDewpointC: 55, // ΔT=5°C, kuru gaz DEĞİL
    ambientTemperatureC: 20,
    isFreeWaterPresent: false,
    waterCutPercent: 0,
    flowRegime: "SLUG",
    ...overrides,
  };
}

describe("selectCo2Model — karar tablosu", () => {
  it("kuru gaz (ΔT≥10°C) → NONE_DRY_GAS, TLC hesaplanmaz", () => {
    const decision = selectCo2Model(baseInput({ temperatureC: 70, waterDewpointC: 55 }));
    expect(decision.primaryModel).toBe("NONE_DRY_GAS");
    expect(decision.isDryGasFlow).toBe(true);
    expect(decision.shouldAlsoComputeTlc).toBe(false);
  });

  it("serbest su VAR → NORSOK_M506", () => {
    const decision = selectCo2Model(baseInput({ isFreeWaterPresent: true, waterCutPercent: 10 }));
    expect(decision.primaryModel).toBe("NORSOK_M506");
    expect(decision.hasFreeWaterFlow).toBe(true);
  });

  it("serbest su YOK ve kuru gaz DEĞİL (yoğuşma riski) → DE_WAARD_FCOND", () => {
    const decision = selectCo2Model(baseInput({ isFreeWaterPresent: false, waterCutPercent: 0 }));
    expect(decision.primaryModel).toBe("DE_WAARD_FCOND");
    expect(decision.hasFreeWaterFlow).toBe(false);
  });

  it("stratifiye + sıcak (T>50°C) + ısı kaybı iken TLC de EK OLARAK hesaplanır (NORSOK dalı)", () => {
    const decision = selectCo2Model(
      baseInput({
        isFreeWaterPresent: true,
        waterCutPercent: 10,
        flowRegime: "STRATIFIED_WAVY",
        temperatureC: 60,
        ambientTemperatureC: 5,
      }),
    );
    expect(decision.primaryModel).toBe("NORSOK_M506");
    expect(decision.shouldAlsoComputeTlc).toBe(true);
    expect(decision.isStratifiedAndHot).toBe(true);
  });

  it("stratifiye + sıcak + ısı kaybı iken TLC de EK OLARAK hesaplanır (de Waard dalı)", () => {
    const decision = selectCo2Model(
      baseInput({
        isFreeWaterPresent: false,
        flowRegime: "STRATIFIED_SMOOTH",
        temperatureC: 60,
        ambientTemperatureC: 5,
      }),
    );
    expect(decision.primaryModel).toBe("DE_WAARD_FCOND");
    expect(decision.shouldAlsoComputeTlc).toBe(true);
  });

  it("stratifiye AMA sıcaklık ≤50°C ise TLC hesaplanmaz", () => {
    const decision = selectCo2Model(
      baseInput({ flowRegime: "STRATIFIED_WAVY", temperatureC: 45, waterDewpointC: 40, ambientTemperatureC: 5 }),
    );
    expect(decision.shouldAlsoComputeTlc).toBe(false);
  });

  it("stratifiye AMA ortam akışkandan daha sıcaksa (ısı kaybı yok) TLC hesaplanmaz", () => {
    const decision = selectCo2Model(
      baseInput({ flowRegime: "STRATIFIED_WAVY", temperatureC: 60, ambientTemperatureC: 80 }),
    );
    expect(decision.shouldAlsoComputeTlc).toBe(false);
  });

  it("stratifiye OLMAYAN bir rejimde (ör. SLUG) sıcak+ısı kaybı olsa bile TLC hesaplanmaz", () => {
    const decision = selectCo2Model(
      baseInput({ flowRegime: "SLUG", isFreeWaterPresent: true, temperatureC: 60, ambientTemperatureC: 5 }),
    );
    expect(decision.shouldAlsoComputeTlc).toBe(false);
  });

  it("her kararda boş olmayan Türkçe bir gerekçe metni döndürür", () => {
    const scenarios: Co2ModelRouterInput[] = [
      baseInput({ temperatureC: 70, waterDewpointC: 55 }),
      baseInput({ isFreeWaterPresent: true, waterCutPercent: 10 }),
      baseInput({ isFreeWaterPresent: false }),
    ];
    for (const scenario of scenarios) {
      const decision = selectCo2Model(scenario);
      expect(decision.rationaleTr.length).toBeGreaterThan(20);
    }
  });
});
