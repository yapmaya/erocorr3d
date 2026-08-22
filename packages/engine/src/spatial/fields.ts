// packages/engine/src/spatial/fields.ts
//
// spatial/ modülünün çekirdek altyapısı: (u,v) parametrik yüzey ızgarası,
// alan biriktirme (kütle korunumlu), tepe/hotspot çıkarma, saat pozisyonu
// etiketleme ve zaman entegrasyonu.
//
// TEMEL MODEL (proje talimatından):
//   damage(u,v) = Σ_mekanizma [ hız_m × süre × f_m(u,v) ]
//   u = eksenel koordinat (0-1), v = çevresel koordinat (0-1 → 0-360°)
//   ∫∫ f_m(u,v) du dv ≈ 1  (KÜTLE KORUNUMU — dağılımın şekli değişse de
//   toplam metal kaybı SADECE hız×süre'ye bağlı kalır, f_m'in seçtiği ŞEKLE
//   değil).
//
// KDP notu: bu dosyadaki tüm fonksiyonlar (Riemann integrasyonu, Gauss
// çekirdekleri, dairesel segment (wetted arc) çözümü, saat pozisyonu
// dönüşümü) SAF MATEMATİK/geometri düzeyindedir — KDP'nin "harici kaynaktan
// doğrula" kuralı MÜHENDİSLİK katsayıları içindir, evrensel matematiksel
// yöntemler için değildir (bkz. uncertainty/monteCarlo.ts'teki aynı gerekçe).
// Her SPESİFİK hasar imzasının (pipeFittings.ts, valves.ts) kullandığı
// YAYILMA GENİŞLİKLERİ (sigma değerleri) ise bu modülün DEĞİL,
// registry/coefficients/spatial.ts'in sorumluluğundadır.

import type { Hotspot, SpatialDamageField } from "../types/results";
import type { SpatialParameterization } from "../types/enums";

/**
 * Normalize edilmiş bir hasar yoğunluk fonksiyonu: f(u,v), u∈[0,1) eksenel,
 * v∈[0,1) çevresel (v=0≡saat12, v=0,25≡saat3, v=0,5≡saat6, v=0,75≡saat9).
 * ∫∫ f dudv ≈ 1 olması BEKLENİR (bkz. normalizeShapeFn).
 */
export type DamageShapeFn = (u: number, v: number) => number;

// ─────────────────────────────────────────────────────────────────────────
// Sayısal integrasyon ve normalizasyon
// ─────────────────────────────────────────────────────────────────────────

/**
 * Birim kare [0,1)×[0,1) üzerinde f(u,v)'nin çift-integralini orta-nokta
 * Riemann toplamıyla sayısal olarak hesaplar.
 *
 * Bu, HER hasar imzasının kütle-korunum testinde ("∫∫ f dudv ≈ 1")
 * kullanılan BAĞIMSIZ doğrulama aracıdır — imza fonksiyonlarının kendisi
 * normalizeShapeFn ile (farklı bir çözünürlükte) normalize edildiği için,
 * testin BU fonksiyonu farklı bir çözünürlükte çağırması gerçek bir çapraz
 * doğrulamadır (yalnızca "kendi kendini test etme" değildir).
 */
export function integrateOverUnitSquare(f: DamageShapeFn, resolution = 400): number {
  if (resolution < 1 || !Number.isInteger(resolution)) {
    throw new Error("resolution pozitif bir tam sayı olmalıdır.");
  }
  const step = 1 / resolution;
  let sum = 0;
  for (let iu = 0; iu < resolution; iu++) {
    const u = (iu + 0.5) * step;
    for (let iv = 0; iv < resolution; iv++) {
      const v = (iv + 0.5) * step;
      sum += f(u, v);
    }
  }
  return sum * step * step;
}

