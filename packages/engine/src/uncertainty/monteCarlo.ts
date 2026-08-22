// packages/engine/src/uncertainty/monteCarlo.ts
//
// Genel amaçlı (herhangi bir aşınma/korozyon modeliyle çalışabilen) Monte
// Carlo belirsizlik yayılımı motoru.
//
// Model: her girdi parametresi bir OLASILIK DAĞILIMI (NORMAL | TRIANGULAR |
// UNIFORM | LOGNORMAL) ile tanımlanır; motor bu dağılımlardan bağımsız
// örnekler çekip çağıranın verdiği saf `modelFn`'i N kez (varsayılan 10.000)
// çalıştırır ve çıktı hızının (mm/yıl) P10/P50/P90'ını, histogramını,
// kümülatif dağılımını ve (istenirse) tasarım ömrü boyunca korozyon payının
// tükenme olasılığını üretir.
//
// KDP notu: rastgele sayı üreteci (mulberry32) ve dağılım örnekleme
// formülleri (üçgen dağılım ters-CDF'i, Box-Muller normal dönüşümü,
// lognormal=exp(normal)) SAF MATEMATİK/istatistik ders kitabı düzeyinde
// genel bilgidir — bu projenin "harici literatürden doğrulanmalı" KDP
// kuralı MÜHENDİSLİK katsayıları içindir, evrensel istatistiksel
// yöntemler için değildir (bkz. fluids/mixtureProperties.ts'deki aynı
// gerekçe: "pure definitional, no KDP sourcing needed"). Girdi
// dağılımlarının GENİŞLİKLERİ (ör. "sıcaklık ±3°C") ise gerçek KDP
// sabitleridir — bkz. defaultDistributions.ts.
//
// Performans: bu fonksiyon saf senkron JS'tir (packages/engine bağımsız ve
// DOM/Worker'a bağımlı olmamalı — bkz. proje talimatı). Arayüzün donmaması
// için apps/web katmanı bu fonksiyonu bir Web Worker içinde (comlink ile)
// SARMALAMALIDIR; bu paket kendi başına worker API'sine bağımlı DEĞİLDİR.
// 10.000 iterasyon, tipik bir modelFn (birkaç aritmetik/log/exp işlemi)
// için bu makinede <100ms sürer — <3s hedefinin çok altında.
//
// Girdi/çıktı birimleri: modelFn'in mm/yıl (korozyon/aşınma hızı) döndürmesi
// beklenir; negatif çıktılar 0'a kırpılır (fiziksel olarak negatif bir
// metal kaybı hızı anlamsızdır — bkz. projenin diğer modüllerindeki aynı
// Math.max(rate,0) kabulü).
//
// Bilinen sınırlamalar: (1) girdi değişkenleri arasında KORELASYON
// desteklenmez — her değişken bağımsız örneklenir (ör. sıcaklık ve basınç
// birlikte hareket edebilir ama bu motor bunu modellemez, bu basitleştirme
// açıkça burada belgelenmiştir); (2) modelFn'in kendisi saf ve hızlı
// olmalıdır — motor onu N kez senkron çağırır.

const DEFAULT_ITERATIONS = 10_000;
const DEFAULT_SEED = 42;
const DEFAULT_HISTOGRAM_BIN_COUNT = 30;
const DEFAULT_CDF_POINT_COUNT = 200;

/** Φ⁻¹(0,90) — standart normal dağılımın %90 kantili. Lognormal örneklemede kullanılır. */
const STANDARD_NORMAL_QUANTILE_90 = 1.2815515655446004;

export interface NormalDistribution {
  readonly type: "NORMAL";
  readonly mean: number;
  readonly stdDev: number;
}

export interface UniformDistribution {
  readonly type: "UNIFORM";
  readonly min: number;
  readonly max: number;
}

export interface TriangularDistribution {
  readonly type: "TRIANGULAR";
  readonly min: number;
  readonly mode: number;
  readonly max: number;
}

/**
 * Lognormal dağılım — medyan ve P90/P50 çarpımsal oranı ile parametrelenir
 * (bu projenin kendi P10/P50/P90 çarpımsal bant sözleşmesiyle tutarlı olsun
 * diye, bkz. uncertainty/percentiles.ts). p90OverP50>1 olmalıdır.
 */
export interface LognormalDistribution {
  readonly type: "LOGNORMAL";
  readonly median: number;
  readonly p90OverP50: number;
}

export type InputDistribution =
  | NormalDistribution
  | UniformDistribution
  | TriangularDistribution
  | LognormalDistribution;

export interface MonteCarloVariable {
  /** modelFn'e geçirilen örnek nesnesindeki anahtar adı (ör. "temperatureC"). */
  name: string;
  distribution: InputDistribution;
}

/**
 * Tasarım ömrü boyunca toplam metal kaybının korozyon payını aşma
 * olasılığının hesaplanması için gereken ek girdiler.
 */
