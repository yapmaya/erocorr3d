// apps/web/src/features/report/pdf/generatePdfReport.ts
//
// PDF dosya üretimi/indirme orkestratörü. SAF DEĞİL (dosya indirme yan
// etkisi) — bu yüzden `exportPng.ts`/`exportChartPng.ts` ile AYNI gerekçeyle
// Vitest ile test edilmez (bkz. o dosyaların dosya başı notları). Belge
// yapısının kendisi `buildPdfDocDefinition.ts`'te SAF olarak test edilir.
//
// pdfmake v0.3 API'si (node_modules'ten doğrulandı): `pdfmake/build/pdfmake`
// çalışma zamanı nesnesini, `pdfmake/build/vfs_fonts`i (gömülü Roboto —
// Türkçe karakterleri destekler) `addVirtualFileSystem` ile kaydeder.
//
// İMPORT NOTU (tarayıcıda GERÇEKTEN doğrulandı, `import * as pdfMake` İLE
// ÇALIŞMIYORDU): `pdfmake/build/pdfmake`'in tip tanımı (@types/pdfmake) düz
// ES named export'lar kullanır (`export default` YOK) — bu yüzden ilk
// izlenimle "namespace import (`import * as`) gerekir" diye düşünülmüştü.
// AMA çalışma zamanında (hem Vite dev sunucusunun esbuild CJS-interop'u HEM
// Rollup'ın commonjs eklentisi) bu paketi TAMAMEN CJS kabul ediyor ve
// `import * as pdfMake` yalnızca `{ default: <gerçek pdfMake nesnesi> }`
// üretiyor (`pdfMake.createPdf`/`addVirtualFileSystem` bu yüzden `undefined`
// kalıyordu, tarayıcıda "is not a function" hatası). `esModuleInterop:true`
// (tsconfig.base.json) sayesinde DÜZ `import pdfMake from "..."` (senkron
// default import) hem tip kontrolünden geçiyor HEM çalışma zamanında doğru
// nesneyi (`.default`in kendisi) veriyor — bu yüzden TERCİH EDİLEN biçim budur.
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { ReportData } from "../reportData";
import { buildPdfDocDefinition } from "./buildPdfDocDefinition";

let vfsRegistered = false;

function ensureVfsRegistered(): void {
  if (vfsRegistered) return;
  pdfMake.addVirtualFileSystem(pdfFonts);
  vfsRegistered = true;
}

export function generatePdfReport(data: ReportData): void {
  ensureVfsRegistered();
  const docDefinition = buildPdfDocDefinition(data);
  const filename = `${data.settings.documentNo || "erocorr3d-rapor"}-rev${data.settings.revision || "0"}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename);
}
