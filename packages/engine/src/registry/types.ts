// packages/engine/src/registry/types.ts
//
// Kaynak Doğrulama Protokolü (KDP) kayıt defterinin veri sözleşmesi.

export type SourceType =
  | "STANDARD"
  | "JOURNAL"
  | "CONFERENCE"
  | "THESIS"
  | "TEXTBOOK"
  | "OPEN_SOURCE_CODE"
  /**
   * Kullanıcının kendi proje dokümanından (ör. bir korozyon/malzeme
   * değerlendirme raporu) doğrudan verdiği değerler. Bu tip, harici
   * literatürle çapraz doğrulanana kadar diğer kaynak tiplerine göre
   * daha düşük bir varsayılan güvenilirlik taşımalıdır (bkz. ilgili
   * Coefficient.confidence alanı).
   */
  | "PROJECT_DOCUMENT";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export interface Source {
  type: SourceType;
  citation: string;
  url?: string;
  accessedDate: string;
}

/**
 * Kayıt defterindeki tek bir mühendislik sabiti/katsayısı.
 *
 * @template T Değerin tipi (ör. number, [number,number] aralık, veya bir
 * tablo/fonksiyon veri yapısı).
 */
export interface Coefficient<T = unknown> {
  id: string;
  value: T;
  unit: string;
  description: string;
  source: Source;
  crossChecked: boolean;
  crossCheckSources: Source[];
  confidence: ConfidenceLevel;
  notes: string;
  /** Bu sabitin ait olduğu mekanizma/modül (ör. "norsok", "shared") — UI filtresi için. */
  module: string;
}
