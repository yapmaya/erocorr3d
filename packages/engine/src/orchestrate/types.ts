// packages/engine/src/orchestrate/types.ts
//
// orchestrate/ modülünün paylaşılan tipleri — motorun ayrı hesap
// fonksiyonlarını (corrosion/*, erosion/*) gerçek MechanismResult[]'a
// bağlayan orkestrasyon katmanının veri sözleşmesi.
//
// MİMARİ NOT: bu katman, projenin şu ana kadar açık bıraktığı boşluğu
// kapatır (bkz. spatial/index.ts dosya başı yorumu: "bu projede henüz
// corrosion/erosion hesap fonksiyonlarını gerçek MechanismResult[]
// nesnelerine dönüştüren bir orkestrasyon katmanı YOKTUR"). Bu dosyadan
// itibaren orchestrate/ o köprüyü kurar.
//
// KDP notu: bu dosyadaki tipler/fonksiyonlar bizzat bir mühendislik sabiti
// DEĞİLDİR — resolveSourceCitations() SADECE registry'de ZATEN kayıtlı
// katsayıların KENDİ source.citation alanını okur, yeni bir sayı/kaynak
// UYDURMAZ.

import { getCoefficient } from "../registry";
import type { ConfidenceLevel } from "../registry/types";
import type { MechanismConfidence } from "../types/enums";
import type { RiskLevel } from "../corrosion/types";
import type { MetalLossResult } from "../aggregate/metalLoss";
import type { MechanismResult, SpatialDamageField } from "../types/results";

/**
 * registry'nin 4-seviyeli ConfidenceLevel'ını (HIGH/MEDIUM/LOW/UNVERIFIED)
 * MechanismResult'ın 3-seviyeli MechanismConfidence'ına (HIGH/MEDIUM/LOW)
 * eşler — types/enums.ts'in kendi notuyla TUTARLI (UNVERIFIED kavramı
 * MechanismResult seviyesinde YOKTUR, ayrı bir izleme mekanizması —
 * AssessmentResult.unverifiedCoefficientsUsed — üstlenir). Bilgi KAYBOLMAZ:
 * UNVERIFIED katsayılar zaten getCoefficient() çağrıldığında konsola uyarı
 * basar (registry/store.ts) — burada yalnızca en düşük geçerlilik-uyumu
 * seviyesine, LOW'a düşürülür.
 */
export function toMechanismConfidence(level: ConfidenceLevel): MechanismConfidence {
  return level === "UNVERIFIED" ? "LOW" : level;
}

/**
 * Bir dizi registry katsayı kimliğini, o katsayıların KENDİ kayıtlı
 * source.citation metnine çevirir (yinelenenler elenir) — MechanismResult.
 * sourceRefs alanının beklediği "tam atıf" biçimini üretir. Hiçbir yeni
 * kaynak UYDURMAZ, yalnızca registry/coefficients/*.ts'te ZATEN kayıtlı
 * atıfları okur.
 */
export function resolveSourceCitations(coefficientIds: string[]): string[] {
  const citations = coefficientIds.map((id) => getCoefficient(id).source.citation);
  return [...new Set(citations)];
}

/**
 * mm/yıl'a çevrilemeyen (yalnızca 0-100 risk skoruyla ifade edilebilen —
 * bkz. corrosion/types.ts::RiskScoreResult) bir mekanizmanın değerlendirme
 * sonucu. SpatialDamageField'a KATILMAZ: KDP'nin "uydurma yok" ilkesi,
 * sayısal olmayan bir riski ısı haritasına zorlamayı da kapsar — bu bulgular
 * yalnızca sonuç panelinde/raporda NİTEL olarak gösterilir.
 */
export interface QualitativeRiskFinding {
  mechanismId: string;
  nameTr: string;
  isMechanismActive: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  rationaleTr: string;
  sourceRefs: string[];
  confidence: MechanismConfidence;
}

/** Tek bir işletme senaryosu (OperatingCase) için tam değerlendirme. */
export interface CaseAssessment {
  caseName: string;
  /** Sayısal mm/yıl hızı olan, ısı haritasına katılan mekanizma sonuçları (isApplicable=false olanlar DAHİL — şeffaflık için "değerlendirildi ama geçerli değil" bilgisi korunur) */
  mechanismResults: MechanismResult[];
  /** Yalnızca risk skoru üreten, ısı haritasına KATILMAYAN mekanizma bulguları */
  qualitativeRiskFindings: QualitativeRiskFinding[];
  /** Tasarım ömrünün TAMAMI kadar (elapsedYears=designLifeYears) biriktirilmiş uzamsal hasar alanı */
  spatialDamageFieldFullLife: SpatialDamageField;
  /** Veri eksikliği nedeniyle DEĞERLENDİRİLEMEYEN/atlanmış mekanizmalar veya yapılan basitleştirici varsayımlar — asla sessizce atlanmaz */
  assumptionsTr: string[];
}

/** Bir bileşenin TÜM işletme senaryoları (OperatingProfile) üzerinden birleşik değerlendirmesi. */
export interface ScenarioAssessment {
  componentLabel: string;
  perCase: CaseAssessment[];
  metalLoss: MetalLossResult;
  /** En büyük yıllık katkıyı yapan (P50 bazında) senaryo adı — bkz. aggregate/metalLoss.ts */
  governingCaseName: string;
}
