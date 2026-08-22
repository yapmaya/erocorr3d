// packages/engine/tests/registry/export.test.ts

import { beforeEach, describe, expect, it } from "vitest";
import type { Coefficient } from "../../src/registry/types";
import { exportRegistry, registerCoefficient, resetRegistryForTests } from "../../src/registry/store";

function makeCoefficient(overrides: Partial<Coefficient> = {}): Coefficient {
  return {
    id: "test.sample",
    module: "test",
    value: 42,
    unit: "-",
    description: "Basit açıklama",
    source: {
      type: "STANDARD",
      citation: "Test kaynağı",
      url: "https://example.com/kaynak",
      accessedDate: "2026-08-11",
    },
    crossChecked: true,
    crossCheckSources: [],
    confidence: "HIGH",
    notes: "",
    ...overrides,
  };
}

describe("registry/store — exportRegistry", () => {
  beforeEach(() => {
    resetRegistryForTests();
  });

  it("JSON formatı, kayıtlı tüm katsayıları geçerli JSON olarak döndürür", () => {
    registerCoefficient(makeCoefficient({ id: "a" }));
    registerCoefficient(makeCoefficient({ id: "b" }));

    const json = exportRegistry("json");
    const parsed: Coefficient[] = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("CSV formatı başlık satırı ve bir veri satırı içerir", () => {
    registerCoefficient(makeCoefficient());
    const csv = exportRegistry("csv");
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "id,module,value,unit,description,confidence,crossChecked,sourceType,sourceCitation,sourceUrl,notes",
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("test.sample");
    expect(lines[1]).toContain("https://example.com/kaynak");
  });

  it("CSV, virgül/tırnak içeren alanları doğru şekilde kaçış (escape) eder", () => {
    registerCoefficient(
      makeCoefficient({
        id: "test.escape",
        description: 'Açıklama, virgüllü ve "tırnaklı" metin',
      }),
    );
    const csv = exportRegistry("csv");
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"Açıklama, virgüllü ve ""tırnaklı"" metin"');
  });

  it("boş kayıt defteri için yalnızca başlık satırını döndürür", () => {
    const csv = exportRegistry("csv");
    expect(csv.split("\n")).toHaveLength(1);
  });
});
