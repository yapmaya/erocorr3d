// packages/engine/src/corrosion/galvanic.ts
//
// Galvanik korozyon risk değerlendirmesi: galvanik seri konumu (nobilite
// mesafesi) + anot/katot alan oranı hızlanma faktörü (üst sınır) + CRA/CS
// birleşiminde izolasyon kiti gerekliliği kararı.
//
// ⚠ API RP 571 §4.3.1 (bkz. data/mechanisms.ts::GALVANIC_INTERNAL/EXTERNAL,
// HIGH) HİÇBİR sayısal mm/yıl hızı vermiyor ("anot/katot alan oranına aşırı
// duyarlı olduğundan tek bir sayı anlamlı değildir"). assessGalvanicRisk()
// bir RiskScoreResult döndürür — conditionalRateRangeMmPerYear HER ZAMAN
// null'dur, ancak areaRatioAccelerationFactor (bir ÇARPAN, mutlak hız
// DEĞİL) sonuçta ayrıca döner.

import { getCoefficient, worstConfidence } from "../registry";
import type { GalvanicSeriesEntry } from "../registry/coefficients/galvanic";
import type { ConfidenceLevel } from "../registry/types";
import {
  ENGINEERING_DISCLAIMER_TR,
  classifyRiskScore,
  clampRiskScore,
  type RiskFactorContribution,
  type RiskScoreResult,
  type ValidityWarning,
} from "./types";

/** Deniz suyu galvanik serisindeki konumu (rank, 1=en soy) döndürür — bulunamazsa hata fırlatır. */
export function getGalvanicSeriesRank(materialLabel: string): number {
  const series = getCoefficient<GalvanicSeriesEntry[]>("galvanic.seawaterSeries").value;
  const entry = series.find((e) => e.materialLabel === materialLabel);
  if (!entry) {
    const available = series.map((e) => e.materialLabel).join(", ");
    throw new Error(`"${materialLabel}" galvanik seride bulunamadı. Tanımlı: ${available}.`);
  }
  return entry.rank;
}

/**
 * En kötü durum (Faraday/akım korunumu üst sınırı) anot akım/hız hızlanma
 * çarpanını hesaplar: i_anot = i_katot × (A_katot/A_anot).
 *
 * @param anodeAreaM2 Anodik (daha az soy) malzemenin ıslak yüzey alanı (m²)
 * @param cathodeAreaM2 Katodik (daha soy) malzemenin ıslak yüzey alanı (m²)
 */
export function computeAreaRatioAccelerationFactor(anodeAreaM2: number, cathodeAreaM2: number): number {
  if (anodeAreaM2 <= 0 || cathodeAreaM2 <= 0) {
    throw new Error("Alanlar pozitif olmalıdır.");
  }
  return cathodeAreaM2 / anodeAreaM2;
}

export interface GalvanicRiskInput {
  /** Daha az soy (beklenen anot) malzeme — data/materials.ts ile ayrı bir eşleme gerekir, bkz. registry galvanic.seawaterSeries etiketleri */
  anodeMaterialLabel: string;
  cathodeMaterialLabel: string;
  anodeAreaM2: number;
  cathodeAreaM2: number;
  electrolytePresent: boolean;
  isolationKitPresent: boolean;
}

const SERIES_DISTANCE_LOW_MAX = 3;
const SERIES_DISTANCE_MODERATE_MAX = 8;

/**
 * Galvanik korozyon risk skorunu (0-100) değerlendirir.
 *
 * Model adı: galvanik seri mesafesi + alan oranı üst-sınır çarpanı (bkz.
 * dosya başı yorumu) + bu projenin kendi risk-skoru ağırlıklandırması.
 * Bilinen sınırlamalar: conditionalRateRangeMmPerYear HER ZAMAN null'dur
 * (API RP 571'in kendi gerekçesi — bkz. dosya başı yorumu); seri mesafesi
 * eşikleri (3/8 rank) KDP kapsamı DIŞINDADIR, proje kuralıdır.
 */
