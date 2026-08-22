// packages/engine/src/spatial/valves.ts
//
// data/valveCatalog.ts'teki erozyon bölgelerini (ErosionZone, yalnızca
// id/açıklama/ağırlık/kısmi-açıklık eğrisi taşır — HİÇBİR geometrik (u,v)
// konumu YOKTUR) bir (u,v) alanına EŞLER. Bu eşleme (VALVE_ZONE_SPATIAL_MAP)
// bu OTURUMUN kendi mekansal yerleşim kararıdır — valveCatalog.ts'in kendisi
// hiçbir zaman bir geometrik konum iddia etmedi (bkz. o dosyanın
// EROSION_ZONE_CAVEAT'ı), bu yüzden burada da yeni bir KDP iddiası
// ÜRETİLMEZ; her girdinin descriptionTr'si valveCatalog.ts'in KENDİ
// descriptionTr metnine dayanır (yalnızca geometriye çevrilir).
//
// Parametrizasyon: LATHE_PROFILE (bkz. types/enums.ts::SpatialParameterizationEnum)
// — vana gövdeleri tipik olarak eksenel-simetrik (döndürme/lathe) parçalardır.
// BU OTURUMDA (u,v) matematiği CYLINDRICAL_UV ile AYNI ele alınır (u eksenel
// akış yönü, v çevresel) — gerçek 3B lathe-profil mesh'i (three.js katmanı)
// ayrı bir konudur, KASITLI bir basitleştirme (bkz. spatial/index.ts başlığı).

import { computeValveZoneDamage, type ValveZoneDamageMap } from "../erosion/valveHydraulics";
import type { UncertaintyBand } from "../uncertainty/percentiles";
import type { ComponentType, SpatialParameterization } from "../types/enums";
import type { SpatialDamageField } from "../types/results";
import {
  circularGaussianKernel,
  linearGaussianKernel,
  normalizeShapeFn,
  DamageField,
  type DamageShapeFn,
} from "./fields";

export interface ValveZoneSpatialDescriptor {
  centerU: number;
  centerV: number;
  sigmaU: number;
  sigmaV: number;
  /** valveCatalog.ts'in kendi descriptionTr'sine ek, konuma özgü kısa not. */
  placementNoteTr: string;
}

const NARROW = 0.05;
const WIDE = 0.15;

/**
 * data/valveCatalog.ts'teki 28 erozyon bölgesi kimliğinin her biri için
 * (u,v) merkez/yayılım — bu oturumun kendi, valveCatalog.ts'in descriptionTr
 * metnine dayalı, UNVERIFIED yerleşim kararı (bkz. modül başlığı).
 * u=0 giriş, u=1 çıkış; v=0 saat12/üst, v=0,5 saat6/alt (genel sözleşim,
 * çoğu vana bölgesi için ANLAMLI bir "üst/alt" ayrımı yoktur — bu durumda
 * v-merkez 0,25 seçilerek nötr/simetrik bir konum verilir ve sigmaV=0,5
 * (tüm çevre) ile ÜNİFORM'a yakın bırakılır).
 */
