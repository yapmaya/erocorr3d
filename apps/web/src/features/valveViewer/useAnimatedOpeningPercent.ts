// apps/web/src/features/valveViewer/useAnimatedOpeningPercent.ts
//
// Hedef (slider) opening%'e HER KAREDE (useFrame) üstel-yaklaşımla (lerp)
// yumuşakça ilerleyen bir React state döndürür. Vana geometrisi
// opening%'e göre YENİDEN ÜRETİLMEZ (pahalı olurdu — CSG içeren gövdeler
// için özellikle) — yalnızca her parçanın ANLIK pozu
// (geometry/valves'in kendi SAF `computePartPoseForOpening` fonksiyonu ile)
// bu değerden türetilir (bkz. ValveScene.tsx). Bilerek React state
// tabanlı (ref+imperatif Object3D mutasyonu DEĞİL) basit bir yaklaşım —
// ~10 parçalık bir montaj için performans sorunu YARATMAZ; bu proje "CAD
// kalitesi/motor performansı gerekmez" ilkesiyle tutarlı bir sadelik
// tercihidir (bkz. proje talimatı).

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

const SNAP_EPSILON = 0.05;

export function useAnimatedOpeningPercent(targetPercent: number, lerpSpeedPerSecond = 4): number {
  const [current, setCurrent] = useState(targetPercent);
  const currentRef = useRef(targetPercent);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useFrame((_, delta) => {
    const diff = targetPercent - currentRef.current;
    if (Math.abs(diff) < SNAP_EPSILON) {
      if (currentRef.current !== targetPercent) {
        currentRef.current = targetPercent;
        setCurrent(targetPercent);
      }
      return;
    }
    const next = currentRef.current + diff * Math.min(1, delta * lerpSpeedPerSecond);
    currentRef.current = next;
    setCurrent(next);
  });

  return current;
}
