// apps/web/src/components/three/SectionStencilPasses.tsx
//
// Kesit düzlemi AKTİFKEN, TEK bir katı parçanın (herhangi bir BufferGeometry)
// stencil sayacına kendi katkısını yazan İKİ görünmez mesh: arka yüzler
// sayacı ARTIRIR (sarmalı), ön yüzler AZALTIR — net değer, kesit düzleminde
// GERÇEKTEN içeride kalan hacim kadar sıfırdan farklı kalır. Paylaşılan
// `SectionCapPlane.tsx`, bu net stencil değerini okuyarak kapağı sadece o
// alanda çizer.
//
// Bu mantık önceden `features/valveViewer/ValvePartMesh.tsx` içine gömülüydü
// (vana parçalarına özgü hiçbir şey İÇERMİYORDU — sadece geometry+plane
// alıyordu); tek bir boru gövdesi gibi TEK parçalı bileşenlerde de aynen
// gerekli olduğu için BURAYA, paylaşılan konuma çıkarıldı. `ValvePartMesh`
// artık bu bileşeni kullanıyor, davranış BİREBİR aynı.

import { AlwaysStencilFunc, BackSide, DecrementWrapStencilOp, FrontSide, IncrementWrapStencilOp, type BufferGeometry, type Plane } from "three";

export interface SectionStencilPassesProps {
  geometry: BufferGeometry;
  plane: Plane;
}

export function SectionStencilPasses({ geometry, plane }: SectionStencilPassesProps) {
  return (
    <>
      {/* Arka yüzler: geçen her yüzeyde stencil sayacını ARTIR (sarmalı). */}
      <mesh geometry={geometry} renderOrder={1} raycast={() => null}>
        <meshBasicMaterial
          side={BackSide}
          clippingPlanes={[plane]}
          colorWrite={false}
          depthWrite={false}
          depthTest={false}
          stencilWrite
          stencilFunc={AlwaysStencilFunc}
          stencilFail={IncrementWrapStencilOp}
          stencilZFail={IncrementWrapStencilOp}
          stencilZPass={IncrementWrapStencilOp}
        />
      </mesh>
      {/* Ön yüzler: geçen her yüzeyde AZALT. */}
      <mesh geometry={geometry} renderOrder={1} raycast={() => null}>
        <meshBasicMaterial
          side={FrontSide}
          clippingPlanes={[plane]}
          colorWrite={false}
          depthWrite={false}
          depthTest={false}
          stencilWrite
          stencilFunc={AlwaysStencilFunc}
          stencilFail={DecrementWrapStencilOp}
          stencilZFail={DecrementWrapStencilOp}
          stencilZPass={DecrementWrapStencilOp}
        />
      </mesh>
    </>
  );
}