/**
 * Ham (normalize edilmemiş) bir şekil fonksiyonunu, ∫∫ dudv=1 olacak şekilde
 * SAYISAL OLARAK normalize eder. Bu proje, her imza için ayrı bir analitik
 * normalizasyon sabiti (ör. kırpılmış/dairesel Gauss için erf tabanlı)
 * türetmek yerine BU jenerik yaklaşımı seçti — analitik erf yaklaşıklığına
 * bağımlı olmadan, HERHANGİ bir şekil fonksiyonu (çok-modlu, düzensiz/
 * tohumlu-rastgele desenler dahil) için doğru sonuç verir.
 *
 * @param integrationResolution Normalizasyon sabitini hesaplarken kullanılan
 * çözünürlük — nihai render çözünürlüğünden BAĞIMSIZDIR (bkz. modül testleri:
 * "ızgara bağımsızlığı").
 */
export function normalizeShapeFn(rawFn: DamageShapeFn, integrationResolution = 400): DamageShapeFn {
  const integral = integrateOverUnitSquare(rawFn, integrationResolution);
  if (!Number.isFinite(integral) || integral <= 0) {
    throw new Error("Şekil fonksiyonunun integrali pozitif ve sonlu olmalıdır (normalize edilemiyor).");
  }
  return (u, v) => rawFn(u, v) / integral;
}

// ─────────────────────────────────────────────────────────────────────────
// Çekirdek (kernel) yardımcıları — imza dosyalarının paylaştığı temel şekiller
// ─────────────────────────────────────────────────────────────────────────

/**
 * v ekseninde DAİRESEL (periyodik, v=0≡v=1 — tam tur) normalize edilmemiş
 * Gauss çekirdeği. En kısa dairesel mesafe kullanılır (ör. v=0,05 ile
 * v=0,95 arası mesafe 0,1 değil 0,1'dir — sarma/wrap-around).
 */
export function circularGaussianKernel(v: number, centerV: number, sigmaV: number): number {
  if (sigmaV <= 0) throw new Error("sigmaV pozitif olmalıdır.");
  let d = Math.abs(v - centerV) % 1;
  if (d > 0.5) d = 1 - d;
  return Math.exp(-0.5 * (d / sigmaV) ** 2);
}

/**
 * u ekseninde SINIRLI (periyodik OLMAYAN, [0,1) aralığında kırpılan) normalize
 * edilmemiş Gauss çekirdeği.
 */
export function linearGaussianKernel(u: number, centerU: number, sigmaU: number): number {
  if (sigmaU <= 0) throw new Error("sigmaU pozitif olmalıdır.");
  return Math.exp(-0.5 * ((u - centerU) / sigmaU) ** 2);
}

/** Sabit (uniform) çekirdek — her (u,v) için 1 döndürür (normalizasyon sonrası tüm alana eşit dağılır). */
export function uniformKernel(): number {
  return 1;
}

/**
 * Bir "halka" (ring) şekli: eksenel (u) yönünde dar bir Gauss, çevresel (v)
 * yönünde TAMAMEN üniform — kaynak dikişi, orifis mansabı, redüksiyon boğazı
 * gibi eksenel-simetrik (tüm çevre boyunca aynı şiddette) hasar imzaları için.
 */
export function axialRingShape(centerU: number, sigmaU: number): DamageShapeFn {
  return (u, _v) => linearGaussianKernel(u, centerU, sigmaU);
}

/**
 * Dairesel kesit (circular segment) alan oranından, segmentin tam açısını
 * (φ, radyan) Newton-Raphson ile çözer: (φ-sinφ)/(2π) = areaFraction.
 *
 * Kullanım: yatay stratifiye akışta sıvı tutulum oranından (holdup), sıvının
 * kapladığı ISLAK (wetted) alt yayın açısal genişliğini bulmak için (bkz.
 * pipeFittings.ts::buildBlcStratifiedShape). Saf geometri — KDP kapsamı
 * dışıdır (ders kitabı düzeyinde dairesel segment formülü).
 *
 * Kendi kendini doğrulayan sınır durumu: areaFraction=0,5 → φ=π TAM OLARAK
 * (çap boyunca kesilen yarım daire) — bkz. modül testi.
 */
