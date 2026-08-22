// packages/engine/src/registry/store.ts
//
// KDP kayıt defterinin çalışma zamanı deposu: kayıt, okuma, kullanım
// izleme, dışa aktarma ve istatistikler.

import type { Coefficient, ConfidenceLevel } from "./types";

const coefficientsById = new Map<string, Coefficient>();
const usageCounts = new Map<string, number>();

/**
 * Kayıt defterine yeni bir katsayı ekler.
 *
 * Aynı id ile ikinci kez kayıt yapılması bir programlama hatasıdır (kopya
 * kayıt) ve hata fırlatır — sessizce üzerine yazılmaz.
 */
export function registerCoefficient(coefficient: Coefficient): void {
  if (coefficientsById.has(coefficient.id)) {
    throw new Error(
      `"${coefficient.id}" kimlikli katsayı zaten kayıt defterinde mevcut (kopya kayıt).`,
    );
  }
  coefficientsById.set(coefficient.id, coefficient);
}

/**
 * Kayıt defterinden bir katsayıyı kimliğiyle getirir.
 *
 * KDP kuralı: confidence "UNVERIFIED" ise konsola uyarı basar. Her çağrı,
 * bu katsayının kullanım sayacını bir artırır (registryStats() ve denetim
 * için).
 */
export function getCoefficient<T = unknown>(id: string): Coefficient<T> {
  const coefficient = coefficientsById.get(id);
  if (!coefficient) {
    throw new Error(`Kayıt defterinde "${id}" kimlikli bir katsayı bulunamadı.`);
  }
  usageCounts.set(id, (usageCounts.get(id) ?? 0) + 1);
  if (coefficient.confidence === "UNVERIFIED") {
    console.warn(
      `[EroCorr3D KDP UYARISI] "${id}" katsayısı DOĞRULANMAMIŞ (UNVERIFIED) bir kaynağa dayanıyor. ` +
        `Not: ${coefficient.notes}`,
    );
  }
  return coefficient as Coefficient<T>;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, UNVERIFIED: 0 };

/**
 * Verilen güven seviyeleri arasından en düşük (en az güvenilir) olanı
 * döndürür — bir hesabın kullandığı tüm katsayıların "zayıf halkası".
 * Boş dizi verilirse hata fırlatır.
 */
export function worstConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) {
    throw new Error("worstConfidence: en az bir güven seviyesi verilmelidir.");
  }
  return levels.reduce((worst, level) => (CONFIDENCE_RANK[level] < CONFIDENCE_RANK[worst] ? level : worst));
}

/** Verilen kimlik listesi içinden yalnızca UNVERIFIED olanları döndürür. */
export function getUsedUnverified(coefficientIds: string[]): Coefficient[] {
  const result: Coefficient[] = [];
  for (const id of coefficientIds) {
    const coefficient = coefficientsById.get(id);
    if (coefficient && coefficient.confidence === "UNVERIFIED") {
      result.push(coefficient);
    }
  }
  return result;
}

export function listCoefficients(): Coefficient[] {
  return [...coefficientsById.values()];
}

export function listByConfidence(level: ConfidenceLevel): Coefficient[] {
  return listCoefficients().filter((c) => c.confidence === level);
}

export function listByModule(moduleName: string): Coefficient[] {
  return listCoefficients().filter((c) => c.module === moduleName);
}

export function getUsageCount(id: string): number {
  return usageCounts.get(id) ?? 0;
}

export interface RegistryStats {
  total: number;
  byConfidence: Record<ConfidenceLevel, number>;
  byModule: Record<string, number>;
}

export function registryStats(): RegistryStats {
  const byConfidence: Record<ConfidenceLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    UNVERIFIED: 0,
  };
  const byModule: Record<string, number> = {};
  for (const coefficient of coefficientsById.values()) {
    byConfidence[coefficient.confidence] += 1;
    byModule[coefficient.module] = (byModule[coefficient.module] ?? 0) + 1;
  }
  return { total: coefficientsById.size, byConfidence, byModule };
}

function csvEscape(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const CSV_COLUMNS = [
  "id",
  "module",
  "value",
  "unit",
  "description",
  "confidence",
  "crossChecked",
  "sourceType",
  "sourceCitation",
  "sourceUrl",
  "notes",
] as const;

/** Kayıt defterini denetim amaçlı JSON veya CSV metni olarak dışa aktarır. */
export function exportRegistry(format: "json" | "csv"): string {
  const coefficients = listCoefficients();
  if (format === "json") {
    return JSON.stringify(coefficients, null, 2);
  }

  const rows = coefficients.map((c) =>
    [
      c.id,
      c.module,
      c.value,
      c.unit,
      c.description,
      c.confidence,
      c.crossChecked,
      c.source.type,
      c.source.citation,
      c.source.url ?? "",
      c.notes,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

/**
 * YALNIZCA TESTLER İÇİN: kayıt defterini ve kullanım sayaçlarını sıfırlar.
 * Üretim kodunda çağrılmamalıdır.
 */
export function resetRegistryForTests(): void {
  coefficientsById.clear();
  usageCounts.clear();
}
