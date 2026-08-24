// packages/engine/scripts/generateRegistryDump.ts
//
// Dokümantasyon sitesinin "Katsayı Kayıt Defteri" sayfasını
// `listCoefficients()`'ten (packages/engine/src/registry/store.ts) ÜRETİR
// — elle yazılmış bir mühendislik iddiası İÇERMEZ, kayıt defterinin
// KENDİSİNİN bir dökümüdür (tek doğruluk kaynağı, bkz.
// generateValidationReport.ts'in dosya başı notuyla aynı ilke). `tsx` ile
// çalışır (bkz. package.json "docs:registry" script'i), doğrudan
// ../src/index'i import eder.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCoefficients, registryStats, type Coefficient } from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "..", "..", "docs");
const OUTPUT_FILE = join(DOCS_DIR, "katsayi-kayit-defteri.md");

function esc(value: unknown): string {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatValue(value: unknown): string {
  if (typeof value === "function") return "*fonksiyon/tablo — kaynak koduna bakın*";
  if (typeof value === "object" && value !== null) return `\`${esc(JSON.stringify(value))}\``;
  return esc(value);
}

const CONFIDENCE_ORDER: Coefficient["confidence"][] = ["HIGH", "MEDIUM", "LOW", "UNVERIFIED"];

function buildMarkdown(): string {
  const all = listCoefficients();
  const stats = registryStats();

  const rows = CONFIDENCE_ORDER.flatMap((level) => all.filter((c) => c.confidence === level))
    .map((c) => {
      const source = `${c.source.type}: ${esc(c.source.citation)}${c.source.url ? ` ([bağlantı](${c.source.url}))` : ""}`;
      return `| \`${esc(c.id)}\` | ${formatValue(c.value)} | ${esc(c.unit)} | ${esc(c.description)} | ${source} | ${c.crossChecked ? "Evet" : "Hayır"} | **${c.confidence}** |`;
    })
    .join("\n");

  return `# Katsayı Kayıt Defteri

Bu sayfa \`packages/engine/src/registry/coefficients/\` altında kayıtlı HER
mühendislik sabitinin/katsayısının OTOMATİK dökümüdür — motor her
derlendiğinde (\`npm run docs:registry\`) yeniden üretilir, elle
düzenlenmez. Kaynak Doğrulama Protokolü (KDP) gereği her satırın bir
kaynak atfı ve güven seviyesi vardır; **UNVERIFIED** işaretli satırlar
kullanılmadan önce yetkin bir mühendis tarafından doğrulanmalıdır.

## Özet

| Güven Seviyesi | Adet |
| --- | --- |
| HIGH | ${stats.byConfidence.HIGH} |
| MEDIUM | ${stats.byConfidence.MEDIUM} |
| LOW | ${stats.byConfidence.LOW} |
| UNVERIFIED | ${stats.byConfidence.UNVERIFIED} |
| **Toplam** | **${stats.total}** |

## Tüm Katsayılar

| ID | Değer | Birim | Açıklama | Kaynak | Çapraz Doğrulandı | Güven |
| --- | --- | --- | --- | --- | --- | --- |
${rows}
`;
}

mkdirSync(DOCS_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, buildMarkdown(), "utf-8");
console.log(`Katsayı kayıt defteri dökümü üretildi: ${OUTPUT_FILE}`);