export function solveCircularSegmentAngleRad(areaFraction: number): number {
  if (areaFraction < 0 || areaFraction > 1) {
    throw new Error("areaFraction [0,1] aralığında olmalıdır.");
  }
  if (areaFraction === 0) return 0;
  if (areaFraction === 1) return 2 * Math.PI;

  const target = 2 * Math.PI * areaFraction;
  let phi = target; // makul başlangıç tahmini
  for (let i = 0; i < 50; i++) {
    const f = phi - Math.sin(phi) - target;
    const fPrime = 1 - Math.cos(phi);
    if (Math.abs(fPrime) < 1e-12) break;
    const next = phi - f / fPrime;
    if (Math.abs(next - phi) < 1e-12) {
      phi = next;
      break;
    }
    phi = Math.min(2 * Math.PI, Math.max(0, next));
  }
  return phi;
}

// ─────────────────────────────────────────────────────────────────────────
// Saat pozisyonu etiketleme
// ─────────────────────────────────────────────────────────────────────────

/**
 * v∈[0,1) koordinatını saat pozisyonuna çevirir: v=0→12, v=0,25→3, v=0,5→6, v=0,75→9.
 *
 * types/results.ts::HotspotSchema/maxLocation'ın `clockPosition` alanı KAPALI [1,12] aralığında
 * ZORUNLUDUR (Zod: min(1).max(12)) — v∈[0, 1/12) alt-aralığı (saat 12'ye "henüz saat 1'e
 * varmamış, hemen sonrası" konumlar) BU YÜZDEN 12'DE SABİTLENİR (doğrusal olarak 0'a doğru
 * İNMEZ) — gerçek bir saat kadranında da 12 ile 1 arasında kesirli bir "0,2" pozisyonu YOKTUR,
 * "henüz 1'e gelmemiş" konum hâlâ "12" olarak adlandırılır.
 */
export function vToClockPosition(v: number): number {
  const wrapped = ((v % 1) + 1) % 1;
  const raw = wrapped * 12;
  return raw < 1 ? 12 : raw;
}

