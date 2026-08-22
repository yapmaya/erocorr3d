// packages/engine/src/registry/coefficients/prEos.ts
//
// Peng-Robinson (1976) hâl denkleminin EVRENSEL sabitleri (Ωa, Ωb) ve
// karışım kuralı için ikili etkileşim parametreleri (kij).
//
// Kaynak: Peng, D.-Y.; Robinson, D.B., "A New Two-Constant Equation of
// State", Industrial & Engineering Chemistry Fundamentals, 15(1), 1976,
// s.59-64 (orijinal makale, bu oturumda doğrudan erişilemedi — paywall).
// Ωa=0.45724/Ωb=0.07780 sabitleri ve κ=0.37464+1.54226ω-0.26992ω² formülü
// BAĞIMSIZ İKİ kaynakta ÇAPRAZ DOĞRULANDI: (1) genel web taraması sentezi
// (a=0.457235R²Tc²/Pc, b=0.077796RTc/Pc — daha hassas/yuvarlanmamış biçim)
// ve (2) Penn State Üniversitesi PNG520 "Phase Behavior of Natural Gas and
// Condensate Fluids" ders notları (a=0.45724R²Tc²/Pc, b=0.07780RTc/Pc —
// yaygın yuvarlanmış biçim). İki biçim de aynı sabitin farklı ondalık
// hassasiyetli sunumudur; bu dosyada yaygın yuvarlanmış biçim kullanıldı.
//
// kij (ikili etkileşim parametresi) KAYNAK DURUMU — KDP'ye göre üç ayrı
// güven seviyesinde işlendi, bkz. her coefficient'in notes alanı:
//   1) Hidrokarbon-hidrokarbon çiftleri: kij=0 (HIGH — Peng-Robinson'ın
//      kendi orijinal konvansiyonu, hemen hemen her ders kitabında tekrar
//      edilir: benzer aile parafinler için van der Waals kuralı tek başına
//      yeterlidir).
//   2) Su-diğer bileşen çiftleri: ABD Jeoloji Kurumu (USGS) PHREEQC 3
//      belgelerindeki "dahili sabit kodlanmış" Peng-Robinson gaz kij
//      değerleri (MEDIUM — resmi/kararlı bir kaynak ama PHREEQC belgesinin
//      kendisi orijinal atıf vermiyor; muhtemel köken Søreide & Whitson,
//      "Peng-Robinson predictions for hydrocarbons, CO2, N2 and H2S with
//      pure water and NaCl brine", Fluid Phase Equilibria 77, 1992 — bu
//      makaleye bu oturumda doğrudan erişilemedi, DOĞRULANMALI).
//   3) CO2/N2/H2S'in birbiriyle VE hidrokarbonlarla çiftleri: bu oturumda
//      GÜVENİLİR bir sayısal değer bulunamadı (yalnızca "kij sıfırdan uzak
//      olabilir" niteliksel ifadeleri bulundu — bkz. InTechOpen "Thermodynamic
//      Models for the Prediction of Petroleum-Fluid Phase Behaviour" bölüm
//      5). KDP kural 4 gereği UYDURULMADI: UNVERIFIED, 0 (etkileşim yok)
//      varsayıldı, kullanılmadan önce doğrulanmalı.

import type { Coefficient, Source } from "../types";

const MODULE = "prEos";

const SRC_PR_1976: Source = {
  type: "JOURNAL",
  citation:
    "Peng, D.-Y.; Robinson, D.B., \"A New Two-Constant Equation of State\", Industrial & Engineering " +
    "Chemistry Fundamentals, Cilt 15, Sayı 1, 1976, s.59-64.",
  accessedDate: "2026-08-11",
};

const SRC_PSU_PNG520: Source = {
  type: "THESIS",
  citation:
    "Adewumi, M., \"Peng-Robinson EOS (1976)\", PNG 520: Phase Behavior of Natural Gas and Condensate " +
    "Fluids (lisansüstü ders notları), Pennsylvania State University.",
  url: "https://courses.ems.psu.edu/png520/m11_p2.html",
  accessedDate: "2026-08-11",
};

const SRC_USGS_PHREEQC: Source = {
  type: "OPEN_SOURCE_CODE",
  citation:
    "United States Geological Survey (USGS), PHREEQC Version 3 belgeleri, \"Peng-Robinson gas binary " +
    "parameters\" sayfası — dahili varsayılan kij değerleri.",
  url: "https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/gas_binary_parameters.htm",
  accessedDate: "2026-08-11",
};

