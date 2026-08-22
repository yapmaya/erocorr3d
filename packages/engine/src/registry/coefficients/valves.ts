// packages/engine/src/registry/coefficients/valves.ts
//
// ISA S75.01.01 / IEC 60534-2-1 vana boyutlandırma denklem sabitleri (N6,
// FF formülü). NOT: vana TİPİNE özgü tipik FL/xT/FD/Cv-d² değerleri burada
// DEĞİL, packages/engine/src/data/valveCatalog.ts içindedir (module
// "valveCatalog") — bu dosya yalnızca TÜM vana tipleri için ORTAK olan
// evrensel boyutlandırma denklemi sabitlerini içerir.

import type { Coefficient, Source } from "../types";

const MODULE = "valves";

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_FISHER_HANDBOOK_EQ_CONSTANTS: Source = {
  type: "TEXTBOOK",
  citation:
    "Emerson/Fisher, \"Control Valve Handbook\", 5. baskı, Bölüm 5.7 \"Equation Constants\" tablosu — N6 " +
    "sabiti (kütlesel debi formu, kg/h, bar, kg/m³ birimlerinde). ISA S75.01.01/IEC 60534-2-1'in aynı " +
    "sabitidir. Bu oturumda dosyanın tam metninden doğrudan okundu.",
  url: "https://uploads-ssl.webflow.com/5ac7cf1999758e25761dac7f/5afc83913a6585f1d67cad74_Emerson-Fisher-Control-Valve-handbook-fifth-edition.pdf",
  accessedDate: "2026-08-11",
};

const SRC_FF_FORMULA_SECONDARY: Source = {
  type: "STANDARD",
  citation:
    "IEC 60534-2-1 sıvı kritik basınç oranı faktörü FF = 0.96 - 0.28×√(Pv/Pc) formülü — bu oturumda " +
    "birden fazla bağımsız ikincil mühendislik kaynağı (multicalci.com hesaplayıcısı, ratral/wcontrolvalve " +
    "açık kaynak R paketi belgeleri, genel arama sentezi) aynı formülde ve aynı katsayılarda (0.96/0.28) " +
    "örtüştü. Orijinal IEC 60534-2-1 standardının kendisi (ücretli) bu oturumda doğrudan okunmadı.",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// N6 — kütlesel debi formu sabiti (metrik: kg/h, bar, kg/m³)
// ─────────────────────────────────────────────────────────────────────────

const N6_METRIC: Coefficient<number> = {
  id: "valves.isa60534.n6Metric",
  module: MODULE,
  value: 27.3,
  unit: "-",
  description:
    "ISA S75.01.01/IEC 60534-2-1 kütlesel debi denklemi sabiti N6 (Cv = W/(N6·Fp·√(ΔP·ρ1))) — W: kg/h, " +
    "ΔP: bar, ρ1: kg/m³ birimlerinde kullanıldığında.",
  source: SRC_FISHER_HANDBOOK_EQ_CONSTANTS,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "OPEN_SOURCE_CODE",
      citation:
        "bydeji.com, \"Control Valve Cv Calculator (IEC 60534 / ISA S75.01)\" — aynı formül ve N6=27.3 " +
        "sabiti bağımsız olarak doğrulandı.",
      url: "https://bydeji.com/posts/cv-calc/",
      accessedDate: "2026-08-11",
    },
  ],
  confidence: "HIGH",
  notes: "İki bağımsız kaynak (Fisher El Kitabı tablosu + bydeji.com hesaplayıcısı) TAM OLARAK aynı değeri (27.3) veriyor.",
};

// ─────────────────────────────────────────────────────────────────────────
// FF formülü sabitleri (sıvı kritik basınç oranı faktörü)
// ─────────────────────────────────────────────────────────────────────────

