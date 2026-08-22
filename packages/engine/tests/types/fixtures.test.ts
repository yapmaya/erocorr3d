// packages/engine/tests/types/fixtures.test.ts

import { describe, expect, it } from "vitest";
import { GeometrySchema } from "../../src/types/geometry";
import { MitigationSchema } from "../../src/types/mitigation";
import { OperatingProfileSchema } from "../../src/types/operating";
import { MechanismResultSchema } from "../../src/types/results";
import {
  REFERENCE_FACILITY_FIXTURES,
  referenceLine1,
  referenceLine2,
  referenceLine1DocumentedResult,
  referenceLine2DocumentedResult,
} from "../../src/fixtures/referenceFacility";

describe("Referans tesis fixture'ları — şema geçerliliği", () => {
  it("REFERENCE_FACILITY_FIXTURES iki akışı da içerir", () => {
    expect(REFERENCE_FACILITY_FIXTURES).toHaveLength(2);
    expect(REFERENCE_FACILITY_FIXTURES.map((f) => f.streamId)).toEqual(["Reference Line 1", "Reference Line 2"]);
  });

  for (const fixture of [referenceLine1, referenceLine2]) {
    describe(fixture.streamId, () => {
      it("geometrisi GeometrySchema'ya uyar", () => {
        expect(GeometrySchema.safeParse(fixture.geometry).success).toBe(true);
      });

      it("mitigation verisi MitigationSchema'ya uyar", () => {
        expect(MitigationSchema.safeParse(fixture.mitigation).success).toBe(true);
      });

      it("işletme profili OperatingProfileSchema'ya uyar", () => {
        expect(OperatingProfileSchema.safeParse(fixture.operatingProfile).success).toBe(true);
      });

      it("işletme senaryolarının gün toplamı 365'tir (kaynak: 91+274)", () => {
        const totalDays = fixture.operatingProfile.cases.reduce(
          (sum, c) => sum + c.durationDaysPerYear,
          0,
        );
        expect(totalDays).toBe(365);
      });

      it("dokümante edilmiş referans sonucu MechanismResultSchema'ya uyar", () => {
        expect(MechanismResultSchema.safeParse(fixture.documentedResult).success).toBe(true);
      });
    });
  }
});

describe("Referans tesis fixture'ları — kaynaktan gelen somut değerler", () => {
  it("Hat 1: tasarım ömrü ve korozyon payı kaynakla eşleşir", () => {
    expect(referenceLine1.operatingProfile.designLifeYears).toBe(30);
    expect(referenceLine1.operatingProfile.corrosionAllowanceMm).toBe(3);
  });

  it("Hat 2: korozyon payı kaynakla eşleşir (sözleşme gereği 6 mm)", () => {
    expect(referenceLine2.operatingProfile.corrosionAllowanceMm).toBe(6);
  });

  it("Hat 1: inhibitörlü hız (Cri=0.148) uninhibited (Cru=0.43) değerinden düşüktür", () => {
    expect(referenceLine1DocumentedResult.governingParameters.Cri_mmPerYear).toBeLessThan(
      referenceLine1DocumentedResult.governingParameters.Cru_mmPerYear,
    );
    expect(referenceLine1DocumentedResult.rateMmPerYear).toBeCloseTo(0.148, 6);
  });

  it("Hat 2: inhibitör gaz fazına taşınmadığı için Cru=Cri", () => {
    expect(referenceLine2DocumentedResult.governingParameters.Cru_mmPerYear).toBe(
      referenceLine2DocumentedResult.governingParameters.Cri_mmPerYear,
    );
    expect(referenceLine2.mitigation.inhibitorUsed).toBe(false);
  });

  it("Hat 1 'Ekşi Gaz' (sour) olarak H2S içerir, Hat 2 içermez", () => {
    const line1Case = referenceLine1.operatingProfile.cases[0];
    const line2Case = referenceLine2.operatingProfile.cases[0];
    expect(line1Case.chemistry.h2sPpmMole).toBeGreaterThan(0);
    expect(line2Case.chemistry.h2sPpmMole).toBe(0);
  });

  it("her iki akış da dokümante edilmiş sonuçlarında düşük güven (LOW) taşır (harici/doğrulanmamış kaynak)", () => {
    expect(referenceLine1DocumentedResult.confidence).toBe("LOW");
    expect(referenceLine2DocumentedResult.confidence).toBe("LOW");
  });
});