const SRC_INTECH_KIJ_REVIEW: Source = {
  type: "CONFERENCE",
  citation:
    "\"Thermodynamic Models for the Prediction of Petroleum-Fluid Phase Behaviour\" (InTechOpen açık " +
    "erişimli kitap bölümü), Bölüm 5 \"Correlations to estimate the binary interaction parameters\" — " +
    "CO2/N2/H2S içeren sistemlerde kij'nin sıfırdan belirgin şekilde farklı olabileceğini niteliksel " +
    "olarak belirtir, ancak bu proje için doğrudan kullanılabilir tekil sayısal bir değer VERMEZ.",
  url: "https://cdn.intechopen.com/pdfs/29879/InTech-Thermodynamic_models_for_the_prediction_of_petroleum_fluid_phase_behaviour.pdf",
  accessedDate: "2026-08-11",
};

const SRC_CODATA: Source = {
  type: "STANDARD",
  citation:
    "CODATA 2018 temel fiziksel sabitler (2019 SI birim sistemi yeniden tanımı ile evrensel gaz sabiti " +
    "R=8.31446261815324 J/(mol·K) TANIM GEREĞİ TAM/kesin bir değerdir — Boltzmann sabiti kB ve Avogadro " +
    "sayısı NA'nın tanımlanmış değerlerinden R=kB×NA olarak türetilir).",
  url: "https://physics.nist.gov/cgi-bin/cuu/Value?r",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Evrensel PR sabitleri
// ─────────────────────────────────────────────────────────────────────────

const PR_UNIVERSAL_GAS_CONSTANT: Coefficient<number> = {
  id: "prEos.universalGasConstant",
  module: MODULE,
  value: 8.314462618,
  unit: "J/(mol·K)",
  description: "Evrensel gaz sabiti R",
  source: SRC_CODATA,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Bir mühendislik korelasyon katsayısı değil, 2019 SI birim sistemi yeniden tanımından bu yana TAM " +
    "(kesin) bir fiziksel sabittir — çapraz doğrulama gerektirmez.",
};

const PR_OMEGA_A: Coefficient<number> = {
  id: "prEos.omegaA",
  module: MODULE,
  value: 0.45724,
  unit: "-",
  description: "PR EOS 'a' parametresi evrensel sabiti: a_c = Ωa·R²·Tc²/Pc",
  source: SRC_PR_1976,
  crossChecked: true,
  crossCheckSources: [SRC_PSU_PNG520],
  confidence: "HIGH",
  notes:
    "İki bağımsız kaynak (genel web taraması sentezi: 0.457235; PSU PNG520 ders notu: 0.45724) aynı " +
    "sabitin farklı yuvarlama hassasiyetiyle sunumu — birebir uyumlu.",
};

const PR_OMEGA_B: Coefficient<number> = {
  id: "prEos.omegaB",
  module: MODULE,
  value: 0.07780,
  unit: "-",
  description: "PR EOS 'b' parametresi evrensel sabiti: b = Ωb·R·Tc/Pc",
  source: SRC_PR_1976,
  crossChecked: true,
  crossCheckSources: [SRC_PSU_PNG520],
  confidence: "HIGH",
  notes:
    "İki bağımsız kaynak (genel web taraması sentezi: 0.077796; PSU PNG520 ders notu: 0.07780) aynı " +
    "sabitin farklı yuvarlama hassasiyetiyle sunumu — birebir uyumlu.",
};

// κ formülünün sabitleri (α(T) sıcaklık fonksiyonu içinde)
const PR_KAPPA_C0: Coefficient<number> = {
  id: "prEos.kappaFormula.c0",
  module: MODULE,
  value: 0.37464,
  unit: "-",
  description: "κ = c0 + c1·ω - c2·ω² formülünün sabit terimi",
  source: SRC_PSU_PNG520,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standart PR (1976) κ formülü, ω≤0.49 için geçerlidir (ω>0.49 için Robinson & Peng 1978 tarafından " +
    "genişletilmiş bir form yayımlanmıştır — bu projede kullanılan tüm bileşenlerin ω'sı 0.49'un altında " +
    "olduğundan (en yükseği su, ω=0.344) genişletilmiş form gerekmez).",
};

const PR_KAPPA_C1: Coefficient<number> = {
  id: "prEos.kappaFormula.c1",
  module: MODULE,
  value: 1.54226,
  unit: "-",
  description: "κ = c0 + c1·ω - c2·ω² formülünün ω terimi katsayısı",
  source: SRC_PSU_PNG520,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Bkz. prEos.kappaFormula.c0 notları.",
};

const PR_KAPPA_C2: Coefficient<number> = {
  id: "prEos.kappaFormula.c2",
  module: MODULE,
  value: 0.26992,
  unit: "-",
  description: "κ = c0 + c1·ω - c2·ω² formülünün ω² terimi katsayısı (formülde EKSİ işaretle kullanılır)",
  source: SRC_PSU_PNG520,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "Bkz. prEos.kappaFormula.c0 notları.",
};

// ─────────────────────────────────────────────────────────────────────────
// İkili etkileşim parametreleri (kij)
// ─────────────────────────────────────────────────────────────────────────

const PR_KIJ_HYDROCARBON_PAIRS_DEFAULT: Coefficient<number> = {
  id: "prEos.kij.hydrocarbonPairsDefault",
  module: MODULE,
  value: 0,
  unit: "-",
  description: "İki hidrokarbon bileşeni (CH4...C6+) arasındaki varsayılan ikili etkileşim parametresi",
  source: SRC_PR_1976,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Peng-Robinson'ın kendi orijinal makalesinden bu yana yerleşik konvansiyon: benzer aile (parafin) " +
    "hidrokarbonlar arasında van der Waals karışım kuralı, kij=0 ile deneysel VLE verisine yeterince " +
    "yakın sonuç verir. Hemen hemen her hâl denklemi ders kitabında tekrar edilen, tartışmasız bir " +
    "mühendislik pratiğidir.",
};

/** Su ile diğer bileşen arasındaki kij (anahtar: diğer bileşenin id'si). */
const PR_KIJ_WATER_PAIRS: Coefficient<Partial<Record<string, number>>> = {
  id: "prEos.kij.waterPairs",
  module: MODULE,
  value: {
    CH4: 0.49,
    C2H6: 0.49,
    C3H8: 0.55,
    CO2: 0.19,
    H2S: 0.19,
    N2: 0.49,
  },
  unit: "-",
  description: "Su (H2O) ile CH4/C2H6/C3H8/CO2/H2S/N2 arasındaki ikili etkileşim parametreleri",
  source: SRC_USGS_PHREEQC,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "USGS PHREEQC 3 belgelerinde \"dahili sabit kodlanmış\" (hard-coded) değerler olarak listeleniyor; " +
    "belgenin kendisi orijinal literatür atfı VERMİYOR. Bu değerlerin muhtemel kökeni Søreide & Whitson " +
    "(1992, Fluid Phase Equilibria) çalışmasıdır ancak bu makaleye bu oturumda doğrudan erişilemediği " +
    "için bu bağlantı DOĞRULANAMADI — bu yüzden MEDIUM (resmi/istikrarlı bir kaynaktan geliyor ama " +
    "birincil atıf zinciri eksik). iC4/nC4/iC5/nC5/C6+ ile su arasındaki kij bu tabloda YOK — bkz. " +
    "prEos.kij.unresolvedDefault.",
};

const PR_KIJ_UNRESOLVED_DEFAULT: Coefficient<number> = {
  id: "prEos.kij.unresolvedDefault",
  module: MODULE,
  value: 0,
  unit: "-",
  description:
    "CO2/N2/H2S'in birbiriyle ve hidrokarbonlarla ikili etkileşim parametresi İÇİN VARSAYILAN " +
    "(bu oturumda güvenilir sayısal kaynak bulunamayan TÜM diğer çiftler için de kullanılır, ör. su " +
    "ile iC4/nC4/iC5/nC5/C6+ arası)",
  source: SRC_INTECH_KIJ_REVIEW,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "UNVERIFIED",
  notes:
    "Bu oturumda kapsamlı bir arama yapıldı (WebSearch + WebFetch, GPSA/Danesh/Whitson/NeqSim gibi " +
    "olası kaynaklar denendi) ancak CO2-hidrokarbon, N2-hidrokarbon, H2S-hidrokarbon, CO2-N2, CO2-H2S, " +
    "N2-H2S çiftleri için TEKİL, güvenilir bir sayısal kij değeri bulunamadı — yalnızca metodoloji " +
    "makaleleri (grup katkı yöntemleri, sıcaklığa bağlı korelasyonlar) bulundu, doğrudan kullanılabilir " +
    "sabit sayılar değil. Literatür bu çiftlerde kij'nin sıfırdan BELİRGİN ŞEKİLDE farklı olabileceğini " +
    "niteliksel olarak belirtiyor (özellikle CO2 ve H2S içeren sistemlerde) — bu yüzden 0 (etkileşim " +
    "yok) varsayımı KESİNLİKLE bir mühendislik onayı GEREKTİRİR ve gaz karışımında bu bileşenlerin mol " +
    "oranı yüksekse (özellikle CO2>%5-10) sonuç dikkatle yorumlanmalıdır. Söreide & Whitson (1992), " +
    "Danesh (1998, PVT and Phase Behaviour of Petroleum Reservoir Fluids, Tablo 5.4) veya bir GCM " +
    "(PPR78) implementasyonu, gelecek bir oturumda bu değerleri gerçek sayılarla değiştirmelidir.",
};

export const PR_EOS_COEFFICIENTS: Coefficient[] = [
  PR_UNIVERSAL_GAS_CONSTANT,
  PR_OMEGA_A,
  PR_OMEGA_B,
  PR_KAPPA_C0,
  PR_KAPPA_C1,
  PR_KAPPA_C2,
  PR_KIJ_HYDROCARBON_PAIRS_DEFAULT,
  PR_KIJ_WATER_PAIRS as Coefficient,
  PR_KIJ_UNRESOLVED_DEFAULT,
];
