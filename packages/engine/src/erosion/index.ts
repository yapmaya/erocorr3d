// packages/engine/src/erosion/index.ts
//
// Erozyon modülünün giriş noktası: (1) BİRLEŞİK TARAMA — API 14E (hız
// tabanlı, katı-içermeyen) + damlacık erozyonu (ıslak gaz) taramalarını tek
// bir çağrıda birleştirir, (2) SEÇİCİ — bir bileşen tipi (ComponentType)
// için DNV-RP-O501'in HANGİ alt-prosedürünün uygulanması gerektiğine karar
// verir ve gerekçesini Türkçe döndürür.
//
// selectDnvErosionModel() saf KARAR mantığıdır (bkz. corrosion/modelRouter.ts
// ile aynı gerekçe — bu bir yayımlanmış sabit değil, hangi alt-modülün
// çağrılacağına dair bir yönlendiricidir, KDP kayıt defterine YAZILMAZ).
// Gerçek hesap, döndürülen modelId'ye karşılık gelen erosion/dnvO501.ts
// fonksiyonuyla (her biri kendi özel girdi şeklini gerektirdiği için)
// ÇAĞIRAN TARAF tarafından yapılır — bu dosya geometriye özgü girdileri
// (R/D, D1/D2, kaynak yüksekliği vb.) tek bir "mega girdi" nesnesine
// zorlamaz.

import type { ComponentType } from "../types/enums";
import { assessApi14eScreening, type Api14eScreeningInput, type Api14eScreeningResult } from "./api14e";
import {
  assessDropletErosionRisk,
  type DropletErosionRiskInput,
  type DropletErosionRiskResult,
} from "./dropletErosion";

export * from "./api14e";
export * from "./dnvO501";
export * from "./dropletErosion";
export * from "./valveHydraulics";
export * from "./types";

export type DnvErosionModelId =
  | "STRAIGHT_PIPE"
  | "WELD_REINFORCEMENT"
  | "DOWNSTREAM_WELD"
  | "BEND"
  | "MITER_BEND"
  | "BLIND_TEE"
  | "TEE_BRANCH"
  | "REDUCER"
  | "RESTRICTION_ORIFICE"
  | "CHOKE_VALVE"
  | "GENERIC_KERNEL_ONLY"
  | "NOT_MODELED";

export interface DnvErosionModelSelection {
  modelId: DnvErosionModelId;
  /** Çağrılması gereken erosion/dnvO501.ts fonksiyonunun adı (bilgi amaçlı) */
  functionNameTr: string;
  rationaleTr: string;
}

/**
 * Bir bileşen tipi (ComponentType) için hangi DNV-RP-O501 alt-prosedürünün
 * uygulanacağına karar verir.
 *
 * Model adı: proje karar mantığı (bir hesap değil, yönlendirme kuralı).
 */
