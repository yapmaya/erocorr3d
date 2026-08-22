// apps/web/src/features/input/computeAssessment.ts
//
// "Hesapla" düğmesinin gerçek eylemi: taslağı motorun kendi Zod şemalarıyla
// (yeniden) doğrular, `assessComponentScenario`'yu çağırır ve sonucu
// `useAssessmentStore`'a yazar. Vana kategorisi için motorun KENDİ
// kısıtını (bkz. orchestrate/assessComponent.ts'in VALVE_COMPONENT_TYPES
// erken-hata deseni) UI'da AÇIKÇA gösterir — sonuç UYDURMAZ.

import { assessComponentScenario, GeometrySchema, MitigationSchema, OperatingProfileSchema } from "@erocorr3d/engine";
import { useAssessmentStore } from "../../store/assessmentStore";
import { useAssessmentHistoryStore } from "../../store/assessmentHistoryStore";
import type { WizardDraft } from "./schema";

export const VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR =
  'Bu sürümde motor yalnızca boru/fitting bileşenlerini değerlendiriyor — vana mekanizma orkestrasyonu henüz bağlanmadı (bkz. packages/engine/src/orchestrate/assessComponent.ts). Vana geometrisini kaydedip önizleyebilirsiniz, ancak "Hesapla" bu kategori için sayısal bir korozyon/erozyon sonucu üretmez.';

export type ComputeAssessmentResult = { ok: true } | { ok: false; messageTr: string };

/**
 * Taslağı motor girdilerine çevirip `assessComponentScenario`'yu çalıştırır
 * ve sonucu (veya hatayı) `useAssessmentStore`'a yazar. Motor SAF/senkron
 * olduğundan (bkz. BOTAŞ fixture'ının aynı şekilde ana thread'de çalışan
 * `getBotasScenarioAssessment`'ı) Web Worker'a gerek yoktur.
 */
export function computeAssessment(draft: WizardDraft): ComputeAssessmentResult {
  const store = useAssessmentStore.getState();

  if (draft.componentCategory === "VALVE") {
    store.setError(VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR);
    return { ok: false, messageTr: VALVE_ASSESSMENT_UNSUPPORTED_MESSAGE_TR };
  }

  try {
    const geometry = GeometrySchema.parse(draft.geometry);
    const mitigation = MitigationSchema.parse(draft.mitigation);
    const operatingProfile = OperatingProfileSchema.parse(draft.operatingProfile);
    const assessment = assessComponentScenario(geometry, mitigation, operatingProfile, {}, draft.componentLabel);

    // "SLC İnhibitörsüz" karşılaştırması (Sonuçlar tablosu) — motor
    // GERÇEKTEN inhibitorUsed=false ile TEKRAR çalıştırılır (bkz.
    // assessmentHistoryStore.ts'in dosya başı notu: NORSOK M-506 yolu
    // rules.ts::applyInhibitorFloor'u kullanmıyor, bu yüzden bir "ne olurdu"
    // sayısı yalnızca gerçek bir ikinci çalıştırmayla elde edilebilir).
    // Taslak zaten inhibitörsüzse bu ZATEN `assessment`in kendisidir.
    const uninhibitedAssessment = mitigation.inhibitorUsed
      ? assessComponentScenario(geometry, { ...mitigation, inhibitorUsed: false }, operatingProfile, {}, draft.componentLabel)
      : assessment;

    store.setResult({ componentLabel: draft.componentLabel, geometry, operatingProfile, assessment });
    useAssessmentHistoryStore.getState().addEntry({
      componentLabel: draft.componentLabel,
      geometry,
      mitigation,
      operatingProfile,
      assessment,
      uninhibitedAssessment,
    });
    return { ok: true };
  } catch (error) {
    const messageTr =
      error instanceof Error
        ? `Hesaplama sırasında hata: ${error.message}`
        : "Hesaplama sırasında bilinmeyen bir hata oluştu.";
    store.setError(messageTr);
    return { ok: false, messageTr };
  }
}
