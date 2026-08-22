// apps/web/src/shaders/HeatmapMesh.tsx
//
// GeometryLab'in FITTING modunda, ısı haritası açıkken mevcut gri
// `GeometryMesh`'in YERİNİ alan R3F bileşeni (`GeometryMesh`'in kendisi
// DOKUNULMADAN kalır — bkz. pages/GeometryLab.tsx). `values` (skaler dizi,
// vertex sayısı kadar) her değiştiğinde geometrinin `damage` attribute'una
// yazılır; `uTime` nabız animasyonu için her karede ilerletilir.

import { useEffect, useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { DoubleSide, type BufferGeometry, type Plane } from "three";
import { DamageHeatmapMaterial, writeDamageAttribute } from "./damageHeatmapMaterial";
import type { ColormapName } from "./colormaps";

export interface HeatmapMeshProps {
  geometry: BufferGeometry;
  values: Float32Array;
  colormap: ColormapName;
  minValue: number;
  maxValue: number;
  opacity: number;
  thresholdWarn: number;
  thresholdCritical: number;
  wallThicknessMm: number;
  isoStepMm: number;
  deformEnabled: boolean;
  deformExaggeration: number;
  invertColormap: boolean;
  /** Kesit düzlemi (world-space) — `null`/`undefined` ise kırpma uygulanmaz. */
  clipPlane?: Plane | null;
  /** bkz. ValvePartMesh.tsx/PipeMesh.tsx'in stencil-katman sırası kuralı (stencil geçişleri=1, görünür mesh=2, kapak=3). */
  renderOrder?: number;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

export function HeatmapMesh({
  geometry,
  values,
  colormap,
  minValue,
  maxValue,
  opacity,
  thresholdWarn,
  thresholdCritical,
  wallThicknessMm,
  isoStepMm,
  deformEnabled,
  deformExaggeration,
  invertColormap,
  clipPlane = null,
  renderOrder = 0,
  onClick,
}: HeatmapMeshProps) {
  const material = useMemo(() => {
    const m = new DamageHeatmapMaterial({ colormap });
    m.side = DoubleSide;
    return m;
    // materyal SADECE bir kez kurulur (ilk `colormap` değeriyle); sonraki prop
    // değişiklikleri aşağıdaki effect'lerle uniform güncellemesi olarak uygulanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    material.setColormap(colormap);
  }, [material, colormap]);

  useEffect(() => {
    material.setRange(minValue, maxValue);
  }, [material, minValue, maxValue]);

  useEffect(() => {
    material.setOpacity(opacity);
  }, [material, opacity]);

  useEffect(() => {
    material.setThresholds(thresholdWarn, thresholdCritical);
  }, [material, thresholdWarn, thresholdCritical]);

  useEffect(() => {
    material.setWallThicknessMm(wallThicknessMm);
  }, [material, wallThicknessMm]);

  useEffect(() => {
    material.setIsoStepMm(isoStepMm);
  }, [material, isoStepMm]);

  useEffect(() => {
    material.setDeform(deformEnabled, deformExaggeration);
  }, [material, deformEnabled, deformExaggeration]);

  useEffect(() => {
    material.setInvertColormap(invertColormap);
  }, [material, invertColormap]);

  useEffect(() => {
    material.setClipPlane(clipPlane);
  }, [material, clipPlane]);

  useEffect(() => {
    writeDamageAttribute(geometry, values);
  }, [geometry, values]);

  useFrame((_state, delta) => {
    material.advanceTime(delta);
  });

  return <mesh castShadow receiveShadow geometry={geometry} material={material} renderOrder={renderOrder} onClick={onClick} />;
}
