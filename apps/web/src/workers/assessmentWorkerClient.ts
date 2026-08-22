// apps/web/src/workers/assessmentWorkerClient.ts
//
// `assessmentWorker.ts`'i başlatıp comlink ile SARAN ana-thread istemcisi.
// SAF DEĞİL (gerçek bir Worker örneği yaratır) — bu yüzden Vitest ile test
// EDİLMEZ (bkz. features/projects/db.ts'in AYNI gerekçeli notu); tarayıcıda
// doğrulanır.

import * as Comlink from "comlink";
import type { AssessmentWorkerApi } from "./assessmentWorker";

export interface AssessmentWorkerClient {
  api: Comlink.Remote<AssessmentWorkerApi>;
  terminate: () => void;
}

export function createAssessmentWorkerClient(): AssessmentWorkerClient {
  const worker = new Worker(new URL("./assessmentWorker.ts", import.meta.url), { type: "module" });
  const api = Comlink.wrap<AssessmentWorkerApi>(worker);
  return { api, terminate: () => worker.terminate() };
}
