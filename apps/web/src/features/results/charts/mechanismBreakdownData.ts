// apps/web/src/features/results/charts/mechanismBreakdownData.ts
//
// Yığılmış çubuk (B) verisi — her senaryonun (CaseAssessment) UYGULANAN
// mekanizmalarının toplam hıza katkısı. Bu toplama GERÇEKTEN geçerlidir:
// motorun kendisi (spatial/fields.ts::computeDamageField) TÜM applicable
// `MechanismResult.rateP50`leri TOPLAYARAK toplam hasar hızını üretir (bkz.
// orchestrate/mechanismRunners.ts'in synergy yorumundaki "Toplam T=C+E+S"
// notu) — burada YENİ bir toplama kuralı İCAT EDİLMEZ, motorun zaten
// yaptığı toplamanın aynısı, mekanizma bazında GÖRÜNÜR kılınır.

import type { ScenarioAssessment } from "@erocorr3d/engine";

export interface MechanismBreakdownRow {
  caseName: string;
  values: Record<string, number>;
}

export interface MechanismBreakdownData {
  rows: MechanismBreakdownRow[];
  /** Tüm senaryolarda görülen mekanizma adları — İLK görüldükleri sırayla (renk/seri tutarlılığı için). */
  mechanismKeys: string[];
}

export function buildMechanismBreakdownData(assessment: ScenarioAssessment): MechanismBreakdownData {
  const mechanismKeys: string[] = [];
  const rows: MechanismBreakdownRow[] = assessment.perCase.map((caseAssessment) => {
    const values: Record<string, number> = {};
    for (const mechanism of caseAssessment.mechanismResults) {
      if (!mechanism.isApplicable) continue;
      values[mechanism.nameTr] = mechanism.rateP50;
      if (!mechanismKeys.includes(mechanism.nameTr)) mechanismKeys.push(mechanism.nameTr);
    }
    return { caseName: caseAssessment.caseName, values };
  });
  return { rows, mechanismKeys };
}

/** Recharts'ın `&lt;BarChart data={...}&gt;`'ının beklediği düz kayıt dizisine çevirir (her mekanizma anahtarı bir sütun). */
export function toRechartsRows(data: MechanismBreakdownData): Record<string, string | number>[] {
  return data.rows.map((row) => ({ caseName: row.caseName, ...row.values }));
}
