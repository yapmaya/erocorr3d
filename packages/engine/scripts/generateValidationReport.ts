// packages/engine/scripts/generateValidationReport.ts
//
// "npm run validate" komutunun ürettiği tek-dosya, çevrimdışı HTML raporu.
// Harici hiçbir kütüphane (grafik/CDN/ücretli servis) KULLANMAZ — saçılım
// grafiği elle çizilmiş inline SVG'dir. `tsx` ile çalıştırılır (bkz.
// package.json "validate" script'i) ve doğrudan ../src/index'i import eder
// — dist/index.js DEĞİL: bu projenin tsconfig'i "moduleResolution":
// "Bundler" kullanır, bu yüzden tsc'nin ürettiği dist/*.js dosyalarındaki
// uzantısız import'lar (ör. "./types") düz Node ESM çözümleyicisiyle
// ÇALIŞMAZ (bu betiği yazarken doğrudan test edilip doğrulandı — "Directory
// import ... is not supported" hatası). tsx, apps/web'in Vite'ıyla AYNI
// bundler-tarzı çözümlemeyi kullandığından src'yi doğrudan çalıştırabilir.
//
// Bu betik, tests/validation/*.test.ts ile AYNI referans veriyi ve AYNI
// motor fonksiyonlarını kullanır (src/fixtures/referenceFacilityValidationData.ts)
// — testler ve rapor birbirinden BAĞIMSIZ sayı üretmez, tek doğruluk kaynağı
// paylaşılır.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPENDIX_A_VALIDATION_CASES,
  computeEngineCo2RateMmPerYear,
  MATERIAL_LADDER_CASES,
  PSS0002_CITATION,
  SLC_CTL_ATL_CASES,
  computeCtlAtl,
  computeTotalMetalLoss,
  listByConfidence,
  registryStats,
  selectPipingMaterial,
} from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "validation-report");
const OUTPUT_FILE = join(OUTPUT_DIR, "index.html");
const TOLERANCE_FRACTION = 0.3;

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// ─────────────────────────────────────────────────────────────────────────
// 1) Appendix A CO2 hız karşılaştırması
// ─────────────────────────────────────────────────────────────────────────

interface Co2Row {
  label: string;
  descriptionTr: string;
  reference: number;
  calculated: number;
  deviationPct: number;
  withinTolerance: boolean;
}

const co2Rows: Co2Row[] = APPENDIX_A_VALIDATION_CASES.map((testCase) => {
  const calculated = computeEngineCo2RateMmPerYear(testCase);
  const reference = testCase.referenceMmPerYear;
  const deviationPct = reference === 0 ? (calculated === 0 ? 0 : Infinity) : ((calculated - reference) / reference) * 100;
  const withinTolerance = Math.abs(deviationPct) <= TOLERANCE_FRACTION * 100;
  return {
    label: `${testCase.streamId} / ${testCase.nativeGasCase.appendixAColumn} (%${testCase.nativeGasCase.nativeGasPercent} doğal gaz)`,
    descriptionTr: testCase.descriptionTr,
    reference,
    calculated,
    deviationPct,
    withinTolerance,
  };
});

const co2PassCount = co2Rows.filter((r) => r.withinTolerance).length;

// ─────────────────────────────────────────────────────────────────────────
// 2) SLC / CTL-ATL
// ─────────────────────────────────────────────────────────────────────────

