// packages/engine/src/registry/coefficients/materialSelection.ts
//
// Proses boru/ekipman malzeme seçimi karar merdivenleri — kullanıcının
// kendi iç proje dokümanından (§10.1/§10.3.2-§10.3.7/§10.4 ve bir kıyı/
// deniz etkisi tablosu) BİREBİR okundu.
//
// KDP NOTU: bu dokümanın kimliği (kurum, doküman no, revizyon, saha kod
// adları) izlenebilirlik amacıyla bu kod tabanında paylaşılmıyor — bu
// yüzden dış kaynakla çapraz doğrulanamıyor ve aşağıdaki tüm katsayılar
// confidence=UNVERIFIED işaretlidir (bkz. her katsayının kendi notes'u).

import type { Coefficient, Source } from "../types";

const MODULE = "materialSelection";

const SRC_ANONYMIZED_PROJECT_DOC: Source = {
  type: "PROJECT_DOCUMENT",
  citation: "Kullanıcının kendi iç proje dokümanı — dış kaynakla çapraz doğrulanmamış, izlenebilirlik amacıyla kimliği paylaşılmıyor.",
  accessedDate: "2026-08-12",
};

// ─────────────────────────────────────────────────────────────────────────
// §10.3.1 — Minimum tasarım sıcaklığı merdiveni
// ─────────────────────────────────────────────────────────────────────────

export type MinDesignTempMaterialFamily = "CS" | "LTCS" | "SS316L_COATED_OR_35NI" | "CRA";

export interface MinDesignTempStep {
  materialFamily: MinDesignTempMaterialFamily;
  /** Bu ailenin geçerli olduğu minimum tasarım sıcaklığı (°C, dahil) — null=alt sınır yok */
  minTempC: number | null;
  /** Bu ailenin geçerli olduğu maksimum tasarım sıcaklığı (°C, dahil) — null=üst sınır yok (bu aile için üstteki aile devralır) */
  maxTempC: number | null;
  displayNameTr: string;
  requiredCorrosionAllowanceMm: number | null;
}

const MIN_DESIGN_TEMP_LADDER: MinDesignTempStep[] = [
  { materialFamily: "CS", minTempC: -29, maxTempC: null, displayNameTr: "Karbon Çelik (CS)", requiredCorrosionAllowanceMm: 1.5 },
  { materialFamily: "LTCS", minTempC: -45, maxTempC: -29, displayNameTr: "Düşük Sıcaklık Karbon Çeliği (LTCS)", requiredCorrosionAllowanceMm: 1.5 },
  {
    materialFamily: "SS316L_COATED_OR_35NI",
    minTempC: -100,
    maxTempC: -46,
    displayNameTr: "Dış Kaplamalı 316L Paslanmaz Çelik veya 3½ Nikel Alaşımlı Çelik",
    requiredCorrosionAllowanceMm: 1.5,
  },
  { materialFamily: "CRA", minTempC: null, maxTempC: -100, displayNameTr: "Korozyona Dayanıklı Alaşım (CRA)", requiredCorrosionAllowanceMm: null },
];

