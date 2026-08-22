// apps/web/tests/input/templates.test.ts
//
// Her hazır şablonun ÜRETTİĞİ geometry/mitigation/operatingProfile'ın
// motorun KENDİ Zod şemalarından (GeometrySchema/MitigationSchema/
// OperatingProfileSchema) geçtiğini doğrular — bir şablon şema-geçersiz bir
// başlangıç durumu üretirse kullanıcı Adım 1'de daha ilk adımda kırık bir
// formla karşılaşır.

import { describe, expect, it } from "vitest";
import { GeometrySchema, MitigationSchema, OperatingProfileSchema } from "@erocorr3d/engine";
import { WIZARD_TEMPLATES } from "../../src/features/input/templates";

describe("WIZARD_TEMPLATES", () => {
  it.each(WIZARD_TEMPLATES)("$nameTr — motor şemalarını geçer", (template) => {
    const values = template.apply();
    expect(() => GeometrySchema.parse(values.geometry)).not.toThrow();
    expect(() => MitigationSchema.parse(values.mitigation)).not.toThrow();
    expect(() => OperatingProfileSchema.parse(values.operatingProfile)).not.toThrow();
  });

  it.each(WIZARD_TEMPLATES)("$nameTr — senaryoların toplam günü 365'i geçmez", (template) => {
    const values = template.apply();
    const totalDays = values.operatingProfile.cases.reduce((sum, c) => sum + c.durationDaysPerYear, 0);
    expect(totalDays).toBeLessThanOrEqual(365);
  });

  it("şablon kimlikleri benzersizdir", () => {
    const ids = WIZARD_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
