// apps/web/src/features/input/components/PreviewCanvas.tsx
//
// Adım 2'nin PIPE_FITTING kategorisi için "sağda canlı 3B önizleme"si —
// `GeometryLab.tsx`'in Canvas+mesh+OrbitControls+Grid deseninin küçük,
// salt-görüntüleme (ısı haritası/slider'sız) bir tekrarı. Geometrinin
// üretimi/imhası (dispose) BU bileşenin DIŞINDA, çağıran tarafta yapılır
// (bkz. GeometryLab.tsx'in aynı deseni — `result` sahibi olan taraf
// dispose eder).

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { DoubleSide, type BufferGeometry } from "three";

const FLOOR_Y = -1;

function PreviewMesh({ geometry }: { geometry: BufferGeometry }) {
  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#a1a1aa" metalness={0.85} roughness={0.32} side={DoubleSide} />
    </mesh>
  );
}

export interface PreviewCanvasProps {
  geometry: BufferGeometry | null;
  heightClassName?: string;
}

export function PreviewCanvas({ geometry, heightClassName = "h-56" }: PreviewCanvasProps) {
  return (
    <div className={`w-full shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-950 dark:border-neutral-800 ${heightClassName}`}>
      <Canvas shadows="percentage" dpr={[1, 1.5]} camera={{ position: [1.2, 0.9, 1.2], fov: 45 }}>
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <Environment preset="warehouse" />
        </Suspense>
        {geometry && <PreviewMesh geometry={geometry} />}
        <Grid
          args={[10, 10]}
          position={[0, FLOOR_Y, 0]}
          cellSize={0.1}
          cellThickness={0.4}
          cellColor="#3f3f46"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#52525b"
          fadeDistance={10}
          infiniteGrid
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.1} maxDistance={10} />
      </Canvas>
    </div>
  );
}
