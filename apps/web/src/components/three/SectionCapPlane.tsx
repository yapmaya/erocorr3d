// apps/web/src/components/three/SectionCapPlane.tsx
//
// Kesit düzleminin "kapağı" — GERÇEK three.js stencil-buffer tekniği (bkz.
// üç.js'in resmi "webgl_clipping_stencil" örneğinin tek-düzlemli hâli).
// Her stencil-yazan parça (bkz. SectionStencilPasses.tsx) KENDİ arka/ön yüz
// stencil geçişini yazar; bu bileşen TEK bir PAYLAŞILAN kapak mesh'idir:
// stencil DEĞERİ 0'DAN FARKLI olan her piksel (yani kesilen düzlemde
// GERÇEKTEN katı malzeme olan yerler) düz, opak bir renk ile doldurulur —
// kesitin içini "boş" değil "dolu" gösteren asıl adım budur.
//
// `onAfterRender`de stencil arabelleği TEMİZLENİR — bir sonraki karenin
// stencil biriktirmesi SIFIRDAN başlasın diye (bkz. üç.js örneğindeki
// AYNI `po.onAfterRender = renderer => renderer.clearStencil()` deseni).
//
// Bu dosya önceden `features/valveViewer/SectionCapPlane.tsx` altındaydı;
// vanaya özgü hiçbir şey içermediği için (jenerik plane+size+color props)
// `features/viewer3d/` de kullanabilsin diye BURAYA, paylaşılan konuma
// taşındı (kod DEĞİŞMEDİ, sadece konumu — bkz. NumberSlider.tsx/
// UnverifiedBadge.tsx emsali).

import { useRef } from "react";
import { DoubleSide, NotEqualStencilFunc, Plane, ReplaceStencilOp, Vector3, type Mesh, type WebGLRenderer } from "three";
import { useFrame } from "@react-three/fiber";

export interface SectionCapPlaneProps {
  plane: Plane;
  size: number;
  color?: string;
}

const PLANE_LOCAL_NORMAL = new Vector3(0, 0, 1);

export function SectionCapPlane({ plane, size, color = "#4d7c0f" }: SectionCapPlaneProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pointOnPlane = plane.normal.clone().multiplyScalar(-plane.constant);
    mesh.position.copy(pointOnPlane);
    mesh.quaternion.setFromUnitVectors(PLANE_LOCAL_NORMAL, plane.normal);
  });

  const clearStencilAfterRender = (renderer: WebGLRenderer) => renderer.clearStencil();

  return (
    <mesh ref={meshRef} renderOrder={3} onAfterRender={clearStencilAfterRender}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={color}
        side={DoubleSide}
        metalness={0.1}
        roughness={0.85}
        stencilWrite
        stencilRef={0}
        stencilFunc={NotEqualStencilFunc}
        stencilFail={ReplaceStencilOp}
        stencilZFail={ReplaceStencilOp}
        stencilZPass={ReplaceStencilOp}
      />
    </mesh>
  );
}