const slcRows = SLC_CTL_ATL_CASES.map((testCase) => {
  const metalLoss = computeTotalMetalLoss(
    [
      {
        scenarioNameTr: "Çekiş (withdrawal)",
        operatingDaysPerYear: testCase.operatingDaysPerYear,
        rateMmPerYear: { p10: testCase.cruMmPerYear, p50: testCase.cruMmPerYear, p90: testCase.cruMmPerYear },
      },
    ],
    testCase.designLifeYears,
  );
  const ctlAtl = computeCtlAtl({
    predictedTotalCorrosionMm: metalLoss.totalServiceLifeCorrosionMm.p50,
    selectedCorrosionAllowanceMm: testCase.primaryCaMm,
  });
  const slcDeviationPct = ((metalLoss.totalServiceLifeCorrosionMm.p50 - testCase.referenceSlcMm) / testCase.referenceSlcMm) * 100;
  const ratioDeviationPct = ((ctlAtl.ratio - testCase.referenceAtlCtlRatio) / testCase.referenceAtlCtlRatio) * 100;
  return {
    streamId: testCase.streamId,
    calculatedSlcMm: metalLoss.totalServiceLifeCorrosionMm.p50,
    referenceSlcMm: testCase.referenceSlcMm,
    slcDeviationPct,
    calculatedRatio: ctlAtl.ratio,
    referenceRatio: testCase.referenceAtlCtlRatio,
    ratioDeviationPct,
    category: ctlAtl.category,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// 3) Malzeme merdiveni
// ─────────────────────────────────────────────────────────────────────────

const materialRows = MATERIAL_LADDER_CASES.map((testCase) => {
  const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: testCase.slcMm, inServiceInspectionPossible: false });
  const expectedLabel = `${testCase.expectedCaMm.toFixed(1).replace(".", ",")}mm`;
  const matches = result.primaryMaterialTr.includes(expectedLabel);
  return {
    streamId: testCase.streamId,
    slcMm: testCase.slcMm,
    expectedCaMm: testCase.expectedCaMm,
    resultLabel: result.primaryMaterialTr,
    matches,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// 4) Kayıt defteri özeti
// ─────────────────────────────────────────────────────────────────────────

const stats = registryStats();
const unverified = listByConfidence("UNVERIFIED");

// ─────────────────────────────────────────────────────────────────────────
// Saçılım grafiği (elle çizilmiş SVG, harici kütüphane yok)
// ─────────────────────────────────────────────────────────────────────────

function buildScatterSvg(rows: Co2Row[]): string {
  const size = 520;
  const pad = 56;
  const plotSize = size - pad * 2;
  const maxValue = Math.max(0.1, ...rows.map((r) => Math.max(r.reference, r.calculated))) * 1.15;

  const toX = (v: number) => pad + (v / maxValue) * plotSize;
  const toY = (v: number) => size - pad - (v / maxValue) * plotSize;

  const gridLines: string[] = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const v = (maxValue / tickCount) * i;
    const x = toX(v);
    const y = toY(v);
    gridLines.push(
      `<line x1="${pad}" y1="${y}" x2="${size - pad}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<line x1="${x}" y1="${pad}" x2="${x}" y2="${size - pad}" stroke="#e2e8f0" stroke-width="1"/>`,
      `<text x="${pad - 8}" y="${y + 4}" font-size="10" text-anchor="end" fill="#64748b">${v.toFixed(2)}</text>`,
      `<text x="${x}" y="${size - pad + 16}" font-size="10" text-anchor="middle" fill="#64748b">${v.toFixed(2)}</text>`,
    );
  }

  const diagonal = `<line x1="${toX(0)}" y1="${toY(0)}" x2="${toX(maxValue)}" y2="${toY(maxValue)}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6,4"/>`;

  const points = rows
    .map((r) => {
      const x = toX(r.reference);
      const y = toY(r.calculated);
      const color = r.withinTolerance ? "#16a34a" : "#dc2626";
      return `<circle cx="${x}" cy="${y}" r="5" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="1"><title>${esc(r.label)}: ref=${r.reference.toFixed(3)}, hesap=${r.calculated.toFixed(3)}</title></circle>`;
    })
    .join("\n");

  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="auto" role="img" aria-label="Referans ve hesaplanan CO2 hızı saçılım grafiği">
    <rect x="0" y="0" width="${size}" height="${size}" fill="#ffffff"/>
    ${gridLines.join("\n")}
    ${diagonal}
    ${points}
    <line x1="${pad}" y1="${size - pad}" x2="${size - pad}" y2="${size - pad}" stroke="#334155" stroke-width="1.5"/>
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${size - pad}" stroke="#334155" stroke-width="1.5"/>
    <text x="${size / 2}" y="${size - 14}" font-size="12" text-anchor="middle" fill="#334155">Referans (Appendix A, mm/yıl)</text>
    <text x="16" y="${size / 2}" font-size="12" text-anchor="middle" fill="#334155" transform="rotate(-90 16 ${size / 2})">Hesaplanan (motor, mm/yıl)</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────
// HTML üretimi
// ─────────────────────────────────────────────────────────────────────────

function statusBadge(ok: boolean): string {
  return ok ? `<span class="badge badge-ok">GEÇTİ</span>` : `<span class="badge badge-fail">TOLERANS AŞILDI</span>`;
}

const co2TableRows = co2Rows
  .map(
    (r) => `<tr class="${r.withinTolerance ? "" : "row-fail"}">
      <td>${esc(r.label)}</td>
      <td>${esc(r.descriptionTr)}</td>
      <td class="num">${r.reference.toFixed(3)}</td>
      <td class="num">${r.calculated.toFixed(3)}</td>
      <td class="num">${Number.isFinite(r.deviationPct) ? r.deviationPct.toFixed(1) + "%" : "—"}</td>
      <td>${statusBadge(r.withinTolerance)}</td>
    </tr>`,
  )
  .join("\n");

const slcTableRows = slcRows
  .map(
    (r) => `<tr>
      <td>${esc(r.streamId)}</td>
      <td class="num">${r.referenceSlcMm.toFixed(3)}</td>
      <td class="num">${r.calculatedSlcMm.toFixed(3)}</td>
      <td class="num">${r.slcDeviationPct.toFixed(1)}%</td>
      <td class="num">${r.referenceRatio.toFixed(3)}</td>
      <td class="num">${r.calculatedRatio.toFixed(3)}</td>
      <td class="num">${r.ratioDeviationPct.toFixed(1)}%</td>
      <td>${esc(r.category)}</td>
    </tr>`,
  )
  .join("\n");

const materialTableRows = materialRows
  .map(
    (r) => `<tr class="${r.matches ? "" : "row-fail"}">
      <td>${esc(r.streamId)}</td>
      <td class="num">${r.slcMm}</td>
      <td class="num">${r.expectedCaMm}mm</td>
      <td>${esc(r.resultLabel)}</td>
      <td>${statusBadge(r.matches)}</td>
    </tr>`,
  )
  .join("\n");

const unverifiedSection =
  unverified.length > 0
    ? `<div class="banner banner-warn">
        <strong>${unverified.length} UNVERIFIED katsayı</strong> — bu değerler mühendislik kararlarında
        kullanılmadan önce harici kaynakla doğrulanmalıdır (toplam ${stats.total} katsayı içinde).
        <ul>${unverified.map((c) => `<li><code>${esc(c.id)}</code> (${esc(c.module)}) — ${esc(c.notes)}</li>`).join("")}</ul>
      </div>`
    : `<div class="banner banner-ok"><strong>0 UNVERIFIED katsayı</strong> — kayıt defterindeki ${stats.total} katsayının tamamı doğrulanmıştır.</div>`;

const generatedAt = new Date().toISOString();

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>EroCorr3D — Doğrulama Raporu</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.15rem; margin-top: 2.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.4rem; }
  .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .disclaimer { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; font-size: 0.85rem; color: #1e3a8a; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 0.75rem; font-size: 0.85rem; background: white; }
  th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.6rem; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.row-fail { background: #fef2f2; }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-fail { background: #fee2e2; color: #991b1b; }
  .banner { border-radius: 8px; padding: 1rem; margin-top: 0.75rem; font-size: 0.88rem; }
  .banner-ok { background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
  .banner-warn { background: #fef9c3; color: #713f12; border: 1px solid #fde047; }
  .banner ul { margin: 0.5rem 0 0 1.2rem; padding: 0; }
  .summary-cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.75rem; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; min-width: 160px; }
  .card .value { font-size: 1.6rem; font-weight: 700; }
  .card .label { font-size: 0.78rem; color: #64748b; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
  footer { margin-top: 3rem; font-size: 0.75rem; color: #94a3b8; }
  code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 4px; }
</style>
</head>
<body>
  <h1>EroCorr3D — Doğrulama Raporu (Güven Belgesi)</h1>
  <div class="subtitle">Üretim zamanı: ${generatedAt}</div>

  <div class="disclaimer">
    Bu sonuçlar mühendislik tahminidir. Model belirsizliği tipik olarak 2-3 kat mertebesindedir.
    Nihai malzeme seçimi yetkin bir korozyon mühendisinin onayını gerektirir. Bu rapor,
    <strong>${esc(PSS0002_CITATION)}</strong> dokümanının yayımlanmış sonuçlarıyla ne ölçüde
    örtüştüğümüzü gösterir — bit-bit aynı sayı üretimi DEĞİL, metodolojinin doğru yönde olduğunun
    kanıtıdır (bkz. her bölümün kendi sınırlama notu).
  </div>

  <div class="summary-cards">
    <div class="card"><div class="value">${co2PassCount}/${co2Rows.length}</div><div class="label">CO2 hızı — ±%30 tolerans içinde</div></div>
    <div class="card"><div class="value">${stats.total}</div><div class="label">Toplam kayıtlı katsayı</div></div>
    <div class="card"><div class="value" style="color:${unverified.length > 0 ? "#b45309" : "#166534"}">${unverified.length}</div><div class="label">UNVERIFIED katsayı</div></div>
  </div>

  <h2>1) CO2 Korozyon Hızı — Appendix A ile Karşılaştırma</h2>
  <div class="grid-2">
    <div>
      <table>
        <thead><tr><th>Vaka</th><th>Akış</th><th class="num">Referans (mm/yıl)</th><th class="num">Hesaplanan (mm/yıl)</th><th class="num">Sapma</th><th>Durum</th></tr></thead>
        <tbody>${co2TableRows}</tbody>
      </table>
    </div>
    <div>${buildScatterSvg(co2Rows)}</div>
  </div>

  <h2>2) SLC / ATL-CTL (Tablo 10-3 / 10-4)</h2>
  <table>
    <thead><tr><th>Akış</th><th class="num">Ref. SLC (mm)</th><th class="num">Hesap. SLC (mm)</th><th class="num">Sapma</th><th class="num">Ref. Oran</th><th class="num">Hesap. Oran</th><th class="num">Sapma</th><th>Kategori</th></tr></thead>
    <tbody>${slcTableRows}</tbody>
  </table>

  <h2>3) Malzeme Seçimi Merdiveni (§10.3.2)</h2>
  <table>
    <thead><tr><th>Akış</th><th class="num">SLC (mm)</th><th class="num">Beklenen CA</th><th>Motor Sonucu</th><th>Durum</th></tr></thead>
    <tbody>${materialTableRows}</tbody>
  </table>

  <h2>4) Kayıt Defteri Özeti (Kaynak Doğrulama Protokolü)</h2>
  ${unverifiedSection}
  <table>
    <thead><tr><th>Güven Seviyesi</th><th class="num">Adet</th></tr></thead>
    <tbody>
      <tr><td>HIGH</td><td class="num">${stats.byConfidence.HIGH}</td></tr>
      <tr><td>MEDIUM</td><td class="num">${stats.byConfidence.MEDIUM}</td></tr>
      <tr><td>LOW</td><td class="num">${stats.byConfidence.LOW}</td></tr>
      <tr><td>UNVERIFIED</td><td class="num">${stats.byConfidence.UNVERIFIED}</td></tr>
    </tbody>
  </table>

  <footer>EroCorr3D — otomatik üretildi (packages/engine/scripts/generateValidationReport.ts). Kaynak: ${esc(PSS0002_CITATION)}</footer>
</body>
</html>`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, html, "utf-8");

console.log(`Doğrulama raporu üretildi: ${OUTPUT_FILE}`);
console.log(`CO2 hızı: ${co2PassCount}/${co2Rows.length} vaka tolerans içinde.`);
console.log(`Kayıt defteri: ${stats.total} katsayı, ${unverified.length} UNVERIFIED.`);
