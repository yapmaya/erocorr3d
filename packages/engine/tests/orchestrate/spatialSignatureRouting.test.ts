// packages/engine/tests/orchestrate/spatialSignatureRouting.test.ts

import { describe, expect, it } from "vitest";
import { resolvePipeFittingSpatialSignature } from "../../src/orchestrate/spatialSignatureRouting";
import { baseGeometry } from "./testFixtures";

describe("resolvePipeFittingSpatialSignature", () => {
  it("TOP_OF_LINE_CONDENSATION her zaman TLC_CONDENSATION'a gider (bileşen tipinden bağımsız)", () => {
    const straight = resolvePipeFittingSpatialSignature("TOP_OF_LINE_CONDENSATION", baseGeometry());
    const elbow = resolvePipeFittingSpatialSignature(
      "TOP_OF_LINE_CONDENSATION",
      baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 1.5, bendAngleDeg: 90 }),
    );
    expect(straight.signatureId).toBe("TLC_CONDENSATION");
    expect(elbow.signatureId).toBe("TLC_CONDENSATION");
  });

  it("EXTERNAL_DISTRIBUTED CUI_EXTERNAL_BANDS'e gider", () => {
    const result = resolvePipeFittingSpatialSignature("EXTERNAL_DISTRIBUTED", baseGeometry());
    expect(result.signatureId).toBe("CUI_EXTERNAL_BANDS");
  });

  it("BULK_LIQUID_OR_TURBULENT_THINNING + düz boru + stratifiye akış → BLC_STRATIFIED, liquidHoldupFraction taşır", () => {
    const result = resolvePipeFittingSpatialSignature("BULK_LIQUID_OR_TURBULENT_THINNING", baseGeometry(), {
      flowRegime: "STRATIFIED_WAVY",
      liquidHoldupFraction: 0.4,
    });
    expect(result.signatureId).toBe("BLC_STRATIFIED");
    expect(result.governingParameters.liquidHoldupFraction).toBe(0.4);
  });

  it("BULK_LIQUID_OR_TURBULENT_THINNING + düz boru + stratifiye OLMAYAN akış → UNIFORM_FULL_BORE", () => {
    const result = resolvePipeFittingSpatialSignature("BULK_LIQUID_OR_TURBULENT_THINNING", baseGeometry(), {
      flowRegime: "BUBBLE",
    });
    expect(result.signatureId).toBe("UNIFORM_FULL_BORE");
  });

  it("BULK_LIQUID_OR_TURBULENT_THINNING + dirsek → UNIFORM_FULL_BORE (IMPINGEMENT'in dar extrados bandıyla KARIŞTIRILMAZ)", () => {
    // Regresyon testi: genel türbülanslı incelme (ör. CO2 korozyonu), akış
    // yönü DEĞİŞTİREN fitting'lerde bile ıslak yüzeyin TAMAMINA yayılmalı —
    // önceden bu arketip yanlışlıkla ELBOW_EXTRADOS_IMPINGEMENT'in dar
    // bandını PAYLAŞIYORDU (bkz. resolveBulkLiquidSignature'ın dosya başı
    // notu), bu da ısı haritasının çoğunun boş kalmasına yol açıyordu.
    const result = resolvePipeFittingSpatialSignature(
      "BULK_LIQUID_OR_TURBULENT_THINNING",
      baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 1.5, bendAngleDeg: 90 }),
    );
    expect(result.signatureId).toBe("UNIFORM_FULL_BORE");
  });

  it("BULK_LIQUID_OR_TURBULENT_THINNING + dallanma te → UNIFORM_FULL_BORE", () => {
    const result = resolvePipeFittingSpatialSignature(
      "BULK_LIQUID_OR_TURBULENT_THINNING",
      baseGeometry({ componentType: "TEE_BRANCH" }),
    );
    expect(result.signatureId).toBe("UNIFORM_FULL_BORE");
  });

  it("IMPINGEMENT + dirsek → ELBOW_EXTRADOS_IMPINGEMENT, bendRadiusRatio taşır", () => {
    const geometry = baseGeometry({ componentType: "ELBOW_90", bendRadiusRatio: 2, bendAngleDeg: 90 });
    const result = resolvePipeFittingSpatialSignature("IMPINGEMENT", geometry, { particleDiameterM: 2e-4 });
    expect(result.signatureId).toBe("ELBOW_EXTRADOS_IMPINGEMENT");
    expect(result.governingParameters.bendRadiusRatio).toBe(2);
    expect(result.governingParameters.particleDiameterM).toBe(2e-4);
  });

  it("IMPINGEMENT + kör Te → TEE_BLIND_IMPACT", () => {
    const result = resolvePipeFittingSpatialSignature("IMPINGEMENT", baseGeometry({ componentType: "TEE_BLIND" }));
    expect(result.signatureId).toBe("TEE_BLIND_IMPACT");
  });

  it("IMPINGEMENT + redüksiyon → REDUCER_THROAT_DOWNSTREAM", () => {
    const result = resolvePipeFittingSpatialSignature(
      "IMPINGEMENT",
      baseGeometry({ componentType: "REDUCER_CONCENTRIC" }),
    );
    expect(result.signatureId).toBe("REDUCER_THROAT_DOWNSTREAM");
  });

  it("vana bileşen tipi için hata fırlatır (spatial/valves.ts'in kapsamıdır)", () => {
    expect(() =>
      resolvePipeFittingSpatialSignature("IMPINGEMENT", baseGeometry({ componentType: "GATE_VALVE" })),
    ).toThrowError();
  });
});
