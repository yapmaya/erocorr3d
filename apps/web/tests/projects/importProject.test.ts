// apps/web/tests/projects/importProject.test.ts

import { describe, expect, it } from "vitest";
import { buildEc3dFile, EC3D_FORMAT_VERSION } from "../../src/features/projects/exportProject";
import { MAX_EC3D_ASSESSMENT_RUNS, MAX_EC3D_COMPONENTS, parseEc3dFile } from "../../src/features/projects/importProject";
import { ec3dJsonReplacer } from "../../src/features/projects/ec3dSerialization";
import { buildTestAssessmentHistoryEntry } from "../report/testFixtures";
import type { AssessmentRunRecord, ProjectComponentRecord, ProjectRecord } from "../../src/features/projects/types";

function buildFixturePackage() {
  const entry = buildTestAssessmentHistoryEntry();
  const project: ProjectRecord = {
    id: "proj-1",
    name: "Test Projesi",
    client: "Test Müşteri",
    facility: "Test Tesis",
    createdBy: "Test Kullanıcı",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    revision: "0",
  };
  const component: ProjectComponentRecord = {
    id: "comp-1",
    projectId: project.id,
    componentLabel: entry.componentLabel,
    componentCategory: "PIPE_FITTING",
    geometry: entry.geometry,
    valveGeometry: undefined,
    mitigation: entry.mitigation,
    operatingProfile: entry.operatingProfile,
    activeStep: 1,
    activeCaseIndex: 0,
    uncertainNotes: [],
    updatedAt: Date.now(),
  };
  const run: AssessmentRunRecord = {
    id: "run-1",
    projectId: project.id,
    componentId: component.id,
    componentLabel: entry.componentLabel,
    computedAt: Date.now(),
    engineVersion: "0.1.0",
    geometry: entry.geometry,
    mitigation: entry.mitigation,
    operatingProfile: entry.operatingProfile,
    assessment: entry.assessment,
    uninhibitedAssessment: entry.uninhibitedAssessment,
  };
  return { project, component, run };
}

describe("parseEc3dFile", () => {
  it("geçerli bir dosyayı ayrıştırır ve YENİ id'ler atar", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.id).not.toBe(project.id);
    expect(result.data.project.name).toBe(project.name);
    expect(result.data.components).toHaveLength(1);
    expect(result.data.components[0]!.id).not.toBe(component.id);
    expect(result.data.components[0]!.projectId).toBe(result.data.project.id);
    expect(result.data.assessmentRuns).toHaveLength(1);
    expect(result.data.assessmentRuns[0]!.componentId).toBe(result.data.components[0]!.id);
  });

  it("Float32Array KAYIPSIZ round-trip eder (JSON serileştirme sorunu YOK)", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const originalField = run.assessment.perCase[0]!.spatialDamageFieldFullLife;
    const roundTrippedField = result.data.assessmentRuns[0]!.assessment.perCase[0]!.spatialDamageFieldFullLife;
    expect(roundTrippedField.valuesMm).toBeInstanceOf(Float32Array);
    expect(roundTrippedField.valuesMm.length).toBe(originalField.valuesMm.length);
    expect(Array.from(roundTrippedField.valuesMm)).toEqual(Array.from(originalField.valuesMm));
  });

  it("hesap izindeki gerçek NaN değerleri (ör. glikol adımı) KAYIPSIZ round-trip eder", () => {
    const { project, component, run } = buildFixturePackage();
    // Gerçek veride NaN üreten mekanizma/adımı BULMAYA çalışmak yerine (kırılgan),
    // JSON'ın NaN'ı taşıyamadığı GERÇEĞİNİ doğrudan test eder: mevcut bir hesap
    // izi adımının çıktısını NaN'a ÇEVİRİP round-trip'in onu KORUDUĞUNU doğrular.
    const stepWithNan = run.assessment.perCase[0]!.mechanismResults[0]!.calculationTrace[0];
    if (stepWithNan) {
      stepWithNan.output = Number.NaN;
      stepWithNan.inputs["testNan"] = Number.NaN;
    }
    const file = buildEc3dFile(project, [component], [run]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (stepWithNan) {
      const roundTrippedStep = result.data.assessmentRuns[0]!.assessment.perCase[0]!.mechanismResults[0]!.calculationTrace[0]!;
      expect(Number.isNaN(roundTrippedStep.output)).toBe(true);
      expect(Number.isNaN(roundTrippedStep.inputs["testNan"])).toBe(true);
    }
  });

  it("bozuk JSON için Türkçe hata döner", () => {
    const result = parseEc3dFile("{ bu geçerli json değil");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain("JSON");
  });

  it("beklenen biçime uymayan (ama geçerli) JSON için Türkçe hata döner", () => {
    const result = parseEc3dFile(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain(".ec3d");
  });
});

