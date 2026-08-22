// apps/web/src/features/viewer3d/sectionPlane/SectionGizmo.tsx
//
// Kesit düzlemini SÜRÜKLEYEREK kaydırmak için drei `TransformControls`
// tabanlı, TEK eksenli (yalnızca düzlemin normali boyunca) tutamaç. Görünmez
// bir grup, normal yönünü kendi YEREL +X'i yapacak şekilde döndürülür
// (`Quaternion.setFromUnitVectors`), sonra `space="local"` + `showY={false}
// showZ={false}` ile TransformControls sadece bu tek ekseni sürüklenebilir
// bırakır — normal HANGİ dünya ekseninde olursa olsun (X/Y/Z/FREE) AYNI
// mekanizma çalışır.
//
// Sürükleme sırasında OrbitControls'un KAMERAYI da döndürmeye çalışması
// tutamaçla çakışır — standart R3F deseni: `onMouseDown`da
// `orbitControls.enabled=false`, `onMouseUp`da tekrar `true`.

import { useCallback, useMemo, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import { Group, Quaternion, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Vec3Tuple } from "./sectionPlaneMath";

export interface SectionGizmoProps {
  normal: Vec3Tuple;
  offsetM: number;
  onOffsetChange: (offsetM: number) => void;
  orbitControlsRef: React.RefObject<OrbitControlsImpl>;
}

const HANDLE_LOCAL_AXIS = new Vector3(1, 0, 0);

export function SectionGizmo({ normal, offsetM, onOffsetChange, orbitControlsRef }: SectionGizmoProps) {
  const groupRef = useRef<Group>(null);
  const normalVec = useMemo(() => new Vector3(...normal).normalize(), [normal]);
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(HANDLE_LOCAL_AXIS, normalVec), [normalVec]);
  const positionM = useMemo<Vec3Tuple>(
    () => [normalVec.x * offsetM, normalVec.y * offsetM, normalVec.z * offsetM],
    [normalVec, offsetM],
  );

  const handleDragStart = useCallback(() => {
    const controls = orbitControlsRef.current;
    if (controls) controls.enabled = false;
  }, [orbitControlsRef]);

  const handleDragEnd = useCallback(() => {
    const controls = orbitControlsRef.current;
    if (controls) controls.enabled = true;
  }, [orbitControlsRef]);

  const handleObjectChange = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    onOffsetChange(group.position.dot(normalVec));
  }, [normalVec, onOffsetChange]);

  return (
    <TransformControls
      mode="translate"
      space="local"
      showY={false}
      showZ={false}
      size={0.85}
      onMouseDown={handleDragStart}
      onMouseUp={handleDragEnd}
      onObjectChange={handleObjectChange}
    >
      <group ref={groupRef} position={positionM} quaternion={quaternion}>
        <mesh raycast={() => null}>
          <coneGeometry args={[0.035, 0.09, 12]} />
          <meshBasicMaterial color="#38bdf8" depthTest={false} />
        </mesh>
      </group>
    </TransformControls>
  );
}
