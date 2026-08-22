// apps/web/src/features/results/materialMatrixData.ts
//
// Malzeme Karşılaştırma Matrisi (H) verisi. `data/materials.ts::MATERIALS`
// kataloğu + `aggregate/materialSelection.ts::assessSourServiceMaterialRequirement`
// (ISO 15156 bölge tayini, corrosion/h2s.ts'in ZATEN sourced mantığını
// yeniden kullanır) + `resultsDerivation.ts::deriveMaterialRecommendation`
// (Adım A'yla AYNI, TEK malzeme-önerisi kaynağı).
//
// ÖNEMLİ KDP NOTU (bkz. onaylı plan'ın kapsam kararı #7): motor, ŞU ANKİ
// (karbon çelik varsayılan) malzeme DIŞINDAKİ 19 aday için AYRI bir
// korozyon hızı modeli TAŞIMIYOR (yalnızca CS modellenmiş — CRA/duplex
// için yalnızca PREN/sıcaklık/sour-servis NİTEL uygunluk kontrolleri var).
// Bu yüzden "Ömür" sütunu YALNIZCA mevcut/önerilen malzeme için GERÇEK bir
// sayı taşır; diğer adaylar için sayısal bir ömür UYDURULMAZ, "Modellenmedi"
// işaretlenir.
//
// PREN≥40 "yüksek çukurlaşma direnci" eşiği YAYGIN bir mühendislik kuralı-
// aklıdır (superduplex/6Mo alaşımları için literatürde sık atıfta bulunulur)
// ama bu UYGULAMANIN kendi KDP kayıt defterine kayıtlı bir sabit DEĞİLDİR —
// yalnızca UI'da açıkça "kaba sezgisel eşik" olarak etiketlenmiş bir
// karşılaştırma yardımcısıdır (bkz. chartlar G'deki fluidCategory sezgisel
// kuralıyla AYNI dürüstlük deseni).

import {
  assessSourServiceMaterialRequirement,
  computeSharedInSituPh,
  MATERIALS,
  type MaterialSpec,
  type ScenarioAssessment,
} from "@erocorr3d/engine";
import type { AssessmentHistoryEntry } from "../../store/assessmentHistoryStore";
import { deriveMaterialRecommendation } from "./resultsDerivation";

const HIGH_PREN_THRESHOLD = 40;
/** Motorun GERÇEK bir korozyon hızı ürettiği TEK malzeme — bkz. dosya başı KDP notu. */
const MODELED_MATERIAL_ID = "cs-a106-grb";

export interface MaterialMatrixRow {
  material: MaterialSpec;
  /** Motorun korozyon hızı MODELLEDİĞİ malzeme mi (yalnızca bunun için gerçek "Ömür" sayısı var). */
  isModeledMaterial: boolean;
  temperatureSuitable: boolean;
  /** Yalnızca `isModeledMaterial=true` iken gerçek bir sayı — diğerleri `null` ("Modellenmedi"). */
  lifeYearsModeled: number | null;
  sourServiceNoteTr: string | null;
}

export interface MaterialMatrixData {
  rows: MaterialMatrixRow[];
  recommendedMaterialTr: string;
  sourServiceApplicable: boolean;
  sourServiceRegionTr: string | null;
}

export function buildMaterialMatrixData(
  entry: Pick<AssessmentHistoryEntry, "operatingProfile"> & { assessment: Pick<ScenarioAssessment, "metalLoss"> },
  options: { inServiceInspectionPossible: boolean },
): MaterialMatrixData {
  const { operatingProfile, assessment } = entry;
  const cases = operatingProfile.cases;

  const material = deriveMaterialRecommendation(entry, options.inServiceInspectionPossible);

  const minTempAcrossCases = Math.min(...cases.map((c) => c.process.temperatureC));
  const maxTempAcrossCases = Math.max(...cases.map((c) => c.process.temperatureC));

  // Sour servis kontrolü, en YÜKSEK H2S maruziyetli senaryo üzerinden (muhafazakâr) yapılır.
  const worstH2sCase = cases.reduce((worst, c) => (c.chemistry.h2sPpmMole > worst.chemistry.h2sPpmMole ? c : worst), cases[0]);
  const inSituPh = computeSharedInSituPh(worstH2sCase);
  const h2sPartialPressureKpa = (worstH2sCase.chemistry.h2sPpmMole / 1e6) * worstH2sCase.process.pressureBara * 100;
  const sourAssessment =
    inSituPh !== undefined ? assessSourServiceMaterialRequirement(h2sPartialPressureKpa, inSituPh) : null;

  const annualRateP50 = assessment.metalLoss.totalAnnualLossMmPerYear.p50;
  const modeledLifeYears = annualRateP50 > 0 ? operatingProfile.corrosionAllowanceMm / annualRateP50 : operatingProfile.designLifeYears;

  const rows: MaterialMatrixRow[] = MATERIALS.map((candidate) => {
    const isModeledMaterial = candidate.materialId === MODELED_MATERIAL_ID;
    const temperatureSuitable = maxTempAcrossCases <= candidate.maxServiceTempC && minTempAcrossCases >= candidate.minDesignTempC;

    let sourServiceNoteTr: string | null = null;
    if (sourAssessment?.isSourService) {
      const highPren = candidate.pren !== undefined && candidate.pren >= HIGH_PREN_THRESHOLD;
      sourServiceNoteTr = highPren
        ? `Yüksek PREN (${candidate.pren}) — sour servise genellikle uygun (kaba sezgisel eşik, PREN≥${HIGH_PREN_THRESHOLD})`
        : "Sour servis (ISO 15156) — HIC testli çelik veya daha yüksek alaşım gerekebilir, sertlik verisi olmadan kesin yargı verilemez";
    }

    return {
      material: candidate,
      isModeledMaterial,
      temperatureSuitable,
      lifeYearsModeled: isModeledMaterial ? modeledLifeYears : null,
      sourServiceNoteTr,
    };
  });

  return {
    rows,
    recommendedMaterialTr: material.primaryMaterialTr,
    sourServiceApplicable: sourAssessment?.isSourService ?? false,
    sourServiceRegionTr: sourAssessment?.region ?? null,
  };
}
