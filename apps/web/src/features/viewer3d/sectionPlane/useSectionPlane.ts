// apps/web/src/features/viewer3d/sectionPlane/useSectionPlane.ts
//
// Kesit düzleminin React durumu: eksen/serbest açı/offset + türetilmiş
// GERÇEK `THREE.Plane`. Saf matematiği `sectionPlaneMath.ts`e devreder.
//
// "Yarım kesit" AYRI bir kırpma mekanizması DEĞİLDİR (bkz. sectionPlaneMath.ts
// başlığı) — sadece axis=Y, offsetM=0'a geçen bir KISAYOLDUR; kapatıldığında
// önceki eksen/offset'e geri döner.

import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Vector3 } from "three";
import {
  computeSectionOffsetRangeM,
  computeSectionPlaneEquation,
  type SectionAxis,
  type SectionPlaneAngles,
} from "./sectionPlaneMath";

export interface UseSectionPlaneParams {
  lengthM: number;
  outerRadiusM: number;
}

const DEFAULT_ANGLES: SectionPlaneAngles = { thetaDeg: 90, phiDeg: 0 };

export function useSectionPlane({ lengthM, outerRadiusM }: UseSectionPlaneParams) {
  const [enabled, setEnabled] = useState(false);
  const [axis, setAxisState] = useState<SectionAxis>("X");
  const [offsetM, setOffsetM] = useState(lengthM / 2);
  const [angles, setAngles] = useState<SectionPlaneAngles>(DEFAULT_ANGLES);
  const [halfSectionEnabled, setHalfSectionEnabled] = useState(false);
  const preHalfSectionRef = useRef<{ axis: SectionAxis; offsetM: number } | null>(null);

  const offsetRangeM = useMemo(() => computeSectionOffsetRangeM(axis, lengthM, outerRadiusM), [axis, lengthM, outerRadiusM]);

  // `offsetM` yalnızca EKSEN değiştiğinde (bkz. aşağıdaki `setAxis`) yeni
  // aralığa sıkıştırılıyordu — `lengthM`/`outerRadiusM` bileşenin KENDİSİ
  // değiştiğinde (ör. sihirbazda "90° Dirsek"ten "Eş Merkezli Redüksiyon"a
  // geçilip daha KISA bir `lengthM` gelmesi) DEĞİL. Sonuç: eski (daha uzun)
  // geometride ayarlanmış bir `offsetM`, yeni/daha kısa geometrinin
  // aralığının TAMAMEN DIŞINDA kalıyor, kesit düzlemi nesnenin dışına
  // düşüyor ve `PipeMesh` TAMAMEN kırpılıp gözden kayboluyordu (tarayıcıda
  // GERÇEK RENDER'da yakalanan gerçek bir hata). `offsetRangeM` zaten TÜM
  // ilgili girdilere (axis/lengthM/outerRadiusM) göre yeniden hesaplandığı
  // için buna bağlı bir effect, `setAxis`'in manuel sıkıştırmasını da kapsar.
  useEffect(() => {
    setOffsetM((prev) => Math.min(Math.max(prev, offsetRangeM[0]), offsetRangeM[1]));
  }, [offsetRangeM]);

  const setAxis = (nextAxis: SectionAxis) => {
    setAxisState(nextAxis);
    const [minM, maxM] = computeSectionOffsetRangeM(nextAxis, lengthM, outerRadiusM);
    setOffsetM((prev) => Math.min(Math.max(prev, minM), maxM));
    if (halfSectionEnabled) setHalfSectionEnabled(false);
  };

  const toggleHalfSection = () => {
    if (halfSectionEnabled) {
      const restore = preHalfSectionRef.current;
      if (restore) {
        setAxisState(restore.axis);
        setOffsetM(restore.offsetM);
      }
      setHalfSectionEnabled(false);
    } else {
      preHalfSectionRef.current = { axis, offsetM };
      setAxisState("Y");
      setOffsetM(0);
      setHalfSectionEnabled(true);
    }
  };

  const plane = useMemo(() => {
    const { normal, constant } = computeSectionPlaneEquation(axis, offsetM, angles);
    return new Plane(new Vector3(...normal), constant);
  }, [axis, offsetM, angles]);

  return {
    enabled,
    setEnabled,
    axis,
    setAxis,
    offsetM,
    setOffsetM,
    offsetRangeM,
    angles,
    setAngles,
    halfSectionEnabled,
    toggleHalfSection,
    plane,
  };
}
