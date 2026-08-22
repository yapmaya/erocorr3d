// packages/engine/src/spatial/pipeFittings.ts
//
// Boru/fitting hasar İMZALARI: her fonksiyon, o bileşen/mekanizma
// kombinasyonu için NORMALİZE edilmiş (∫∫≈1) bir DamageShapeFn üretir.
// fields.ts'in DamageField.addContribution'ı bu şekli hız×süre ile
// ölçekleyip biriktirir (kütle korunumu bu ayrımdan gelir — şekil
// fonksiyonları ASLA mutlak büyüklük taşımaz, yalnızca DAĞILIM).
//
// Her imzanın hangi fiziksel mekanizmayı temsil ettiği ve kaynak durumu
// (sourced/UNVERIFIED) kendi JSDoc'unda belgelenir; sayısal yayılma
// genişlikleri registry/coefficients/spatial.ts'ten gelir (KDP kaydı,
// çoğunlukla UNVERIFIED — bkz. o dosyanın başlık notu).

import { getCoefficient } from "../registry";
import { computeBendPeakAngleDeg } from "../erosion/dnvO501";
import { clockPositionToRadians, tlcAngularProfile } from "../corrosion/tlc";
import { createSeededRng } from "../uncertainty/monteCarlo";
import {
  axialRingShape,
  circularGaussianKernel,
  linearGaussianKernel,
  normalizeShapeFn,
  solveCircularSegmentAngleRad,
  uniformKernel,
  type DamageShapeFn,
} from "./fields";

export type PipeFittingSignatureId =
  | "BLC_STRATIFIED"
  | "TLC_CONDENSATION"
  | "UNIFORM_FULL_BORE"
  | "ELBOW_EXTRADOS_IMPINGEMENT"
  | "BEND_INTRADOS_SECONDARY"
  | "TEE_BLIND_IMPACT"
  | "TEE_BRANCH_SHARP_EDGE"
  | "REDUCER_THROAT_DOWNSTREAM"
  | "WELD_ROOT_TURBULENCE"
  | "DEADLEG_STAGNANT"
  | "ORIFICE_DOWNSTREAM_JET"
  | "MIC_BOTTOM_PATCHY"
  | "UDC_SEDIMENT_BED"
  | "CUI_EXTERNAL_BANDS";

const EXTRADOS_V = 0; // proje sözleşmesi: v=0 ≡ dış yarıçap (extrados) — bkz. modül başlığı
const INTRADOS_V = 0.5; // v=0,5 ≡ iç yarıçap (intrados), extrados'un tam karşısı
const BOTTOM_V = 0.5; // v=0,5 ≡ saat 6 (alt) — dairesel v sözleşmesinde extrados/intrados ile AYNI 0,5 değeri
// kullanılıyor olması kasıtlıdır: her ikisi de "kesitin karşı ucu" anlamına gelir, bağlam (bend vs. yatay
// boru) hangi fiziksel yorumun geçerli olduğunu belirler.

// ─────────────────────────────────────────────────────────────────────────
// 1) BLC_STRATIFIED — dip korozyonu, yatay boru
// ─────────────────────────────────────────────────────────────────────────

export interface BlcStratifiedInput {
  /** Sıvı tutulum oranı (0-1) — fluids/flowRegime.ts::computeBeggsBrillHoldup çıktısı tipik girdidir. */
  liquidHoldupFraction: number;
}

/**
 * Alt hat korozyonu (bottom-of-line, BLC) — yatay/hafif eğimli borularda
 * dipte biriken serbest suyun oluşturduğu tabaka korozyonu.
 *
 * Şekil: saat 6'da (v=0,5) dairesel Gauss tepe; YAYILIM GENİŞLİĞİ sıvı
 * tutulumundan (holdup) TÜRETİLİR (sabit bir sayı DEĞİL) — dairesel kesit
 * (circular segment) formülüyle holdup'tan ıslak yayın açısal genişliği
 * çözülür (bkz. fields.ts::solveCircularSegmentAngleRad, saf geometri),
 * sonra bu yarı-genişlik bir Gauss σ'sına çevrilir (3-sigma kuralı, bkz.
 * spatial.gaussianEnvelope.arcHalfWidthSigmaDivisor). Eksenel (u) yönde
 * ÜNİFORM (düz boruda özel bir eksenel konum yoktur).
 */