describe("parseEc3dFile — dosya biçimi sürümü ve tutarsız referanslar", () => {
  it("BİLİNMEYEN bir formatVersion'ı sessizce kabul ETMEZ", () => {
    const { project, component, run } = buildFixturePackage();
    const file = { ...buildEc3dFile(project, [component], [run]), formatVersion: 999 };
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain("v999");
  });

  it("daha ESKİ bir formatVersion'ı da reddeder", () => {
    const { project, component, run } = buildFixturePackage();
    const file = { ...buildEc3dFile(project, [component], [run]), formatVersion: 0 };
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(false);
  });

  it("hiçbir bileşene bağlı OLMAYAN çalıştırma kaydını içe aktarmaz ama SESSİZ de kalmaz", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(project, [component], [{ ...run, componentId: "DOSYADA-OLMAYAN-ID" }]);
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assessmentRuns).toHaveLength(0);
    expect(result.data.warningsTr.join(" ")).toContain("içe aktarılmadı");
  });

  it("geçerli bir çalıştırma kaydı, bileşenin YENİ id'sine yeniden bağlanır", () => {
    const { project, component, run } = buildFixturePackage();
    const result = parseEc3dFile(JSON.stringify(buildEc3dFile(project, [component], [run]), ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assessmentRuns).toHaveLength(1);
    expect(result.data.assessmentRuns[0]!.componentId).toBe(result.data.components[0]!.id);
    expect(result.data.warningsTr).toHaveLength(0);
  });
});

describe("parseEc3dFile — büyük dosyaların ana thread'i kilitlemesini önleyen sayı sınırları", () => {
  // Bilinçli olarak Zod'un doğrulayabileceği GERÇEK bileşen/çalıştırma nesneleri
  // ÜRETMEZ — sınır kontrolü Zod'dan ÖNCE, ham dizi uzunluğuna bakarak çalışır
  // (bkz. importProject.ts::readArrayLength), bu yüzden içerik önemsizdir ve
  // test 50.000 gerçek kayıt üretmeden (yavaşlatmadan) MAX_EC3D_COMPONENTS/
  // MAX_EC3D_ASSESSMENT_RUNS sınırının hemen ÜSTÜNÜ kullanabilir.
  it("bileşen sayısı sınırı aşıldığında, pahalı Zod doğrulamasına girmeden reddeder", () => {
    const raw = {
      formatVersion: EC3D_FORMAT_VERSION,
      exportedAt: Date.now(),
      project: {},
      components: new Array(MAX_EC3D_COMPONENTS + 1).fill({}),
      assessmentRuns: [],
    };
    const result = parseEc3dFile(JSON.stringify(raw));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain(String(MAX_EC3D_COMPONENTS));
    expect(result.errorTr).toContain("bileşen");
  });

  it("çalıştırma kaydı sayısı sınırı aşıldığında reddeder", () => {
    const raw = {
      formatVersion: EC3D_FORMAT_VERSION,
      exportedAt: Date.now(),
      project: {},
      components: [],
      assessmentRuns: new Array(MAX_EC3D_ASSESSMENT_RUNS + 1).fill({}),
    };
    const result = parseEc3dFile(JSON.stringify(raw));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorTr).toContain(String(MAX_EC3D_ASSESSMENT_RUNS));
    expect(result.errorTr).toContain("çalıştırma");
  });

  it("sınırın altındaki makul boyutlu bir dosya, sayı sınırı yüzünden reddedilmez", () => {
    const { project, component, run } = buildFixturePackage();
    const file = buildEc3dFile(
      project,
      [component, { ...component, id: "comp-2" }],
      [run, { ...run, id: "run-2" }],
    );
    const result = parseEc3dFile(JSON.stringify(file, ec3dJsonReplacer));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.components).toHaveLength(2);
  });
});
