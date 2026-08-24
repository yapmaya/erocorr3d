// apps/web/src/features/viewer3d/performance/FpsProbe.tsx
//
// `Canvas` içine yerleştirilen, GÖRÜNMEZ bir FPS ölçüm probu — mevcut
// `FpsCounter.tsx`'in (stats.js widget'ı, yalnızca GÖRSEL) aksine,
// `usePerfStore`'a sayısal bir kayan-ortalama FPS yazar (yalnızca
// `DevPerfOverlay`'in okuması için — bkz. performans bütçesi, master görev
// madde 9). Saniyede yalnızca birkaç kez state günceller (her karede DEĞİL)
// ki bu ölçümün kendisi performansı etkilemesin.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { usePerfStore } from "../../../store/perfStore";

const UPDATE_INTERVAL_S = 0.5;

export function FpsProbe() {
  const frameCountRef = useRef(0);
  const elapsedSinceUpdateRef = useRef(0);

  useFrame((_state, deltaSeconds) => {
    frameCountRef.current += 1;
    elapsedSinceUpdateRef.current += deltaSeconds;
    if (elapsedSinceUpdateRef.current >= UPDATE_INTERVAL_S) {
      const fps = frameCountRef.current / elapsedSinceUpdateRef.current;
      usePerfStore.getState().setFps(fps);
      frameCountRef.current = 0;
      elapsedSinceUpdateRef.current = 0;
    }
  });

  return null;
}
