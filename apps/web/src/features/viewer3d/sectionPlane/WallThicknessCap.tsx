// apps/web/src/features/viewer3d/sectionPlane/WallThicknessCap.tsx
//
// Kesit kapağı + teknik-resim et-kalınlığı taraması + ölçü çizgisi. Paylaşılan
// `components/three/SectionCapPlane.tsx` (stencil-uyumlu opak kapak) İLE
// AYNI hizalama tekniğini (useFrame'de plane.normal'e göre quaternion) tekrar
// uygular — kapak stencile göre "nerede katı var" gösterirken, BU dosya o
// katı alanın (=et kalınlığı halkası) ÜZERİNE taramayı/ölçüyü çizer.
// `sectionCapDimensions.ts`'in 2B yerel-düzlem noktaları, hizalanmış grubun
// YEREL x/y'sine doğrudan verilir — grup zaten dünya-uzayına doğru
// döndürülüp konumlandırıldığı için ayrıca dönüşüm GEREKMEZ.

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Text } from "@react-three/drei";
import { Group, Plane, Vector3 } from "three";
import { SectionCapPlane } from "../../../components/three/SectionCapPlane";
import { computeAnnulusHatchTicks2D, computeWallThicknessDimensionLine2D } from "./sectionCapDimensions";

export interface WallThicknessCapProps {
  plane: Plane;
  outerRadiusM: number;
  innerRadiusM: number;
  capSize: number;
}

const PLANE_LOCAL_NORMAL = new Vector3(0, 0, 1);
// Tarama/ölçü çizgileri, kapak yüzeyinin HEMEN önüne (yereldeki +Z, hizalama
// sonrası düzlem normali yönü) küçük bir miktar kaydırılır — z-fighting
// önlemi, SceneHelpers.tsx::ScaleReference'ın zemine göre aynı yaklaşımı.
const HATCH_Z_OFFSET_M = 0.0015;
const DIMENSION_Z_OFFSET_M = 0.002;

export function WallThicknessCap({ plane, outerRadiusM, innerRadiusM, capSize }: WallThicknessCapProps) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const pointOnPlane = plane.normal.clone().multiplyScalar(-plane.constant);
    group.position.copy(pointOnPlane);
    group.quaternion.setFromUnitVectors(PLANE_LOCAL_NORMAL, plane.normal);
  });

  const hatchTicks = useMemo(() => computeAnnulusHatchTicks2D(outerRadiusM, innerRadiusM), [outerRadiusM, innerRadiusM]);
  const dimLine = useMemo(() => computeWallThicknessDimensionLine2D(outerRadiusM, innerRadiusM), [outerRadiusM, innerRadiusM]);

  return (
    <>
      <SectionCapPlane plane={plane} size={capSize} />
      <group ref={groupRef} renderOrder={4}>
        {hatchTicks.map((tick, i) => (
          <Line
            key={i}
            points={[
              [tick.start.x, tick.start.y, HATCH_Z_OFFSET_M],
              [tick.end.x, tick.end.y, HATCH_Z_OFFSET_M],
            ]}
            color="#052e16"
            lineWidth={1}
          />
        ))}
        <Line
          points={[
            [dimLine.startXY.x, dimLine.startXY.y, DIMENSION_Z_OFFSET_M],
            [dimLine.endXY.x, dimLine.endXY.y, DIMENSION_Z_OFFSET_M],
          ]}
          color="#fef08a"
          lineWidth={1.5}
        />
        <Text
          position={[dimLine.labelPositionXY.x, dimLine.labelPositionXY.y, DIMENSION_Z_OFFSET_M]}
          fontSize={Math.max(outerRadiusM * 0.28, 0.02)}
          color="#fef08a"
          anchorX="center"
          anchorY="middle"
        >
          {`${dimLine.wallThicknessMm.toFixed(1)} mm`}
        </Text>
      </group>
    </>
  );
}