export function selectDnvErosionModel(componentType: ComponentType): DnvErosionModelSelection {
  switch (componentType) {
    case "STRAIGHT_PIPE":
      return {
        modelId: "STRAIGHT_PIPE",
        functionNameTr: "computeStraightPipeErosionRate",
        rationaleTr: "Düz boru — DNV §8.2 (Eq. 8.9), yalnızca düşey çelik borular için doğrudan geçerli.",
      };
    case "WELDOLET":
    case "WELD_JOINT":
    case "FLANGE_WELD_NECK":
      return {
        modelId: "WELD_REINFORCEMENT",
        functionNameTr: "computeWeldReinforcementErosionRate + computeDownstreamWeldErosionRate",
        rationaleTr:
          "Kaynak dikişi — DNV §8.3.1 (akışa bakan yüz, boyutlandırma için SINIRLAYICI DEĞİL) VE §8.3.2 " +
          "(aşağı akış, daha kritik) BİRLİKTE değerlendirilmelidir.",
      };
    case "ELBOW_90":
    case "ELBOW_45":
    case "BEND_LONG_RADIUS":
    case "BEND_SHORT_RADIUS":
      return {
        modelId: "BEND",
        functionNameTr: "computeBendErosionRate",
        rationaleTr: "Dirsek/bükme — DNV §8.4 (Eq. 8.15-8.21), en kritik ve en yüksek güvenilirlikli alt-model.",
      };
    case "MITER_BEND":
      return {
        modelId: "MITER_BEND",
        functionNameTr: "computeMiterBendErosionRate",
        rationaleTr:
          "Miter bükme — DNV'nin KAPSAMI DIŞINDA; dirsek modelinin çağıran tarafça sağlanan eşdeğer R/D " +
          "ile YAKLAŞIK uygulanması (DOĞRULANMAMIŞ).",
      };
    case "TEE_BLIND":
      return {
        modelId: "BLIND_TEE",
        functionNameTr: "computeBlindTeeErosionRate",
        rationaleTr: "Kör (dead-end) Te — DNV §8.5 (Eq. 8.22-8.29).",
      };
    case "TEE_SWEEPING":
    case "TEE_BRANCH":
      return {
        modelId: "TEE_BRANCH",
        functionNameTr: "computeTeeBranchErosionRate",
        rationaleTr:
          "Akışın devam ettiği dallanma/geçiş Te'si — DNV'nin kör Te modeli bunu KAPSAMAZ; dirsek " +
          "modelinin ~90° yönelim-değişimi analojisiyle YAKLAŞIK uygulanması (DOĞRULANMAMIŞ).",
      };
    case "REDUCER_CONCENTRIC":
    case "REDUCER_ECCENTRIC":
      return {
        modelId: "REDUCER",
        functionNameTr: "computeReducerErosionRate",
        rationaleTr: "Redüksiyon — DNV §8.6 (Eq. 8.30-8.35).",
      };
    case "RESTRICTION_ORIFICE":
      return {
        modelId: "RESTRICTION_ORIFICE",
        functionNameTr: "computeRestrictionOrificeErosionRate",
        rationaleTr:
          "Kısıtlama orifisi — DNV'de ayrı bölüm yok; redüksiyon modeliyle (§8.6) aynı fiziksel sınıf " +
          "(ani akış alanı daralması) olduğu için doğrudan uygulanır.",
      };
    case "CHOKE_VALVE":
    case "CONTROL_VALVE_GLOBE":
    case "CONTROL_VALVE_CAGE":
      return {
        modelId: "CHOKE_VALVE",
        functionNameTr: "computeChokeValveErosionRate",
        rationaleTr:
          "Choke/kontrol vana trimi — DNV'nin KENDİ METNİ AÇIKÇA kapsam dışı bırakır (\"manifolds and " +
          "chokes\"); redüksiyon modelinin trim geçişine YAKLAŞIK uygulanması (DOĞRULANMAMIŞ, LOW " +
          "confidence). Malzeme seçiminde Haugen et al. (1995) NİTEL olarak dikkate alınmalı.",
      };
    case "GATE_VALVE":
    case "GLOBE_VALVE":
    case "BALL_VALVE_FULL":
    case "BALL_VALVE_REDUCED":
    case "BUTTERFLY_VALVE":
    case "CHECK_VALVE_SWING":
    case "CHECK_VALVE_LIFT":
    case "CHECK_VALVE_DUAL_PLATE":
    case "PLUG_VALVE":
    case "NEEDLE_VALVE":
    case "PRESSURE_SAFETY_VALVE":
      return {
        modelId: "GENERIC_KERNEL_ONLY",
        functionNameTr: "computeDnvO501ErosionRate (temel Eq. 8.1 çekirdeği)",
        rationaleTr:
          "Bu vana tipi için DNV'de veya bu oturumda bulunan literatürde özel bir geometri alt-modeli " +
          "yok — yalnızca temel Eq. 8.1 çekirdeği, çağıran tarafın kendi tahmin ettiği çarpma açısı/hedef " +
          "alanla (ör. valveCatalog.ts erosionZones verisi, kendisi de UNVERIFIED/LOW) kullanılabilir.",
      };
    default: {
      const exhaustiveCheck: never = componentType;
      return {
        modelId: "NOT_MODELED",
        functionNameTr: "-",
        rationaleTr: `Tanınmayan bileşen tipi: ${String(exhaustiveCheck)}`,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Birleşik tarama: API 14E + damlacık erozyonu
// ─────────────────────────────────────────────────────────────────────────

export interface CombinedErosionScreeningInput {
  api14e: Api14eScreeningInput;
  droplet: DropletErosionRiskInput;
}

export interface CombinedErosionScreeningResult {
  api14e: Api14eScreeningResult;
  droplet: DropletErosionRiskResult;
  /** İki taramadan HERHANGİ biri risk/aşım gösteriyorsa true */
  anyScreeningExceeded: boolean;
}

/**
 * API 14E ve damlacık erozyonu taramalarını TEK ÇAĞRIDA birleştirir.
 *
 * ⚠ Bu, katı parçacık (kum) erozyonu YERİNE GEÇMEZ — kum içeren akışlarda
 * asıl değerlendirme her zaman DNV-RP-O501 (selectDnvErosionModel +
 * ilgili erosion/dnvO501.ts fonksiyonu) ile yapılmalıdır.
 */
export function runCombinedErosionScreening(
  input: CombinedErosionScreeningInput,
): CombinedErosionScreeningResult {
  const api14eResult = assessApi14eScreening(input.api14e);
  const dropletResult = assessDropletErosionRisk(input.droplet);

  const api14eExceeded = api14eResult.warningLevel === "AŞILDI" || api14eResult.warningLevel === "KRİTİK";
  const dropletExceeded = dropletResult.riskLevel === "RİSKLİ";

  return {
    api14e: api14eResult,
    droplet: dropletResult,
    anyScreeningExceeded: api14eExceeded || dropletExceeded,
  };
}