export function buildBlcStratifiedShape(input: BlcStratifiedInput): DamageShapeFn {
  if (input.liquidHoldupFraction <= 0 || input.liquidHoldupFraction >= 1) {
    throw new Error("liquidHoldupFraction (0,1) açık aralığında olmalıdır.");
  }
  const phiRad = solveCircularSegmentAngleRad(input.liquidHoldupFraction);
  const halfWidthVFraction = phiRad / 2 / (2 * Math.PI); // yarı-yay açısı → v-birimine (tam tur=1) çevrim
  const sigmaDivisor = getCoefficient<number>("spatial.gaussianEnvelope.arcHalfWidthSigmaDivisor").value;
  const sigmaV = Math.max(halfWidthVFraction / sigmaDivisor, 1e-3);

  return normalizeShapeFn((_u, v) => circularGaussianKernel(v, BOTTOM_V, sigmaV) * uniformKernel());
}

// ─────────────────────────────────────────────────────────────────────────
// 2) TLC_CONDENSATION — üst hat korozyonu
// ─────────────────────────────────────────────────────────────────────────

export interface TlcCondensationInput {
  /** Eksenel tepe konumu (0-1) — bilinmiyorsa registry varsayılanı (0,35) kullanılır. */
  peakAxialFraction?: number;
  axialSigmaFraction?: number;
}

/**
 * Üst hat korozyonu (top-of-line, TLC) — çevresel profil
 * corrosion/tlc.ts::tlcAngularProfile'ı (zaten KDP-kayıtlı, UNVERIFIED
 * "proje türetimi") YENİDEN KULLANIR, İKİNCİ bir formül İCAT ETMEZ.
 *
 * ⚠ Görev talimatı "saat 3-9'da SIFIR" der; corrosion/tlc.ts'in ZATEN
 * kayıtlı (1+cosθ)/2 formülü saat 3/9'da 0,5 (yarı-şiddet) verir, TAM sıfır
 * yalnızca saat 6'dadır. Bu proje, aynı fiziksel olgu için İKİNCİ, tutarsız
 * bir formül üretmek yerine (a) zaten registry'de olan tek-doğru-kaynağı
 * korumayı, (b) görev metnindeki "3-9 sıfır" ifadesini bu daha yumuşak
 * eğrinin İDEALİZE bir sözel tarifi olarak yorumlamayı tercih etti.
 *
 * Eksenel "çan eğrisi": girişten sonra soğuma ile artan, yoğuşma bitince
 * azalan bir Gauss — tepe konumu/genişliği registry'den (UNVERIFIED,
 * gerçek termal profil olmadığı için bu oturumun makul varsayılanı).
 */