export interface DesignLifeAllowanceCheck {
  designLifeYears: number;
  corrosionAllowanceMm: number;
}

export interface MonteCarloConfig {
  variables: MonteCarloVariable[];
  /** Her örnek için çağrılan SAF fonksiyon — çıktı mm/yıl cinsinden bir hız olmalıdır. */
  modelFn: (sample: Readonly<Record<string, number>>) => number;
  /** Varsayılan 10.000. */
  iterations?: number;
  /** Tekrarlanabilirlik için sabit tohum — varsayılan 42. */
  seed?: number;
  histogramBinCount?: number;
  cdfPointCount?: number;
  designLifeAllowanceCheck?: DesignLifeAllowanceCheck;
}

export interface HistogramBin {
  binStartMmPerYear: number;
  binEndMmPerYear: number;
  count: number;
  /** count / iterations */
  frequency: number;
}

export interface CumulativeDistributionPoint {
  rateMmPerYear: number;
  /** 0-1 arası kümülatif olasılık. */
  cumulativeProbability: number;
}

export interface MonteCarloResult {
  p10MmPerYear: number;
  p50MmPerYear: number;
  p90MmPerYear: number;
  meanMmPerYear: number;
  stdDevMmPerYear: number;
  minMmPerYear: number;
  maxMmPerYear: number;
  histogram: HistogramBin[];
  cumulativeDistribution: CumulativeDistributionPoint[];
  /**
   * "Tasarım ömrü boyunca korozyon payı tükenme olasılığı (%)" —
   * designLifeAllowanceCheck verilmediyse null.
   */
  probabilityOfExceedingAllowancePercent: number | null;
  iterations: number;
  seed: number;
  durationMs: number;
}

