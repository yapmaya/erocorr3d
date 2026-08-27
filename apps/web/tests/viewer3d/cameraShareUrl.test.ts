// apps/web/tests/viewer3d/cameraShareUrl.test.ts

import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  decodeCameraStateFromParams,
  encodeCameraStateToParams,
  type CameraShareState,
} from "../../src/features/viewer3d/export/cameraShareUrl";

const SAMPLE_STATE: CameraShareState = {
  positionM: [1.2345, -2.5, 3],
  targetM: [0, 0.5, -1.25],
  orthographic: true,
  zoom: 42.5,
};

describe("encodeCameraStateToParams / decodeCameraStateFromParams", () => {
  it("round-trip: encode edilip decode edilen durum orijinaliyle (4 ondalık hassasiyetle) eşleşir", () => {
    const params = encodeCameraStateToParams(SAMPLE_STATE);
    const decoded = decodeCameraStateFromParams(params);
    expect(decoded).not.toBeNull();
    expect(decoded!.positionM[0]).toBeCloseTo(SAMPLE_STATE.positionM[0], 4);
    expect(decoded!.positionM[1]).toBeCloseTo(SAMPLE_STATE.positionM[1], 4);
    expect(decoded!.positionM[2]).toBeCloseTo(SAMPLE_STATE.positionM[2], 4);
    expect(decoded!.targetM).toEqual(expect.arrayContaining(decoded!.targetM));
    expect(decoded!.orthographic).toBe(true);
    expect(decoded!.zoom).toBeCloseTo(SAMPLE_STATE.zoom, 4);
  });

  it("orthographic=false doğru kodlanır/çözülür", () => {
    const params = encodeCameraStateToParams({ ...SAMPLE_STATE, orthographic: false });
    expect(decodeCameraStateFromParams(params)!.orthographic).toBe(false);
  });

  it("var olan diğer query parametrelerini KORUR", () => {
    const base = new URLSearchParams("foo=bar");
    const params = encodeCameraStateToParams(SAMPLE_STATE, base);
    expect(params.get("foo")).toBe("bar");
  });

  it("eksik parametrelerde null döner (kısmi uygulama yok)", () => {
    const params = new URLSearchParams();
    params.set("camPos", "1,2,3");
    // camTarget/camZoom eksik
    expect(decodeCameraStateFromParams(params)).toBeNull();
  });

  it("bozuk (3 sayı olmayan) bir vektör için null döner", () => {
    const params = new URLSearchParams();
    params.set("camPos", "1,2");
    params.set("camTarget", "0,0,0");
    params.set("camZoom", "1");
    expect(decodeCameraStateFromParams(params)).toBeNull();
  });

  it("boş URLSearchParams için null döner", () => {
    expect(decodeCameraStateFromParams(new URLSearchParams())).toBeNull();
  });
});

describe("buildShareUrl", () => {
  it("tam bir URL string'i üretir ve baseUrl'in path'ini korur", () => {
    const url = buildShareUrl(SAMPLE_STATE, "http://localhost:5173/some/path");
    expect(url.startsWith("http://localhost:5173/some/path?")).toBe(true);
  });

  it("üretilen URL'den kamera durumu geri okunabilir", () => {
    const url = buildShareUrl(SAMPLE_STATE, "http://localhost:5173/");
    const parsed = new URL(url);
    const decoded = decodeCameraStateFromParams(parsed.searchParams);
    expect(decoded).not.toBeNull();
    expect(decoded!.orthographic).toBe(true);
  });
});

describe("decodeCameraStateFromParams — bozuk/dejenere paylaşım bağlantıları", () => {
  const paramsFor = (o: Record<string, string>) => new URLSearchParams(o);
  const valid = { camPos: "1,2,3", camTarget: "0,0,0", camZoom: "1", camOrtho: "0" };

  it("geçerli bir bağlantıyı KABUL eder (kontrol)", () => {
    expect(decodeCameraStateFromParams(paramsFor(valid))).not.toBeNull();
  });

  it("zoom = 0 reddedilir (projeksiyon matrisini bozar)", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camZoom: "0" }))).toBeNull();
  });

  it("negatif zoom reddedilir", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camZoom: "-5" }))).toBeNull();
  });

  it("konum ile hedef AYNI ise reddedilir (sıfır uzunlukta bakış vektörü)", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camPos: "0,0,0", camTarget: "0,0,0" }))).toBeNull();
  });

  it("boş bileşenli vektör ',,' sessizce [0,0,0] OLMAZ", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camPos: ",," }))).toBeNull();
  });

  it("aşırı büyük koordinatlar reddedilir", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camPos: "1e308,1e308,1e308" }))).toBeNull();
  });

  it("boş zoom değeri sessizce 0 OLMAZ", () => {
    expect(decodeCameraStateFromParams(paramsFor({ ...valid, camZoom: "" }))).toBeNull();
  });
});