const MIN_DESIGN_TEMP_LADDER_COEFFICIENT: Coefficient<MinDesignTempStep[]> = {
  id: "materialSelection.minDesignTempLadder",
  module: MODULE,
  value: MIN_DESIGN_TEMP_LADDER,
  unit: "°C",
  description: "§10.3.1 minimum tasarım sıcaklığına göre malzeme ailesi seçimi merdiveni.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Kaynak dokümanın kimliği izlenebilirlik amacıyla anonim tutulduğundan dış kaynakla çapraz " +
    "doğrulanamadı — kullanılmadan önce bağımsız bir kaynakla veya yetkin bir mühendisle doğrulanmalıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// §10.3.2 — Proses Borusu (Piping) CA merdiveni
// ─────────────────────────────────────────────────────────────────────────

export interface CorrosionAllowanceLadderStep {
  /** Bu basamağın ÜST sınırı (mm, dahil) — null=üst sınır yok (en üst basamak) */
  maxRequiredCaMm: number | null;
  selectedCorrosionAllowanceMm: number | null;
  materialDisplayNameTr: string;
  requiresCra: boolean;
  extraRequirementsTr: string[];
}

const PIPING_CA_LADDER: CorrosionAllowanceLadderStep[] = [
  { maxRequiredCaMm: 1.5, selectedCorrosionAllowanceMm: 1.5, materialDisplayNameTr: "Karbon Çelik (CS) + 1,5mm CA", requiresCra: false, extraRequirementsTr: [] },
  { maxRequiredCaMm: 3.0, selectedCorrosionAllowanceMm: 3.0, materialDisplayNameTr: "Karbon Çelik (CS) + 3,0mm CA", requiresCra: false, extraRequirementsTr: [] },
  {
    maxRequiredCaMm: 6.0,
    selectedCorrosionAllowanceMm: 6.0,
    materialDisplayNameTr: "Karbon Çelik (CS) + 6,0mm CA (servis içi muayene mümkünse 3,0mm CA yeterli)",
    requiresCra: false,
    extraRequirementsTr: [],
  },
  {
    maxRequiredCaMm: null,
    selectedCorrosionAllowanceMm: null,
    materialDisplayNameTr: "Korozyona Dayanıklı Alaşım (CRA), minimum SS316L",
    requiresCra: true,
    extraRequirementsTr: ["Intergranular (taneler arası) korozyon testi yapılmalıdır."],
  },
];

const PIPING_CA_LADDER_COEFFICIENT: Coefficient<CorrosionAllowanceLadderStep[]> = {
  id: "materialSelection.pipingCaLadder",
  module: MODULE,
  value: PIPING_CA_LADDER,
  unit: "mm",
  description: "§10.3.2 gerekli korozyon payına göre proses borusu malzeme seçimi merdiveni.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Kaynak dokümanın kimliği izlenebilirlik amacıyla anonim tutulduğundan dış kaynakla çapraz " +
    "doğrulanamadı — kullanılmadan önce bağımsız bir kaynakla veya yetkin bir mühendisle doğrulanmalıdır. " +
    "Bu tam olarak görev tanımının kendi 'karar merdiveni' örneğidir (CA=1.49/1.50/2.99/3.00/5.99/6.00/6.01 " +
    "sınır testleri bu tabloyu hedefler).",
};

// ─────────────────────────────────────────────────────────────────────────
// §10.4 / Tablo 10-2 — Cıvatalama seçimi (ISO 21457)
// ─────────────────────────────────────────────────────────────────────────

export interface BoltingOption {
  pipingMaterialFamily: string;
  boltsStandard: string;
  nutsStandard: string;
  /** Bu cıvata/somun çiftinin geçerli olduğu minimum sıcaklık (°C, bu değerin ÜZERİNDE geçerli) */
  minTempC: number;
}

const BOLTING_TABLE: BoltingOption[] = [
  { pipingMaterialFamily: "Karbon Çelik / Düşük Alaşımlı Çelik", boltsStandard: "ASTM A193 Gr B7", nutsStandard: "ASTM A194 Gr 2H", minTempC: -40 },
  { pipingMaterialFamily: "Karbon Çelik / Düşük Alaşımlı Çelik (katodik korumalı)", boltsStandard: "ASTM A193 Gr B7M", nutsStandard: "ASTM A194 Gr 2HM", minTempC: -48 },
  { pipingMaterialFamily: "316L Paslanmaz Çelik (katodik korumalı)", boltsStandard: "ASTM A320 Grade L7M", nutsStandard: "ASTM A194 Grade 7M", minTempC: -73 },
  { pipingMaterialFamily: "316L Paslanmaz Çelik", boltsStandard: "ASTM A320 Grade L7", nutsStandard: "ASTM A194 Grade 4", minTempC: -101 },
];

const BOLTING_TABLE_COEFFICIENT: Coefficient<BoltingOption[]> = {
  id: "materialSelection.boltingTable",
  module: MODULE,
  value: BOLTING_TABLE,
  unit: "-",
  description: "§10.4 Tablo 10-2 — kabul edilebilir cıvatalama, sıcaklığa göre.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation: "ISO 21457 — kaynak dokümanın kendisi bu tablonun ISO 21457 gereksinimlerine uygun olduğunu belirtiyor (\"Bolting for process pipework shall comply with requirements of ISO 21457\").",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "UNVERIFIED",
  notes:
    "ISO 21457'ye (uluslararası standart) atıfla çapraz kontrol edildi, ancak bu yalnızca GENEL " +
    "çerçevenin uygulandığını doğrular — spesifik cıvata/somun standardı EŞLEŞTİRMELERİ hâlâ anonim " +
    "tutulan iç proje dokümanına dayanır ve dış kaynakla ayrıca doğrulanmadı — kullanılmadan önce " +
    "bağımsız bir kaynakla veya yetkin bir mühendisle doğrulanmalıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// §10.3.3-§10.3.7 — sayısal bir eşik/tablo İÇERMEYEN, ama doğrudan
// dokümandan okunan NİTELİKSEL karar kuralları (basınçlı kap/ısı değiştirici/
// hava soğutmalı eşanjör/gövde-boru eşanjörü/depolama tankı) için TEK bir
// belgeleme/izlenebilirlik kaydı — her bir kuralın kendi metin alıntısı
// ilgili fonksiyonun JSDoc'unda ve aggregate/materialSelection.ts'in dosya
// başı yorumunda ayrıca verilir.
// ─────────────────────────────────────────────────────────────────────────

const PSS_DOCUMENT_REFERENCE: Coefficient<string> = {
  id: "materialSelection.pssDocument",
  module: MODULE,
  value: "Kullanıcının kendi iç proje dokümanı, §10.3.3-§10.3.7 (kimliği izlenebilirlik amacıyla anonim tutuluyor)",
  unit: "-",
  description: "§10.3.3 (Pressure Vessels), §10.3.4 (Heat Exchangers), §10.3.5 (Air Cooled HX), §10.3.6 (Shell & Tube HX), §10.3.7 (Storage Tanks) niteliksel karar kurallarının izlenebilirlik kaydı.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Bu bölümlerin sayısal eşikleri (3mm/6mm/1,5mm CA, 50barg, 60°C) doğrudan kaynak dokümanın metninden " +
    "okundu (aggregate/materialSelection.ts'teki ilgili fonksiyonların JSDoc'unda alıntılanır) — ayrı bir " +
    "yapılandırılmış tablo/registry girdisi olarak TEKRARLANMADI (piping/min-tasarım-sıcaklığı/bolting'in " +
    "aksine, bu bölümler daha çok metinsel/koşullu kurallardır, temiz bir tablo yapısına dönüşmez). Kaynak " +
    "dokümanın kimliği anonim tutulduğundan dış kaynakla çapraz doğrulanamadı.",
};

// ─────────────────────────────────────────────────────────────────────────
// §8.1 — Kıyı ortamı eşiği (bu PROJEYE özgü örnek, genel bir mühendislik
// sabiti DEĞİLDİR — çağıran taraf kendi sahası için ayarlamalıdır)
// ─────────────────────────────────────────────────────────────────────────

const COASTAL_DISTANCE_THRESHOLD_KM: Coefficient<number> = {
  id: "materialSelection.coastalDistanceThresholdKm",
  module: MODULE,
  value: 16,
  unit: "km",
  description: "Bu PROJEYE özgü kıyı/deniz etkisi eşiği — genel bir mühendislik sabiti DEĞİLDİR, kaynak sahasına özgüdür.",
  source: SRC_ANONYMIZED_PROJECT_DOC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Kaynak dokümanın kendi metninden BİREBİR okundu ANCAK bu değer SAHAYA ÖZGÜDÜR (kaynak sahasının " +
    "spesifik meteorolojik/tuz taşınım koşullarına dayanır) — başka bir saha için doğrudan uygulanmamalı, " +
    "bu yüzden fonksiyonda her zaman override edilebilir bir parametre olarak sunulur. Kaynağın kimliği " +
    "izlenebilirlik amacıyla anonim tutulduğundan dış kaynakla çapraz doğrulanamadı.",
};

export const MATERIAL_SELECTION_COEFFICIENTS: Coefficient[] = [
  MIN_DESIGN_TEMP_LADDER_COEFFICIENT as Coefficient,
  PIPING_CA_LADDER_COEFFICIENT as Coefficient,
  BOLTING_TABLE_COEFFICIENT as Coefficient,
  PSS_DOCUMENT_REFERENCE as Coefficient,
  COASTAL_DISTANCE_THRESHOLD_KM,
];
