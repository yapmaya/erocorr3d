// apps/web/src/features/valveViewer/ValvePartMesh.tsx
//
// TEK bir vana parçasını (BODY, WEDGE, STEM, ...) render eder: tıklanabilir
// (raycast → onSelect), üstüne gelince vurgulanır (hover), ve kesit
// düzlemi AKTİFSE `SectionStencilPasses` ile kendi arka/ön yüz
// stencil-yazma geçişini ekler (bkz. components/three/SectionCapPlane.tsx —
// o dosya PAYLAŞILAN kapağı çizer, SectionStencilPasses HER parçanın
// stencil sayacına KENDİ katkısını yazar).
//
// Poz sarmalayıcı: `<group position={pivotPointM + pose.positionM}
// rotation={pose.rotationRad}>` — pivotPointM SIFIR olan (çoğunluk) parça-
// larda bu basitçe pose'un kendisidir; menteşeli (checkValve.ts'in swing/
// dualPlate diskleri gibi) parçalarda geometri ZATEN pivot-göreli inşa
// edilmiştir (bkz. geometry/valves/types.ts::ValvePivot), bu yüzden AYNI
// formül HER İKİ durumda da doğru sonuç verir (bkz. modülün kendi türetimi).

import { useState } from "react";
import { DoubleSide, type BufferGeometry, type Plane } from "three";
import type { ValvePartPose, ValvePivot } from "../../geometry";
import { colorForPartName } from "./partAppearance";
import { SectionStencilPasses } from "../../components/three/SectionStencilPasses";

export interface ValvePartMeshProps {
  name: string;
  geometry: BufferGeometry;
  pose: ValvePartPose;
  pivotPointM: ValvePivot["pivotPointM"];
  plane: Plane;
  sectionEnabled: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function ValvePartMesh({ name, geometry, pose, pivotPointM, plane, sectionEnabled, selected, onSelect }: ValvePartMeshProps) {
  const [hovered, setHovered] = useState(false);

  const groupPositionM: [number, number, number] = [
    pivotPointM[0] + pose.positionM[0],
    pivotPointM[1] + pose.positionM[1],
    pivotPointM[2] + pose.positionM[2],
  ];

  const color = colorForPartName(name);
  const emissive = selected ? "#38bdf8" : hovered ? "#0ea5e9" : "#000000";
  const emissiveIntensity = selected ? 0.6 : hovered ? 0.25 : 0;
  const clippingPlanes = sectionEnabled ? [plane] : [];

  return (
    <group position={groupPositionM} rotation={pose.rotationRad}>
      {sectionEnabled && <SectionStencilPasses geometry={geometry} plane={plane} />}
      <mesh
        geometry={geometry}
        renderOrder={2}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.85}
          roughness={0.32}
          side={DoubleSide}
          clippingPlanes={clippingPlanes}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
    </group>
  );
}
