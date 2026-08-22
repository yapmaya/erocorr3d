// packages/engine/src/erosion/dropletErosion.ts
//
// Sıvı damlacık erozyonu (yüksek hızlı ıslak gaz/gaz-kondensat sistemlerinde
// gaz akışı içinde sürüklenen sıvı damlacıklarının çarpmasıyla oluşan
// aşınma).
//
// ⚠⚠⚠ BU MODÜL, api14e.ts İLE AYNI FELSEFEYİ PAYLAŞAN BİR TARAMA
// MODÜLÜDÜR — MUTLAK BİR AŞINMA HIZI MODELİ DEĞİLDİR ⚠⚠⚠
//
// Araştırılan HİÇBİR kaynak (DNV RP O501 dahil — standardın kendi metni:
// "Droplet erosion is briefly addressed... appropriate velocity limits are
// given") bu mekanizma için doğrulanmış, sayısal bir mm/yıl denklemi
// vermiyor. Bu yüzden:
//
// 1) computeDropletErosionVelocityLimit() — DNV'nin kendi eşiği (70-80 m/s,
//    HIGH confidence, 2 bağımsız kaynakla çapraz doğrulandı).
// 2) assessDropletErosionRisk() — eşik altı/üstü tarama + eşik ÜSTÜ için bir
//    GÖSTERGE (indicative) hız. Bu gösterge hız KESİNLİKLE UNVERIFIED'dır
//    (bkz. registry/coefficients/dropletErosion.ts) — mutlak büyüklüğü
//    kaynaktan gelmez, yalnızca "ne kadar aşıldığına göre kabaca nasıl
//    ölçeklenir" sorusuna kaba bir cevap verir. UI'da HER ZAMAN sarı rozet +
//    belirgin uyarı ile gösterilmelidir.
//
// Kaynak: bkz. registry/coefficients/dropletErosion.ts başlık yorumu.

import { getCoefficient, worstConfidence } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import { applyMultiplicativeUncertaintyBand } from "../uncertainty/percentiles";

export type DropletErosionRiskLevel = "GÜVENLİ" | "YAKLAŞIYOR" | "RİSKLİ";

export interface DropletErosionVelocityLimit {
  /** Eşik hızı aralığı [alt (muhafazakâr), üst] m/s */
  velocityLimitRangeMs: [number, number];
  /** Muhafazakâr (alt sınır) eşik — tarama için kullanılır */
  conservativeLimitMs: number;
  confidence: ConfidenceLevel;
  sourcesUsed: string[];
}

/**
 * DNV RP O501 §6/§9.2-9.3'ün damlacık erozyonu hız eşiğini döndürür.
 *
 * Model adı: DNV-RP-O501 damlacık erozyonu TARAMA eşiği (sayısal bir hız
 * modeli DEĞİLDİR — bkz. dosya başı yorumu).
 * Girdi/çıktı birimleri: çıktı m/s.
 * Geçerlilik aralığı: gaz-kondensat sistemleri (ıslak gaz, yüksek hız).
 */
export function computeDropletErosionVelocityLimit(): DropletErosionVelocityLimit {
  const range = getCoefficient<[number, number]>("dropletErosion.velocityLimitRangeMs").value;
  return {
    velocityLimitRangeMs: range,
    conservativeLimitMs: range[0],
    confidence: getCoefficient("dropletErosion.velocityLimitRangeMs").confidence,
    sourcesUsed: ["dropletErosion.velocityLimitRangeMs"],
  };
}

export interface DropletErosionRiskInput {
  /** Gerçek gaz hızı (m/s) */
  actualGasVelocityMs: number;
  /** Akışkan sıcaklığı su çiy noktasının en az bu kadar (°C) üstündeyse akış "kuru gaz" kabul edilir ve mekanizma devre dışıdır — bkz. corrosion/rules.ts isDryGas ile aynı proje kuralı, burada tekrar uygulanmaz; çağıran taraf yalnızca serbest sıvı/damlacık VARSA bu fonksiyonu çağırmalıdır */
  entrainedLiquidPresent: boolean;
}

export interface DropletErosionRiskResult {
  velocityLimitMs: number;
  velocityToLimitRatio: number;
  riskLevel: DropletErosionRiskLevel;
  /** Eşik üstündeyse GÖSTERGE (indicative) hız — bkz. dosya başı yorumu, HER ZAMAN confidence=UNVERIFIED */
  indicativeRateMmPerYear: UncertaintyBand | null;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
  screeningOnlyNoteTr: string;
}

const SCREENING_ONLY_NOTE_TR =
  "Bu, sıvı damlacık erozyonu için SAYISAL BİR HIZ MODELİ DEĞİL, bir TARAMA kriteridir. Hiçbir kaynak, bu " +
  "mekanizma için doğrulanmış bir mm/yıl denklemi vermiyor. Eşik üstü 'gösterge hız' KESİNLİKLE " +
  "DOĞRULANMAMIŞTIR (UNVERIFIED) — yalnızca kaba bir mertebe fikri verir, malzeme/boyutlandırma kararı " +
  "için KULLANILMAMALIDIR.";

