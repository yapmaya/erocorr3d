// packages/engine/src/spatial/flowFieldLite.ts
//
// "CFD-lite" yerel hız çarpanı alanı: gerçek bir CFD çözümü YAPMADAN,
// potansiyel akış + ampirik korelasyonlarla yaklaşık bir yerel hız
// ÇARPANI (yerel hız / ortalama karışım hızı) alanı üretir. Bu alan,
// pipeFittings.ts'in TEMEL (baseline, hız-bağımsız) hasar şeklini
// erozyon~hız^n ilişkisiyle YENİDEN ŞEKİLLENDİRMEK için kullanılır —
// applyVelocityScaling() bunu yapar ve sonucu YENİDEN normalize eder
// (kütle korunumu korunur — ölçekleme yalnızca ŞEKLİ değiştirir, toplam
// hacmi DEĞİL; toplam hacim hâlâ DamageField.addContribution'a verilen
// hız×süre tarafından belirlenir).

import { getCoefficient } from "../registry";
import { normalizeShapeFn, type DamageShapeFn } from "./fields";

/** (u,v) → yerel hız çarpanı (yerel hız / ortalama karışım hızı, boyutsuz). */
export type VelocityMultiplierFn = (u: number, v: number) => number;

const EXTRADOS_V = 0;

/**
 * Dirsek/bükmede çevresel yerel hız çarpanı alanı: dış duvarda (extrados,
 * v=0) yüksek, iç duvarda (intrados, v=0,5) düşük çarpan — ikincil akış
 * (Dean vorteksi) rejiminde tepe hızının dış duvara kaymasını yansıtır
 * (bkz. registry notu: YÖN literatürle doğrulandı, BÜYÜKLÜK proje talimatı
 * kaynaklı). v=0↔0,5 arası KOSİNÜS ile yumuşak geçiş (fiziksel bir ara-değer
 * ölçümü YOKTUR, bu oturumun kendi enterpolasyon seçimidir).
 */
export function computeBendVelocityMultiplierField(): VelocityMultiplierFn {
  const { outer, inner } = getCoefficient<{ outer: number; inner: number }>(
    "spatial.flowFieldLite.bendWallMultipliers",
  ).value;
  const mean = (outer + inner) / 2;
  const amplitude = (outer - inner) / 2;
  return (_u, v) => {
    let d = Math.abs(v - EXTRADOS_V) % 1;
    if (d > 0.5) d = 1 - d; // v=0'a dairesel mesafe, [0, 0,5]
    // d=0 (extrados) → +amplitude (outer); d=0,5 (intrados) → -amplitude (inner)
    return mean + amplitude * Math.cos((d / 0.5) * Math.PI);
  };
}

/**
 * Redüksiyon boğazında yerel hız çarpanı: sürekliliğe (continuity, A1V1=A2V2)
 * göre boğazda (D1/D2)² kat artış — bu SAF TANIMSAL fizik, KDP kaynağı
 * gerekmez (bkz. fluids/mixtureProperties.ts'deki aynı gerekçe). Boğazdan
 * önce çarpan 1, boğazda/sonrasında (D1/D2)² — geçiş throatAxialFraction
 * civarında yumuşak (Gauss-benzeri sigmoid) bir basamaktır.
 */
export function computeReducerVelocityMultiplierField(
  upstreamIdM: number,
  downstreamIdM: number,
  throatAxialFraction = 0.15,
  transitionSharpness = 40,
): VelocityMultiplierFn {
  if (upstreamIdM <= 0 || downstreamIdM <= 0) {
    throw new Error("Boru iç çapları pozitif olmalıdır.");
  }
  const throatMultiplier = (upstreamIdM / downstreamIdM) ** 2;
  return (u, _v) => {
    const sigmoid = 1 / (1 + Math.exp(-transitionSharpness * (u - throatAxialFraction)));
    return 1 + (throatMultiplier - 1) * sigmoid;
  };
}

/**
 * Bir vana vena contracta'sındaki (yerel daralma noktası) hız çarpanı —
 * süreklilik + daralma katsayısı Cc: V_vc/V_ort ≈ 1/(açıklıkOranı×Cc).
 * Cc kaynağı: registry (0,61, MEDIUM — bkz. registry notu).
 *
 * Bu, tam bir ALAN değil, TEK BİR SKALER çarpandır (vena contracta,
 * geometriye göre değişen tek bir nokta/dar-kesittir, ayrı bir (u,v) alanı
 * OLUŞTURMAK yerine pipeFittings.ts imzalarının merkez şiddetini ölçeklemek
 * için doğrudan kullanılabilir).
 */
export function computeVenaContractaVelocityMultiplier(openingFraction: number): number {
  if (openingFraction <= 0 || openingFraction > 1) {
    throw new Error("openingFraction (0,1] aralığında olmalıdır.");
  }
  const contractionCoefficient = getCoefficient<number>(
    "spatial.flowFieldLite.venaContractaContractionCoefficient",
  ).value;
  return 1 / (openingFraction * contractionCoefficient);
}

/**
 * Bir TEMEL (hız-bağımsız) hasar şeklini, yerel hız çarpanı alanıyla
 * erozyon~hız^n ilişkisi üzerinden YENİDEN ŞEKİLLENDİRİR ve sonucu tekrar
 * normalize eder (∫∫≈1 KORUNUR — yalnızca dağılımın ŞEKLİ değişir).
 *
 * @param exponentN Hız üssü — ÇAĞIRAN TARAF, kullandığı erozyon modelinin
 * (ör. DNV-RP-O501 malzeme tablosundaki n, bkz. erosion/dnvO501.ts) KENDİ
 * n değerini vermelidir; burada sessiz bir varsayılan YOKTUR (yanlış bir
 * malzemeyi temsil eden gizli bir sayı kullanmamak için).
 */
export function applyVelocityScaling(
  baseShapeFn: DamageShapeFn,
  velocityMultiplierFn: VelocityMultiplierFn,
  exponentN: number,
): DamageShapeFn {
  if (exponentN <= 0) {
    throw new Error("exponentN pozitif olmalıdır.");
  }
  return normalizeShapeFn((u, v) => baseShapeFn(u, v) * velocityMultiplierFn(u, v) ** exponentN);
}
