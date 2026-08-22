// apps/web/tests/geometry/manifoldCheck.ts
//
// Test yardımcısı (üretim kodu DEĞİL): bir BufferGeometry'nin KAPALI
// (watertight) bir manifold olup olmadığını, her kenarın TAM OLARAK 2
// üçgen tarafından paylaşılıp paylaşılmadığını sayarak kontrol eder.
// Konum bazlı (UV/diğer öznitelik farklarını YOK sayan) bir "kanonik
// vertex" birleştirmesi kullanır — dikiş (seam) amaçlı YİNELENEN
// pozisyon-aynı vertex'ler doğru şekilde TEK kenar ucu sayılır.

import type { BufferGeometry } from "three";

export interface ManifoldCheckResult {
  isClosed: boolean;
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  triangleCount: number;
}

export function checkManifold(geometry: BufferGeometry, positionTolerance = 1e-5): ManifoldCheckResult {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertexCount = position.count;

  // Kanonik vertex kimliği: pozisyona göre yuvarlanmış anahtar. ÖNEMLİ: toFixed() -0/0 işaretini
  // KORUR (ör. Math.sin(2π)'nin ~-1e-16'lık kalıntısı "-0.00000" verir, "0.00000"e EŞİT DEĞİLDİR
  // string olarak) — bu, matematiksel olarak aynı noktaların YANLIŞLIKLA farklı kanonik kimliklere
  // düşmesine yol açar; toleransın altındaki değerleri tam sıfıra SIKI SIKIYA kırparak önlenir.
  const precision = Math.round(-Math.log10(positionTolerance));
  const snapZero = (v: number) => (Math.abs(v) < positionTolerance / 2 ? 0 : v);
  const keyOf = (i: number) =>
    `${snapZero(position.getX(i)).toFixed(precision)}|${snapZero(position.getY(i)).toFixed(precision)}|${snapZero(position.getZ(i)).toFixed(precision)}`;
  const canonicalId = new Map<string, number>();
  const canonical = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const key = keyOf(i);
    let id = canonicalId.get(key);
    if (id === undefined) {
      id = canonicalId.size;
      canonicalId.set(key, id);
    }
    canonical[i] = id;
  }

  const indices: number[] = [];
  if (index) {
    for (let i = 0; i < index.count; i++) indices.push(index.getX(i));
  } else {
    for (let i = 0; i < vertexCount; i++) indices.push(i);
  }
  const triangleCount = indices.length / 3;

  const edgeCounts = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const a = canonical[indices[t * 3]];
    const b = canonical[indices[t * 3 + 1]];
    const c = canonical[indices[t * 3 + 2]];
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdgeCount++;
    else if (count !== 2) nonManifoldEdgeCount++;
  }

  return {
    isClosed: boundaryEdgeCount === 0 && nonManifoldEdgeCount === 0,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    triangleCount,
  };
}
