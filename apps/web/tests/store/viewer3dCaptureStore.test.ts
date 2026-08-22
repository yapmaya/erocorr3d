// apps/web/tests/store/viewer3dCaptureStore.test.ts

import { describe, expect, it } from "vitest";
import { useViewer3dCaptureStore, captureCurrentViewPng } from "../../src/store/viewer3dCaptureStore";

describe("viewer3dCaptureStore", () => {
  it("görüntüleyici hiç mount olmadıysa null döner (uydurulmuş bir görsel VERİLMEZ)", () => {
    expect(captureCurrentViewPng()).toBeNull();
  });

  it("registerCapture sonrası kayıtlı fonksiyonu çağırır", () => {
    useViewer3dCaptureStore.getState().registerCapture(() => "data:image/png;base64,TEST");
    expect(captureCurrentViewPng()).toBe("data:image/png;base64,TEST");
  });

  it("unregisterCapture sonrası tekrar null döner", () => {
    useViewer3dCaptureStore.getState().registerCapture(() => "data:image/png;base64,TEST");
    useViewer3dCaptureStore.getState().unregisterCapture();
    expect(captureCurrentViewPng()).toBeNull();
  });
});
