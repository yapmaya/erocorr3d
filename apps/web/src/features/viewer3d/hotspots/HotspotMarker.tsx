// apps/web/src/features/viewer3d/hotspots/HotspotMarker.tsx
//
// Bir hotspot'un 3B etiketi — drei `Html` (master görev madde 4'ün açıkça
// istediği teknik), NON-fullscreen (`positionM`de doğrudan çapalı) —
// PipeViewer.tsx'in HUD paneli için kullandığı `fullscreen` modundan FARKLI,
// burada anchor-offset sorunu YOK çünkü nokta zaten gerçek 3B konumun
// kendisi (bkz. o dosyadaki `Html fullscreen`in kendi ayrı konumlama notu).
//
// `pointerEvents` PROP'u BİLEREK kullanılmıyor — bkz. PipeViewer.tsx'in
// `style={{pointerEvents:...}}` notu: drei'nin `transform=false` (varsayılan,
// burada da geçerli) modunda o prop sessizce yok sayılıyor. Bu bileşende
// sorun değil çünkü zaten istenen değer ('auto') CSS'in kendi varsayılanı.

import { Html } from "@react-three/drei";
import type { Hotspot } from "@erocorr3d/engine";
import type { Vector3 } from "three";

export interface HotspotMarkerProps {
  hotspot: Hotspot;
  positionM: Vector3;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}

const BASE_CLASS =
  "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-lg transition-colors";

export function HotspotMarker({ hotspot, positionM, rank, selected, onSelect }: HotspotMarkerProps) {
  return (
    <Html position={positionM} center zIndexRange={[60, 0]}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        title={hotspot.descriptionTr}
        className={
          selected
            ? `${BASE_CLASS} border-white bg-amber-500 text-black`
            : `${BASE_CLASS} border-amber-400 bg-neutral-900/90 text-amber-300 hover:bg-neutral-800`
        }
      >
        {rank}
      </button>
    </Html>
  );
}
