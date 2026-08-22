// apps/web/src/features/valveViewer/FlowParticles.tsx
//
// `ValveAssembly.flowPath` boyunca akan küçük ok/parçacık izleri — akışkanın
// vanadan NASIL geçtiğini gösterir. Catmull-Rom eğrisiyle ara noktalar
// üretilir, TEK bir InstancedMesh ile (N parçacık = 1 çizim çağrısı)
// render edilir. `relativeSpeedHint` yerel ilerleme hızını VE ok boyutunu
// ölçekler (GÖRSEL — bkz. geometry/valves/types.ts::ValveFlowPathPoint
// başlığı, KDP kapsamı dışı, gerçek bir CFD hız alanı DEĞİLDİR).

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, InstancedMesh, Object3D, Vector3 } from "three";
import type { ValveFlowPathPoint } from "../../geometry";

export interface FlowParticlesProps {
  flowPath: ValveFlowPathPoint[];
  count?: number;
  color?: string;
}

const UP = new Vector3(0, 1, 0);
const dummy = new Object3D();
const BASE_ADVANCE_PER_SECOND = 0.12;

export function FlowParticles({ flowPath, count = 10, color = "#38bdf8" }: FlowParticlesProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const phaseRef = useRef(0);

  const { curve, speeds, size } = useMemo(() => {
    const points = flowPath.map((p) => new Vector3(p.positionM[0], p.positionM[1], p.positionM[2]));
    const builtCurve = points.length >= 2 ? new CatmullRomCurve3(points) : null;
    const speedHints = flowPath.map((p) => p.relativeSpeedHint);
    let maxDistanceFromOrigin = 0.01;
    for (const point of points) maxDistanceFromOrigin = Math.max(maxDistanceFromOrigin, point.length());
    return { curve: builtCurve, speeds: speedHints, size: Math.max(0.006, maxDistanceFromOrigin * 0.035) };
  }, [flowPath]);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !curve) return;
    const n = speeds.length;
    const speedAt = (t: number) => speeds[Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))];

    phaseRef.current = (phaseRef.current + delta * BASE_ADVANCE_PER_SECOND * speedAt(phaseRef.current)) % 1;

    for (let i = 0; i < count; i++) {
      const t = (phaseRef.current + i / count) % 1;
      const position = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();
      dummy.position.copy(position);
      dummy.quaternion.setFromUnitVectors(UP, tangent);
      const localSpeed = speedAt(t);
      dummy.scale.setScalar(size * (0.7 + 0.3 * localSpeed));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!curve) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false} raycast={() => null}>
      <coneGeometry args={[1, 2.6, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.2} roughness={0.4} />
    </instancedMesh>
  );
}
