// apps/web/src/workers/assessmentWorkerClient.ts
//
// `assessmentWorker.ts`'i başlatıp comlink ile SARAN ana-thread istemcisi.
// SAF DEĞİL (gerçek bir Worker örneği yaratır) — bu yüzden Vitest ile test
// EDİLMEZ (bkz. features/projects/db.ts'in AYNI gerekçeli notu); tarayıcıda
// doğrulanır. Zaman aşımı mantığının kendisi SAF bir yardımcıya
// (`lib/withTimeout.ts`) çıkarıldı ve orada AYRI test edilir.

import * as Comlink from "comlink";
import type { AssessmentWorkerApi } from "./assessmentWorker";
import { withTimeout } from "../lib/withTimeout";

// Bu depoda tek bir bileşenin değerlendirmesi ~50-200 ms sürüyor (ölçülmüş
// tipik değer). Yavaş bir cihazda bu çok daha uzun olabilir, bu yüzden
// gerçek bir hesaplamanın PRATİKTE asla ulaşmayacağı, yalnızca worker hiç
// yanıt VERMEDİĞİNDE (CSP engeli, bayat PWA chunk'ı, çökme) devreye giren
// cömert bir "kilitlenmeyi engelle" sınırı seçildi.
const ASSESS_ONE_TIMEOUT_MS = 30_000;

/** Worker yüklenemedi/çöktü — çağıran taraf (batchAnalysis.ts) bunu `TimeoutError` ile birlikte "worker artık kullanılamaz" işareti olarak ele alır. */
export class WorkerFatalError extends Error {}

type AssessOneFn = (...args: Parameters<AssessmentWorkerApi["assessOne"]>) => Promise<ReturnType<AssessmentWorkerApi["assessOne"]>>;

export interface AssessmentWorkerClient {
  assessOne: AssessOneFn;
  terminate: () => void;
}

export function createAssessmentWorkerClient(): AssessmentWorkerClient {
  const worker = new Worker(new URL("./assessmentWorker.ts", import.meta.url), { type: "module" });
  const api = Comlink.wrap<AssessmentWorkerApi>(worker);

  // Worker hiç YÜKLENEMEZSE (CSP engeli, modül worker desteklemeyen tarayıcı,
  // bayat PWA chunk'ı) comlink'in promise'i ASLA çözülmez/reddedilmez —
  // `onerror` bu durumu YAKALAYIP açık bir hataya çevirir. Bir kez reddettikten
  // sonra bu promise KALICI OLARAK reddedilmiş kalır; bu sayede worker
  // öldükten SONRAKİ her `assessOne` çağrısı da (aşağıdaki Promise.race
  // sayesinde) 30 sn'lik zaman aşımını beklemeden HEMEN başarısız olur.
  const fatalError = new Promise<never>((_resolve, reject) => {
    worker.onerror = (event) => {
      reject(new WorkerFatalError(`Worker yüklenemedi veya çöktü: ${event.message || "bilinmeyen hata"}`));
    };
  });
  // Hiçbir çağrı henüz bu promise'i beklemiyor olsa bile (ör. worker ilk
  // assessOne çağrısından ÖNCE çökerse) tarayıcının "unhandled promise
  // rejection" uyarısı vermemesi için boş bir catch.
  fatalError.catch(() => {});

  const assessOne: AssessOneFn = (...args) =>
    withTimeout(
      Promise.race([api.assessOne(...args), fatalError]),
      ASSESS_ONE_TIMEOUT_MS,
      "Analiz motoru (worker) zaman aşımına uğradı — yanıt vermiyor.",
    );

  return { assessOne, terminate: () => worker.terminate() };
}