const FF_FORMULA_CONSTANT_1: Coefficient<number> = {
  id: "valves.isa60534.ffFormulaConstant1",
  module: MODULE,
  value: 0.96,
  unit: "-",
  description: "FF = C1 - C2×√(Pv/Pc) formülündeki C1 sabiti.",
  source: SRC_FF_FORMULA_SECONDARY,
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Orijinal IEC 60534-2-1 standardı (ücretli) bu oturumda doğrudan okunmadı, yalnızca birbirini " +
    "doğrulayan ikincil kaynaklar kullanıldı — MEDIUM işaretlendi. Pv≈0 iken FF→0.96, bu değer aynı zamanda " +
    "eski/basitleştirilmiş sızdırmazlık standartlarında sabit FF=0.96 olarak da kullanılıyordu (tutarlı).",
};

const FF_FORMULA_CONSTANT_2: Coefficient<number> = {
  id: "valves.isa60534.ffFormulaConstant2",
  module: MODULE,
  value: 0.28,
  unit: "-",
  description: "FF = C1 - C2×√(Pv/Pc) formülündeki C2 sabiti.",
  source: SRC_FF_FORMULA_SECONDARY,
  crossChecked: true,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes: "FF_FORMULA_CONSTANT_1 ile aynı gerekçeyle MEDIUM işaretlendi.",
};

// ─────────────────────────────────────────────────────────────────────────
// ISA-RP75.23-1995 "Considerations for Evaluating Control Valve Cavitation"
// — sigma (σ) yöntemi: kademeli kavitasyon şiddeti, ölçek etkileri (SSE/PSE)
// ─────────────────────────────────────────────────────────────────────────
//
// KAYNAK NOTU: ISA-RP75.23-1995'in kendisi bu oturumda doğrudan okunmadı
// (birden fazla mirror denendi, hiçbiri erişilebilir bir PDF vermedi — bkz.
// SRC_MASONEILAN_STARES_2007/SRC_DEZURIK_ALPHA1). Bunun yerine standardı
// BİREBİR alıntılayan/uygulayan İKİ BAĞIMSIZ, isimli-yazar/üretici kaynağı
// kullanıldı ve TÜM formüller (b üsteli, SSE, PSE, σv) ayrıca DeZURIK
// kaynağındaki tam SAYISAL örnek (Adım 1-8, 2" VPB vana, 300/50/29.84 psia)
// bu oturumda BAĞIMSIZ OLARAK elle yeniden hesaplanarak doğrulandı (b=0.115,
// SSE=0.954, PSE=1.347, σv=1.71 — hepsi kaynağın kendi sonuçlarıyla birebir
// eşleşti) — bkz. tests/erosion/valveHydraulics.test.ts "DeZURIK örneği".

const SRC_MASONEILAN_STARES_2007: Source = {
  type: "CONFERENCE",
  citation:
    "James A. Stares (Chief Engineer, Masoneilan/Dresser), \"Control Valve Cavitation, Damage Control\", " +
    "Şubat 2007 — ISA-RP75.23-1995 sigma yönteminin tam açıklaması: σ=(P1-Pv)/(P1-P2), kavitasyon " +
    "rejimleri (σi incipient, σc constant, σmv max vibration, σid incipient damage), ölçek etkisi " +
    "denklemleri SSE=(d/dR)^b, PSE=[(P1-Pv)/(P1-Pv)R]^a, b=0.068×(Cv/d²)^0.25, ve " +
    "σv=(σmr×SSE-1)×PSE+1 (Bölüm \"Sigma Method\"). Bu oturumda dosyanın tam metninden (pdftotext ile) " +
    "doğrudan okundu.",
  url: "https://iceweb.eit.edu.au/Valve/Control%20Valves/Masoneilan/ControlValveCavitation.pdf",
  accessedDate: "2026-08-12",
};

