// apps/web/src/features/viewer3d/export/cameraShareUrl.ts
//
// Kamera açısını paylaşılabilir bir URL'ye kodlar/çözer (master görev
// madde 9). SAF matematik/string işleme — three.js/DOM bağımlılığı yok
// (URL'nin KENDİSİNE yazma/okuma PipeViewer.tsx::SceneRoot'ta yapılır).
// KDP kapsamı DIŞINDADIR — mühendislik katsayısı değil, kodlama şeması.

export interface CameraShareState {
  positionM: [number, number, number];
  targetM: [number, number, number];
  orthographic: boolean;
  zoom: number;
}

const PARAM_POSITION = "camPos";
const PARAM_TARGET = "camTarget";
const PARAM_ORTHO = "camOrtho";
const PARAM_ZOOM = "camZoom";
const DECIMAL_PLACES = 4;

function formatVec3(v: [number, number, number]): string {
  return v.map((n) => n.toFixed(DECIMAL_PLACES)).join(",");
}

function parseVec3(raw: string | null): [number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/** Verilen (opsiyonel) taban `URLSearchParams` üzerine kamera alanlarını YAZAR — diğer query parametrelerine dokunmaz. */
export function encodeCameraStateToParams(state: CameraShareState, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  params.set(PARAM_POSITION, formatVec3(state.positionM));
  params.set(PARAM_TARGET, formatVec3(state.targetM));
  params.set(PARAM_ORTHO, state.orthographic ? "1" : "0");
  params.set(PARAM_ZOOM, state.zoom.toFixed(DECIMAL_PLACES));
  return params;
}

/** Eksik/bozuk parametre varsa `null` döner (hiçbir kamera alanını KISMİ uygulamaz). */
export function decodeCameraStateFromParams(params: URLSearchParams): CameraShareState | null {
  const positionM = parseVec3(params.get(PARAM_POSITION));
  const targetM = parseVec3(params.get(PARAM_TARGET));
  const zoomRaw = params.get(PARAM_ZOOM);
  const zoom = zoomRaw !== null ? Number(zoomRaw) : NaN;
  if (!positionM || !targetM || !Number.isFinite(zoom)) return null;
  return { positionM, targetM, orthographic: params.get(PARAM_ORTHO) === "1", zoom };
}

/** `baseUrl`in mevcut query'sini KORUYARAK kamera alanlarını ekler/günceller. */
export function buildShareUrl(state: CameraShareState, baseUrl: string): string {
  const url = new URL(baseUrl);
  url.search = encodeCameraStateToParams(state, url.searchParams).toString();
  return url.toString();
}
