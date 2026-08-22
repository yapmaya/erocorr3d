// packages/engine/tests/types/fixtures.test.ts

import { describe, expect, it } from "vitest";
import { GeometrySchema } from "../../src/types/geometry";
import { MitigationSchema } from "../../src/types/mitigation";
import { OperatingProfileSchema } from "../../src/types/operating";
import { MechanismResultSchema } from "../../src/types/results";
import {
  BOTAS_FIXTURES,
  botasStream1030,
  botasStream1130,
  stream1030DocumentedResult,
  stream1130DocumentedResult,
} from "../../src/fixtures/botas";

describe("BOTAŞ fixture'ları — şema geçerliliği", () => {
  it("BOTAS_FIXTURES iki akışı da içerir", () => {
    expect(BOTAS_FIXTURES).toHaveLength(2);
    expect(BOTAS_FIXTURES.map((f) => f.streamId)).toEqual(["Stream 1030", "Stream 1130"]);
  });

  for (const fixture of [botasStream1030, botasStream1130]) {
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

describe("BOTAŞ fixture'ları — kaynaktan gelen somut değerler", () => {
  it("Stream 1030: tasarım ömrü ve korozyon payı kaynakla eşleşir", () => {
    expect(botasStream1030.operatingProfile.designLifeYears).toBe(30);
    expect(botasStream1030.operatingProfile.corrosionAllowanceMm).toBe(3);
  });

  it("Stream 1130: korozyon payı kaynakla eşleşir (sözleşme gereği 6 mm)", () => {
    expect(botasStream1130.operatingProfile.corrosionAllowanceMm).toBe(6);
  });

  it("Stream 1030: inhibitörlü hız (Cri=0.148) uninhibited (Cru=0.43) değerinden düşüktür", () => {
    expect(stream1030DocumentedResult.governingParameters.Cri_mmPerYear).toBeLessThan(
      stream1030DocumentedResult.governingParameters.Cru_mmPerYear,
    );
    expect(stream1030DocumentedResult.rateMmPerYear).toBeCloseTo(0.148, 6);
  });

  it("Stream 1130: inhibitör gaz fazına taşınmadığı için Cru=Cri", () => {
    expect(stream1130DocumentedResult.governingParameters.Cru_mmPerYear).toBe(
      stream1130DocumentedResult.governingParameters.Cri_mmPerYear,
    );
    expect(botasStream1130.mitigation.inhibitorUsed).toBe(false);
  });

  it("Stream 1030 'Ekşi Gaz' (sour) olarak H2S içerir, Stream 1130 içermez", () => {
    const case1030 = botasStream1030.operatingProfile.cases[0];
    const case1130 = botasStream1130.operatingProfile.cases[0];
    expect(case1030.chemistry.h2sPpmMole).toBeGreaterThan(0);
    expect(case1130.chemistry.h2sPpmMole).toBe(0);
  });

  it("her iki akış da dokümante edilmiş sonuçlarında düşük güven (LOW) taşır (harici/doğrulanmamış kaynak)", () => {
    expect(stream1030DocumentedResult.confidence).toBe("LOW");
    expect(stream1130DocumentedResult.confidence).toBe("LOW");
  });
});
