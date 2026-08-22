// apps/web/src/features/valveViewer/ValveScene.tsx
//
// Vana montajının 3B sahne içeriği. LOD (drei `Detailed`): kamera
// YAKINDA tam parça seti (tıklanabilir/kesit-destekli), UZAKTA (bkz.
// LOD_FAR_DISTANCE_M) tek bir basit silindir görünür — GeometryLab'ın
// mevcut FITTING görünümünde LOD YOKTU (tek parça zaten ucuzdu); vana
// montajları 4-10 parça+CSG içerdiğinden bu proje kendi LOD katmanını
// ekliyor (bkz. proje talimatı "uzaktan basit silindir, yakında tam detay").

import { useMemo } from "react";
import { Detailed } from "@react-three/drei";
import { CylinderGeometry, DoubleSide, Plane, Vector3 } from "three";
import { computePartPoseForOpening, IDENTITY_POSE, type ValveAssembly } from "../../geometry";
import { ValvePartMesh } from "./ValvePartMesh";
import { SectionCapPlane } from "../../components/three/SectionCapPlane";
import { FlowParticles } from "./FlowParticles";
import { useAnimatedOpeningPercent } from "./useAnimatedOpeningPercent";

export interface ValveSceneProps {
  assembly: ValveAssembly;
  targetOpeningPercent: number;
  sectionEnabled: boolean;
  sectionOffsetM: number;
  flowVisible: boolean;
  selectedPartName: string | null;
  onSelectPart: (name: string) => void;
}

const LOD_FAR_DISTANCE_M = 6;
const PLANE_LOCAL_NORMAL = new Vector3(0, 0, 1);

export function ValveScene({
  assembly,
  targetOpeningPercent,
  sectionEnabled,
  sectionOffsetM,
  flowVisible,
  selectedPartName,
  onSelectPart,
}: ValveSceneProps) {
  const animatedOpeningPercent = useAnimatedOpeningPercent(targetOpeningPercent);
  const plane = useMemo(() => new Plane(PLANE_LOCAL_NORMAL.clone(), -sectionOffsetM), [sectionOffsetM]);

  const bodyPart = assembly.parts.find((p) => p.name === "BODY") ?? assembly.parts[0];
  const boundingRadiusM = bodyPart.geometry.boundingSphere?.radius ?? 0.2;
  const isVerticalBody = assembly.componentType === "PRESSURE_SAFETY_VALVE";

  const placeholderGeometry = useMemo(
    () => new CylinderGeometry(boundingRadiusM * 0.55, boundingRadiusM * 0.55, boundingRadiusM * 2.2, 12),
    [boundingRadiusM],
  );

  return (
    <group>
      <Detailed distances={[0, LOD_FAR_DISTANCE_M]}>
        <group>
          {assembly.parts.map((part) => {
            const pose = part.pivot ? computePartPoseForOpening(part.pivot, animatedOpeningPercent) : IDENTITY_POSE;
            return (
              <ValvePartMesh
                key={part.name}
                name={part.name}
                geometry={part.geometry}
                pose={pose}
                pivotPointM={part.pivot?.pivotPointM ?? [0, 0, 0]}
                plane={plane}
                sectionEnabled={sectionEnabled}
                selected={selectedPartName === part.name}
                onSelect={() => onSelectPart(part.name)}
              />
            );
          })}
          {flowVisible && <FlowParticles flowPath={assembly.flowPath} />}
        </group>
        <mesh geometry={placeholderGeometry} rotation={isVerticalBody ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.5} side={DoubleSide} />
        </mesh>
      </Detailed>
      {sectionEnabled && <SectionCapPlane plane={plane} size={boundingRadiusM * 6} />}
    </group>
  );
}
