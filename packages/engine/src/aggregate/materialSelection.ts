// packages/engine/src/aggregate/materialSelection.ts
//
// Proses borusu ve ekipman için malzeme seçimi karar merdivenleri —
// BOTAŞ F3-500-ME-SPC-PSS-0002 §10.1/§10.3.2-§10.3.7/§10.4/Tablo 8-1'den
// BİREBİR (bkz. registry/coefficients/materialSelection.ts). Bu, kullanıcının
// "yüklediğim doküman" dediği ve bir önceki oturumda (data/materials.ts)
// diskte BULUNAMAYAN belge — bu oturumda /home/aliattar/İndirilenler/
// F3-500-ME-SPC-PSS-0002_AE.pdf olarak BULUNDU ve doğrudan okundu.
//
// Beş AYRI karar merdiveni (piping, basınçlı kap, ısı değiştirici, hava
// soğutmalı eşanjör, depolama tankı) + çapraz-kesen kontroller (min tasarım
// sıcaklığı, kıyı/CSCC/kaplama, sour servis/ISO 15156, CRA-CS izolasyon
// kiti, cıvatalama) ayrı fonksiyonlar olarak sunulur — top-level
// recommendMaterial() bunları ekipman tipine göre birleştirir.

import { getMaterial } from "../data/materials";
import { assessHardnessCompliance, determineSscRegion, type SscRegion } from "../corrosion/h2s";
import { getCoefficient } from "../registry";
import type {
  BoltingOption,
  CorrosionAllowanceLadderStep,
  MinDesignTempStep,
} from "../registry/coefficients/materialSelection";
import type { ConfidenceLevel } from "../registry/types";
import { ENGINEERING_DISCLAIMER_TR, type ValidityWarning } from "../corrosion/types";

export type EquipmentType =
  | "PIPING"
  | "PRESSURE_VESSEL"
  | "HEAT_EXCHANGER_GENERAL"
  | "AIR_COOLED_HEAT_EXCHANGER"
  | "SHELL_AND_TUBE_HEAT_EXCHANGER"
  | "STORAGE_TANK";