/** Saat pozisyonunu (1-12) Türkçe bir konum ifadesine çevirir (ör. "saat 6 (alt)"). */
export function describeClockPositionTr(clockPosition: number): string {
  const rounded = Math.round(clockPosition * 10) / 10;
  if (Math.abs(rounded - 12) < 0.05) return "saat 12 (üst)";
  if (Math.abs(rounded - 6) < 0.05) return "saat 6 (alt)";
  if (Math.abs(rounded - 3) < 0.05) return "saat 3";
  if (Math.abs(rounded - 9) < 0.05) return "saat 9";
  return `saat ${rounded}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Ampirik yüzdelik (percentile) — ızgara değerleri üzerinde
// ─────────────────────────────────────────────────────────────────────────

function computeGridPercentile(sortedValues: Float32Array, percentile: number): number {
  const n = sortedValues.length;
  if (n === 0) throw new Error("Boş ızgara için yüzdelik hesaplanamaz.");
  if (n === 1) return sortedValues[0];
  const rank = (percentile / 100) * (n - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const fraction = rank - lowerIndex;
  return sortedValues[lowerIndex] + fraction * (sortedValues[upperIndex] - sortedValues[lowerIndex]);
}

// ─────────────────────────────────────────────────────────────────────────
// DamageField
// ─────────────────────────────────────────────────────────────────────────

export interface DamageFieldPeak {
  u: number;
  v: number;
  valueMm: number;
  iu: number;
  iv: number;
}

/** Bir mekanizmanın alana katkısı: normalize şekil × hız × süre. */
export interface DamageContribution {
  mechanismId: string;
  shapeFn: DamageShapeFn;
  rateMmPerYear: number;
}

/**
 * Bir bileşen yüzeyi üzerindeki (u,v) hasar ızgarası. Değerler mm (metal
 * kaybı) cinsindendir. Izgara SATIR-ÖNCELİKLİ (row-major) saklanır; bu
 * MODÜLÜN KENDİ sözleşimi olarak satırlar V (çevresel), sütunlar U
 * (eksenel) eksenini temsil eder: index(iu,iv) = iv×resolutionU + iu
 * (bkz. types/results.ts::SpatialDamageFieldSchema — şema yalnızca
 * "satır-öncelikli" der, hangi eksenin satır olduğunu belirtmez; bu proje
 * BURADA sabitler).
 */
export class DamageField {
  readonly resolutionU: number;
  readonly resolutionV: number;
  readonly parameterization: SpatialParameterization;
  readonly valuesMm: Float32Array;

  constructor(resolutionU: number, resolutionV: number, parameterization: SpatialParameterization) {
    if (resolutionU < 1 || !Number.isInteger(resolutionU) || resolutionV < 1 || !Number.isInteger(resolutionV)) {
      throw new Error("resolutionU ve resolutionV pozitif tam sayılar olmalıdır.");
    }
    this.resolutionU = resolutionU;
    this.resolutionV = resolutionV;
    this.parameterization = parameterization;
    this.valuesMm = new Float32Array(resolutionU * resolutionV);
  }

  private index(iu: number, iv: number): number {
    return iv * this.resolutionU + iu;
  }

  /** Hücre (iu,iv)'nin merkez (u,v) koordinatı — orta-nokta örnekleme (Riemann kuralıyla tutarlı). */
  cellCenter(iu: number, iv: number): { u: number; v: number } {
    return { u: (iu + 0.5) / this.resolutionU, v: (iv + 0.5) / this.resolutionV };
  }

  getValueMm(iu: number, iv: number): number {
    return this.valuesMm[this.index(iu, iv)];
  }

  /**
   * Tek bir mekanizmanın katkısını alana EKLER (biriktirir):
   * her hücreye shapeFn(u,v)×rateMmPerYear×elapsedYears eklenir.
   *
   * Kütle korunumu: shapeFn ∫∫≈1 olduğu SÜRECE, bu çağrının alana kattığı
   * TOPLAM hacim (ızgara ortalaması) ≈ rateMmPerYear×elapsedYears olur —
   * shapeFn'in ŞEKLİ (Gauss/üniform/çok-modlu) bu toplamı DEĞİŞTİRMEZ.
   */
  addContribution(shapeFn: DamageShapeFn, rateMmPerYear: number, elapsedYears: number): void {
    if (rateMmPerYear < 0) throw new Error("rateMmPerYear negatif olamaz.");
    if (elapsedYears < 0) throw new Error("elapsedYears negatif olamaz.");
    const totalMm = rateMmPerYear * elapsedYears;
    if (totalMm === 0) return;
    for (let iv = 0; iv < this.resolutionV; iv++) {
      for (let iu = 0; iu < this.resolutionU; iu++) {
        const { u, v } = this.cellCenter(iu, iv);
        this.valuesMm[this.index(iu, iv)] += shapeFn(u, v) * totalMm;
      }
    }
  }

  /** Birden fazla mekanizma katkısını sırayla biriktirir — "zaman entegrasyonu: t yılındaki birikmiş hasar". */
  accumulate(contributions: DamageContribution[], elapsedYears: number): void {
    for (const contribution of contributions) {
      this.addContribution(contribution.shapeFn, contribution.rateMmPerYear, elapsedYears);
    }
  }

  /** Izgara üzerindeki ortalama değer — kütle korunumu testinin doğrudan girdisi (bkz. addContribution notu). */
  computeMeanValueMm(): number {
    let sum = 0;
    for (let i = 0; i < this.valuesMm.length; i++) sum += this.valuesMm[i];
    return sum / this.valuesMm.length;
  }

  computeValuePercentile(percentile: number): number {
    const sorted = Float32Array.from(this.valuesMm).sort();
    return computeGridPercentile(sorted, percentile);
  }

  findPeak(): DamageFieldPeak {
    let maxValue = -Infinity;
    let maxIu = 0;
    let maxIv = 0;
    for (let iv = 0; iv < this.resolutionV; iv++) {
      for (let iu = 0; iu < this.resolutionU; iu++) {
        const value = this.getValueMm(iu, iv);
        if (value > maxValue) {
          maxValue = value;
          maxIu = iu;
          maxIv = iv;
        }
      }
    }
    const { u, v } = this.cellCenter(maxIu, maxIv);
    return { u, v, valueMm: maxValue, iu: maxIu, iv: maxIv };
  }

  /**
   * Belirgin yerel hasar noktalarını (hotspot) çıkarır: değeri global
   * tepenin en az `minValueFractionOfPeak`'i olan, ızgarada yerel maksimum
   * olan (8-komşuluk) hücreler, değere göre azalan sırada, en fazla
   * `maxCount` tanesi.
   */
  extractHotspots(maxCount = 5, minValueFractionOfPeak = 0.3): Hotspot[] {
    const peak = this.findPeak();
    if (peak.valueMm <= 0) return [];
    const threshold = peak.valueMm * minValueFractionOfPeak;

    const candidates: DamageFieldPeak[] = [];
    for (let iv = 0; iv < this.resolutionV; iv++) {
      for (let iu = 0; iu < this.resolutionU; iu++) {
        const value = this.getValueMm(iu, iv);
        if (value < threshold) continue;
        let isLocalMax = true;
        for (let dv = -1; dv <= 1 && isLocalMax; dv++) {
          for (let du = -1; du <= 1; du++) {
            if (du === 0 && dv === 0) continue;
            const niu = iu + du;
            let niv = iv + dv;
            if (niu < 0 || niu >= this.resolutionU) continue; // u periyodik değil
            niv = ((niv % this.resolutionV) + this.resolutionV) % this.resolutionV; // v periyodik
            if (this.getValueMm(niu, niv) > value) {
              isLocalMax = false;
              break;
            }
          }
        }
        if (isLocalMax) {
          const { u, v } = this.cellCenter(iu, iv);
          candidates.push({ u, v, valueMm: value, iu, iv });
        }
      }
    }

    candidates.sort((a, b) => b.valueMm - a.valueMm);
    return candidates.slice(0, maxCount).map((c) => {
      const clockPosition = vToClockPosition(c.v);
      return {
        u: c.u,
        v: c.v,
        valueMm: c.valueMm,
        clockPosition,
        descriptionTr: `Eksenel konum u=${c.u.toFixed(2)}, ${describeClockPositionTr(clockPosition)}`,
      };
    });
  }

  /** Zod ile şemalanmış nihai SpatialDamageField'ı üretir (types/results.ts). */
  toSpatialDamageField(maxCount = 5, minValueFractionOfPeak = 0.3): SpatialDamageField {
    const peak = this.findPeak();
    const clockPosition = vToClockPosition(peak.v);
    return {
      parameterization: this.parameterization,
      resolutionU: this.resolutionU,
      resolutionV: this.resolutionV,
      // TS'in yerleşik Float32Array<TArrayBuffer> jenerik parametresi ile Zod'un z.instanceof(Float32Array)
      // çıkarımı arasındaki (davranışsal olarak ÖNEMSİZ) buffer-tipi uyuşmazlığını gidermek için tip
      // ataması — çalışma zamanında hâlâ gerçek bir Float32Array'dir, Zod şeması bunu doğrular.
      valuesMm: this.valuesMm as SpatialDamageField["valuesMm"],
      maxValueMm: peak.valueMm,
      maxLocation: {
        u: peak.u,
        v: peak.v,
        descriptionTr: `Eksenel konum u=${peak.u.toFixed(2)}, ${describeClockPositionTr(clockPosition)}`,
        clockPosition,
      },
      hotspots: this.extractHotspots(maxCount, minValueFractionOfPeak),
    };
  }
}
