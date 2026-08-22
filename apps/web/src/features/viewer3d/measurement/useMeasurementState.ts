// apps/web/src/features/viewer3d/measurement/useMeasurementState.ts
//
// Ölçüm modu + tıklanan nokta(lar) — SAF React state. Türetilmiş sonuçlar
// (mesafe mm, kalan et, saat pozisyonu) BURADA HESAPLANMAZ — bu hook sadece
// "hangi mod aktif, hangi noktalar tıklandı"yı tutar; PipeViewer.tsx::SceneRoot
// zaten sahip olduğu geometri/senaryo/zaman bilgisiyle türetilmiş sonuçları
// kendi `useMemo`larında hesaplar (bkz. measurementMath.ts).

import { useCallback, useState } from "react";
import type { Vec3Tuple } from "./measurementMath";

export const MEASUREMENT_MODES = ["NONE", "DISTANCE", "WALL_PROBE", "CLOCK"] as const;
export type MeasurementMode = (typeof MEASUREMENT_MODES)[number];

const MAX_DISTANCE_POINTS = 2;

export function useMeasurementState() {
  const [mode, setModeRaw] = useState<MeasurementMode>("NONE");
  const [distancePoints, setDistancePoints] = useState<Vec3Tuple[]>([]);
  const [probePoint, setProbePoint] = useState<Vec3Tuple | null>(null);
  const [clockPoint, setClockPoint] = useState<Vec3Tuple | null>(null);

  const clearPoints = useCallback(() => {
    setDistancePoints([]);
    setProbePoint(null);
    setClockPoint(null);
  }, []);

  const setMode = useCallback(
    (nextMode: MeasurementMode) => {
      setModeRaw(nextMode);
      clearPoints();
    },
    [clearPoints],
  );

  const handleSurfaceClick = useCallback(
    (point: Vec3Tuple) => {
      if (mode === "DISTANCE") {
        setDistancePoints((prev) => (prev.length >= MAX_DISTANCE_POINTS ? [point] : [...prev, point]));
      } else if (mode === "WALL_PROBE") {
        setProbePoint(point);
      } else if (mode === "CLOCK") {
        setClockPoint(point);
      }
    },
    [mode],
  );

  return { mode, setMode, distancePoints, probePoint, clockPoint, handleSurfaceClick, clearPoints };
}