/**
 * Sıvı damlacık erozyonu riskini değerlendirir: eşik hızı, gerçek hız/eşik
 * oranı, ayrık risk seviyesi ve (yalnızca eşik üstündeyse) bir GÖSTERGE hız.
 *
 * Risk seviyesi eşikleri (oran bazlı) bu PROJENİN KENDİ raporlama kabulüdür
 * (KDP kapsamı dışı, api14e.ts'teki uyarı seviyesi mantığıyla aynı): <0,8
 * GÜVENLİ, 0,8-1,0 YAKLAŞIYOR, >1,0 RİSKLİ.
 */
export function assessDropletErosionRisk(input: DropletErosionRiskInput): DropletErosionRiskResult {
  if (input.actualGasVelocityMs < 0) {
    throw new Error("Gaz hızı negatif olamaz.");
  }

  const validityWarnings: ValidityWarning[] = [];

  if (!input.entrainedLiquidPresent) {
    return {
      velocityLimitMs: Number.POSITIVE_INFINITY,
      velocityToLimitRatio: 0,
      riskLevel: "GÜVENLİ",
      indicativeRateMmPerYear: null,
      confidence: "HIGH",
      validityWarnings: [],
      sourcesUsed: [],
      disclaimer: `Sürüklenen serbest sıvı (damlacık) yok; damlacık erozyonu mekanizması geçerli değil. ${ENGINEERING_DISCLAIMER_TR}`,
      screeningOnlyNoteTr: SCREENING_ONLY_NOTE_TR,
    };
  }

  const { conservativeLimitMs, sourcesUsed: limitSources } = computeDropletErosionVelocityLimit();
  const velocityToLimitRatio = input.actualGasVelocityMs / conservativeLimitMs;

  let riskLevel: DropletErosionRiskLevel;
  if (velocityToLimitRatio < 0.8) {
    riskLevel = "GÜVENLİ";
  } else if (velocityToLimitRatio < 1.0) {
    riskLevel = "YAKLAŞIYOR";
  } else {
    riskLevel = "RİSKLİ";
  }

  const sourcesUsed = [...limitSources];
  const usedConfidences: ConfidenceLevel[] = [getCoefficient("dropletErosion.velocityLimitRangeMs").confidence];

  let indicativeRateMmPerYear: UncertaintyBand | null = null;

  if (velocityToLimitRatio >= 1.0) {
    validityWarnings.push({
      parameter: "Hız / eşik oranı",
      value: velocityToLimitRatio,
      min: 0,
      max: 1,
      unit: "-",
      message: `Gerçek gaz hızı, damlacık erozyonu eşiğini (${conservativeLimitMs} m/s) %${((velocityToLimitRatio - 1) * 100).toFixed(0)} aşıyor.`,
    });

    const [nMin, nMax] = getCoefficient<[number, number]>(
      "dropletErosion.aboveThresholdVelocityExponentRange",
    ).value;
    const exponent = nMin; // muhafazakâr (düşük aşım bölgesinde erozyonu abartmayan) uç — bkz. registry notes
    const referenceRateMmPerYear = getCoefficient<number>(
      "dropletErosion.indicativeRateAtThresholdMmPerYear",
    ).value;
    const centralRateMmPerYear = referenceRateMmPerYear * velocityToLimitRatio ** exponent;
    // Duyarlılık bilgisi: aralığın üst ucu (nMax) ile hesaplanan alternatif değer, yalnızca
    // aşağıdaki validityWarning mesajında gösterilir — sonuca (band) KARIŞMAZ.
    const alternativeUpperExponentRateMmPerYear = referenceRateMmPerYear * velocityToLimitRatio ** nMax;

    const uncertaintyFactor = getCoefficient<number>("dropletErosion.uncertaintyBandFactor").value;
    indicativeRateMmPerYear = applyMultiplicativeUncertaintyBand(centralRateMmPerYear, uncertaintyFactor);

    sourcesUsed.push(
      "dropletErosion.aboveThresholdVelocityExponentRange",
      "dropletErosion.indicativeRateAtThresholdMmPerYear",
      "dropletErosion.uncertaintyBandFactor",
    );
    usedConfidences.push(
      getCoefficient("dropletErosion.aboveThresholdVelocityExponentRange").confidence,
      getCoefficient("dropletErosion.indicativeRateAtThresholdMmPerYear").confidence,
      getCoefficient("dropletErosion.uncertaintyBandFactor").confidence,
    );

    validityWarnings.push({
      parameter: "Gösterge aşınma hızı",
      value: centralRateMmPerYear,
      min: 0,
      max: Infinity,
      unit: "mm/yıl",
      message:
        "Bu hız DOĞRULANMAMIŞ (UNVERIFIED) bir göstergedir — hiçbir kaynak damlacık erozyonu için mutlak " +
        `bir mm/yıl büyüklüğü vermiyor. Yalnızca eşik aşım oranına göre kaba bir mertebe fikri verir ` +
        `(üstel n=${nMin}-${nMax} duyarlılık aralığının üst ucuyla, aynı oranda, gösterge hız ` +
        `${alternativeUpperExponentRateMmPerYear.toFixed(3)} mm/yıl'a kadar çıkabilir).`,
    });
  }

  return {
    velocityLimitMs: conservativeLimitMs,
    velocityToLimitRatio,
    riskLevel,
    indicativeRateMmPerYear,
    confidence: worstConfidence(usedConfidences),
    validityWarnings,
    sourcesUsed,
    disclaimer: ENGINEERING_DISCLAIMER_TR,
    screeningOnlyNoteTr: SCREENING_ONLY_NOTE_TR,
  };
}
