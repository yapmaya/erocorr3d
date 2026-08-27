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

/** Kameranın sahnede makul kalacağı üst sınır (m) — 1e308 gibi bir değer projeksiyon matrisini NaN'a çevirir. */
const MAX_ABS_COORDINATE_M = 1e6;

function parseVec3(raw: string | null): [number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 3) return null;
  // `Number("")` = 0 (JS tuzağı): ",," gibi BOŞ bir değer sessizce [0,0,0]
  // oluyordu. Boş/yalnızca-boşluk parçalar AÇIKÇA reddedilir.
  if (parts.some((p) => p.trim() === "")) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isFinite(n) || Math.abs(n) > MAX_ABS_COORDINATE_M)) return null;
  return [numbers[0]!, numbers[1]!, numbers[2]!];
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
  const zoom = zoomRaw !== null && zoomRaw.trim() !== "" ? Number(zoomRaw) : NaN;
  if (!positionM || !targetM || !Number.isFinite(zoom)) return null;

  // `zoom <= 0` three.js'in projeksiyon matrisini bozar (sıfıra bölme →
  // NaN matris → BOŞ/siyah tuval). `Number.isFinite(0)` true olduğu için
  // eski kontrol bunu YAKALAMIYORDU.
  if (zoom <= 0) return null;

  // Kamera konumu ile hedefi AYNI ise bakış vektörü sıfır uzunluktadır —
  // OrbitControls bu durumda NaN üretir ve görüntüleyici kilitlenir.
  if (positionM.every((v, i) => v === targetM[i])) return null;

  return { positionM, targetM, orthographic: params.get(PARAM_ORTHO) === "1", zoom };
}

/** `baseUrl`in mevcut query'sini KORUYARAK kamera alanlarını ekler/günceller. */
export function buildShareUrl(state: CameraShareState, baseUrl: string): string {
  const url = new URL(baseUrl);
  url.search = encodeCameraStateToParams(state, url.searchParams).toString();
  return url.toString();
}