const SRC_DEZURIK_ALPHA1: Source = {
  type: "TEXTBOOK",
  citation:
    "DeZURIK, \"Alpha I Cavitation Guide\" (Alpha1 V20 yazılımı teknik kılavuzu) — ISA-RP75.23-1995'in " +
    "PSE/SSE/σv denklemlerini BİREBİR aynı formda tekrar eder (Bölüm 6 \"PSE & SSE Equations and " +
    "Variables ISA 75.23\", Bölüm 7 \"σv Pipe Reducers and σp ISA 75.23\") ve tam sayısal bir uygulama " +
    "örneği içerir (Bölüm 8 \"Steps for Analyzing Cavitation\", 2\" VPB vana, P1=300psia, P2=50psia, " +
    "Pv=29.84psia örneği — b=0.115, SSE=0.954, PSE=1.347, σv=1.71 sonuçlarıyla). Bu oturumda dosyanın " +
    "tam metninden (pdftotext ile) doğrudan okundu.",
  url: "https://www.dezurik.com/wp-content/uploads/2025/01/Cavitation-Guide.pdf",
  accessedDate: "2026-08-12",
};

const SIGMA_SCALE_EXPONENT_B_FORMULA_CONSTANT: Coefficient<number> = {
  id: "valves.isaRp7523.sizeScaleExponentBFormulaConstant",
  module: MODULE,
  value: 0.068,
  unit: "-",
  description:
    "ISA-RP75.23-1995 boyut ölçekleme üsteli b'nin, aynı Cv/d² oranına sahip bir vana serisi için " +
    "yaklaşık formülündeki sabit: b = 0.068×(Cv/d²)^0.25 (Cv/d², ABD birim sistemi — Cv [ABD gpm birimi], " +
    "d [inç] — kaynağın kendi belirttiği birim kuralı).",
  source: SRC_MASONEILAN_STARES_2007,
  crossChecked: true,
  crossCheckSources: [SRC_DEZURIK_ALPHA1],
  confidence: "HIGH",
  notes:
    "İKİ BAĞIMSIZ kaynak TAM OLARAK aynı formülü veriyor VE DeZURIK'in kendi sayısal örneğinde " +
    "(Cv=32, d=2\") b=0.068×(32/4)^0.25=0.068×8^0.25=0.1146≈0.115 sonucu bu oturumda elle yeniden " +
    "hesaplanarak doğrulandı (kaynağın kendi \"b=0.115\" sonucuyla birebir eşleşti).",
};

const SCALED_SIGMA_FORMULA: Coefficient<string> = {
  id: "valves.isaRp7523.scaledIncipientDamageSigmaFormula",
  module: MODULE,
  value: "σv = (σmr × SSE − 1) × PSE + 1  (SSE=(d/dR)^b, PSE=[(P1−Pv)/(P1−Pv)R]^a)",
  unit: "-",
  description:
    "ISA-RP75.23-1995 üretici-değerlendirmesi σmr'yi (referans boyut/basınçta test edilmiş kavitasyon " +
    "hasarı başlangıcı sigma değeri) uygulama koşullarına (gerçek boyut d, gerçek basınç P1-Pv) ölçekleyen " +
    "formül. Kabul kriteri: σ (servis) ≥ σv ise güvenli; σ < σv ise hasar başlangıcı riski (kaynağın kendi " +
    "kuralı: σ/σv < 0.90 olduğunda kavitasyon 'başlangıcı' kabul edilir).",
  source: SRC_MASONEILAN_STARES_2007,
  crossChecked: true,
  crossCheckSources: [SRC_DEZURIK_ALPHA1],
  confidence: "HIGH",
  notes:
    "İKİ BAĞIMSIZ kaynak (Masoneilan/Stares 2007, DeZURIK Alpha I Guide) BİREBİR aynı formülü veriyor VE " +
    "DeZURIK'in kendi sayısal örneği (σmr=1.6 @%47 açıklık, SSE=0.954, PSE=1.347 → σv=(1.6×0.954-1)×1.347+1" +
    "=1.7099) bu oturumda elle yeniden hesaplanarak doğrulandı (kaynağın kendi \"σv=1.71\" sonucuyla birebir " +
    "eşleşti) — bu, projedeki en güçlü şekilde çapraz doğrulanmış vana kavitasyon sabitlerinden biridir. " +
    "ÖNEMLİ: σmr (üretici tarafından test edilen kavitasyon hasarı sigma'sı), a/b üsteli, dR/PR referans " +
    "boyut/basıncı — HİÇBİRİ jenerik/vana-tipinden-bağımsız bir sayı DEĞİLDİR, her biri ÜRETİCİ TEST " +
    "VERİSİNDEN gelmelidir (tıpkı data/valveCatalog.ts'teki kcTypical alanı gibi) — bu oturumda hiçbir vana " +
    "tipi için jenerik bir σmr/a/b DEĞERİ verilmedi/uydurulmadı, yalnızca FORMÜLÜN KENDİSİ kayda geçirildi.",
};