export function assessGalvanicRisk(input: GalvanicRiskInput): RiskScoreResult {
  const validityWarnings: ValidityWarning[] = [];

  if (!input.electrolytePresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Elektrolit (nemli/sulu ortam) yok — galvanik korozyon mekanizması geçerli değil (API RP 571 §4.3.1'in 3 koşulundan biri eksik). ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  if (input.isolationKitPresent) {
    return {
      isMechanismActive: false,
      riskScore: 0,
      riskLevel: "DÜŞÜK",
      factorContributions: [],
      conditionalRateRangeMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Elektriksel izolasyon kiti mevcut — galvanik hücre devresi kesilmiş kabul edilir (API RP 571 §4.3.1 önlem listesi). ${ENGINEERING_DISCLAIMER_TR}`,
    };
  }

  const anodeRank = getGalvanicSeriesRank(input.anodeMaterialLabel);
  const cathodeRank = getGalvanicSeriesRank(input.cathodeMaterialLabel);
  const sourcesUsed = ["galvanic.seawaterSeries"];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("galvanic.seawaterSeries").confidence];

  const seriesDistance = anodeRank - cathodeRank;
  if (seriesDistance <= 0) {
    validityWarnings.push({
      parameter: "Galvanik seri sırası",
      value: seriesDistance,
      min: 1,
      max: Infinity,
      unit: "-",
      message: `"${input.anodeMaterialLabel}", "${input.cathodeMaterialLabel}"'den daha SOY (veya eşit) — anot/katot ataması TERSİNE dönmüş olabilir, girdileri kontrol edin.`,
    });
  }

  const areaRatioAccelerationFactor = computeAreaRatioAccelerationFactor(input.anodeAreaM2, input.cathodeAreaM2);
  sourcesUsed.push("galvanic.areaRatioWorstCaseFormula");
  usedConfidences.push(getCoefficient("galvanic.areaRatioWorstCaseFormula").confidence);

  const factorContributions: RiskFactorContribution[] = [];

  let distancePoints: number;
  if (seriesDistance <= SERIES_DISTANCE_LOW_MAX) {
    distancePoints = 10;
  } else if (seriesDistance <= SERIES_DISTANCE_MODERATE_MAX) {
    distancePoints = 30;
  } else {
    distancePoints = 50;
  }
  factorContributions.push({
    factorTr: `Galvanik seri mesafesi (${seriesDistance} sıra)`,
    points: distancePoints,
    rationaleTr: "Seride ne kadar uzaksa potansiyel fark (ve dolayısıyla itici güç) o kadar büyük kabul edilir (proje kuralı).",
  });

  let areaRatioPoints: number;
  if (areaRatioAccelerationFactor <= 1) {
    areaRatioPoints = 5;
  } else if (areaRatioAccelerationFactor <= 10) {
    areaRatioPoints = 25;
  } else {
    areaRatioPoints = 45;
  }
  factorContributions.push({
    factorTr: `Katot/anot alan oranı (×${areaRatioAccelerationFactor.toFixed(1)})`,
    points: areaRatioPoints,
    rationaleTr: "Küçük anot/büyük katot en yüksek anot akım yoğunluğunu (ve hızını) verir — API RP 571 §4.3.1.",
  });

  if (areaRatioAccelerationFactor > 10) {
    validityWarnings.push({
      parameter: "Katot/anot alan oranı",
      value: areaRatioAccelerationFactor,
      min: 0,
      max: 10,
      unit: "-",
      message:
        `Alan oranı (×${areaRatioAccelerationFactor.toFixed(1)}) yüksek — bu, ÜST SINIR bir çarpandır ` +
        "(bkz. registry galvanic.areaRatioWorstCaseFormula notları), gerçek hızlanma polarizasyon/ohmik " +
        "direnç nedeniyle daha düşük olabilir ama tasarımda muhafazakâr taraf tercih edilmelidir.",
    });
  }

  const riskScore = clampRiskScore(factorContributions.reduce((sum, f) => sum + f.points, 0));

  if (riskScore >= 50) {
    validityWarnings.push({
      parameter: "İzolasyon kiti önerisi",
      value: riskScore,
      min: 0,
      max: 100,
      unit: "-",
      message:
        "Yüksek galvanik risk — CRA/CS (veya benzeri farklı-alaşım) birleşiminde elektriksel izolasyon " +
        "kiti (conta + cıvata kılıfı) KULLANILMASI önerilir (API RP 571 §4.3.1 önlem listesi).",
    });
  }

  return {
    isMechanismActive: true,
    riskScore,
    riskLevel: classifyRiskScore(riskScore),
    factorContributions,
    conditionalRateRangeMmPerYear: null,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
