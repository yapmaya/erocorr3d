// packages/engine/tests/data/pipeSchedules.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  PIPE_SCHEDULE_NAMES,
  PipeDimensionsSchema,
  getPipe,
  listPipesForSchedule,
  listSchedulesForNps,
} from "../../src/data/pipeSchedules";

describe("pipeSchedules — veri bütünlüğü", () => {
  it("her cetveldeki her satır PipeDimensionsSchema'yı geçer", () => {
    for (const schedule of PIPE_SCHEDULE_NAMES) {
      for (const pipe of listPipesForSchedule(schedule)) {
        const result = PipeDimensionsSchema.safeParse(pipe);
        expect(result.success, `${schedule} / NPS ${pipe.npsLabel} şema doğrulamasından geçemedi`).toBe(
          true,
        );
      }
    }
  });

  it("her satırda iç çap = dış çap - 2×et kalınlığı (0.05mm tolerans)", () => {
    for (const schedule of PIPE_SCHEDULE_NAMES) {
      for (const pipe of listPipesForSchedule(schedule)) {
        const expectedId = pipe.odMm - 2 * pipe.wallThicknessMm;
        expect(Math.abs(expectedId - pipe.idMm)).toBeLessThan(0.05);
      }
    }
  });

  it("toplamda 300'den fazla (NPS × cetvel) kombinasyonu içerir", () => {
    const total = PIPE_SCHEDULE_NAMES.reduce(
      (sum, schedule) => sum + listPipesForSchedule(schedule).length,
      0,
    );
    expect(total).toBeGreaterThan(300);
  });
});

describe("getPipe", () => {
  it("NPS 2, Schedule 40 için bilinen (evrensel referans) değerleri döndürür", () => {
    const pipe = getPipe(2, "40");
    expect(pipe.odMm).toBeCloseTo(60.32, 1);
    expect(pipe.wallThicknessMm).toBeCloseTo(3.91, 2);
    expect(pipe.idMm).toBeCloseTo(52.5, 1);
  });

  it("NPS 24, Schedule 100 için bağımsız doğrulanan değeri döndürür", () => {
    const pipe = getPipe(24, "100");
    expect(pipe.wallThicknessMm).toBeCloseTo(38.89, 2);
  });

  it("NPS 12, Schedule XXS için bilinen değeri döndürür", () => {
    const pipe = getPipe(12, "XXS");
    expect(pipe.odMm).toBeCloseTo(323.85, 1);
    expect(pipe.wallThicknessMm).toBeCloseTo(25.4, 1);
  });

  it("standartta tanımlı olmayan bir NPS×cetvel kombinasyonu için açık Türkçe hata fırlatır (uydurma yok)", () => {
    // NPS 2" için Schedule 20 ASME B36.10M'de tanımlı değildir.
    expect(() => getPipe(2, "20")).toThrowError(/tanımlı değil/);
  });

  it("tamamen geçersiz bir NPS için de hata fırlatır", () => {
    expect(() => getPipe(999, "40")).toThrowError(/tanımlı değil/);
  });
});

describe("listSchedulesForNps / listPipesForSchedule", () => {
  it("NPS 2 için tanımlı cetvelleri doğru listeler", () => {
    const schedules = listSchedulesForNps(2);
    expect(schedules).toContain("40");
    expect(schedules).toContain("80");
    expect(schedules).toContain("XXS");
    expect(schedules).not.toContain("20"); // NPS 2" için tanımlı değil
  });

  it("bilinmeyen bir NPS için boş liste döner", () => {
    expect(listSchedulesForNps(999)).toEqual([]);
  });

  it("Schedule XXS yalnızca NPS 12'ye kadar tanımlıdır (14+ içermez)", () => {
    const xxsPipes = listPipesForSchedule("XXS");
    expect(xxsPipes.every((p) => p.nps <= 12)).toBe(true);
  });
});

describe("pipeSchedules — KDP kayıt defteri entegrasyonu", () => {
  it("her cetvel registry'de ayrı bir kayıt olarak bulunur", () => {
    const registered = listCoefficients().filter((c) => c.module === "pipeSchedules");
    expect(registered).toHaveLength(PIPE_SCHEDULE_NAMES.length);
    for (const schedule of PIPE_SCHEDULE_NAMES) {
      const entry = registered.find((c) => c.id === `data.pipeSchedules.schedule${schedule}`);
      expect(entry, `${schedule} registry'de bulunamadı`).toBeDefined();
      expect(entry?.confidence).toBe("HIGH");
      expect(entry?.source.type).toBe("STANDARD");
    }
  });
});