const VALVE_ZONE_SPATIAL_MAP: Record<string, ValveZoneSpatialDescriptor> = {
  "gate.seat_cavity": { centerU: 0.5, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Oturak boşluğu, gövde ortası" },
  "gate.downstream_seat": { centerU: 0.7, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Oturak mansabı" },
  "globe.plug_seat_contact": { centerU: 0.5, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Tapa-oturak teması, gövde ortası" },
  "globe.downstream_seat": { centerU: 0.65, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Oturak mansabı" },
  "ballFull.seat_ring": { centerU: 0.5, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Oturak halkası, küre çevresi" },
  "ballReduced.v_notch_edge": { centerU: 0.45, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "V-çentik kenarı — dar, keskin bölge" },
  "ballReduced.downstream_cavity": { centerU: 0.7, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Mansap boşluğu" },
  "butterfly.disc_edge_seat": { centerU: 0.5, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "Disk kenarı-oturak teması" },
  "butterfly.downstream_disc": { centerU: 0.65, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Disk mansabı" },
  "checkSwing.disc_seat_edge": { centerU: 0.5, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "Disk-oturak kenarı" },
  "checkSwing.hinge_pin_area": { centerU: 0.4, centerV: 0.75, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "Menteşe pimi bölgesi (üst)" },
  "checkLift.disc_seat_edge": { centerU: 0.5, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "Disk-oturak kenarı" },
  "checkLift.guide_bore": { centerU: 0.55, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Kılavuz delik" },
  "checkDualPlate.plate_hinge_area": { centerU: 0.45, centerV: 0.5, sigmaU: NARROW, sigmaV: WIDE, placementNoteTr: "Plaka menteşe bölgesi" },
  "checkDualPlate.seat_area": { centerU: 0.5, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Oturak bölgesi" },
  "plug.port_edge": { centerU: 0.5, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "Port kenarı" },
  "plug.body_cavity_below_plug": { centerU: 0.55, centerV: 0.5, sigmaU: WIDE, sigmaV: WIDE, placementNoteTr: "Tapa altı gövde boşluğu" },
  "needle.tip_seat": { centerU: 0.5, centerV: 0, sigmaU: NARROW, sigmaV: NARROW, placementNoteTr: "İğne ucu-oturak" },
  "choke.bean_orifice": { centerU: 0.4, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Bean/orifis dar geçişi" },
  "choke.downstream_expansion": { centerU: 0.75, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Mansap genişleme bölgesi" },
  "controlGlobe.trim_seat_region": { centerU: 0.5, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Trim-oturak bölgesi" },
  "controlGlobe.downstream_seat": { centerU: 0.65, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Oturak mansabı" },
  "controlCage.cage_window_edges": { centerU: 0.5, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Kafes penceresi kenarları" },
  "controlCage.downstream_cage": { centerU: 0.65, centerV: 0.25, sigmaU: WIDE, sigmaV: 0.5, placementNoteTr: "Kafes mansabı" },
  "psv.nozzle_seat_disc": { centerU: 0.5, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Nozul-oturak-disk teması" },
  "psv.downstream_outlet_elbow": { centerU: 0.85, centerV: 0, sigmaU: WIDE, sigmaV: NARROW, placementNoteTr: "Çıkış dirseği dış yarıçapı" },
  "ro.bore_edge": { centerU: 0.5, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Delik kenarı" },
  "ro.immediate_downstream_wall": { centerU: 0.6, centerV: 0.25, sigmaU: NARROW, sigmaV: 0.5, placementNoteTr: "Hemen mansap duvarı" },
};

/** Bir bölge kimliği için (u,v) yerleşim tanımını döndürür — bulunamazsa hata fırlatır (sessizce atlanmaz). */
export function getValveZoneSpatialDescriptor(zoneId: string): ValveZoneSpatialDescriptor {
  const descriptor = VALVE_ZONE_SPATIAL_MAP[zoneId];
  if (!descriptor) {
    throw new Error(
      `"${zoneId}" için bir (u,v) mekansal yerleşim tanımı bulunamadı — spatial/valves.ts::VALVE_ZONE_SPATIAL_MAP'e eklenmeli.`,
    );
  }
  return descriptor;
}

function buildZoneShape(descriptor: ValveZoneSpatialDescriptor): DamageShapeFn {
  return normalizeShapeFn(
    (u, v) =>
      linearGaussianKernel(u, descriptor.centerU, descriptor.sigmaU) *
      circularGaussianKernel(v, descriptor.centerV, descriptor.sigmaV),
  );
}

export interface ValveDamageFieldResolution {
  resolutionU: number;
  resolutionV: number;
}

const DEFAULT_VALVE_RESOLUTION: ValveDamageFieldResolution = { resolutionU: 64, resolutionV: 64 };
/** Açıklık yüzdesi çağıran tarafça belirtilmediğinde kullanılan varsayılan (tam açık) — bkz. fonksiyon JSDoc'u. */
const DEFAULT_OPENING_PERCENT = 100;

/**
 * Bir vananın TÜM erozyon bölgelerini tek bir SpatialDamageField'da
 * birleştirir. Her bölge, erosion/valveHydraulics.ts::computeValveZoneDamage
 * (ZATEN var olan, bu oturumda YENİDEN İCAT EDİLMEYEN) ile hesaplanan KENDİ
 * hızıyla, spatial/valves.ts'in bu oturumda eklediği (u,v) konumuna
 * yerleştirilir — kütle korunumu HER bölge için AYRI AYRI sağlanır (bkz.
 * fields.ts::DamageField.addContribution).
 *
 * @param openingPercent Belirtilmezse %100 (tam açık) varsayılır — kısma
 * servisindeki bir vana için ÇAĞIRAN TARAFIN gerçek açıklığı vermesi
 * ÖNEMLİDİR (bkz. erosion/valveHydraulics.ts::assessPartialOpeningSuitability).
 */
export function computeValveDamageField(
  componentType: ComponentType,
  baseRateMmPerYear: UncertaintyBand,
  elapsedYears: number,
  openingPercent: number = DEFAULT_OPENING_PERCENT,
  resolution: ValveDamageFieldResolution = DEFAULT_VALVE_RESOLUTION,
): SpatialDamageField {
  const zoneDamage: ValveZoneDamageMap = computeValveZoneDamage(componentType, openingPercent, baseRateMmPerYear);
  const parameterization: SpatialParameterization = "LATHE_PROFILE";
  const field = new DamageField(resolution.resolutionU, resolution.resolutionV, parameterization);

  for (const [zoneId, band] of Object.entries(zoneDamage)) {
    const descriptor = getValveZoneSpatialDescriptor(zoneId);
    const shapeFn = buildZoneShape(descriptor);
    field.addContribution(shapeFn, band.p50, elapsedYears);
  }

  return field.toSpatialDamageField();
}
