// apps/web/src/features/viewer3d/useCameraController.ts
//
// Kamerayı VE OrbitControls'u imperatif olarak sürer — hızlı görünüm
// butonları, "nesneye sığdır", "görünümü sıfırla" ve perspektif↔ortografik
// geçiş. Saf matematiği `cameraViews.ts`e devreder (bu dosya SADECE
// three.js/R3F nesnelerine bağlama katmanıdır, kendi hesap mantığını
// İÇERMEZ — testler cameraViews.ts üzerinde çalışır, bkz. proje kuralı
// "her hesap fonksiyonu SAF olacak").

import { useCallback, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3, type OrthographicCamera, type PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  computeFitDistanceM,
  computeOrthoFitZoom,
  computeQuickViewCameraPositionM,
  getQuickViewUp,
  type QuickViewPreset,
} from "./cameraViews";

export interface UseCameraControllerParams {
  /** Sahne hedefi (bakılacak nokta, dünya metre) — genelde bileşenin bounding-sphere merkezi. */
  targetM: [number, number, number];
  /** Bileşenin bounding-sphere yarıçapı (metre) — sığdırma hesaplarının girdisi. */
  boundingRadiusM: number;
  /** Başlangıç/"sıfırla" görünümü. */
  defaultView?: QuickViewPreset;
}

const DEFAULT_VERTICAL_FOV_DEG = 45;
const QUICK_VIEW_MARGIN = 1.6;
const FIT_MARGIN = 1.35;

function isOrthographicCamera(camera: PerspectiveCamera | OrthographicCamera): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera === true;
}

export function useCameraController({ targetM, boundingRadiusM, defaultView = "ISO" }: UseCameraControllerParams) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [orthographic, setOrthographic] = useState(false);
  const [currentView, setCurrentView] = useState<QuickViewPreset>(defaultView);
  const camera = useThree((s) => s.camera) as PerspectiveCamera | OrthographicCamera;
  const size = useThree((s) => s.size);

  const applyCameraForView = useCallback(
    (preset: QuickViewPreset) => {
      const [px, py, pz] = computeQuickViewCameraPositionM(preset, targetM, boundingRadiusM, DEFAULT_VERTICAL_FOV_DEG, QUICK_VIEW_MARGIN);
      camera.position.set(px, py, pz);
      const [ux, uy, uz] = getQuickViewUp(preset);
      camera.up.set(ux, uy, uz);
      if (isOrthographicCamera(camera)) {
        camera.zoom = computeOrthoFitZoom(boundingRadiusM, size.height / 2, FIT_MARGIN);
      }
      camera.lookAt(targetM[0], targetM[1], targetM[2]);
      camera.updateProjectionMatrix();
      const controls = controlsRef.current;
      if (controls) {
        controls.target.set(targetM[0], targetM[1], targetM[2]);
        controls.update();
      }
    },
    [camera, targetM, boundingRadiusM, size.height],
  );

  const goToView = useCallback(
    (preset: QuickViewPreset) => {
      setCurrentView(preset);
      applyCameraForView(preset);
    },
    [applyCameraForView],
  );

  const resetView = useCallback(() => goToView(defaultView), [goToView, defaultView]);

  // Perspektif↔ortografik geçişte drei, `makeDefault` ile YENİ bir kamera
  // nesnesi kaydeder (bkz. PipeViewer.tsx'in koşullu <PerspectiveCamera>/
  // <OrthographicCamera> render'ı) — bu yeni nesnenin kendi varsayılan
  // konumu/zoom'u vardır, önceki görünümle İLGİSİZDİR. `camera` referansı
  // değiştiğinde son uygulanan görünümü (currentView) otomatik yeniden
  // uygulayarak bu geçişi kullanıcı için görünmez kılıyoruz.
  useEffect(() => {
    applyCameraForView(currentView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  /** Mevcut görünüm YÖNÜNÜ korur, sadece mesafeyi/zoom'u nesneyi tam kapsayacak şekilde yeniden ayarlar. */
  const fitToObject = useCallback(() => {
    if (isOrthographicCamera(camera)) {
      camera.zoom = computeOrthoFitZoom(boundingRadiusM, size.height / 2, FIT_MARGIN);
      camera.updateProjectionMatrix();
      return;
    }
    const direction = camera.position.clone().sub(new Vector3(...targetM)).normalize();
    const distanceM = computeFitDistanceM(boundingRadiusM, camera.fov, FIT_MARGIN);
    camera.position.set(
      targetM[0] + direction.x * distanceM,
      targetM[1] + direction.y * distanceM,
      targetM[2] + direction.z * distanceM,
    );
    camera.updateProjectionMatrix();
    controlsRef.current?.update();
  }, [camera, targetM, boundingRadiusM, size.height]);

  const togglePerspective = useCallback(() => {
    setOrthographic((prev) => !prev);
  }, []);

  /**
   * Adlandırılmış bir ön ayara (`QuickViewPreset`) DEĞİL, DOĞRUDAN verilen
   * konum/hedef/zoom'a uygular — paylaşılabilir kamera URL'sini geri
   * yüklemek için (bkz. export/cameraShareUrl.ts). `applyCameraForView`in
   * ön ayar sistemi bu kullanım için KASITLI OLARAK genişletilmedi (farklı
   * bir sorumluluk: "adlandırılmış görünüme git" vs "tam olarak bu 3B
   * noktaya git").
   */
  const applyExplicitCamera = useCallback(
    (positionM: [number, number, number], explicitTargetM: [number, number, number], zoom: number) => {
      camera.position.set(...positionM);
      if (isOrthographicCamera(camera)) {
        camera.zoom = zoom;
      }
      camera.lookAt(explicitTargetM[0], explicitTargetM[1], explicitTargetM[2]);
      camera.updateProjectionMatrix();
      const controls = controlsRef.current;
      if (controls) {
        controls.target.set(explicitTargetM[0], explicitTargetM[1], explicitTargetM[2]);
        controls.update();
      }
    },
    [camera],
  );

  /** Mevcut kamera durumunun anlık görüntüsü — paylaşılabilir URL üretmek için (bkz. export/cameraShareUrl.ts). */
  const getCameraSnapshot = useCallback(
    (): { positionM: [number, number, number]; targetM: [number, number, number]; zoom: number } => ({
      positionM: [camera.position.x, camera.position.y, camera.position.z],
      targetM: controlsRef.current
        ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z]
        : targetM,
      zoom: camera.zoom,
    }),
    [camera, targetM],
  );

  return {
    controlsRef,
    orthographic,
    currentView,
    goToView,
    resetView,
    fitToObject,
    togglePerspective,
    applyExplicitCamera,
    getCameraSnapshot,
  };
}
