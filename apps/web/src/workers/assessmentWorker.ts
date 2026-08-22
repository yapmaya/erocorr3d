// apps/web/src/workers/assessmentWorker.ts
//
// Toplu analiz (Proje kütüphanesi) için Web Worker — `assessComponentScenario`
// motorun KENDİ SAF/bağımsız fonksiyonudur (bkz. packages/engine — DOM'a
// bağımlı değildir), bu yüzden worker içinde DEĞİŞİKLİKSİZ çalışır; yeni bir
// hesap İCAT EDİLMEZ, yalnızca ana thread'i bloke etmeden çağrılır.
//
// comlink ile dışa açılır (proje zaten `comlink` bağımlılığını taşıyor —
// bkz. apps/web/package.json).

import * as Comlink from "comlink";
import { assessComponentScenario } from "@erocorr3d/engine";
import type { Geometry, Mitigation, OperatingProfile, ScenarioAssessment } from "@erocorr3d/engine";

const assessmentWorkerApi = {
  assessOne(geometry: Geometry, mitigation: Mitigation, operatingProfile: OperatingProfile, componentLabel: string): ScenarioAssessment {
    return assessComponentScenario(geometry, mitigation, operatingProfile, {}, componentLabel);
  },
};

export type AssessmentWorkerApi = typeof assessmentWorkerApi;

Comlink.expose(assessmentWorkerApi);
