// apps/web/src/features/viewer3d/usePipeGeometry.ts
//
// Ana 3B görüntüleyicinin tek gerçek geometri üretim noktası. Adım 2'nin
// canlı önizlemesinin ZATEN kullandığı `features/input/componentPreview.ts::
// buildComponentPreviewGeometry` dispatch'ini (ComponentType → createStraightPipe/
// createElbow/createTee/... eşlemesi) yeniden kullanır — böylece görüntülenen
// şekil, girdi sihirbazında seçilen bileşen tipini (ör. "90° Dirsek") takip
// eder; önceden bu hook HER ZAMAN `createStraightPipe` çağırıyordu ve seçilen
// bileşen tipini hiç okumuyordu (bkz. bu dosyanın önceki taslağı). Üreticilerin
// TÜMÜ aynı `GeneratedGeometry` (geometry+uvMap+metadata) şeklini döndürdüğü
// için (bkz. geometry/types.ts'in UvMap notu: "TÜM şekillerde aynı şekilde
// çalışan tek bir yöntem") `PipeMesh`, kamera-sığdırma, ısı haritası ve
// hotspot yerleştirme kodu şekil ne olursa olsun DEĞİŞMEDEN çalışmaya devam eder.

import { useMemo } from "react";
import { MM_PER_M, type GeneratedGeometry } from "../../geometry";
import { buildComponentPreviewGeometry } from "../input/componentPreview";
import type { Geometry } from "@erocorr3d/engine";

export type PipeGeometrySource = Pick<
  Geometry,
  "componentType" | "odMm" | "wallThicknessMm" | "idMm" | "lengthMm" | "bendRadiusRatio" | "bendAngleDeg" | "branchNps" | "outletNps" | "schedule"
>;

export interface PipeGeometryInfo extends GeneratedGeometry {
  outerRadiusM: number;
  innerRadiusM: number;
  lengthM: number;
}

export function usePipeGeometry(source: PipeGeometrySource): PipeGeometryInfo {
  const { componentType, odMm, wallThicknessMm: wtMm, lengthMm, idMm, bendRadiusRatio, bendAngleDeg, branchNps, outletNps, schedule } = source;
  return useMemo(() => {
    const generated = buildComponentPreviewGeometry(componentType, source, "medium");
    return {
      ...generated,
      outerRadiusM: odMm / 2 / MM_PER_M,
      innerRadiusM: (odMm / 2 - wtMm) / MM_PER_M,
      lengthM: lengthMm / MM_PER_M,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentType, odMm, wtMm, lengthMm, idMm, bendRadiusRatio, bendAngleDeg, branchNps, outletNps, schedule]);
}
