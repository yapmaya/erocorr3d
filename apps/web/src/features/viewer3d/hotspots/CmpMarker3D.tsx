// apps/web/src/features/viewer3d/hotspots/CmpMarker3D.tsx
//
// Kritik İzleme Noktası (CMP) 3B işareti — HotspotMarker.tsx'in AYNI drei
// `Html` (non-fullscreen, `positionM`de doğrudan çapalı) desenini izler,
// ama GERÇEK veriye dayanan AYRI bir katmandır (bkz. useCmpPoints.ts'in
// dosya başı notu) — sentetik demo hotspot işaretleriyle (turuncu/amber)
// KARIŞTIRILMASIN diye teal renk ve kare biçim kullanır.

import { Html } from "@react-three/drei";
import type { CriticalMonitoringPoint } from "@erocorr3d/engine";
import type { Vector3 } from "three";

export interface CmpMarker3DProps {
  point: CriticalMonitoringPoint;
  positionM: Vector3;
}

export function CmpMarker3D({ point, positionM }: CmpMarker3DProps) {
  const titleTr = [
    point.locationDescriptionTr,
    `Önerilen teknik: ${point.recommendedTechniquesTr.join(", ")}`,
    point.accessibilityWarningTr ? `⚠ ${point.accessibilityWarningTr}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Html position={positionM} center zIndexRange={[59, 0]}>
      <div
        title={titleTr}
        className="flex h-6 w-6 items-center justify-center rounded border-2 border-teal-300 bg-teal-900/90 text-[11px] font-bold text-teal-200 shadow-lg"
      >
        {point.rank}
      </div>
    </Html>
  );
}
