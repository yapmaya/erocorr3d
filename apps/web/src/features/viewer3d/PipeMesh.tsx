// apps/web/src/features/viewer3d/PipeMesh.tsx
//
// Ana çalışma alanının boru gövdesi. Önceki oturumda (bkz. proje hafızası)
// bu dosya iki bağımsız (dış + BackSide iç) `cylinderGeometry` mesh'i ile
// yer tutucu bir görünüm çiziyordu — GERÇEK bir kapalı (watertight) tüp
// DEĞİLDİ, bu yüzden ne kesit-düzlemi stencil tekniği ne de ısı haritası
// (uv/damage attribute'u gerektirir) üzerinde çalışabilirdi. Şimdi
// `geometry/straightPipe.ts::createStraightPipe`nin ürettiği TEK, gerçek
// geometriyi kullanıyor (bkz. usePipeGeometry.ts) — diğer tüm fitting/vana
// üreticileriyle AYNI altyapı.

import { DoubleSide, type BufferGeometry, type Plane, type Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { SectionStencilPasses } from "../../components/three/SectionStencilPasses";
import { HeatmapMesh, type HeatmapMeshProps } from "../../shaders";

// Yer tutucu görselleştirme ölçüleri — ASME B36.10 nominal boru cetveli,
// NPS 12 Std et kalınlığı (OD 323.9 mm, et kalınlığı 9.53 mm). Bu bir
// mühendislik hesap sonucu DEĞİL, girdi paneli henüz bağlanmadan önce
// sahneyi anlamlı bir ölçekte göstermek için kullanılan bilinen bir
// standart tablo değeridir.
export const DEFAULT_OUTER_DIAMETER_MM = 323.9;
export const DEFAULT_WALL_THICKNESS_MM = 9.53;
export const DEFAULT_LENGTH_MM = 4000;

// clipPlane/renderOrder/onClick PipeMesh'in KENDİ kesit/tıklama durumuna göre belirlenir —
// çağıran taraf bunları ayarlayamaz (bkz. aşağıdaki <HeatmapMesh> çağrısı).
export type PipeHeatmapProps = Omit<HeatmapMeshProps, "geometry" | "clipPlane" | "renderOrder" | "onClick">;

export interface PipeMeshProps {
  /** Geometri TEK bir üst bileşende (bkz. PipeViewer.tsx::SceneRoot) üretilir — kesit/kamera/ısı
   * haritası AYNI BufferGeometry örneğini paylaşsın diye burada TEKRAR üretilmez. */
  geometry: BufferGeometry;
  sectionEnabled: boolean;
  sectionPlane: Plane;
  /** null/undefined → düz metalik malzeme; dolu ise ısı haritası materyali kullanılır. */
  heatmap?: PipeHeatmapProps | null;
  /** Yüzeye tıklanınca (dünya konumu) — hotspot seçimi/ölçüm araçları için. Isı haritası açık/kapalı
   * FARK ETMEKSİZİN görünen mesh HANGİSİYSE ondan gelir (bkz. aşağıdaki her iki dal). */
  onSurfaceClick?: (point: Vector3) => void;
}

export function PipeMesh({ geometry, sectionEnabled, sectionPlane, heatmap = null, onSurfaceClick }: PipeMeshProps) {
  const handleClick = onSurfaceClick
    ? (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSurfaceClick(event.point);
      }
    : undefined;

  return (
    <>
      {sectionEnabled && <SectionStencilPasses geometry={geometry} plane={sectionPlane} />}
      {heatmap ? (
        <HeatmapMesh
          geometry={geometry}
          renderOrder={2}
          clipPlane={sectionEnabled ? sectionPlane : null}
          onClick={handleClick}
          {...heatmap}
        />
      ) : (
        <mesh
          geometry={geometry}
          renderOrder={2}
          castShadow
          receiveShadow
          onPointerOver={(e) => e.stopPropagation()}
          onClick={handleClick}
        >
          <meshStandardMaterial
            color="#a1a1aa"
            metalness={0.85}
            roughness={0.32}
            side={DoubleSide}
            clippingPlanes={sectionEnabled ? [sectionPlane] : []}
          />
        </mesh>
      )}
    </>
  );
}