export interface MaterialSelectionResult {
  equipmentType: EquipmentType;
  primaryMaterialTr: string;
  alternativeMaterialsTr: string[];
  additionalRequirementsTr: string[];
  rationaleTr: string;
  /** CS=1.0 referans — bkz. data/materials.ts relativeCostIndex (yalnızca eşleşen bir malzeme bulunabildiğinde dolu) */
  relativeCostIndex: number | null;
  confidence: ConfidenceLevel;
  validityWarnings: ValidityWarning[];
  sourcesUsed: string[];
  disclaimer: string;
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.1 — Minimum tasarım sıcaklığı merdiveni
// ─────────────────────────────────────────────────────────────────────────

/**
 * Minimum tasarım sıcaklığına göre temel malzeme ailesini seçer.
 *
 * Model adı: BOTAŞ F3-500-ME-SPC-PSS-0002 §10.3.1 (bkz. registry/
 * coefficients/materialSelection.ts::materialSelection.minDesignTempLadder).
 */
export function selectMinDesignTempMaterial(minDesignTemperatureC: number): MinDesignTempStep {
  const ladder = getCoefficient<MinDesignTempStep[]>("materialSelection.minDesignTempLadder").value;
  const step = ladder.find((s) => (s.minTempC === null || minDesignTemperatureC >= s.minTempC) && (s.maxTempC === null || minDesignTemperatureC <= s.maxTempC));
  if (!step) {
    throw new Error(`Minimum tasarım sıcaklığı (${minDesignTemperatureC}°C) için merdiven basamağı bulunamadı.`);
  }
  return step;
}

// ─────────────────────────────────────────────────────────────────────────
// Çapraz-kesen kontroller
// ─────────────────────────────────────────────────────────────────────────

const CRA_FAMILY_TO_MATERIAL_ID: Record<"SS316L" | "DUPLEX_2205" | "SUPERDUPLEX_2507", string> = {
  SS316L: "ss-316-316l",
  DUPLEX_2205: "duplex-2205",
  SUPERDUPLEX_2507: "super-duplex-2507",
};

export interface CoastalCoatingAssessment {
  isCoastal: boolean;
  coatingRequired: boolean;
  rationaleTr: string;
}

/**
 * Kıyı ortamı + CSCC eşiği + kaplama gerekliliğini değerlendirir (§8.1/8.2,
 * Tablo 8-1 — data/materials.ts'teki csccLimitC/coatingRequiredAboveC
 * alanları ÜZERİNDEN, TEKRAR EDİLMEDEN).
 *
 * @param distanceFromCoastKm Tesisin kıyıya mesafesi (km)
 * @param craFamily Değerlendirilen CRA ailesi — null ise (CS/LTCS gibi
 * CRA-olmayan malzemeler) CSCC kavramı uygulanmaz, her zaman false döner.
 */
export function assessCoastalCoatingRequirement(
  distanceFromCoastKm: number,
  operatingTemperatureC: number,
  craFamily: "SS316L" | "DUPLEX_2205" | "SUPERDUPLEX_2507" | null,
): CoastalCoatingAssessment {
  const coastalThresholdKm = getCoefficient<number>("materialSelection.coastalDistanceThresholdKm").value;
  const isCoastal = distanceFromCoastKm <= coastalThresholdKm;

  if (!isCoastal || craFamily === null) {
    return {
      isCoastal,
      coatingRequired: false,
      rationaleTr: !isCoastal
        ? `Tesis kıyıya ${distanceFromCoastKm}km mesafede — ${coastalThresholdKm}km eşiğinin (bkz. §8.1) üzerinde, kıyı/CSCC riski değerlendirilmedi.`
        : "CRA malzemesi seçilmedi (CS/LTCS) — CSCC/PREN kavramları uygulanmaz.",
    };
  }

  const material = getMaterial(CRA_FAMILY_TO_MATERIAL_ID[craFamily]);
  const coatingRequired = material.coatingRequiredAboveC !== undefined && operatingTemperatureC >= material.coatingRequiredAboveC;
  return {
    isCoastal,
    coatingRequired,
    rationaleTr: coatingRequired
      ? `Tesis kıyı ortamında (${distanceFromCoastKm}km≤${coastalThresholdKm}km) VE işletme sıcaklığı (${operatingTemperatureC}°C), "${material.displayNameTr}" için kaplama eşiğini (${material.coatingRequiredAboveC}°C, Tablo 8-1) aşıyor — DIŞ KAPLAMA ZORUNLUDUR.`
      : `Tesis kıyı ortamında ama işletme sıcaklığı (${operatingTemperatureC}°C), "${material.displayNameTr}" için kaplama eşiğinin (${material.coatingRequiredAboveC}°C) altında — kaplama şart değildir (yine de CSCC sınırı ${material.csccLimitC}°C'ye dikkat edilmelidir).`,
  };
}

/** CRA malzeme CS ile aynı hatta/ekipmanda birleşiyorsa izolasyon kiti gerekliliği (§10.3.1: "Where CRA material meet CS to avoid galvanic cell formation insulation kit shall be employed"). */
export function assessIsolationKitRequirement(craMeetsCs: boolean): { required: boolean; rationaleTr: string } {
  return {
    required: craMeetsCs,
    rationaleTr: craMeetsCs
      ? "CRA malzeme CS ile birleşiyor — galvanik hücre oluşumunu önlemek için izolasyon kiti KULLANILMALIDIR (§10.3.1)."
      : "CRA-CS birleşimi yok — izolasyon kiti gerekmez.",
  };
}

export interface SourServiceAssessment {
  isSourService: boolean;
  region: SscRegion | null;
  isoCompliant: boolean | null;
  rationaleTr: string;
}

/**
 * Sour servis olup olmadığını ve (öyleyse) ISO 15156 uyumluluğunu
 * değerlendirir — corrosion/h2s.ts'in ZATEN sourced ISO 15156-2 bölge/
 * sertlik mantığını YENİDEN KULLANIR, burada TEKRAR EDİLMEZ.
 */
export function assessSourServiceMaterialRequirement(
  h2sPartialPressureKpa: number,
  inSituPh: number,
  candidateHardnessHrc?: number,
): SourServiceAssessment {
  if (h2sPartialPressureKpa <= 0) {
    return { isSourService: false, region: null, isoCompliant: null, rationaleTr: "H2S kısmi basıncı 0 — sour servis değil, ISO 15156 kısıtı uygulanmaz." };
  }
  const region = determineSscRegion(h2sPartialPressureKpa, inSituPh);
  const isSourService = region !== "REGION_0";
  if (!isSourService) {
    return { isSourService, region, isoCompliant: null, rationaleTr: "ISO 15156-2 Region 0 — normalde özel SSC önlemi gerekmez." };
  }
  let isoCompliant: boolean | null = null;
  let rationaleTr = `ISO 15156-2 ${region} — malzeme SOUR SERVİSE UYGUN (ISO 15156/NACE MR0175) seçilmelidir.`;
  if (candidateHardnessHrc !== undefined) {
    isoCompliant = assessHardnessCompliance(candidateHardnessHrc, region).isCompliant;
    rationaleTr += isoCompliant
      ? ` Aday malzemenin sertliği (${candidateHardnessHrc} HRC) sınır dahilinde — UYGUN.`
      : ` Aday malzemenin sertliği (${candidateHardnessHrc} HRC) ISO 15156-2 sınırını AŞIYOR — UYGUN DEĞİL, HIC testli/daha yumuşak çelik veya CRA gerekir.`;
  }
  return { isSourService, region, isoCompliant, rationaleTr };
}

/**
 * Cıvatalama önerisini döndürür (§10.4, Tablo 10-2, ISO 21457).
 *
 * @param minDesignTemperatureC Minimum tasarım sıcaklığı (°C)
 * @param pipingMaterialFamily Boru malzemesi ailesi — "CS_LAS" | "SS316L"
 * @param cathodicallyProtected 316L için katodik korumalı (S3) alt-varyant mı
 */
export function getBoltingRecommendation(
  minDesignTemperatureC: number,
  pipingMaterialFamily: "CS_LAS" | "SS316L",
  cathodicallyProtected: boolean,
): BoltingOption {
  const table = getCoefficient<BoltingOption[]>("materialSelection.boltingTable").value;
  const candidates =
    pipingMaterialFamily === "CS_LAS"
      ? table.filter((o) => o.pipingMaterialFamily.includes("Karbon Çelik"))
      : table.filter((o) => o.pipingMaterialFamily.includes("316L"));
  const filtered = candidates.filter((o) => o.pipingMaterialFamily.includes("katodik korumalı") === cathodicallyProtected);
  // En düşük minTempC'ye sahip (en geniş kapsamlı) seçenek tercih edilir, sıcaklık onu karşılamıyorsa daha sınırlı seçenek denenir.
  const sorted = [...filtered].sort((a, b) => a.minTempC - b.minTempC);
  const option = sorted.find((o) => minDesignTemperatureC > o.minTempC) ?? sorted[sorted.length - 1];
  if (!option) {
    throw new Error(`"${pipingMaterialFamily}" için cıvatalama seçeneği bulunamadı.`);
  }
  return option;
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.2 — Proses Borusu (Piping)
// ─────────────────────────────────────────────────────────────────────────

function findCaLadderStep(ladder: CorrosionAllowanceLadderStep[], requiredCaMm: number): CorrosionAllowanceLadderStep {
  const step = ladder.find((s) => s.maxRequiredCaMm === null || requiredCaMm <= s.maxRequiredCaMm);
  if (!step) {
    throw new Error(`Gerekli korozyon payı (${requiredCaMm}mm) için merdiven basamağı bulunamadı.`);
  }
  return step;
}

export interface PipingMaterialSelectionInput {
  requiredCorrosionAllowanceMm: number;
  /** 3,0-6,0mm bandında, servis içi et kalınlığı muayenesi mümkün mü (mümkünse 6mm yerine 3mm CA yeterli — §10.3.2) */
  inServiceInspectionPossible: boolean;
}

/**
 * Proses borusu için malzeme seçer.
 *
 * Model adı: BOTAŞ F3-500-ME-SPC-PSS-0002 §10.3.2 (bkz. registry
 * materialSelection.pipingCaLadder).
 * Girdi/çıktı birimleri: mm → çıktı malzeme önerisi (Türkçe).
 * Geçerlilik aralığı: yalnızca proses borusu için (basınçlı kap/ekipman
 * için AYRI fonksiyonlar kullanılmalıdır — bkz. aşağıdaki diğer fonksiyonlar).
 */
export function selectPipingMaterial(input: PipingMaterialSelectionInput): MaterialSelectionResult {
  if (input.requiredCorrosionAllowanceMm < 0) {
    throw new Error("Gerekli korozyon payı negatif olamaz.");
  }
  const ladder = getCoefficient<CorrosionAllowanceLadderStep[]>("materialSelection.pipingCaLadder").value;
  const step = findCaLadderStep(ladder, input.requiredCorrosionAllowanceMm);
  const validityWarnings: ValidityWarning[] = [];

  let primaryMaterialTr = step.materialDisplayNameTr;
  const alternativeMaterialsTr: string[] = [];

  // 3-6mm bandında servis içi muayene mümkünse 3mm CA'lı CS de birincil alternatif olarak sunulur.
  if (step.maxRequiredCaMm === 6.0 && input.inServiceInspectionPossible) {
    primaryMaterialTr = "Karbon Çelik (CS) + 3,0mm CA (servis içi et kalınlığı muayenesi ile doğrulanacak)";
    alternativeMaterialsTr.push("Karbon Çelik (CS) + 6,0mm CA (muayene programı olmadan)");
  } else if (step.requiresCra) {
    alternativeMaterialsTr.push("Daha yüksek alaşımlı CRA (22Cr/25Cr duplex) — ağır sour/klorür koşullarında 316L yetersizse");
  } else if (ladder.indexOf(step) < ladder.length - 1) {
    alternativeMaterialsTr.push(ladder[ladder.length - 1]!.materialDisplayNameTr + " (daha yüksek maliyetli, uzun vadede daha az bakım)");
  }

  const csMaterial = getMaterial("cs-a106-grb");
  const relativeCostIndex = step.requiresCra ? getMaterial("ss-316-316l").relativeCostIndex : csMaterial.relativeCostIndex;

  return {
    equipmentType: "PIPING",
    primaryMaterialTr,
    alternativeMaterialsTr,
    additionalRequirementsTr: step.extraRequirementsTr,
    rationaleTr: `Gerekli korozyon payı ${input.requiredCorrosionAllowanceMm.toFixed(2)}mm — §10.3.2 merdivenine göre: ${primaryMaterialTr}.`,
    relativeCostIndex,
    confidence: getCoefficient("materialSelection.pipingCaLadder").confidence,
    validityWarnings,
    sourcesUsed: ["materialSelection.pipingCaLadder"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.3 — Basınçlı Kap (Pressure Vessel)
// ─────────────────────────────────────────────────────────────────────────

export interface PressureVesselMaterialSelectionInput {
  requiredCorrosionAllowanceMm: number;
  operatingTemperatureC: number;
  operatingPressureBarg: number;
}

/**
 * Basınçlı kap için malzeme seçer (§10.3.3).
 *
 * Model: <3mm→CS+3mm; 3-6mm ve T<60°C ve P<50barg→CS+organik astar;
 * 3-6mm ve (T≥60°C veya P≥50barg)→CS+üretici-onaylı kaplama VEYA CRA
 * kaplamalı/dolu CRA (ikisi de alternatif olarak sunulur).
 */
export function selectPressureVesselMaterial(input: PressureVesselMaterialSelectionInput): MaterialSelectionResult {
  if (input.requiredCorrosionAllowanceMm < 0) {
    throw new Error("Gerekli korozyon payı negatif olamaz.");
  }
  const validityWarnings: ValidityWarning[] = [];
  const csMaterial = getMaterial("cs-a106-grb");
  const ss316 = getMaterial("ss-316-316l");

  if (input.requiredCorrosionAllowanceMm < 3.0) {
    return {
      equipmentType: "PRESSURE_VESSEL",
      primaryMaterialTr: "Karbon Çelik (CS) + 3,0mm CA",
      alternativeMaterialsTr: [],
      additionalRequirementsTr: [],
      rationaleTr: `Gerekli korozyon payı ${input.requiredCorrosionAllowanceMm.toFixed(2)}mm < 3,0mm — §10.3.3'e göre astar/CRA gerekmez.`,
      relativeCostIndex: csMaterial.relativeCostIndex,
      confidence: getCoefficient("materialSelection.minDesignTempLadder").confidence,
      validityWarnings,
      sourcesUsed: ["materialSelection.pssDocument"],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
    };
  }

  const severeCondition = input.operatingTemperatureC >= 60 || input.operatingPressureBarg >= 50;

  if (!severeCondition) {
    return {
      equipmentType: "PRESSURE_VESSEL",
      primaryMaterialTr: "Karbon Çelik (CS) + organik astar (iç kaplama)",
      alternativeMaterialsTr: ["Karbon Çelik (CS) + CRA kaplama (cladding) veya dolu CRA (daha küçük kaplar için)"],
      additionalRequirementsTr: [
        "Astarlı kap için korozyon payı, planlı muayeneler arasında kaplama kusurlarında oluşacak korozyona en az eşit olmalı, azami 6,0mm.",
        "Kap sıvı içeriyorsa, iç aksam CRA olsa bile kaplama gövde delik/kusurlarında galvanik korozyon riskine karşı KAPLANMALIDIR.",
        "İletken sıvı içeren proses/yardımcı alanlarda CRA iç aksam elektriksel olarak İZOLE EDİLMELİDİR.",
      ],
      rationaleTr: `Gerekli korozyon payı ${input.requiredCorrosionAllowanceMm.toFixed(2)}mm (3-6mm bandı), işletme sıcaklığı (${input.operatingTemperatureC}°C) < 60°C VE basınç (${input.operatingPressureBarg}barg) < 50barg — §10.3.3'e göre organik astar uygundur.`,
      relativeCostIndex: csMaterial.relativeCostIndex,
      confidence: getCoefficient("materialSelection.minDesignTempLadder").confidence,
      validityWarnings,
      sourcesUsed: ["materialSelection.pssDocument"],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
    };
  }

  validityWarnings.push({
    parameter: "İşletme koşulu (astar uygunluğu)",
    value: Math.max(input.operatingTemperatureC, input.operatingPressureBarg),
    min: 0,
    max: 60,
    unit: "°C veya barg",
    message: "İşletme sıcaklığı ≥60°C veya basınç ≥50barg — organik kaplama seçilirse üretici verisiyle DESTEKLENMELİDİR, aksi halde CRA kaplama/dolu CRA tercih edilmelidir.",
  });

  return {
    equipmentType: "PRESSURE_VESSEL",
    primaryMaterialTr: "Karbon Çelik (CS) + CRA kaplama (cladding) veya dolu CRA (daha küçük kaplar için)",
    alternativeMaterialsTr: ["Karbon Çelik (CS) + üretici verisiyle desteklenmiş özel organik kaplama"],
    additionalRequirementsTr: ["Kaplama seçilirse üretici verisiyle desteklenmelidir (§10.3.3)."],
    rationaleTr: `Gerekli korozyon payı ${input.requiredCorrosionAllowanceMm.toFixed(2)}mm > 3mm VE işletme koşulları şiddetli (T=${input.operatingTemperatureC}°C≥60°C veya P=${input.operatingPressureBarg}barg≥50barg) — §10.3.3'e göre CRA kaplama/dolu CRA önerilir.`,
    relativeCostIndex: ss316.relativeCostIndex,
    confidence: getCoefficient("materialSelection.minDesignTempLadder").confidence,
    validityWarnings,
    sourcesUsed: ["materialSelection.pssDocument"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.4 — Isı Değiştirici (genel)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Genel ısı değiştirici malzeme kararı (§10.3.4) — CS tüplere büyük
 * korozyon payı eklemek ısı transferini düşürdüğü için pratik DEĞİLDİR
 * (astar CS için değil), bu yüzden karar CA-merdiveni değil NİTELİKSEL bir
 * ikilidir: akış yeterince korozif DEĞİLSE CS, DEĞİLSE CRA.
 */
export function selectHeatExchangerMaterial(streamSufficientlyNonCorrosive: boolean): MaterialSelectionResult {
  const csMaterial = getMaterial("cs-a106-grb");
  const ss316 = getMaterial("ss-316-316l");
  return {
    equipmentType: "HEAT_EXCHANGER_GENERAL",
    primaryMaterialTr: streamSufficientlyNonCorrosive ? "Karbon Çelik (CS), korozyon payı GEREKMEZ" : "Korozyona Dayanıklı Alaşım (CRA), minimum SS316L",
    alternativeMaterialsTr: streamSufficientlyNonCorrosive ? [] : ["Duplex 2205/Süper Duplex 2507 (daha agresif sour/klorür koşullarında)"],
    additionalRequirementsTr: [
      "İnhibitör kullanımı ısı değiştiricilerde GÜVENİLİR kabul EDİLMEZ (§10.3.4).",
      "Büyük bir korozyon payı CS tüplere eklemek pratik DEĞİLDİR (ısı transferini düşürür).",
    ],
    rationaleTr: streamSufficientlyNonCorrosive
      ? "Akış yeterince korozif değil — §10.3.4'e göre CS kullanılabilir."
      : "Akış yeterince korozif değil VARSAYIMI GEÇERSİZ — §10.3.4'e göre CRA kullanılmalıdır (inhibitör/CA yaklaşımı bu ekipman için güvenilmez).",
    relativeCostIndex: streamSufficientlyNonCorrosive ? csMaterial.relativeCostIndex : ss316.relativeCostIndex,
    confidence: "HIGH",
    validityWarnings: [],
    sourcesUsed: ["materialSelection.pssDocument"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.5 — Hava Soğutmalı Eşanjör (Air Cooled Heat Exchanger)
// ─────────────────────────────────────────────────────────────────────────

export interface AirCooledHeatExchangerResult extends Omit<MaterialSelectionResult, "primaryMaterialTr"> {
  headerMaterialTr: string;
  tubeMaterialTr: string;
}

/**
 * Hava soğutmalı eşanjör başlık (header) ve tüp malzemesini AYRI AYRI
 * seçer (§10.3.5).
 */
export function selectAirCooledHeatExchangerMaterial(
  headerRequiredCorrosionAllowanceMm: number,
  tubeRequiredCorrosionAllowanceMm: number,
): AirCooledHeatExchangerResult {
  if (headerRequiredCorrosionAllowanceMm < 0 || tubeRequiredCorrosionAllowanceMm < 0) {
    throw new Error("Gerekli korozyon payları negatif olamaz.");
  }
  const csMaterial = getMaterial("cs-a106-grb");
  const ss316 = getMaterial("ss-316-316l");

  let headerMaterialTr: string;
  const alternativeMaterialsTr: string[] = [];
  if (headerRequiredCorrosionAllowanceMm <= 3.0) {
    headerMaterialTr = "Karbon Çelik (CS) + 3,0mm CA (başlık)";
  } else {
    headerMaterialTr = "Karbon Çelik (CS) + azami 6,0mm CA (başlık)";
    alternativeMaterialsTr.push("CRA kaplamalı (clad) CS başlık");
    if (headerRequiredCorrosionAllowanceMm > 6.0) {
      const w: ValidityWarning = {
        parameter: "Başlık korozyon payı",
        value: headerRequiredCorrosionAllowanceMm,
        min: 0,
        max: 6.0,
        unit: "mm",
        message: `Gerekli başlık korozyon payı (${headerRequiredCorrosionAllowanceMm}mm) §10.3.5'in azami 6,0mm sınırını AŞIYOR — CRA kaplamalı CS veya dolu CRA başlık gerekir.`,
      };
      return buildAcheResult(headerMaterialTr, tubeRequiredCorrosionAllowanceMm, alternativeMaterialsTr, [w], csMaterial.relativeCostIndex);
    }
  }

  return buildAcheResult(headerMaterialTr, tubeRequiredCorrosionAllowanceMm, alternativeMaterialsTr, [], ss316.relativeCostIndex);

  function buildAcheResult(
    header: string,
    tubeCaMm: number,
    alts: string[],
    warnings: ValidityWarning[],
    _unused: number,
  ): AirCooledHeatExchangerResult {
    const tubeMaterialTr = tubeCaMm > 1.5 ? "Dolu Korozyona Dayanıklı Alaşım (CRA) tüpler" : "Karbon Çelik (CS) tüpler (korozyon payı belirtilmez)";
    const relativeCostIndex = tubeCaMm > 1.5 ? ss316.relativeCostIndex : csMaterial.relativeCostIndex;
    return {
      equipmentType: "AIR_COOLED_HEAT_EXCHANGER",
      headerMaterialTr: header,
      tubeMaterialTr,
      alternativeMaterialsTr: alts,
      additionalRequirementsTr: [
        "Kullanılıyorsa alüminyum kanatlar (fins) başlıktaki bir yuvaya (rebate) uzanmalı veya gerilim altında tüpe sarılmalıdır (§10.3.5).",
        "Kanatsız tüp bölümleri harici olarak boyanmalıdır.",
      ],
      rationaleTr: `Başlık CA=${headerRequiredCorrosionAllowanceMm}mm → ${header}. Tüp CA=${tubeCaMm}mm → ${tubeMaterialTr} (§10.3.5: tüp CA>1,5mm ise dolu CRA zorunlu).`,
      relativeCostIndex,
      confidence: "HIGH",
      validityWarnings: warnings,
      sourcesUsed: ["materialSelection.pssDocument"],
      disclaimer: ENGINEERING_DISCLAIMER_TR,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.6 — Gövde-Boru Tipi Eşanjör (Shell and Tube Heat Exchanger)
// ─────────────────────────────────────────────────────────────────────────

export interface ShellAndTubeHeatExchangerResult extends Omit<MaterialSelectionResult, "primaryMaterialTr"> {
  shellMaterialTr: string;
  tubeMaterialTr: string;
}

/** Gövde-boru tipi eşanjör gövde ve tüp/tüp levhası malzemesini AYRI AYRI seçer (§10.3.6). */
export function selectShellAndTubeHeatExchangerMaterial(
  shellRequiredCorrosionAllowanceMm: number,
  tubeRequiredCorrosionAllowanceMm: number,
): ShellAndTubeHeatExchangerResult {
  if (shellRequiredCorrosionAllowanceMm < 0 || tubeRequiredCorrosionAllowanceMm < 0) {
    throw new Error("Gerekli korozyon payları negatif olamaz.");
  }
  const csMaterial = getMaterial("cs-a106-grb");
  const ss316 = getMaterial("ss-316-316l");

  const bothLow = shellRequiredCorrosionAllowanceMm < 3.0 && tubeRequiredCorrosionAllowanceMm < 3.0;
  const shellMaterialTr = bothLow
    ? `Karbon Çelik (CS) + ${Math.max(shellRequiredCorrosionAllowanceMm, 0.1).toFixed(1)}mm CA (gövde)`
    : shellRequiredCorrosionAllowanceMm <= 6.0
      ? "Karbon Çelik (CS) + 6,0mm CA (gövde)"
      : "Korozyona Dayanıklı Alaşım (CRA) veya CRA kaplamalı CS (gövde)";

  const tubeMaterialTr =
    tubeRequiredCorrosionAllowanceMm > 1.5
      ? "CRA tüpler + CRA tüp levhası (kanallar, gelen boru malzemesiyle eşleşecek şekilde)"
      : bothLow
        ? "Karbon Çelik (CS) tüpler (gövdeyle aynı CA)"
        : "Karbon Çelik (CS) tüpler";

  return {
    equipmentType: "SHELL_AND_TUBE_HEAT_EXCHANGER",
    shellMaterialTr,
    tubeMaterialTr,
    alternativeMaterialsTr: shellRequiredCorrosionAllowanceMm > 6.0 ? [] : ["CRA kaplamalı (clad) CS gövde (daha yüksek sıcaklık/basınç güvencesi için)"],
    additionalRequirementsTr: [],
    rationaleTr: `Gövde CA=${shellRequiredCorrosionAllowanceMm}mm → ${shellMaterialTr}. Tüp CA=${tubeRequiredCorrosionAllowanceMm}mm → ${tubeMaterialTr} (§10.3.6: tüp CA>1,5mm ise CRA tüp+tüp levhası zorunlu; gövde CA>6mm ise CRA/CRA-clad zorunlu).`,
    relativeCostIndex: tubeRequiredCorrosionAllowanceMm > 1.5 || shellRequiredCorrosionAllowanceMm > 6.0 ? ss316.relativeCostIndex : csMaterial.relativeCostIndex,
    confidence: "HIGH",
    validityWarnings: [],
    sourcesUsed: ["materialSelection.pssDocument"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// §10.3.7 — Depolama Tankı (Storage Tank)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Depolama tankı gövde+çatı malzemesini döndürür (§10.3.7) — bu, bir
 * DEĞİŞKEN karar merdiveni değildir, dokümanın kendi sabit önerisidir
 * (yalnızca iz miktarda su/kondens beklenen, sabit çatılı yakıt gazı
 * örtülü tanklar için geçerlidir — farklı servis koşulları için bu
 * fonksiyon KULLANILMAMALIDIR, bkz. dönen validityWarning).
 */
export function selectStorageTankMaterial(traceWaterOnly: boolean, dryFuelGasBlanketed: boolean): MaterialSelectionResult {
  const csMaterial = getMaterial("cs-a106-grb");
  const validityWarnings: ValidityWarning[] = [];
  if (!traceWaterOnly || !dryFuelGasBlanketed) {
    validityWarnings.push({
      parameter: "Depolama tankı servis koşulu",
      value: 0,
      min: 0,
      max: 0,
      unit: "-",
      message:
        "§10.3.7'nin CS+3mm önerisi, YALNIZCA iz miktarda su beklenen VE kuru yakıt gazı örtülü (blanketed) " +
        "sabit çatılı tanklar için geçerlidir — bu koşullar sağlanmıyorsa (ör. önemli miktarda serbest su " +
        "bekleniyor) bu öneri DOĞRUDAN uygulanmamalı, ayrı bir değerlendirme yapılmalıdır.",
    });
  }
  return {
    equipmentType: "STORAGE_TANK",
    primaryMaterialTr: "Karbon Çelik (CS) + 3,0mm CA (gövde ve çatı)",
    alternativeMaterialsTr: [],
    additionalRequirementsTr: [
      "Gövde: dip plaka ve beklenen su seviyesine kadar (en az 1m) kaplama + iç katodik koruma sağlanmalıdır.",
      "Çatı: çatı iç yüzeyine en az cam pulu takviyeli epoksi (glass flake reinforced epoxy) kaplama önerilir.",
      "Kış aylarında düşük kondensat seviyesi/su dibi varsa tankın tüm iç gövde yüzeyi de kaplanmalıdır.",
    ],
    rationaleTr: "§10.3.7: sabit çatılı, kuru yakıt gazı örtülü depolama tankları için CS+3mm CA (gövde ve çatı) yeterlidir; yoğuşma riski düşük kabul edilir.",
    relativeCostIndex: csMaterial.relativeCostIndex,
    confidence: "HIGH",
    validityWarnings,
    sourcesUsed: ["materialSelection.pssDocument"],
    disclaimer: ENGINEERING_DISCLAIMER_TR,
  };
}
