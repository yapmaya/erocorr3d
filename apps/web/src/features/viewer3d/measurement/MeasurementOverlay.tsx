// apps/web/src/features/viewer3d/measurement/MeasurementOverlay.tsx
//
// Ölçüm sonuçlarının 3B render'ı — noktalar/çizgi/etiketler. Türetilmiş
// sonuçlar (mesafe/kalan et/saat pozisyonu) PipeViewer.tsx::SceneRoot'ta
// zaten hesaplanmış olarak PROP olarak gelir (bkz. useMeasurementState.ts'in
// kendi "bu hook sadece nokta tutar" notu) — bu dosya SADECE görüntüler.
//
// `Html`e `style={{pointerEvents:"none"}}` verilir, `pointerEvents` PROP'u
// DEĞİL — bkz. PipeViewer.tsx'in aynı notu (drei'nin `transform=false`
// modunda o prop sessizce yok sayılıyor, tarayıcıda yakalanan gerçek hata).

import { Html, Line } from "@react-three/drei";
import { computeDistanceMm, computeMidpoint, type Vec3Tuple } from "./measurementMath";
import type { WallProbeResult } from "./measurementMath";
import type { MeasurementMode } from "./useMeasurementState";
import { useTranslation } from "../../../i18n/translations";

const LABEL_CLASS = "whitespace-nowrap rounded bg-neutral-900/90 px-2 py-1 text-[11px] font-mono text-violet-200 shadow-lg";

function MeasurementMarker({ positionM }: { positionM: Vec3Tuple }) {
  return (
    <mesh position={positionM} raycast={() => null}>
      <sphereGeometry args={[0.012, 12, 12]} />
      <meshBasicMaterial color="#a78bfa" depthTest={false} />
    </mesh>
  );
}

export interface MeasurementOverlayProps {
  mode: MeasurementMode;
  distancePoints: Vec3Tuple[];
  probePoint: Vec3Tuple | null;
  probeResult: WallProbeResult | null;
  clockPoint: Vec3Tuple | null;
  clockDescriptionTr: string | null;
}

export function MeasurementOverlay({ mode, distancePoints, probePoint, probeResult, clockPoint, clockDescriptionTr }: MeasurementOverlayProps) {
  const { t } = useTranslation();

  return (
    <>
      {mode === "DISTANCE" &&
        distancePoints.map((point, index) => <MeasurementMarker key={index} positionM={point} />)}
      {mode === "DISTANCE" && distancePoints.length === 2 && (
        <>
          <Line points={distancePoints} color="#a78bfa" lineWidth={2} />
          <Html position={computeMidpoint(distancePoints[0], distancePoints[1])} center style={{ pointerEvents: "none" }}>
            <div className={LABEL_CLASS}>{computeDistanceMm(distancePoints[0], distancePoints[1]).toFixed(1)} mm</div>
          </Html>
        </>
      )}

      {mode === "WALL_PROBE" && probePoint && probeResult && (
        <>
          <MeasurementMarker positionM={probePoint} />
          <Html position={probePoint} center style={{ pointerEvents: "none" }}>
            <div className={LABEL_CLASS}>
              {t("viewer3dHotspotRemainingWall")}: {probeResult.remainingWallMm.toFixed(2)} mm
            </div>
          </Html>
        </>
      )}

      {mode === "CLOCK" && clockPoint && clockDescriptionTr && (
        <>
          <MeasurementMarker positionM={clockPoint} />
          <Html position={clockPoint} center style={{ pointerEvents: "none" }}>
            <div className={LABEL_CLASS}>{clockDescriptionTr}</div>
          </Html>
        </>
      )}
    </>
  );
}