export function buildTlcCondensationShape(input: TlcCondensationInput = {}): DamageShapeFn {
  const defaults = getCoefficient<{ peakAxialFraction: number; sigmaFraction: number }>(
    "spatial.tlcCondensation.axialProfile",
  ).value;
  const peakAxialFraction = input.peakAxialFraction ?? defaults.peakAxialFraction;
  const axialSigma = input.axialSigmaFraction ?? defaults.sigmaFraction;

  return normalizeShapeFn((u, v) => {
    const thetaRad = 2 * Math.PI * v; // v=0→θ=0 (saat12), v=0,5→θ=π (saat6) — tlcAngularProfile'ın kendi sözleşimiyle aynı
    return tlcAngularProfile(thetaRad) * linearGaussianKernel(u, peakAxialFraction, axialSigma);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3) UNIFORM_FULL_BORE — tam ıslak, tek faz sıvı
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tam ıslak, durgun olmayan tek fazlı sıvı akışı — hasar tüm yüzeye
 * ÜNİFORM dağılır (özel bir konum tercihi yok). Tanımsal (∫∫1 dudv=1 birim
 * kare üzerinde TAM olarak 1'dir) — normalizasyona bile gerek yok ama
 * tutarlılık için aynı yardımcı üzerinden geçirilir.
 */
export function buildUniformFullBoreShape(): DamageShapeFn {
  return normalizeShapeFn(() => uniformKernel());
}

// ─────────────────────────────────────────────────────────────────────────
// 4) ELBOW_EXTRADOS_IMPINGEMENT — dirsek dış yarıçap
// ─────────────────────────────────────────────────────────────────────────

export interface ElbowExtradosImpingementInput {
  bendRadiusRatio: number;
  bendSweepAngleDeg?: number;
  /** Parçacık çapı (m) — verilirse, tepe konumu girişe doğru kayar (atalet etkisi). */
  particleDiameterM?: number;
  /** Boru iç çapı (m) — particleDiameterM ile birlikte göreli parçacık boyutu (dp/D) için gerekir. */
  pipeIdM?: number;
}

/**
 * Dirsek dış yarıçap (extrados) darbe erozyonu — DNV-RP-O501 §8.4'ün
 * ZATEN sourced tepe açısı formülünü (erosion/dnvO501.ts::computeBendPeakAngleDeg,
 * α=atan(1/(2×R/D))) YENİDEN KULLANIR (ayrı bir kopya formül YOKTUR).
 *
 * Tepe konumu SABİT DEĞİLDİR: eksenel (u) konum R/D'ye (DNV, sourced) VE
 * göreli parçacık çapına (dp/D, bu oturumun eklediği — bkz.
 * spatial.elbowInertiaShift.parameters notu: YÖN literatürle doğrulandı,
 * BÜYÜKLÜK bu oturumun mütevazı tahmini) bağlıdır — büyük parçacık tepeyi
 * girişe (daha küçük u) kaydırır.
 *
 * Çevresel (v): extrados'ta (v=0) DAR bant.
 */
export function buildElbowExtradosImpingementShape(input: ElbowExtradosImpingementInput): DamageShapeFn {
  const sweepDeg = input.bendSweepAngleDeg ?? 90;
  const alphaDeg = computeBendPeakAngleDeg(input.bendRadiusRatio);
  let axialFraction = Math.min(1, alphaDeg / sweepDeg);

  if (input.particleDiameterM !== undefined && input.pipeIdM) {
    const { maxShiftFraction, referenceRelativeDiameter } = getCoefficient<{
      maxShiftFraction: number;
      referenceRelativeDiameter: number;
    }>("spatial.elbowInertiaShift.parameters").value;
    const relativeDiameter = input.particleDiameterM / input.pipeIdM;
    const shiftIntensity = Math.min(1, relativeDiameter / referenceRelativeDiameter);
    axialFraction = axialFraction * (1 - maxShiftFraction * shiftIntensity);
  }

  const sigmaV = getCoefficient<number>("spatial.circumferential.narrowBandSigma").value;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;

  return normalizeShapeFn(
    (u, v) => linearGaussianKernel(u, axialFraction, sigmaU) * circularGaussianKernel(v, EXTRADOS_V, sigmaV),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5) BEND_INTRADOS_SECONDARY — Dean vorteksleri, zayıf ikincil bölge
// ─────────────────────────────────────────────────────────────────────────

export interface BendIntradosSecondaryInput {
  bendRadiusRatio: number;
  bendSweepAngleDeg?: number;
}

/**
 * Dirsek iç yarıçap (intrados) — Dean vorteksi kaynaklı ZAYIF ikincil
 * erozyon bölgesi. VARLIĞI iki bağımsız kaynakla doğrulandı, göreli şiddeti
 * (extrados tepesine oranla) bu oturumun muhafazakâr tahminidir — bkz.
 * spatial.bendIntradosSecondary.relativeSeverityFraction notu.
 *
 * Bu fonksiyon TEK BAŞINA normalize edilmiş bir şekildir (kendi ∫∫=1) —
 * çağıran taraf bunu extrados şekliyle KENDİ oranlarında (relativeSeverityFraction
 * ağırlıklı) birleştirmek isterse, iki AYRI addContribution çağrısıyla
 * (her biri kendi hızıyla ölçeklenmiş) yapmalıdır; bu fonksiyon kendi
 * göreli ağırlığını İÇSEL olarak uygulamaz (tek bir normalize şekil olma
 * sözleşmesini bozmamak için).
 */
export function buildBendIntradosSecondaryShape(input: BendIntradosSecondaryInput): DamageShapeFn {
  const sweepDeg = input.bendSweepAngleDeg ?? 90;
  const alphaDeg = computeBendPeakAngleDeg(input.bendRadiusRatio);
  // İkincil bölge, Dean vorteksinin gelişmesi için ana darbe noktasından biraz DAHA İLERİDE oluşur.
  const axialFraction = Math.min(1, (alphaDeg / sweepDeg) * 1.4);

  const sigmaV = getCoefficient<number>("spatial.circumferential.wideBandSigma").value;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value * 1.5;

  return normalizeShapeFn(
    (u, v) => linearGaussianKernel(u, axialFraction, sigmaU) * circularGaussianKernel(v, INTRADOS_V, sigmaV),
  );
}

/** BEND_INTRADOS_SECONDARY'nin extrados tepesine göre göreli şiddet ağırlığı (bkz. registry notu). */
export function getBendIntradosSecondaryRelativeSeverity(): number {
  return getCoefficient<number>("spatial.bendIntradosSecondary.relativeSeverityFraction").value;
}

// ─────────────────────────────────────────────────────────────────────────
// 6) TEE_BLIND_IMPACT — kör kolun tabanında yoğun daire
// ─────────────────────────────────────────────────────────────────────────

/**
 * Kör te (blind tee) — akış kör kolun tabanına DOĞRUDAN çarpar (DNV §8.5).
 * erosion/dnvO501.ts::computeBlindTeeErosionRate zaten bu konumu
 * axialPositionFraction=1, angularPositionDeg=null olarak işaretliyor
 * (simetrik/eksenel-simetrik konum) — bu şekil AYNI sözleşimi izler:
 * u=1'de (kör kolun ucu) dar bir eksenel bant, çevresel olarak TAMAMEN
 * üniform ("yoğun daire" — ucu çevreleyen simetrik bir disk, eksenel
 * silindir parametrizasyonunda en yakın temsili budur; gerçek düz uç-kapak
 * geometrisi CUSTOM_MESH gerektirir — bkz. modül başlığı, KASITLI
 * basitleştirme).
 */
export function buildTeeBlindImpactShape(): DamageShapeFn {
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;
  // u=1 sınırında kırpılan tek-taraflı Gauss — normalizeShapeFn bunu (sayısal integrasyonla) doğru ele alır.
  return normalizeShapeFn(axialRingShape(1, sigmaU));
}

// ─────────────────────────────────────────────────────────────────────────
// 7) TEE_BRANCH_SHARP_EDGE — dal ağzı keskin kenarında halka
// ─────────────────────────────────────────────────────────────────────────

export interface TeeBranchSharpEdgeInput {
  /** Dal bağlantısının ana hat üzerindeki eksenel konumu (0-1) — varsayılan 0,5 (orta). */
  branchAxialFraction?: number;
}

/** Dallanma te (branch tee) — dal ağzının keskin kenarında, ana hat çevresinde bir HALKA. */
export function buildTeeBranchSharpEdgeShape(input: TeeBranchSharpEdgeInput = {}): DamageShapeFn {
  const centerU = input.branchAxialFraction ?? 0.5;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;
  return normalizeShapeFn(axialRingShape(centerU, sigmaU));
}

// ─────────────────────────────────────────────────────────────────────────
// 8) REDUCER_THROAT_DOWNSTREAM — boğaz sonrası hızlanma bölgesi
// ─────────────────────────────────────────────────────────────────────────

export interface ReducerThroatDownstreamInput {
  /** Boğazdan hemen sonraki hızlanma bölgesinin eksenel konumu (0-1) — varsayılan 0,15 (redüksiyon başlangıcına yakın). */
  throatAxialFraction?: number;
}

/** Redüksiyon boğazı sonrası hızlanma bölgesi — eksenel halka. */
export function buildReducerThroatDownstreamShape(input: ReducerThroatDownstreamInput = {}): DamageShapeFn {
  const centerU = input.throatAxialFraction ?? 0.15;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;
  return normalizeShapeFn(axialRingShape(centerU, sigmaU));
}

// ─────────────────────────────────────────────────────────────────────────
// 9) WELD_ROOT_TURBULENCE — kaynak dikişi mansabında halka
// ─────────────────────────────────────────────────────────────────────────

export interface WeldRootTurbulenceInput {
  /** Kaynağın eksenel konumu (0-1) — bilinmiyorsa 0,5 (nötr, orta) varsayılır. */
  weldAxialFraction?: number;
}

/** Kaynak dikişi mansabı türbülansı — eksenel halka (bkz. DNV §8.3.2, zaten sourced mekanizma; burada yalnızca ŞEKİL). */
export function buildWeldRootTurbulenceShape(input: WeldRootTurbulenceInput = {}): DamageShapeFn {
  const centerU = input.weldAxialFraction ?? 0.5;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;
  return normalizeShapeFn(axialRingShape(centerU, sigmaU));
}

// ─────────────────────────────────────────────────────────────────────────
// 10) DEADLEG_STAGNANT — ölü bacakta çökelme + MIC
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ölü bacak (dead leg) — durgun uca (u=1) doğru üstel artan çökelme/MIC
 * birikimi, dipte (v=0,5, yerçekimi ile çökelme) hafif ağırlıklı.
 */
export function buildDeadlegStagnantShape(): DamageShapeFn {
  const decayLength = getCoefficient<number>("spatial.deadleg.axialDecayLengthFraction").value;
  const sigmaV = getCoefficient<number>("spatial.circumferential.wideBandSigma").value;
  return normalizeShapeFn((u, v) => Math.exp((u - 1) / decayLength) * (0.5 + 0.5 * circularGaussianKernel(v, BOTTOM_V, sigmaV)));
}

// ─────────────────────────────────────────────────────────────────────────
// 11) ORIFICE_DOWNSTREAM_JET — orifis mansabında çarpma halkası
// ─────────────────────────────────────────────────────────────────────────

export interface OrificeDownstreamJetInput {
  /** Orifisten hemen sonraki çarpma halkasının eksenel konumu (0-1) — varsayılan 0,15. */
  orificeAxialFraction?: number;
}

/** Kısıcı orifis mansabında jet çarpma halkası — eksenel halka, orifise yakın konumda. */
export function buildOrificeDownstreamJetShape(input: OrificeDownstreamJetInput = {}): DamageShapeFn {
  const centerU = input.orificeAxialFraction ?? 0.15;
  const sigmaU = getCoefficient<number>("spatial.axial.defaultRingSigma").value;
  return normalizeShapeFn(axialRingShape(centerU, sigmaU));
}

// ─────────────────────────────────────────────────────────────────────────
// 12) MIC_BOTTOM_PATCHY — saat 6'da düzensiz lekeler (rastgele ama tohumlu)
// ─────────────────────────────────────────────────────────────────────────

export interface MicBottomPatchyInput {
  /** Tekrarlanabilirlik için tohum — varsayılan 12345 (sabit, deterministik). */
  seed?: number;
}

const DEFAULT_MIC_SEED = 12345;

/**
 * MIC (mikrobiyolojik kaynaklı korozyon) — alt hatta (v≈0,5) yoğunlaşan
 * ama DÜZENSİZ/lokalize ("patchy") bir desen. Genel bottom-biased zarf
 * (geniş dairesel Gauss) × birkaç TOHUMLU-rastgele lekenin toplamı —
 * AYNI seed HER ZAMAN AYNI deseni üretir (saf fonksiyon, yan etki yok).
 */
export function buildMicBottomPatchyShape(input: MicBottomPatchyInput = {}): DamageShapeFn {
  const seed = input.seed ?? DEFAULT_MIC_SEED;
  const { patchCount, patchSigmaV, patchSigmaU } = getCoefficient<{
    patchCount: number;
    patchSigmaV: number;
    patchSigmaU: number;
  }>("spatial.micBottomPatchy.parameters").value;
  const envelopeSigmaV = getCoefficient<number>("spatial.circumferential.wideBandSigma").value;

  const rng = createSeededRng(seed);
  const patches: { centerU: number; centerV: number; weight: number }[] = [];
  for (let i = 0; i < patchCount; i++) {
    patches.push({
      centerU: rng(),
      // lekeler alt-yarı yayın (v∈[0,25;0,75]) içinde yoğunlaşır
      centerV: 0.25 + rng() * 0.5,
      weight: 0.5 + rng(), // 0,5-1,5 arası göreli leke ağırlığı
    });
  }

  return normalizeShapeFn((u, v) => {
    const envelope = circularGaussianKernel(v, BOTTOM_V, envelopeSigmaV);
    let patchSum = 0;
    for (const patch of patches) {
      patchSum +=
        patch.weight *
        linearGaussianKernel(u, patch.centerU, patchSigmaU) *
        circularGaussianKernel(v, patch.centerV, patchSigmaV);
    }
    return envelope * (0.3 + patchSum);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 13) UDC_SEDIMENT_BED — saat 5-7 arası çökelti yatağı
// ─────────────────────────────────────────────────────────────────────────

/**
 * UDC (birikinti altı korozyonu) — saat 5-7 arasında (dip, ±1 saat) çökelti
 * yatağı, eksenel olarak üniform (düşük noktalar boru boyunca herhangi bir
 * yerde olabilir).
 */
export function buildUdcSedimentBedShape(): DamageShapeFn {
  const fiveOClockRad = clockPositionToRadians(5);
  const sixOClockRad = clockPositionToRadians(6);
  const halfWidthRad = sixOClockRad - fiveOClockRad; // saat 6'dan saat 5/7'ye kadar olan açı
  const sigmaDivisor = getCoefficient<number>("spatial.gaussianEnvelope.arcHalfWidthSigmaDivisor").value;
  const sigmaV = halfWidthRad / (2 * Math.PI) / sigmaDivisor;

  return normalizeShapeFn((_u, v) => circularGaussianKernel(v, BOTTOM_V, sigmaV));
}

// ─────────────────────────────────────────────────────────────────────────
// 14) CUI_EXTERNAL_BANDS — dış yüzeyde destek/askı noktalarında bantlar
// ─────────────────────────────────────────────────────────────────────────

export interface CuiExternalBandsInput {
  /** Gerçek destek/askı konumları (0-1) biliniyorsa — verilmezse registry'nin eşit-aralıklı varsayılanı kullanılır. */
  supportPositionsAxialFraction?: number[];
}

/**
 * CUI (izolasyon altı korozyonu) — destek/askı noktalarında dış yüzeyde
 * eksenel bantlar (izolasyon bu noktalarda sıkışır/hasar görür, nem
 * tutulumu artar). Çevresel olarak ÜNİFORM (destek kelepçesi tüm çevreyi sarar).
 */
export function buildCuiExternalBandsShape(input: CuiExternalBandsInput = {}): DamageShapeFn {
  const { bandCount, bandSigmaFraction } = getCoefficient<{ bandCount: number; bandSigmaFraction: number }>(
    "spatial.cuiExternalBands.parameters",
  ).value;

  const positions =
    input.supportPositionsAxialFraction ??
    Array.from({ length: bandCount }, (_, i) => (i + 1) / (bandCount + 1));

  return normalizeShapeFn((u, _v) => {
    let sum = 0;
    for (const center of positions) {
      sum += linearGaussianKernel(u, center, bandSigmaFraction);
    }
    return sum;
  });
}
