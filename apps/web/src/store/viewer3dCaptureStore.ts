// apps/web/src/store/viewer3dCaptureStore.ts
//
// 3B görüntüleyicinin O ANKİ kamera açısının PNG anlık görüntüsünü, Canvas'ın
// React ağacı DIŞINDAKİ koda (rapor üretimi — features/report/) senkron
// olarak sunan köprü store. `capturePngDataUrl` (viewer3d/export/exportPng.ts)
// yalnızca PipeViewer.tsx::SceneRoot içinde (Canvas'ın `gl`/`scene`/`camera`
// context'ine `useThree` ile erişimi olan tek yer) çağrılabilir — SceneRoot
// mount olduğunda kendi capture closure'ını buraya kaydeder, unmount'ta siler.
//
// 3B görüntüleyici hiç açılmadıysa (ör. kullanıcı raporu başka bir sekmedeyken
// üretiyorsa) `captureFn` null'dır — çağıran taraf bunu "görsel yok" olarak
// ele almalıdır, sessizce boş bir resim UYDURULMAZ.

import { create } from "zustand";

type CaptureFn = () => string;

interface Viewer3dCaptureState {
  captureFn: CaptureFn | null;
  registerCapture: (fn: CaptureFn) => void;
  unregisterCapture: () => void;
}

export const useViewer3dCaptureStore = create<Viewer3dCaptureState>((set) => ({
  captureFn: null,
  registerCapture: (fn) => set({ captureFn: fn }),
  unregisterCapture: () => set({ captureFn: null }),
}));

/** Şu anki 3B görünümün PNG data URL'sini döndürür; görüntüleyici mount değilse `null`. */
export function captureCurrentViewPng(): string | null {
  const { captureFn } = useViewer3dCaptureStore.getState();
  return captureFn ? captureFn() : null;
}
