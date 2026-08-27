// apps/web/tests/lib/withTimeout.test.ts

import { describe, expect, it, vi, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "../../src/lib/withTimeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("promise zaman aşımından ÖNCE çözülürse değeri döner", async () => {
    const result = await withTimeout(Promise.resolve("tamam"), 1000, "zaman aşımı");
    expect(result).toBe("tamam");
  });

  it("promise zaman aşımından ÖNCE reddedilirse orijinal hatayı iletir", async () => {
    const original = new Error("motor hatası");
    await expect(withTimeout(Promise.reject(original), 1000, "zaman aşımı")).rejects.toBe(original);
  });

  it("promise SÜRESİNDE çözülmezse TimeoutError ile reddeder", async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise<string>(() => {});
    const pending = withTimeout(neverSettles, 1000, "yanıt vermiyor");
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("TimeoutError mesajı verilen Türkçe metni taşır", async () => {
    vi.useFakeTimers();
    const neverSettles = new Promise<string>(() => {});
    const pending = withTimeout(neverSettles, 500, "Analiz motoru (worker) zaman aşımına uğradı.");
    const assertion = expect(pending).rejects.toThrow("Analiz motoru (worker) zaman aşımına uğradı.");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
