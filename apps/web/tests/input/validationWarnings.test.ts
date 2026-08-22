// apps/web/tests/input/validationWarnings.test.ts

import { describe, expect, it } from "vitest";
import { getSoftWarning } from "../../src/features/input/validationWarnings";

describe("getSoftWarning", () => {
  it("tanımlı aralık içindeki değerler için null döner", () => {
    expect(getSoftWarning("process.pressureBara", 50)).toBeNull();
    expect(getSoftWarning("chemistry.phMeasured", 6)).toBeNull();
  });

  it("üst sınırı aşan değerler için uyarı mesajı döner", () => {
    const warning = getSoftWarning("process.pressureBara", 250);
    expect(warning).not.toBeNull();
    expect(warning).toContain("250");
  });

  it("alt sınırın altındaki değerler için uyarı mesajı döner", () => {
    const warning = getSoftWarning("chemistry.phMeasured", 1);
    expect(warning).not.toBeNull();
  });

  it("kuralı olmayan alan adı için her zaman null döner", () => {
    expect(getSoftWarning("bilinmeyen.alan", 999999)).toBeNull();
  });

  it("NaN/sonsuz için null döner (kural tetiklenmez)", () => {
    expect(getSoftWarning("process.pressureBara", NaN)).toBeNull();
  });
});
