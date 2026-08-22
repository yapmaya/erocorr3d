// apps/web/src/features/viewer3d/export/exportGltf.ts
//
// GLTF/GLB dışa aktarımı, hasar rengi vertex color olarak GÖMÜLÜ (master
// görev madde 9). `three-stdlib`in `GLTFExporter`ını kullanır (three.js'in
// kendi `examples/jsm/exporters/GLTFExporter.js`inin taşınabilir/paketlenmiş
// hâli — bu proje zaten `OrbitControls`/`TransformControls` için AYNI
// pakete bağımlı, bkz. useCameraController.ts/SectionGizmo.tsx).
//
// Orijinal geometri DEĞİL, bir KOPYASI dışa aktarılır (`clone()`) — canvas'ta
// hâlâ görüntülenen `damage`/`surfaceRegion` gibi bu projeye özgü
// attribute'lar GLTFExporter tarafından zaten tanınmayıp yok sayılır, ama
// KOPYA üzerinde çalışmak "orijinal sahne geometrisini yan etkiyle
// bozmama" garantisini AÇIKÇA sağlar.

import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from "three";
import { GLTFExporter } from "three-stdlib";
import { bakeVertexColors } from "./vertexColorBaking";
import type { ColormapName } from "../../../shaders/colormaps";

export interface ExportGlbParams {
  geometry: BufferGeometry;
  /** null → düz metalik malzeme (ısı haritası kapalıyken); dolu → hasar rengi vertex color olarak gömülür. */
  damageValues: Float32Array | null;
  minValue: number;
  maxValue: number;
  colormap: ColormapName;
  invertColormap: boolean;
}

export async function exportPipeAsGlb({
  geometry,
  damageValues,
  minValue,
  maxValue,
  colormap,
  invertColormap,
}: ExportGlbParams): Promise<ArrayBuffer> {
  const exportGeometry = geometry.clone();
  if (damageValues) {
    const colors = bakeVertexColors(damageValues, minValue, maxValue, colormap, invertColormap);
    exportGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  }

  const material = new MeshStandardMaterial({
    color: 0xa1a1aa,
    metalness: 0.85,
    roughness: 0.32,
    vertexColors: damageValues !== null,
  });
  const mesh = new Mesh(exportGeometry, material);

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(mesh, { binary: true });

  exportGeometry.dispose();
  material.dispose();

  if (!(result instanceof ArrayBuffer)) {
    throw new Error("GLTFExporter ikili (GLB) çıktı yerine JSON döndürdü — beklenmeyen durum.");
  }
  return result;
}

export function downloadGlb(buffer: ArrayBuffer, filename = "erocorr3d-boru.glb"): void {
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
