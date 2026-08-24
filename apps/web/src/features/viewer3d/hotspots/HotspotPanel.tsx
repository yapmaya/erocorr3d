// apps/web/src/features/viewer3d/hotspots/HotspotPanel.tsx
//
// Sağ üstte (CameraToolbar'ın ALTINDA) yerleşen HUD paneli: etiket
// yoğunluğu (kaç hotspot gösterilsin) + göster/gizle + seçili hotspot'un
// detayı (mekanizma/hız/kalan et/saat pozisyonu/denklem/kaynak atıfları —
// bkz. hotspotDetail.ts'in dürüstlük notu, bu panel o alanları OLDUĞU GİBİ
// gösterir, ekstra bir "gerçekmiş gibi" sunum eklemez).

import { NumberSlider } from "../../../components/NumberSlider";
import { useTranslation } from "../../../i18n/translations";
import type { DemoHotspotDetail } from "./hotspotDetail";
import type { Hotspot } from "@erocorr3d/engine";

export interface HotspotPanelProps {
  visible: boolean;
  onToggleVisible: () => void;
  maxCount: number;
  onSetMaxCount: (maxCount: number) => void;
  /** 3B görünümdeki hotspot işaretçilerinin METİN ALTERNATİFİ — fareyle
   * canvas'a hiç dokunmadan, klavye/ekran okuyucuyla gezilip seçilebilir. */
  hotspots: Hotspot[];
  selectedIndex: number | null;
  onSelectHotspot: (index: number) => void;
  selectedDetail: DemoHotspotDetail | null;
  onCloseDetail: () => void;
  /** Gerçek bir ScenarioAssessment mevcutken (Referans Tesis/Özel Veri) true — DEMO modunda CMP kavramı ANLAMSIZ olduğundan aç/kapa kontrolü hiç gösterilmez. */
  cmpAvailable?: boolean;
  cmpVisible?: boolean;
  onToggleCmpVisible?: () => void;
}

export function HotspotPanel({
  visible,
  onToggleVisible,
  maxCount,
  onSetMaxCount,
  hotspots,
  selectedIndex,
  onSelectHotspot,
  selectedDetail,
  onCloseDetail,
  cmpAvailable = false,
  cmpVisible = false,
  onToggleCmpVisible,
}: HotspotPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="no-print pointer-events-auto absolute right-2 top-12 z-10 w-64 rounded-md bg-neutral-900/80 p-2.5 text-neutral-200 backdrop-blur-sm">
      <label className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span>{t("viewer3dHotspotsTitle")}</span>
        <input type="checkbox" checked={visible} onChange={onToggleVisible} className="accent-amber-500" />
      </label>

      {visible && hotspots.length > 0 && (
        <ul aria-label={t("viewer3dHotspotsTitle")} className="mb-2 max-h-28 overflow-y-auto rounded border border-neutral-700 text-[11px]">
          {hotspots.map((hotspot, index) => (
            <li key={index}>
              <button
                type="button"
                aria-current={selectedIndex === index}
                onClick={() => onSelectHotspot(index)}
                className={`flex w-full items-center justify-between gap-2 px-1.5 py-1 text-left ${
                  selectedIndex === index ? "bg-amber-600/30 text-amber-200" : "hover:bg-neutral-800"
                }`}
              >
                <span className="truncate">
                  #{index + 1} {hotspot.descriptionTr}
                </span>
                <span className="shrink-0 font-mono text-neutral-400">{hotspot.valueMm.toFixed(2)} mm</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {cmpAvailable && (
        <label className="mb-2 flex items-center justify-between text-xs font-semibold">
          <span>İzleme Noktaları (CMP)</span>
          <input type="checkbox" checked={cmpVisible} onChange={onToggleCmpVisible} className="accent-teal-400" />
        </label>
      )}

      {visible && (
        <NumberSlider
          label={t("viewer3dHotspotsDensity")}
          value={maxCount}
          min={1}
          max={5}
          step={1}
          onChange={(v) => onSetMaxCount(Math.round(v))}
        />
      )}

      {selectedDetail && (
        <div className="mt-2 space-y-1.5 border-t border-neutral-700 pt-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-300">{t("viewer3dHotspotDetailTitle")}</span>
            <button type="button" onClick={onCloseDetail} className="text-neutral-400 hover:text-white">
              ✕
            </button>
          </div>
          <div>{selectedDetail.hotspot.descriptionTr}</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-neutral-300">
            <span className="font-sans text-neutral-500">{t("viewer3dHotspotDamage")}</span>
            <span>{selectedDetail.hotspot.valueMm.toFixed(2)} mm</span>
            <span className="font-sans text-neutral-500">{t("viewer3dHotspotRate")}</span>
            <span>{selectedDetail.rateMmPerYear.toFixed(2)} mm/yıl</span>
            <span className="font-sans text-neutral-500">{t("viewer3dHotspotRemainingWall")}</span>
            <span>{selectedDetail.remainingWallMm.toFixed(2)} mm</span>
            <span className="font-sans text-neutral-500">{t("viewer3dHotspotClock")}</span>
            <span>{selectedDetail.hotspot.clockPosition.toFixed(1)}</span>
          </div>
          <div className="text-amber-400">{selectedDetail.modelUsed}</div>
          <div className="text-neutral-400">{selectedDetail.formula}</div>
          <div>
            <div className="text-neutral-500">{t("viewer3dHotspotSources")}</div>
            <ul className="ml-3 list-disc text-neutral-400">
              {selectedDetail.sourceRefs.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ul>
          </div>
          <div className="text-yellow-500">
            {selectedDetail.validityWarnings.map((warning) => (
              <div key={warning}>⚠ {warning}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
