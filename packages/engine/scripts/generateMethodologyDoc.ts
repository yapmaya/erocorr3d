// packages/engine/scripts/generateMethodologyDoc.ts
//
// Dokümantasyon sitesinin "Mühendislik Metodolojisi" sayfasını
// `MECHANISMS` kataloğundan (packages/engine/src/data/mechanisms.ts, 24
// hasar mekanizması) ÜRETİR — her mekanizmanın açıklaması, kaynağı,
// tetikleyici koşulları, tipik konumu ve önleyici tedbirleri ZATEN kayıtlı
// veridir; burada YENİ bir mühendislik iddiası YAZILMAZ (KDP'ye uygun).
// Sayısal model/katsayı ayrıntıları için bkz. ayrı üretilen
// "Katsayı Kayıt Defteri" sayfası (generateRegistryDump.ts).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MECHANISMS, type DamageMechanism } from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "..", "..", "..", "docs");
const OUTPUT_FILE = join(DOCS_DIR, "metodoloji.md");

function esc(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function renderMechanism(m: DamageMechanism): string {
  const rateRange = m.typicalRateRangeMmPerYear
    ? `${m.typicalRateRangeMmPerYear[0]}–${m.typicalRateRangeMmPerYear[1]} mm/yıl`
    : "*Belirtilmemiş — bkz. ilgili sayısal model (Katsayı Kayıt Defteri)*";

  return `### ${m.nameTr} (${m.nameEn})

- **Kimlik:** \`${m.id}\`
- **Kaynak/Standart:** ${esc(m.relatedStandardOrSource)}
- **Tetikleyici koşullar:** ${esc(m.triggerConditionsTr)}
- **Tipik konum:** ${esc(m.typicalLocationTr)}
- **Tipik hız aralığı:** ${rateRange}
- **Önleyici tedbirler:**
${m.preventiveMeasuresTr.map((p) => `  - ${esc(p)}`).join("\n")}
`;
}

function buildMarkdown(): string {
  const internal = MECHANISMS.filter((m) => m.category === "INTERNAL");
  const external = MECHANISMS.filter((m) => m.category === "EXTERNAL");

  return `# Mühendislik Metodolojisi

Bu sayfa, motorun değerlendirdiği ${MECHANISMS.length} hasar mekanizmasının
(${internal.length} iç + ${external.length} dış) OTOMATİK dökümüdür —
\`packages/engine/src/data/mechanisms.ts\` kataloğundan üretilir
(\`npm run docs:methodology\`), elle düzenlenmez. Her mekanizmanın SAYISAL
modeli (formül, katsayılar, geçerlilik aralığı) için bkz.
[Katsayı Kayıt Defteri](katsayi-kayit-defteri.md) — bu sayfa NİTELİKSEL
tanımı, kaynağı ve önleyici tedbirleri listeler.

> Bu belge mühendislik tahminidir. Model belirsizliği tipik olarak 2-3 kat
> mertebesindedir. Nihai malzeme seçimi yetkin bir korozyon mühendisinin
> onayını gerektirir. Bkz. [Sorumluluk Reddi](sorumluluk-reddi.md).

## İç (Internal) Mekanizmalar

${internal.map(renderMechanism).join("\n")}

## Dış (External) Mekanizmalar

${external.map(renderMechanism).join("\n")}
`;
}

mkdirSync(DOCS_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, buildMarkdown(), "utf-8");
console.log(`Metodoloji belgesi üretildi: ${OUTPUT_FILE}`);
