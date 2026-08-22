// packages/engine/src/data/pipeGrades.ts
//
// Boru hattı çelik dereceleri (API 5L) — SMYS (Specified Minimum Yield
// Strength, belirtilen minimum akma dayanımı) veritabanı. `aggregate/b31g.ts`
// (ASME B31G/Modified B31G kalan dayanım hesabı) ve ASME B31.8 et kalınlığı
// tasarım formülünün S girdisi için kullanılır.
//
// KAYNAK NOTU: BOTAŞ fixture'ları (fixtures/botas.ts) boru çelik DERECESİNİ
// (grade) İÇERMEZ — kaynak belge (bkz. o dosyanın başlık notu) yalnızca
// NPS/schedule/et kalınlığını temsili olarak doldurur, malzeme sertifikası
// içermez. Bu YÜZDEN bu modül kullanıcının/mühendisin SEÇTİĞİ bir derece
// listesi sunar (gerçek B31G değerlendirmesinde de derece her zaman saha
// malzeme sertifikasından ALINIR, otomatik varsayılmaz) — hiçbir BOTAŞ
// hattına "şu derecedir" diye bir atama UYDURULMAZ.

import { registerCoefficient } from "../registry";
import type { Coefficient, Source } from "../registry/types";

const MODULE = "pipeGrades";

const SRC_API_5L: Source = {
  type: "STANDARD",
  citation:
    "American Petroleum Institute, \"Specification for Line Pipe\", API Spec 5L, 45. Baskı " +
    "(Aralık 2012, yürürlük 1 Temmuz 2013) — Tablo 6 \"Requirements for the Results of Tensile " +
    "Tests for PSL 1 Pipe\" (Pipe Body of Seamless and Welded Pipes, Yield Strength Rt0.5 sütunu).",
  url: "https://www.worldironsteel.com/Content/upload/PDF/20179562/API-5L.pdf",
  accessedDate: "2026-08-13",
};

const SRC_OCTALSTEEL_CROSSCHECK: Source = {
  type: "STANDARD",
  citation:
    "Octal Steel ve ilgili boru tedarikçisi mühendislik referans sayfaları (octalsteel.com) — " +
    "API 5L X42/X52/X60/X65 SMYS özet tabloları, bağımsız ikinci kaynak olarak kullanıldı.",
  accessedDate: "2026-08-13",
};

export interface PipeGradeSpec {
  gradeId: string;
  /** API 5L "L" (SI) tanımı — ör. "L360" */
  designationL: string;
  /** API 5L "X" (geleneksel) tanımı — ör. "X52" */
  designationX: string;
  displayNameTr: string;
  smysPa: number;
  smysMpaForDisplay: number;
  smysPsiForDisplay: number;
  notesTr: string;
}

interface PipeGradeDefinition {
  spec: PipeGradeSpec;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  notes: string;
}

function mpaToSpec(
  gradeId: string,
  designationL: string,
  designationX: string,
  displayNameTr: string,
  smysMpa: number,
  smysPsi: number,
  notesTr: string,
): PipeGradeSpec {
  return {
    gradeId,
    designationL,
    designationX,
    displayNameTr,
    smysPa: smysMpa * 1e6,
    smysMpaForDisplay: smysMpa,
    smysPsiForDisplay: smysPsi,
    notesTr,
  };
}

// API 5L Tablo 6 (PSL1, boru gövdesi) — Rt0.5 minimum akma dayanımı, MPa (psi).
const PIPE_GRADE_DEFINITIONS: PipeGradeDefinition[] = [
  {
    spec: mpaToSpec(
      "api5l-l245-b",
      "L245",
      "B",
      "API 5L Grade B (L245)",
      245,
      35500,
      "Genel amaçlı, düşük mukavemetli boru hattı çeliği — eski/düşük basınçlı dağıtım hatlarında yaygın.",
    ),
    confidence: "HIGH",
    notes: "API 5L Tablo 6'dan doğrudan okundu (birincil kaynak).",
  },
  {
    spec: mpaToSpec(
      "api5l-l290-x42",
      "L290",
      "X42",
      "API 5L Grade X42 (L290)",
      290,
      42100,
      "Orta mukavemetli, yaygın iletim hattı çeliği.",
    ),
    confidence: "HIGH",
    notes:
      "API 5L Tablo 6'dan doğrudan okundu (birincil kaynak); Octal Steel özet tablosuyla (42.100 psi) birebir eşleşti.",
  },
  {
    spec: mpaToSpec(
      "api5l-l360-x52",
      "L360",
      "X52",
      "API 5L Grade X52 (L360)",
      360,
      52200,
      "Doğal gaz iletim hatlarında çok yaygın kullanılan orta-yüksek mukavemetli derece.",
    ),
    confidence: "HIGH",
    notes:
      "API 5L Tablo 6'dan doğrudan okundu (birincil kaynak); Octal Steel özet tablosuyla (52.200 psi) birebir eşleşti.",
  },
  {
    spec: mpaToSpec(
      "api5l-l415-x60",
      "L415",
      "X60",
      "API 5L Grade X60 (L415)",
      415,
      60200,
      "Yüksek mukavemetli iletim hattı çeliği.",
    ),
    confidence: "HIGH",
    notes:
      "API 5L Tablo 6'dan doğrudan okundu (birincil kaynak); Octal Steel özet tablosuyla (60.200 psi) birebir eşleşti.",
  },
  {
    spec: mpaToSpec(
      "api5l-l450-x65",
      "L450",
      "X65",
      "API 5L Grade X65 (L450)",
      450,
      65300,
      "Yüksek basınçlı/büyük çaplı iletim hatlarında kullanılan yüksek mukavemetli derece.",
    ),
    confidence: "HIGH",
    notes:
      "API 5L Tablo 6'dan doğrudan okundu (birincil kaynak, 65.300 psi); Octal Steel özet tablosu 65.000 psi " +
      "veriyordu (küçük yuvarlama farkı, muhtemelen kaynağın kendisi de yuvarlamış) — birincil kaynağın " +
      "(API 5L'in kendisi) sayısı esas alındı.",
  },
];

export const PIPE_GRADES: PipeGradeSpec[] = PIPE_GRADE_DEFINITIONS.map((def) => def.spec);

export function getPipeGrade(gradeId: string): PipeGradeSpec {
  const grade = PIPE_GRADES.find((g) => g.gradeId === gradeId);
  if (!grade) {
    const available = PIPE_GRADES.map((g) => g.gradeId).join(", ");
    throw new Error(`"${gradeId}" kimlikli bir boru çelik derecesi bulunamadı. Tanımlı dereceler: ${available}.`);
  }
  return grade;
}

for (const def of PIPE_GRADE_DEFINITIONS) {
  const coefficient: Coefficient<PipeGradeSpec> = {
    id: `data.pipeGrades.${def.spec.gradeId}`,
    module: MODULE,
    value: def.spec,
    unit: "Pa",
    description: `${def.spec.displayNameTr} — SMYS (belirtilen minimum akma dayanımı)`,
    source: SRC_API_5L,
    crossChecked: true,
    crossCheckSources: [SRC_OCTALSTEEL_CROSSCHECK],
    confidence: def.confidence,
    notes: def.notes,
  };
  registerCoefficient(coefficient as Coefficient);
}
