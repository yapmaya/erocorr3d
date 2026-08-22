// packages/engine/src/uncertainty/tornado.ts
//
// Tornado (duyarlılık) diyagramı verisi — her girdi parametresi TEK TEK
// ±perturbFraction (varsayılan %20) değiştirilir, diğerleri temel (base)
// değerinde sabit tutulur, modelin çıktısındaki değişim ölçülür. Sonuçlar
// etki büyüklüğüne göre (en kritik girdi en üstte olacak şekilde) azalan
// sırada döner — bu proje kapsamında "hangi girdinin belirsizliği en çok
// önemsiyor" sorusuna cevap verir (ör. Monte Carlo koşmadan önce hangi
// dağılımların daraltılmaya değer olduğunu hızlıca göstermek için).
//
// KDP notu: ±%20 tek-parametre pertürbasyonu ve etki-sıralaması yöntemi
// GENEL bir duyarlılık analizi tekniğidir (ders kitabı düzeyinde, "one-at-
// a-time sensitivity analysis") — KDP kapsamı dışıdır, bu projenin kendi
// mühendislik karar mantığıdır (bkz. corrosion/modelRouter.ts ve
// corrosion/rules.ts'deki aynı gerekçe: saf karar mantığı KDP'ye kayıtlı
// bir sabit DEĞİLDİR).
//
// Bilinen sınırlamalar: (1) yalnızca TEK parametre değiştirilir — girdiler
// arası etkileşim/korelasyon YAKALANMAZ (bunun için uncertainty/monteCarlo.ts
// kullanılmalıdır); (2) taban değeri 0 olan parametreler için ORANSAL
// pertürbasyon (0×1,2=0) anlamsızdır — bu parametreler analiz dışı bırakılır
// ve `skippedParameters` alanında açıkça listelenir, sessizce atlanmaz.

export interface TornadoParameterResult {
  parameter: string;
  baseValue: number;
  lowValue: number;
  highValue: number;
  baseOutputMmPerYear: number;
  lowOutputMmPerYear: number;
  highOutputMmPerYear: number;
  /** |highOutput - lowOutput| — sıralama bu alana göre yapılır. */
  impactRangeMmPerYear: number;
  /** impactRangeMmPerYear, baseOutput'un yüzdesi olarak (baseOutput=0 ise null). */
  impactPercentOfBase: number | null;
}

export interface TornadoAnalysisResult {
  /** impactRangeMmPerYear'a göre azalan sırada (en kritik parametre ilk sırada). */
  results: TornadoParameterResult[];
  baseOutputMmPerYear: number;
  /** Taban değeri 0 olduğu için oransal pertürbasyonu anlamsız olan, analiz dışı bırakılan parametreler. */
  skippedParameters: string[];
}

export interface TornadoConfig {
  baseInputs: Record<string, number>;
  /** Her girdi kümesi için çağrılan SAF fonksiyon — çıktı mm/yıl cinsinden bir hız olmalıdır. */
  modelFn: (inputs: Readonly<Record<string, number>>) => number;
  /** Varsayılan 0,20 (±%20). */
  perturbFraction?: number;
  /** Hangi parametrelerin analiz edileceği — varsayılan: baseInputs'un tüm anahtarları. */
  parameters?: string[];
}

const DEFAULT_PERTURB_FRACTION = 0.2;

/**
 * Her parametreyi tek tek ±perturbFraction değiştirip modelin çıktısındaki
 * duyarlılığı ölçer ve en kritik parametreyi en üstte olacak şekilde sıralar.
 */
export function computeTornadoAnalysis(config: TornadoConfig): TornadoAnalysisResult {
  const { baseInputs, modelFn, perturbFraction = DEFAULT_PERTURB_FRACTION, parameters } = config;

  if (perturbFraction <= 0) {
    throw new Error("perturbFraction pozitif olmalıdır.");
  }
  const parameterNames = parameters ?? Object.keys(baseInputs);
  if (parameterNames.length === 0) {
    throw new Error("Tornado analizi için en az bir parametre gereklidir.");
  }
  for (const name of parameterNames) {
    if (!(name in baseInputs)) {
      throw new Error(`"${name}" parametresi baseInputs içinde bulunamadı.`);
    }
  }

  const baseOutputMmPerYear = Math.max(modelFn(baseInputs), 0);

  const results: TornadoParameterResult[] = [];
  const skippedParameters: string[] = [];

  for (const parameter of parameterNames) {
    const baseValue = baseInputs[parameter];
    if (baseValue === 0) {
      skippedParameters.push(parameter);
      continue;
    }

    const lowValue = baseValue * (1 - perturbFraction);
    const highValue = baseValue * (1 + perturbFraction);

    const lowOutputMmPerYear = Math.max(modelFn({ ...baseInputs, [parameter]: lowValue }), 0);
    const highOutputMmPerYear = Math.max(modelFn({ ...baseInputs, [parameter]: highValue }), 0);

    const impactRangeMmPerYear = Math.abs(highOutputMmPerYear - lowOutputMmPerYear);
    const impactPercentOfBase =
      baseOutputMmPerYear === 0 ? null : (impactRangeMmPerYear / baseOutputMmPerYear) * 100;

    results.push({
      parameter,
      baseValue,
      lowValue,
      highValue,
      baseOutputMmPerYear,
      lowOutputMmPerYear,
      highOutputMmPerYear,
      impactRangeMmPerYear,
      impactPercentOfBase,
    });
  }

  results.sort((a, b) => b.impactRangeMmPerYear - a.impactRangeMmPerYear);

  return { results, baseOutputMmPerYear, skippedParameters };
}