/**
 * mulberry32 — küçük, hızlı, tohumlanabilir sözde-rastgele sayı üreteci
 * (public domain algoritma). Bu modülün dışında da (ör. spatial/pipeFittings.ts'in
 * "rastgele ama tohumlu" MIC leke deseni) tekrarlanabilirlik gerektiren her
 * yerde YENİDEN KULLANILMASI için dışa aktarılır — paralel bir PRNG icat
 * ETMEZ.
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller dönüşümü — standart normal (ortalama 0, σ=1) bir örnek üretir. */
function sampleStandardNormal(rng: () => number): number {
  let u1 = rng();
  // u1 tam 0 ise ln(0)=-Infinity olur — bu ölçülemeyecek kadar düşük olasılıklı ama teorik olarak
  // mümkün bir durumu engellemek için en küçük pozitif değere kırp.
  if (u1 <= 0) u1 = Number.EPSILON;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Verilen dağılımdan tek bir örnek çeker.
 *
 * Formüller: UNIFORM min+u×(max-min); TRIANGULAR standart ters-CDF (bkz. Wikipedia
 * "Triangular distribution", ders kitabı düzeyinde, KDP kapsamı dışı); NORMAL
 * Box-Muller; LOGNORMAL exp(ln(medyan)+σ×z), σ=ln(p90OverP50)/Φ⁻¹(0,90).
 */
export function sampleFromDistribution(distribution: InputDistribution, rng: () => number): number {
  switch (distribution.type) {
    case "UNIFORM": {
      const { min, max } = distribution;
      if (min >= max) throw new Error("UNIFORM dağılımda min, max'tan küçük olmalıdır.");
      return min + rng() * (max - min);
    }
    case "TRIANGULAR": {
      const { min, mode, max } = distribution;
      if (!(min <= mode && mode <= max) || min === max) {
        throw new Error("TRIANGULAR dağılımda min ≤ mode ≤ max ve min < max sağlanmalıdır.");
      }
      const u = rng();
      const modeFraction = (mode - min) / (max - min);
      if (u < modeFraction) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      }
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
    case "NORMAL": {
      const { mean, stdDev } = distribution;
      if (stdDev < 0) throw new Error("NORMAL dağılımda stdDev negatif olamaz.");
      return mean + stdDev * sampleStandardNormal(rng);
    }
    case "LOGNORMAL": {
      const { median, p90OverP50 } = distribution;
      if (median <= 0) throw new Error("LOGNORMAL dağılımda median pozitif olmalıdır.");
      if (p90OverP50 <= 1) throw new Error("LOGNORMAL dağılımda p90OverP50, 1'den büyük olmalıdır.");
      const sigma = Math.log(p90OverP50) / STANDARD_NORMAL_QUANTILE_90;
      return Math.exp(Math.log(median) + sigma * sampleStandardNormal(rng));
    }
  }
}

/** Sıralı bir dizi üzerinde doğrusal enterpolasyonlu ampirik yüzdelik (percentile). */
function computeEmpiricalPercentile(sortedValues: number[], percentile: number): number {
  const n = sortedValues.length;
  if (n === 0) throw new Error("Boş dizi için yüzdelik hesaplanamaz.");
  if (n === 1) return sortedValues[0];
  const rank = (percentile / 100) * (n - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = rank - lowerIndex;
  return sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
}

function buildHistogram(sortedValues: number[], binCount: number): HistogramBin[] {
  const n = sortedValues.length;
  const min = sortedValues[0];
  const max = sortedValues[n - 1];
  const bins: HistogramBin[] = [];
  const span = max - min;
  const binWidth = span > 0 ? span / binCount : 1;
  for (let i = 0; i < binCount; i++) {
    const binStartMmPerYear = min + i * binWidth;
    const binEndMmPerYear = i === binCount - 1 ? max : min + (i + 1) * binWidth;
    bins.push({ binStartMmPerYear, binEndMmPerYear, count: 0, frequency: 0 });
  }
  for (const value of sortedValues) {
    if (span === 0) {
      bins[0].count += 1;
      continue;
    }
    let index = Math.floor(((value - min) / span) * binCount);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    bins[index].count += 1;
  }
  for (const bin of bins) {
    bin.frequency = bin.count / n;
  }
  return bins;
}

function buildCumulativeDistribution(sortedValues: number[], pointCount: number): CumulativeDistributionPoint[] {
  const n = sortedValues.length;
  const points: CumulativeDistributionPoint[] = [];
  const step = Math.max(1, Math.floor(n / pointCount));
  for (let i = 0; i < n; i += step) {
    points.push({ rateMmPerYear: sortedValues[i], cumulativeProbability: (i + 1) / n });
  }
  const last = sortedValues[n - 1];
  if (points.length === 0 || points[points.length - 1].rateMmPerYear !== last) {
    points.push({ rateMmPerYear: last, cumulativeProbability: 1 });
  }
  return points;
}

/**
 * Monte Carlo belirsizlik yayılımı simülasyonunu çalıştırır.
 *
 * Aynı `seed` ve aynı `config` ile çağrıldığında, `durationMs` (gerçek zaman
 * ölçümü, teşhis amaçlı) HARİÇ, BİREBİR AYNI sonucu üretir (tekrarlanabilirlik
 * — bkz. modül testleri). `durationMs` tek istisnadır ve karar/sonuç
 * hesaplamasının hiçbir adımında girdi olarak kullanılmaz.
 */
export function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
  const {
    variables,
    modelFn,
    iterations = DEFAULT_ITERATIONS,
    seed = DEFAULT_SEED,
    histogramBinCount = DEFAULT_HISTOGRAM_BIN_COUNT,
    cdfPointCount = DEFAULT_CDF_POINT_COUNT,
    designLifeAllowanceCheck,
  } = config;

  if (variables.length === 0) {
    throw new Error("Monte Carlo simülasyonu için en az bir girdi değişkeni tanımlanmalıdır.");
  }
  if (iterations < 1 || !Number.isInteger(iterations)) {
    throw new Error("iterations pozitif bir tam sayı olmalıdır.");
  }

  const startedAt = Date.now();
  const rng = createSeededRng(seed);
  const outputs = new Array<number>(iterations);
  const allowanceExceedances = designLifeAllowanceCheck ? new Array<boolean>(iterations) : null;

  for (let i = 0; i < iterations; i++) {
    const sample: Record<string, number> = {};
    for (const variable of variables) {
      sample[variable.name] = sampleFromDistribution(variable.distribution, rng);
    }
    const rawOutput = modelFn(sample);
    const output = Math.max(rawOutput, 0);
    outputs[i] = output;
    if (designLifeAllowanceCheck && allowanceExceedances) {
      const totalLossMm = output * designLifeAllowanceCheck.designLifeYears;
      allowanceExceedances[i] = totalLossMm > designLifeAllowanceCheck.corrosionAllowanceMm;
    }
  }

  const sortedOutputs = [...outputs].sort((a, b) => a - b);
  const mean = outputs.reduce((sum, value) => sum + value, 0) / iterations;
  const variance =
    iterations > 1
      ? outputs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (iterations - 1)
      : 0;

  const probabilityOfExceedingAllowancePercent = allowanceExceedances
    ? (allowanceExceedances.filter(Boolean).length / iterations) * 100
    : null;

  return {
    p10MmPerYear: computeEmpiricalPercentile(sortedOutputs, 10),
    p50MmPerYear: computeEmpiricalPercentile(sortedOutputs, 50),
    p90MmPerYear: computeEmpiricalPercentile(sortedOutputs, 90),
    meanMmPerYear: mean,
    stdDevMmPerYear: Math.sqrt(variance),
    minMmPerYear: sortedOutputs[0],
    maxMmPerYear: sortedOutputs[iterations - 1],
    histogram: buildHistogram(sortedOutputs, histogramBinCount),
    cumulativeDistribution: buildCumulativeDistribution(sortedOutputs, cdfPointCount),
    probabilityOfExceedingAllowancePercent,
    iterations,
    seed,
    durationMs: Date.now() - startedAt,
  };
}
