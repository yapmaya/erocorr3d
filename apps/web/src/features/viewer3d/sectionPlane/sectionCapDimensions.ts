// apps/web/src/features/viewer3d/sectionPlane/sectionCapDimensions.ts
//
// Kesit kapağının 2B (kesit düzleminin KENDİ yerel x/y'si — henüz 3B
// dünyaya döndürülmemiş) süsleme geometrisi: teknik-resim kuralına uygun
// et-kalınlığı TARAMASI (kısa, 45° eğik çizgiler — annulus'un orta hattı
// boyunca eşit aralıklı) ve bir ÖLÇÜ ÇİZGİSİ (iç yarıçaptan dış yarıçapa,
// üzerinde mm cinsinden et kalınlığı etiketiyle). SAF matematik — three.js
// bağımlılığı yok, `WallThicknessCap.tsx` bu 2B noktaları düzlemin gerçek
// normaline göre 3B'ye taşır (bkz. o dosyanın kendi quaternion hizalaması,
// components/three/SectionCapPlane.tsx ile AYNI teknik).
//
// KDP kapsamı DIŞINDADIR — mühendislik katsayısı değil, saf çizim geometrisi.

export interface Point2D {
  x: number;
  y: number;
}

export interface HatchTick2D {
  start: Point2D;
  end: Point2D;
}

/**
 * Et kalınlığı halkasının (annulus) orta hattı boyunca eşit aralıklı, 45°
 * eğik KISA çizgi parçaları — klasik teknik-resim kesit taraması. Her çizgi
 * annulus'un orta yarıçapında ORTALANIR, uzunluğu et kalınlığından biraz
 * fazladır (gerçek taramaya benzer şekilde iç/dış sınırı hafifçe aşar).
 */
export function computeAnnulusHatchTicks2D(
  outerRadiusM: number,
  innerRadiusM: number,
  tickCount = 48,
  hatchAngleDeg = 45,
): HatchTick2D[] {
  if (outerRadiusM <= innerRadiusM) throw new Error("outerRadiusM, innerRadiusM'den büyük olmalıdır.");
  if (innerRadiusM < 0) throw new Error("innerRadiusM negatif olamaz.");
  if (tickCount < 3 || !Number.isInteger(tickCount)) throw new Error("tickCount en az 3 olan bir tam sayı olmalıdır.");

  const midRadiusM = (innerRadiusM + outerRadiusM) / 2;
  const wallThicknessM = outerRadiusM - innerRadiusM;
  const halfLenM = wallThicknessM * 0.65;
  const tiltRad = (hatchAngleDeg * Math.PI) / 180;

  const ticks: HatchTick2D[] = [];
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * Math.PI * 2;
    const centerX = Math.cos(angle) * midRadiusM;
    const centerY = Math.sin(angle) * midRadiusM;
    // Yerel tarama yönü: dairesel teğet ile radyal doğrultunun tiltRad
    // ağırlıklı karışımı — tiltRad=45°'de klasik çapraz tarama hissi verir.
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const dirX = tangentX * Math.sin(tiltRad) + radialX * Math.cos(tiltRad);
    const dirY = tangentY * Math.sin(tiltRad) + radialY * Math.cos(tiltRad);
    ticks.push({
      start: { x: centerX - dirX * halfLenM, y: centerY - dirY * halfLenM },
      end: { x: centerX + dirX * halfLenM, y: centerY + dirY * halfLenM },
    });
  }
  return ticks;
}

export interface WallThicknessDimensionLine2D {
  startXY: Point2D;
  endXY: Point2D;
  labelPositionXY: Point2D;
  wallThicknessMm: number;
}

/**
 * İç yarıçaptan dış yarıçapa uzanan tek bir radyal ölçü çizgisi (varsayılan
 * olarak saat 4-5 yönünde, hatch deseniyle çakışmayan sabit bir açıda) +
 * etiketin (mm cinsinden et kalınlığı) yerleştirileceği nokta.
 */
export function computeWallThicknessDimensionLine2D(
  outerRadiusM: number,
  innerRadiusM: number,
  angleDeg = -30,
): WallThicknessDimensionLine2D {
  if (outerRadiusM <= innerRadiusM) throw new Error("outerRadiusM, innerRadiusM'den büyük olmalıdır.");
  if (innerRadiusM < 0) throw new Error("innerRadiusM negatif olamaz.");

  const angleRad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);
  const labelRadiusM = outerRadiusM * 1.18;

  return {
    startXY: { x: dirX * innerRadiusM, y: dirY * innerRadiusM },
    endXY: { x: dirX * outerRadiusM, y: dirY * outerRadiusM },
    labelPositionXY: { x: dirX * labelRadiusM, y: dirY * labelRadiusM },
    wallThicknessMm: (outerRadiusM - innerRadiusM) * 1000,
  };
}
