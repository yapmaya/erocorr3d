// apps/web/src/features/viewer3d/comparison/useSyncedCamera.ts
//
// Kamera senkronizasyonu (master görev madde 6) — iki BAĞIMSIZ `<Canvas>`
// (iki ayrı WebGL bağlamı, tek bir `OrbitControls` ikisini birden
// SÜREMEZ) arasında kamera durumunu paylaşmak için bir MUTABLE, PAYLAŞILAN
// referans nesnesi. Tek yönlü akış — GERİ BESLEME DÖNGÜSÜ YOK:
//   MASTER taraf (interaktif OrbitControls'lu) HER KAREDE kendi kamera
//   durumunu bu nesneye YAZAR; FOLLOWER taraf HER KAREDE bu nesneden
//   OKUR ve kendi kamerasını buna eşitler. Yalnızca MASTER yazar.

import { useRef } from "react";
import { Vector3 } from "three";

export interface SyncedCameraState {
  position: Vector3;
  target: Vector3;
  zoom: number;
}

export function useSyncedCameraState(
  initialPositionM: [number, number, number],
  initialTargetM: [number, number, number],
  initialZoom = 1,
): SyncedCameraState {
  return useRef<SyncedCameraState>({
    position: new Vector3(...initialPositionM),
    target: new Vector3(...initialTargetM),
    zoom: initialZoom,
  }).current;
}