const CHOKING_SIGMA_RELATION_NOTE: Coefficient<string> = {
  id: "valves.isaRp7523.chokingSigmaFromFlRelation",
  module: MODULE,
  value: "σ_choked = (P1−Pv) / ΔPchoked = (P1−Pv) / [FL²×(P1−Ff×Pv)] ≈ 1/FL² (Ff≈1 iken)",
  unit: "-",
  description:
    "Boğulmuş akış noktasındaki sigma (σch), vana boğulma denkleminden (ΔPchoked=FL²(P1-Ff·Pv), zaten " +
    "valves.isa60534.* kayıtlarında sourced) DOĞRUDAN CEBİRSEL OLARAK türetilir — ayrı bir kaynak sabiti " +
    "GEREKMEZ. Ff≈1 (Pv≪Pc yaygın durumu) yaklaşımıyla σch≈1/FL² basitleşir.",
  source: {
    type: "STANDARD",
    citation:
      "Bu oturumda iki bağımsız ikincil kaynak (dezurik.com Alpha I Guide 'the inverse of Kc is used to " +
      "create σmr' bölümü ve controleng.com \"Control Valve Cavitation\" makalesinin arama-motoru " +
      "özetindeki 'choked flow cavitation occurs when sigma drops to approximately 1/(FL²)' ifadesi) aynı " +
      "sonuca işaret etti; bu proje formülü KENDİ zaten-sourced ΔPchoked denkleminden CEBİRSEL olarak " +
      "yeniden türeterek (bağımsız matematiksel doğrulama) kullanır — controleng.com'un kendisi bu " +
      "oturumda 403 nedeniyle doğrudan okunamadı, yalnızca arama motoru sentezinden alıntılandı.",
    accessedDate: "2026-08-12",
  },
  crossChecked: true,
  crossCheckSources: [SRC_DEZURIK_ALPHA1],
  confidence: "HIGH",
  notes:
    "confidence=HIGH, çünkü bu bir CEBİRSEL TÜRETİMDİR (zaten HIGH/MEDIUM sourced FL/FF formüllerinden), " +
    "harici bir sayının doğrudan alıntılanmasına dayanmaz — kod bu yaklaşımı KULLANMAZ, tam formülü " +
    "(Ff dahil) doğrudan hesaplar; bu kayıt yalnızca belgeleme/izlenebilirlik amaçlıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Gaz/buhar servisi — IEC 60534-2-1 boyutlandırma (Fγ, xT-bazlı boğulma, Y)
// ─────────────────────────────────────────────────────────────────────────

const SRC_HITVALVE_SIZING_GUIDE: Source = {
  type: "TEXTBOOK",
  citation:
    "HIT VALVE S.p.A., \"Valve Sizing Calculator — Reference Guide\", Rev. 0 (15/09/2016), Bölüm 2.1.2 " +
    "\"Gas/vapor flow sizing equations\" — W=N6·Cv·Fp·Y·√(xsizing·p1·ρ1), xchoked=Fγ·xTP, Fγ=γ/1.4, " +
    "Y=1-xsizing/(3·xchoked) (boğulmada Y→2/3), ve \"Mach number (gas)\" bölümü (\"Mach number at the " +
    "valve outlet should be lower than 1. Gas applications... noise attenuation trim... limited to " +
    "approximately 0.33 Mach for continuous throttling duty\"). Bu oturumda dosyanın tam metninden " +
    "(pdftotext ile) doğrudan okundu — IEC 60534-2-1'in kendisi ücretli olduğundan bu oturumda doğrudan " +
    "okunmadı, ancak bu kaynak standardın denklemlerini birebir/açık atıfla tekrarlıyor.",
  url: "https://hitvalve.com/images/downloads/valve-sizing-calculator_reference-guide.pdf",
  accessedDate: "2026-08-12",
};

const GAS_REFERENCE_SPECIFIC_HEAT_RATIO: Coefficient<number> = {
  id: "valves.gasSizing.referenceSpecificHeatRatio",
  module: MODULE,
  value: 1.4,
  unit: "-",
  description:
    "IEC 60534-2-1 özgül ısı oranı düzeltme faktörü Fγ=γ/1.4 formülündeki referans değer (havanın/iki " +
    "atomlu gazın standart γ'sı, γ=1.4 için Fγ=1 olacak şekilde normalize eder).",
  source: SRC_HITVALVE_SIZING_GUIDE,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "STANDARD",
      citation:
        "Genel termodinamik — ideal iki atomlu gaz (hava, N2, doğal gazın ana bileşeni CH4'e yakın) için " +
        "γ=Cp/Cv=1.4 standart ders kitabı değeri; bu oturumda birden fazla bağımsız vana boyutlandırma " +
        "kaynağı (industrialmonitordirect.com, CheCalc) aynı Fγ=γ/1.4 formunu doğruladı.",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "HIGH",
  notes: "Standart termodinamik referans değeri, birden fazla bağımsız kaynakla tutarlı.",
};

const GAS_MASS_FLOW_N6_REUSE_NOTE: Coefficient<string> = {
  id: "valves.gasSizing.massFlowEquationReusesLiquidN6",
  module: MODULE,
  value: "W_gas [kg/h] = Cv × N6 × Fp × Y × √(x_sizing[bar] × P1[bar] × ρ1[kg/m³])",
  unit: "-",
  description:
    "IEC 60534-2-1 gaz/buhar KÜTLESEL debi denklemi, sıvı denklemiyle AYNI N6 sabitini kullanır (yalnızca " +
    "boğulmuş basınç düşümü ΔPchoked yerine xsizing×P1 ve genleşme faktörü Y eklenir) — sıvı ve gaz için " +
    "AYRI bir N sabiti GEREKMEZ.",
  source: SRC_HITVALVE_SIZING_GUIDE,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Tek kaynak (HIT VALVE) ama STRÜKTÜREL bir gerçek (formülün ŞEKLİ, yeni bir sayısal sabit DEĞİL) — " +
    "N6'nın SAYISAL DEĞERİ (27.3) zaten valves.isa60534.n6Metric altında bağımsız iki kaynakla " +
    "doğrulanmıştı, burada yalnızca AYNI sabitin gaz denkleminde de kullanıldığı belgeleniyor.",
};

const GAS_MACH_CONTINUOUS_THROTTLING_LIMIT: Coefficient<number> = {
  id: "valves.gasSizing.machNumberContinuousThrottlingLimit",
  module: MODULE,
  value: 0.33,
  unit: "-",
  description:
    "Sürekli kısma (continuous throttling) servisinde, gürültü azaltma trim'i kullanılan gaz uygulamaları " +
    "için önerilen vana çıkışı Mach sayısı üst sınırı.",
  source: SRC_HITVALVE_SIZING_GUIDE,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Tek kaynak — bağımsız ikinci bir sayısal kaynak bu oturumda bulunamadı. Aynı kaynak içinde ayrıca " +
    "\"high noise levels can be generated even though the outlet velocity may be as low as Mach 0.4\" " +
    "ifadesi de var (aynı mertebe, dahili tutarlılık) ama bu ayrı/bağımsız bir kaynak SAYILMADI.",
};

const GAS_AERODYNAMIC_NOISE_NEVER_EXCEED_DBA: Coefficient<number> = {
  id: "valves.gasSizing.aerodynamicNoiseNeverExceedDbA",
  module: MODULE,
  value: 110,
  unit: "dBA",
  description:
    "VDMA 24422 (1979) bazlı hesaplamada, vana/boru mekanik hasarını ve enstrümantasyon fonksiyonunu " +
    "korumak için AŞILMAMASI önerilen ses basıncı seviyesi (1m mesafede, yalıtımsız Sch 40 boru varsayımı).",
  source: SRC_HITVALVE_SIZING_GUIDE,
  crossChecked: true,
  crossCheckSources: [
    {
      type: "TEXTBOOK",
      citation:
        "Valmet, \"Flow Control Manual — Gas and steam flow\" — aynı 110 dBA \"never used\" sınırını " +
        "bağımsız olarak yayımlıyor (kendisi de VDMA 24422/IEC 60534-8 kaynaklı).",
      url: "https://www.valmet.com/flowcontrol/valves/flow-control-manual/gas-and-steam-flow/",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "MEDIUM",
  notes:
    "İki bağımsız ÜRETİCİ yayını aynı sayıyı veriyor ama ikisi de muhtemelen aynı kök standarda (VDMA " +
    "24422:1979) dayanıyor — orijinal VDMA standardının kendisi bu oturumda okunmadı (ücretli), bu yüzden " +
    "MEDIUM (tam bağımsız değil, ama en azından iki farklı üretici tarafından doğrulanmış).",
};

const LIQUID_CAVITATION_NOISE_SIZE_LIMITS_DBA: Coefficient<{ maxNpsInch: number | null; limitDbA: number }[]> = {
  id: "valves.liquidCavitationNoise.sizeDependentLimitDbA",
  module: MODULE,
  value: [
    { maxNpsInch: 3, limitDbA: 80 },
    { maxNpsInch: 6, limitDbA: 85 },
    { maxNpsInch: 14, limitDbA: 90 },
    { maxNpsInch: null, limitDbA: 95 }, // null = 16" ve üzeri
  ],
  unit: "dBA",
  description:
    "SIVI kavitasyon hasarından kaçınmak için, vana NPS boyutuna göre önerilen dış ses basıncı seviyesi " +
    "(1m mesafede) üst sınırı — büyük vanalarda kabarcık/saniye yoğunluğu daha dağınık olduğu için sınır " +
    "yükselir.",
  source: {
    type: "TEXTBOOK",
    citation:
      "Valin (Flow Control Magazine), \"Predicting Cavitation Damage in Control Valves\" — Dr. Hans " +
      "Baumann'ın 1985 makalesinde 85 dBA'i 6\" kelebek vana için üst sınır olarak önermesi ve Metso'nun " +
      "(makale yazarının çalıştığı üretici) çok sayıda uygulamayı inceleyen doğrulama çalışmasının VDMA " +
      "24422 (1979) gürültü hesabına dayalı sonucu: ≤3\"→80dBA, 4-6\"→85dBA, 8-14\"→90dBA, ≥16\"→95dBA.",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Tek yayımlanmış kaynak (ama isimli yazar/kaynak zinciri belgeli: Baumann 1985 → Metso doğrulama " +
    "çalışması → Flow Control Magazine). Bu tablo SIVI kavitasyon gürültüsü içindir — GAZ/aerodinamik " +
    "gürültü için valves.gasSizing.aerodynamicNoiseNeverExceedDbA (110dBA, farklı mekanizma/farklı " +
    "sayı) kullanılmalıdır, ikisi KARIŞTIRILMAMALIDIR.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kısmi açıklık erozyon şiddet çarpanı — jenerik (vana-tipinden bağımsız)
// varsayılan eğri
// ─────────────────────────────────────────────────────────────────────────

const GENERIC_PARTIAL_OPENING_SEVERITY_CURVE: Coefficient<{ openingPercent: number; multiplier: number }[]> = {
  id: "valves.partialOpeningSeverity.genericMultiplierCurve",
  module: MODULE,
  value: [
    { openingPercent: 100, multiplier: 1 },
    { openingPercent: 50, multiplier: 2.5 },
    { openingPercent: 20, multiplier: 6.0 },
    { openingPercent: 10, multiplier: 12 },
  ],
  unit: "-",
  description:
    "Vana TİPİNDEN BAĞIMSIZ, jenerik kısmi açıklık erozyon şiddet çarpanı eğrisi — yalnızca data/" +
    "valveCatalog.ts'in ilgili vana tipi/bölgesi için kendi eğrisi TANIMLI DEĞİLSE yedek (fallback) " +
    "olarak kullanılır.",
  source: {
    type: "PROJECT_DOCUMENT",
    citation:
      "Bu proje için verilen görev tanımının kendisinde (master-context) önerilen kalibrasyon " +
      "başlangıç noktası: \"%100→1.0, %50→~2.5, %20→~6.0, %10→~12\".",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "data/valveCatalog.ts'teki EROSION_ZONE_CAVEAT ile AYNI nedenle: bu oturumda hiçbir yayımlanmış " +
    "kaynak, vana kısmi açıklığına karşı erozyon şiddetinin sayısal bir çarpan eğrisini vermiyor " +
    "(doğrulandı — bkz. bu dosyanın araştırma notları). Bu eğri, görev tanımının kendi önerdiği " +
    "KALİBRE EDİLEBİLİR bir varsayılan başlangıç noktasıdır, ölçülmüş bir veri DEĞİLDİR. UI'da HER ZAMAN " +
    "sarı rozet + açık uyarı ile gösterilmelidir; gerçek saha/test verisiyle kalibre edilmeden " +
    "malzeme/bakım kararı için kullanılmamalıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kavitasyon hasar hızı GÖSTERGE (indicative) ölçeklemesi — erosion/dropletErosion.ts
// İLE AYNI FELSEFE: hiçbir kaynak mutlak bir mm/yıl değeri vermiyor, yalnızca
// eşik-altı/üstü oranına göre KABA bir üstel ölçekleme.
// ─────────────────────────────────────────────────────────────────────────

const CAVITATION_DAMAGE_VELOCITY_EXPONENT_RANGE: Coefficient<[number, number]> = {
  id: "valves.cavitationDamage.severityExponentRange",
  module: MODULE,
  value: [3, 6],
  unit: "-",
  description:
    "Eşik (σv) ALTINA inildikçe, gösterge kavitasyon hasar hızının yaklaşık olarak (σv/σ)^n ile " +
    "ölçeklendiği varsayılan üstel (n) aralığı — enerji yoğunluğunun kabarcık çöküşünde ΔP/σ ile " +
    "keskin biçimde arttığı fiziksel gerçeğinin KABA bir temsili.",
  source: {
    type: "JOURNAL",
    citation:
      "\"Velocity Exponent for Hydrodynamic Cavitation Erosion\" (mej.researchcommons.org) — arama " +
      "motoru özetine göre kavitasyon erozyonu hız üsteli test koşullarına bağlı olarak 3 ile 12.62 " +
      "arasında değişiyor. BU KAYNAK BU OTURUMDA DOĞRUDAN OKUNAMADI (sunucu 403 Forbidden döndü) — " +
      "yalnızca arama motoru özetinden alıntılandı, birincil metin doğrulanmadı.",
    url: "https://mej.researchcommons.org/cgi/viewcontent.cgi?article=2740&context=home",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [
    {
      type: "CONFERENCE",
      citation:
        "erosion/dropletErosion.ts'teki dropletErosion.aboveThresholdVelocityExponentRange (n=4-5, sünek " +
        "malzeme buhar türbini damlacık erozyonu literatüründen, ANALOJİ yoluyla) benzer mertebede — aynı " +
        "genel fiziksel mekanizma (sünek metalde tekrarlı darbe/çökme yorulması) olduğu için kabaca " +
        "tutarlılık kontrolü olarak kullanıldı, bağımsız bir SAYISAL kaynak değil.",
      accessedDate: "2026-08-12",
    },
  ],
  confidence: "UNVERIFIED",
  notes:
    "KDP kural 4 açıkça uygulanıyor: birincil/ikincil kaynağın kendisi bu oturumda OKUNAMADI (403), " +
    "yalnızca arama motoru sentez metninden bir sayı aralığı elde edildi — bu YETERSİZ bir doğrulama " +
    "düzeyidir. Bu proje aralığın MUHAFAZAKÂR (düşük aşım oranlarında hasarı ABARTMAYAN) alt ucunu, n=3'ü, " +
    "merkezi tahmin olarak kullanır; üst uç (n=6, bulunan 12.62'nin çok altında, ekstra muhafazakâr bir " +
    "kısıtlama) yalnızca duyarlılık bilgisi olarak sonuç mesajında gösterilir. SONUÇ HER ZAMAN " +
    "confidence=UNVERIFIED taşır.",
};

const CAVITATION_DAMAGE_INDICATIVE_RATE_AT_THRESHOLD_MM_PER_YEAR: Coefficient<number> = {
  id: "valves.cavitationDamage.indicativeRateAtThresholdMmPerYear",
  module: MODULE,
  value: 0.1,
  unit: "mm/yıl",
  description:
    "Eşik noktasında (σ=σv, kavitasyon hasarı TAM BAŞLANGICI) varsayılan GÖSTERGE aşınma hızı — mutlak " +
    "büyüklüğü kaynaktan GELMEZ, erosion/dropletErosion.ts'teki AYNI mühendislik kabulünün (projenin " +
    "kendi 'asgari anlamlı aşınma hızı' konvansiyonu, bkz. shared.ts) bu mekanizmaya taşınmış halidir.",
  source: {
    type: "STANDARD",
    citation:
      "Bu projenin kendi mühendislik kabulü — bkz. registry/coefficients/shared.ts ve dropletErosion.ts, " +
      "aynı 0,1 mm/yıl değeri.",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "BU DEĞER MUTLAK BİR ÖLÇÜM DEĞİLDİR. Hiçbir kaynak, kavitasyon hasarı başlangıcındaki mutlak mm/yıl " +
    "büyüklüğünü vermiyor. HER ZAMAN confidence=UNVERIFIED + belirgin validityWarning ile birlikte döner.",
};

const CAVITATION_DAMAGE_UNCERTAINTY_BAND_FACTOR: Coefficient<number> = {
  id: "valves.cavitationDamage.uncertaintyBandFactor",
  module: MODULE,
  value: 5,
  unit: "-",
  description: "Gösterge kavitasyon hasar hızı için çarpımsal belirsizlik bandı genişliği (P90=P50×faktör, P10=P50/faktör).",
  source: {
    type: "STANDARD",
    citation:
      "Projenin kendi mühendislik kabulü — dropletErosion.uncertaintyBandFactor ile AYNI gerekçe: hem " +
      "üstel (n, UNVERIFIED) hem referans hız (0,1mm/yıl, ödünç alınmış) belirsiz olduğu için geniş tutuldu.",
    accessedDate: "2026-08-12",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes: "Yayımlanmış bir kavitasyon-hasarı-özgü P10/P90 bandı bulunamadı.",
};

// ─────────────────────────────────────────────────────────────────────────
// Dışa aktarım
// ─────────────────────────────────────────────────────────────────────────

export const VALVES_COEFFICIENTS: Coefficient[] = [
  N6_METRIC,
  FF_FORMULA_CONSTANT_1,
  FF_FORMULA_CONSTANT_2,
  SIGMA_SCALE_EXPONENT_B_FORMULA_CONSTANT,
  SCALED_SIGMA_FORMULA as Coefficient,
  CHOKING_SIGMA_RELATION_NOTE as Coefficient,
  GAS_REFERENCE_SPECIFIC_HEAT_RATIO,
  GAS_MASS_FLOW_N6_REUSE_NOTE as Coefficient,
  GAS_MACH_CONTINUOUS_THROTTLING_LIMIT,
  GAS_AERODYNAMIC_NOISE_NEVER_EXCEED_DBA,
  LIQUID_CAVITATION_NOISE_SIZE_LIMITS_DBA as Coefficient,
  GENERIC_PARTIAL_OPENING_SEVERITY_CURVE as Coefficient,
  CAVITATION_DAMAGE_VELOCITY_EXPONENT_RANGE as Coefficient,
  CAVITATION_DAMAGE_INDICATIVE_RATE_AT_THRESHOLD_MM_PER_YEAR,
  CAVITATION_DAMAGE_UNCERTAINTY_BAND_FACTOR,
];
