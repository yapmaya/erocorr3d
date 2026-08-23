// apps/web/src/features/viewer3d/hotspots/useCmpPoints.ts
//
// 3B görüntüleyicideki "İzleme Noktaları" (CMP) katmanı — @erocorr3d/engine'in
// GERÇEK selectCriticalMonitoringPoints()'unu (bkz. aggregate/
// criticalMonitoringPoints.ts) çağırır. `useDemoHotspots.ts`nin AKSİNE
// sentetik veri YOKTUR — bu hook yalnızca GERÇEK bir ScenarioAssessment +
// Geometry çifti (Referans Tesis VEYA girdi sihirbazının "Hesapla" sonucu)
// mevcutken bir sonuç üretir, aksi halde boş dizi döner (DEMO modunda
// koşulsuz olarak boş — CMP kavramı sentetik demo veri üzerinde ANLAMSIZDIR,
// bkz. master görev madde 1'in "gerçek hasar alanından" ifadesi).
//
// NOT: seçilen sekme (scenario tab) HANGİ senaryo olursa olsun, CMP her
// zaman bileşenin BÜTÜNÜNÜN belirleyici (governing) senaryosundan türetilir
// (bkz. selectCriticalMonitoringPoints'in kendi notu) — bu yüzden bu hook
// `realCase` (seçili sekme) DEĞİL, TÜM `ScenarioAssessment`i alır.

import { useMemo } from "react";
import { selectCriticalMonitoringPoints, type CriticalMonitoringPoint, type Geometry, type ScenarioAssessment } from "@erocorr3d/engine";

export function useCmpPoints(assessment: ScenarioAssessment | null, geometry: Geometry | null): CriticalMonitoringPoint[] {
  return useMemo(() => {
    if (!assessment || !geometry) return [];
    return selectCriticalMonitoringPoints(assessment, geometry, 5).points;
  }, [assessment, geometry]);
}
