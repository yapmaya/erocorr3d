// apps/web/src/geometry/valves/types.ts
//
// Vana montajları (assembly) için paylaşılan tipler. Mevcut geometry/types.ts'in
// `GeneratedGeometry` şekli (TEK BufferGeometry) vanalara UYMUYOR — bir vana,
// AYRI AYRI tıklanabilir/hareket edebilir parçalardan (gövde, kapak, sürgü/top/
// disk, mil, oturak halkası...) oluşur. Bu yüzden vanalar KENDİ üst tipini
// (ValveAssembly) kullanır; `geometry/types.ts`'in LodLevel'ı ve MM_PER_M'i
// dışında paylaşılan bir şey yoktur.
//
// TASARIM KARARI — "referans poz" sözleşimi: her hareketli parçanın GEOMETRİSİ
// KAPALI (closed, opening%=0) pozunda İNŞA EDİLİR (vertex'ler zaten o pozdadır).
// `ValvePivot.closedValue` bu yüzden HER ZAMAN 0'dır (sabit sözleşim, aşağıda
// belgelenmiştir) — `computePartPoseForOpening` (bkz. valveHelpers.ts) yalnızca
// `openValue` yönünde bir DELTA (ek pozisyon/rotasyon) üretir ve bu delta'yı
// çağıran taraf (React/R3F katmanı, Faz 2) mesh'in `position`/`rotation`
// prop'una EKLER. Bu, opening% slider'ının her karede geometri yeniden
// ÜRETMEDEN (ucuz) yumuşak (lerp) animasyonuna izin verir.
//
// (u,v)/hasar-bölgesi NOTU: `ValveDamageZone.centerUV`, packages/engine/src/
// spatial/valves.ts::VALVE_ZONE_SPATIAL_MAP ile AYNI bölge kimliklerini (id)
// kullanır (çapraz referans için) ve AYNI fiziksel konumu tarif eder, ANCAK
// BAĞIMSIZ bir sayısal kopyadır — apps/web/src/geometry/ katmanı KASITLI
// olarak @erocorr3d/engine'in ÇALIŞMA ZAMANI (runtime) fonksiyonlarına bağımlı
// DEĞİLDİR (yalnızca tip importu, bkz. flangedSpool.ts emsali); bu yüzden o
// haritayı import etmek yerine aynı sayıları burada bağımsızca yeniden
// beyan ediyoruz. Her iki taraf da spatial/valves.ts'in kendi UNVERIFIED
// itirafını miras alır — bu bir KDP-kaynaklı mühendislik sabiti DEĞİL, bu
// oturumun kendi geometrik yerleşim kararıdır.

import type { BufferGeometry } from "three";
import type { ComponentType } from "@erocorr3d/engine";
import type { LodLevel } from "../types";

export interface ValveDamageZone {
  /** packages/engine/src/spatial/valves.ts::VALVE_ZONE_SPATIAL_MAP ile aynı kimlik sözleşimi (ör. "gate.seat_cavity"). */
  id: string;
  centerUV: { u: number; v: number };
  /** Normalize (u,v) uzayında tek-sayı yayılım yarıçapı — bkz. modül başlığı. */
  radius: number;
  /** Bu bölgenin ait olduğu ValvePart.name. */
  meshName: string;
}

export type PivotKind = "TRANSLATE" | "ROTATE";

export interface ValvePivot {
  partName: string;
  kind: PivotKind;
  /** Yerel birim eksen — SADECE tek bir temel eksene (X, Y veya Z) hizalı olmalıdır (bkz. computePartPoseForOpening kısıtı). */
  axis: [number, number, number];
  /**
   * SADECE ROTATE için: montaj-yerel dönme merkezi (metre). Bu (0,0,0)'DAN
   * FARKLIYSA, o parçanın `geometry`'si ZATEN bu noktaya göre (yani bu
   * noktanın kendisi parçanın yerel (0,0,0)'ı olacak şekilde) İNŞA EDİLMİŞTİR
   * — render katmanı (Faz 2) parçayı `<group position={pivotPointM}
   * rotation={pose.rotationRad}><mesh geometry=.../></group>` şeklinde
   * SARMALIDIR (döner menteşe örneği: checkValve.ts'in swing/dualPlate
   * diskleri). pivotPointM=(0,0,0) olan (çoğunluk) parçalarda basitçe
   * `<mesh position={pose.positionM} rotation={pose.rotationRad}/>` yeterlidir.
   * TRANSLATE pivotlarında kullanılmaz (yön zaten `axis`'te, konumdan bağımsızdır).
   */
  pivotPointM: [number, number, number];
  /** SÖZLEŞME GEREĞİ her zaman 0 — bkz. modül başlığı "referans poz". */
  closedValue: 0;
  /** opening%=100 (tam açık) değeri: TRANSLATE→metre (+ = eksen yönünde öteleme), ROTATE→radyan. */
  openValue: number;
}

export interface ValvePartPose {
  positionM: [number, number, number];
  rotationRad: [number, number, number];
}

export const IDENTITY_POSE: ValvePartPose = { positionM: [0, 0, 0], rotationRad: [0, 0, 0] };

export interface ValvePart {
  name: string;
  geometry: BufferGeometry;
  /** Hareketsiz parçalarda null. */
  pivot: ValvePivot | null;
  damageZones: ValveDamageZone[];
}

export interface ValveFlowPathPoint {
  positionM: [number, number, number];
  /** Yerel akış teğet yönü (birim vektör) — ok/partikül yönlendirmesi için. */
  tangent: [number, number, number];
  /** GÖRSEL göreli hız ipucu (1=nominal, >1=daralma bölgesi) — KDP kapsamı dışı, akış okları/partikül hızını ölçeklemek için. */
  relativeSpeedHint: number;
}

export interface ValveMetadata {
  componentKind: ComponentType;
  partNames: string[];
  vertexCount: number;
  triangleCount: number;
  lod: LodLevel;
}

export interface ValveAssembly {
  componentType: ComponentType;
  parts: ValvePart[];
  /** Üretim anındaki openingPercent için ÖNCEDEN hesaplanmış kolaylık pozları (bkz. modül başlığı — computePartPoseForOpening ile animasyon sırasında YENİDEN türetilir, bu alan yalnızca statik/ilk-kare gösterim içindir). */
  currentPose: Record<string, ValvePartPose>;
  flowPath: ValveFlowPathPoint[];
  metadata: ValveMetadata;
}
