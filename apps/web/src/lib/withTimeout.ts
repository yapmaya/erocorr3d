// apps/web/src/lib/withTimeout.ts
//
// Bir promise'i zaman aşımına uğratan SAF yardımcı — DOM/Worker'a dokunmaz,
// bu yüzden sahte zamanlayıcılarla (fake timers) test edilebilir. Worker
// istemcisinin (assessmentWorkerClient.ts) "worker hiç yanıt vermiyor"
// durumunu ele alması için çıkarıldı.

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessageTr: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(timeoutMessageTr)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
