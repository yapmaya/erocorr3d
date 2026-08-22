// apps/web/src/features/projects/compareRuns.ts
//
// SAF fonksiyon: iki `AssessmentRunRecord`'u (aynı bileşenin farklı
// zamanlardaki çalıştırmaları OLABİLİR ama ZORUNLU değildir) karşılaştırır.
// Yeni bir hesap İCAT ETMEZ — yalnızca ikisinin ZATEN saklanmış girdi/
// çıktı alanlarını okuyup FARKLARI listeler ("ne değişti" raporu).

import type { AssessmentRunRecord } from "./types";

export interface FieldDelta {
  labelTr: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface MechanismDelta {
  mechanismId: string;
  nameTr: string;
  beforeP50: number | null;
  afterP50: number | null;
  deltaP50: number | null;
}

export interface RunComparison {
  runA: AssessmentRunRecord;
  runB: AssessmentRunRecord;
  engineVersionChanged: boolean;
  inputDeltas: FieldDelta[];
  resultDeltas: FieldDelta[];
  mechanismDeltas: MechanismDelta[];
  /** Yalnızca DEĞİŞEN alanlardan üretilmiş Türkçe özet cümleleri — hiçbir şey değişmediyse boş dizi. */
  summaryTr: string[];
}

function delta(labelTr: string, before: string | number, after: string | number): FieldDelta {
  const beforeStr = String(before);
  const afterStr = String(after);
  return { labelTr, before: beforeStr, after: afterStr, changed: beforeStr !== afterStr };
}

function buildMechanismDeltas(runA: AssessmentRunRecord, runB: AssessmentRunRecord): MechanismDelta[] {
  const caseA = runA.assessment.perCase.find((c) => c.caseName === runA.assessment.governingCaseName) ?? runA.assessment.perCase[0];
  const caseB = runB.assessment.perCase.find((c) => c.caseName === runB.assessment.governingCaseName) ?? runB.assessment.perCase[0];

  const mechanismIds = new Set<string>();
  for (const m of caseA?.mechanismResults ?? []) mechanismIds.add(m.mechanismId);
  for (const m of caseB?.mechanismResults ?? []) mechanismIds.add(m.mechanismId);

  return [...mechanismIds].map((mechanismId) => {
    const mA = caseA?.mechanismResults.find((m) => m.mechanismId === mechanismId);
    const mB = caseB?.mechanismResults.find((m) => m.mechanismId === mechanismId);
    const beforeP50 = mA?.isApplicable ? mA.rateP50 : null;
    const afterP50 = mB?.isApplicable ? mB.rateP50 : null;
    return {
      mechanismId,
      nameTr: mA?.nameTr ?? mB?.nameTr ?? mechanismId,
      beforeP50,
      afterP50,
      deltaP50: beforeP50 !== null && afterP50 !== null ? afterP50 - beforeP50 : null,
    };
  });
}

export function compareAssessmentRuns(runA: AssessmentRunRecord, runB: AssessmentRunRecord): RunComparison {
  const inputDeltas: FieldDelta[] = [
    delta("Bileşen Tipi", runA.geometry.componentType, runB.geometry.componentType),
    delta("Dış Çap (mm)", runA.geometry.odMm, runB.geometry.odMm),
    delta("Et Kalınlığı (mm)", runA.geometry.wallThicknessMm, runB.geometry.wallThicknessMm),
    delta("İç Çap (mm)", runA.geometry.idMm, runB.geometry.idMm),
    delta("Uzunluk (mm)", runA.geometry.lengthMm, runB.geometry.lengthMm),
    delta("İnhibitör Kullanımı", runA.mitigation.inhibitorUsed ? "Evet" : "Hayır", runB.mitigation.inhibitorUsed ? "Evet" : "Hayır"),
    delta("Tasarım Ömrü (yıl)", runA.operatingProfile.designLifeYears, runB.operatingProfile.designLifeYears),
    delta("Korozyon Payı (mm)", runA.operatingProfile.corrosionAllowanceMm, runB.operatingProfile.corrosionAllowanceMm),
    delta("Senaryo Sayısı", runA.operatingProfile.cases.length, runB.operatingProfile.cases.length),
  ];

  const resultDeltas: FieldDelta[] = [
    delta(
      "Toplam Metal Kaybı P50 (mm)",
      runA.assessment.metalLoss.totalServiceLifeCorrosionMm.p50.toFixed(3),
      runB.assessment.metalLoss.totalServiceLifeCorrosionMm.p50.toFixed(3),
    ),
    delta("Belirleyici Senaryo", runA.assessment.governingCaseName, runB.assessment.governingCaseName),
    delta("Motor Sürümü", runA.engineVersion, runB.engineVersion),
  ];

  const mechanismDeltas = buildMechanismDeltas(runA, runB);

  const summaryTr: string[] = [];
  for (const d of [...inputDeltas, ...resultDeltas]) {
    if (d.changed) summaryTr.push(`${d.labelTr}: ${d.before} → ${d.after}`);
  }
  for (const m of mechanismDeltas) {
    if (m.deltaP50 !== null && Math.abs(m.deltaP50) > 1e-9) {
      summaryTr.push(`${m.nameTr} (P50): ${m.beforeP50!.toFixed(3)} → ${m.afterP50!.toFixed(3)} mm/yıl`);
    }
  }

  return {
    runA,
    runB,
    engineVersionChanged: runA.engineVersion !== runB.engineVersion,
    inputDeltas,
    resultDeltas,
    mechanismDeltas,
    summaryTr,
  };
}
