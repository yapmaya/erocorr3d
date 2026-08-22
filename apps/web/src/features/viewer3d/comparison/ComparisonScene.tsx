// apps/web/src/features/viewer3d/comparison/ComparisonScene.tsx
//
// Karşılaştırma modunun TEK bir tarafı (kendi `<Canvas>`ının İÇİNDE render
// edilir — bkz. ComparisonViewer.tsx, iki BAĞIMSIZ Canvas). Hangi skaler
// alanı (A'nın kendi hasarı / B'nin kendi hasarı / delta) göstereceğine
// KARIŞMAZ — `heatmapValues`/`minValue`/`maxValue`/`colormap` üst bileşenden
// gelir (bkz. PipeMesh.tsx/HeatmapMesh.tsx'in AYNI "akıllı ebeveyn, aptal
// çocuk" deseni). Kesit düzlemi/hotspot/ölçüm katmanları YOK — karşılaştırma
// modu, master görev talimatının kendi kapsamıyla (yan yana viewport +
// kamera senkronizasyonu + fark haritası) sınırlı, tam donanımlı tekli
// görüntüleyicinin bir KOPYASI değil.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HeatmapMesh } from "../../../shaders";
import type { ColormapName } from "../../../shaders";
import { SceneHelpers } from "../SceneHelpers";
import type { PipeGeometryInfo } from "../usePipeGeometry";
import type { SyncedCameraState } from "./useSyncedCamera";

export interface ComparisonSceneProps {
  geometryInfo: PipeGeometryInfo;
  heatmapValues: Float32Array;
  minValue: number;
  maxValue: number;
  colormap: ColormapName;
  invertColormap: boolean;
  wallThicknessMm: number;
  syncedState: SyncedCameraState;
  /** true → bu taraf İNTERAKTİF (OrbitControls'lu) ve durumu `syncedState`e YAZAR; false → SADECE `syncedState`i okuyup kendi kamerasına uygular. */
  master: boolean;
  isDark: boolean;
}

export function ComparisonScene({
  geometryInfo,
  heatmapValues,
  minValue,
  maxValue,
  colormap,
  invertColormap,
  wallThicknessMm,
  syncedState,
  master,
  isDark,
}: ComparisonSceneProps) {
  const { geometry, lengthM, outerRadiusM } = geometryInfo;
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const targetM: [number, number, number] = [lengthM / 2, 0, 0];
  const boundingRadiusM = Math.sqrt((lengthM / 2) ** 2 + outerRadiusM ** 2);
  const startPositionM: [number, number, number] = [boundingRadiusM * 1.6, boundingRadiusM, boundingRadiusM * 1.6];

  useFrame(({ camera }) => {
    if (master) {
      syncedState.position.copy(camera.position);
      if (controlsRef.current) syncedState.target.copy(controlsRef.current.target);
      syncedState.zoom = camera.zoom;
    } else {
      camera.position.copy(syncedState.position);
      camera.zoom = syncedState.zoom;
      camera.updateProjectionMatrix();
      camera.lookAt(syncedState.target);
    }
  });

  return (
    <>
      <color attach="background" args={[isDark ? "#0a0a0a" : "#dbe1ea"]} />
      <ambientLight intensity={isDark ? 0.4 : 0.75} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow />
      <PerspectiveCamera makeDefault position={startPositionM} fov={45} />
      {master && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={targetM}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.05}
          maxDistance={boundingRadiusM * 20}
        />
      )}
      <HeatmapMesh
        geometry={geometry}
        values={heatmapValues}
        colormap={colormap}
        minValue={minValue}
        maxValue={maxValue}
        opacity={1}
        thresholdWarn={wallThicknessMm * 0.5}
        thresholdCritical={wallThicknessMm * 0.8}
        wallThicknessMm={wallThicknessMm}
        isoStepMm={1}
        deformEnabled={false}
        deformExaggeration={1}
        invertColormap={invertColormap}
      />
      <SceneHelpers lengthM={lengthM} />
    </>
  );
}
