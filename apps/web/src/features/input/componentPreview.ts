// apps/web/src/features/input/componentPreview.ts
//
// Adım 2'nin "sağda canlı 3B önizleme" gereksinimi — var olan
// `geometry/*` üreticilerini (GeometryLab.tsx'in kullandığı AYNI
// fonksiyonlar) `Geometry` form değerlerinden besler. Sıfırdan geometri
// kodu YAZILMAZ; yalnızca `ComponentType` → üretici çağrısı eşlemesi
// yapılır. Yalnızca PIPE_FITTING kategorisi içindir — vana önizlemesi
// (çok parçalı, animasyonlu) `features/valveViewer/ValveTab.tsx`
// bileşeninin kendisi yeniden kullanılarak sağlanır (bkz. steps/Step2Geometry.tsx).

import {
  createElbow,
  createFlangedSpool,
  createMiterBend,
  createOrificePlate,
  createReducer,
  createStraightPipe,
  createTee,
  createWeldJoint,
  type GeneratedGeometry,
  type LodLevel,
} from "../../geometry";
import { getPipe, type ComponentType, type Geometry } from "@erocorr3d/engine";

const DEFAULT_BEND_RADIUS_RATIO = 1.5;
const DEFAULT_FLANGE_CLASS = 300 as const;

function resolveBranchOrOutletDims(
  npsIn: number | undefined,
  schedule: string,
  fallbackOdMm: number,
  fallbackWtMm: number,
): { odMm: number; wtMm: number } {
  if (!npsIn) return { odMm: fallbackOdMm * 0.6, wtMm: fallbackWtMm * 0.8 };
  try {
    const pipe = getPipe(npsIn, schedule as Parameters<typeof getPipe>[1]);
    return { odMm: pipe.odMm, wtMm: pipe.wallThicknessMm };
  } catch {
    return { odMm: fallbackOdMm * 0.6, wtMm: fallbackWtMm * 0.8 };
  }
}

/**
 * `Geometry` form değerlerinden, seçili `ComponentType`'a uygun bir önizleme
 * BufferGeometry'si üretir. Motorun kendisine (SI/mm) sadık kalır; yalnızca
 * şemada bulunmayan ikincil görsel parametreler (kaynak kapağı yüksekliği,
 * flanş sınıfı vb.) için makul sabit varsayılanlar kullanılır — bunlar
 * mühendislik sonucunu ETKİLEMEZ, yalnızca önizleme görünümünü.
 */
export function buildComponentPreviewGeometry(
  componentType: ComponentType,
  geometry: Pick<Geometry, "odMm" | "wallThicknessMm" | "idMm" | "lengthMm" | "bendRadiusRatio" | "bendAngleDeg" | "branchNps" | "outletNps" | "schedule">,
  lod: LodLevel = "medium",
): GeneratedGeometry {
  const { odMm, wallThicknessMm: wtMm, idMm, lengthMm, bendRadiusRatio, bendAngleDeg, branchNps, outletNps, schedule } = geometry;

  switch (componentType) {
    case "STRAIGHT_PIPE":
      return createStraightPipe({ odMm, wtMm, lengthMm, lod });

    case "ELBOW_90":
    case "ELBOW_45":
    case "BEND_LONG_RADIUS":
    case "BEND_SHORT_RADIUS":
      return createElbow({
        odMm,
        wtMm,
        bendRadiusMm: (bendRadiusRatio ?? DEFAULT_BEND_RADIUS_RATIO) * odMm,
        angleDeg: bendAngleDeg ?? (componentType === "ELBOW_45" ? 45 : 90),
        lod,
      });

    case "MITER_BEND":
      return createMiterBend({
        odMm,
        wtMm,
        bendRadiusMm: (bendRadiusRatio ?? DEFAULT_BEND_RADIUS_RATIO) * odMm,
        angleDeg: bendAngleDeg ?? 90,
        segments: 4,
        lod,
      });

    case "TEE_BLIND":
    case "TEE_SWEEPING":
    case "TEE_BRANCH": {
      const branch = resolveBranchOrOutletDims(branchNps, schedule, odMm, wtMm);
      return createTee({
        runOdMm: odMm,
        runWtMm: wtMm,
        runLengthMm: lengthMm,
        branchOdMm: branch.odMm,
        branchWtMm: branch.wtMm,
        branchLengthMm: lengthMm * 0.4,
        lod,
      });
    }

    case "REDUCER_CONCENTRIC":
    case "REDUCER_ECCENTRIC": {
      const outlet = resolveBranchOrOutletDims(outletNps, schedule, odMm, wtMm);
      return createReducer({
        od1Mm: odMm,
        od2Mm: outlet.odMm,
        wt1Mm: wtMm,
        wt2Mm: outlet.wtMm,
        lengthMm,
        type: componentType === "REDUCER_ECCENTRIC" ? "ECCENTRIC" : "CONCENTRIC",
        lod,
      });
    }

    // Weldolet için özel bir üretici yok — en yakın görsel yaklaşım olarak
    // kısa bir kaynak dikişi kullanılır (yalnızca ÖNİZLEME amaçlı; motora
    // giden Geometry verisi etkilenmez).
    case "WELDOLET":
    case "WELD_JOINT":
      return createWeldJoint({ odMm, wtMm, lengthMm: Math.min(lengthMm, 200), capHeightMm: 3, rootPenetrationMm: 1, lod });

    case "FLANGE_WELD_NECK":
      return createFlangedSpool({ odMm, wtMm, lengthMm, flangeClass: DEFAULT_FLANGE_CLASS, lod });

    case "RESTRICTION_ORIFICE":
      return createOrificePlate({ pipeOdMm: odMm, boreDiaMm: idMm * 0.5, thicknessMm: wtMm, lod });

    default:
      // Vana tipleri buraya gelmemeli (bkz. bu dosyanın başlık yorumu) —
      // yine de sessizce çökmek yerine en azından düz boru göster.
      return createStraightPipe({ odMm, wtMm, lengthMm, lod });
  }
}
