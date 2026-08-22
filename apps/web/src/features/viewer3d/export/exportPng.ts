// apps/web/src/features/viewer3d/export/exportPng.ts
//
// Yüksek çözünürlüklü PNG dışa aktarımı (master görev madde 9). Three.js/
// DOM'a bağımlı — SAF DEĞİL, bu yüzden test edilmez (proje kuralı: sadece
// hesap fonksiyonları SAF olmak ZORUNDA; DOM/GPU yan etkisi olan bu tür
// yardımcılar tsc/lint/gerçek tarayıcı ile doğrulanır, bkz. Colorbar.tsx'in
// AYNI emsali).
//
// Şeffaf arka plan: `Canvas`ın `gl={{alpha:true}}` İLE kurulmuş olması
// GEREKİR (bkz. PipeViewer.tsx) — aksi halde WebGL context'in kendisi alfa
// kanalı TAŞIMAZ, `scene.background=null` yapmak tek başına yetmez.

import type { Camera, Scene, WebGLRenderer } from "three";

export interface CapturePngParams {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  transparentBackground: boolean;
}

/** Sahneyi bir kez daha render edip mevcut canvas içeriğini PNG data URL'sine çevirir. */
export function capturePngDataUrl({ gl, scene, camera, transparentBackground }: CapturePngParams): string {
  const previousBackground = scene.background;
  const previousClearAlpha = gl.getClearAlpha();

  if (transparentBackground) {
    scene.background = null;
    gl.setClearAlpha(0);
  }

  gl.render(scene, camera);
  const dataUrl = gl.domElement.toDataURL("image/png");

  if (transparentBackground) {
    scene.background = previousBackground;
    gl.setClearAlpha(previousClearAlpha);
  }

  return dataUrl;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
