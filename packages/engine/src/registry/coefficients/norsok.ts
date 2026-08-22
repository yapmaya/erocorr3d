// packages/engine/src/registry/coefficients/norsok.ts
//
// NORSOK M-506 CO2 korozyon modeli katsayıları.
// Bu dosyadaki HER sabit, araştırma ile bulunmuş ve kaynağı burada belgelenmiştir.
// Hiçbir sayı hafızadan/tahminen yazılmamıştır. Kaynak bulunamayan değerler
// confidence: "UNVERIFIED" olarak işaretlenmiştir.

import type { Coefficient, Source } from "../types";

export interface NorsokKtPoint {
  temperatureC: number;
  kt: number;
}

export type NorsokPhSegment =
  | { kind: "polynomial"; phMin: number; phMax: number; coeffs: number[] }
  | { kind: "exponential"; phMin: number; phMax: number; a: number; k: number };

export interface NorsokPhTemperatureRow {
  temperatureC: number;
  segments: NorsokPhSegment[];
}

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_NORSOK_STANDARD: Source = {
  type: "STANDARD",
  citation:
    "NORSOK Standard M-506, \"CO2 Corrosion Rate Calculation Model\", Rev. 2, Standards Norway, Oslo, Norway, Haziran 2005.",
  url: "https://pdfcoffee.com/norsok-m-506-co2-corrosion-rate-calculation-model-pdf-free.html",
  accessedDate: "2026-08-11",
};

const SRC_DUNGNGUYEN_CODE: Source = {
  type: "OPEN_SOURCE_CODE",
  citation:
    "Nguyen, D., \"norsokm506\" (NORSOK M-506 modelinin açık kaynak Python implementasyonu, MIT lisansı), GitHub deposu.",
  url: "https://github.com/dungnguyen2/norsokm506",
  accessedDate: "2026-08-11",
};

const SRC_MOHYALDIN_2011: Source = {
  type: "JOURNAL",
  citation:
    "Mohyaldin, M.E., Elkhatib, N., Ismail, M.C., \"Coupling NORSOK CO2 Corrosion Prediction Model with Pipelines Thermal/Hydraulic Models to Simulate CO2 Corrosion along Pipelines\", Journal of Engineering Science and Technology, Vol. 6, No. 6 (2011), s. 709-719, Taylor's University.",
  url: "https://jestec.taylors.edu.my/Vol%206%20Issue%206%20December%2011/Vol_6_6_709_719_MYSARA%20EISSA%20MOHYALDIN.pdf",
  accessedDate: "2026-08-11",
};

const SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT: Source = {
  type: "STANDARD",
  citation:
    "NORSOK Standard M-506, Rev. 2, Haziran 2005 — bu oturumda TAM METİN doğrudan indirilip pdftotext " +
    "VE 200-400dpi sayfa görüntüleri olarak render edilip görsel olarak (Eq.7-8, Bölüm 8.1; Eq.1-3 ve " +
    "Tablo 1-2, Bölüm 5.2; Bölüm 5.3 glikol/inhibitör) doğrulandı.",
  url: "https://00448349299399495787.googlegroups.com/attach/207f0a05d64cb52e/NORSOK%20CO2%20M-506.pdf",
  accessedDate: "2026-08-11",
};

const SRC_HOSSEINI_2015: Source = {
  type: "CONFERENCE",
  citation:
    "Hosseini, S.M.K., \"Avoiding Common Pitfalls in CO2 Corrosion Rate Assessment for Upstream Hydrocarbon Industries\", Paper No. 24, The 16th Nordic Corrosion Congress, 20-22 Mayıs 2015, Stavanger, Norveç.",
  url: "https://www.corrosionclinic.com/CO2_Corrosion/Avoiding%20Common%20Pitfalls%20in%20CO2%20Corrosion%20Rate%20Assessment%20for%20Upstream%20Hydrocarbon%20Industries.pdf",
  accessedDate: "2026-08-11",
};

const MODULE = "norsok";

// ─────────────────────────────────────────────────────────────────────────
// Ana denklem sabitleri
// CRt = Kt × fCO2^0.62 × (S/19)^(0.146 + 0.0324·log10(fCO2)) × f(pH)t
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_CO2_EXPONENT: Coefficient<number> = {
  id: "norsok.mainEquation.co2FugacityExponent",
  module: MODULE,
  value: 0.62,
  unit: "-",
  description: "Ana denklemde CO2 fugasitesinin üssü (fCO2^0.62)",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes:
    "Standardın kendisinin aynası (pdfcoffee/googlegroups), bağımsız açık kaynak kod (dungnguyen2) ve hakemli dergi makalesi (Mohyaldin 2011, Eq. 2) üçü de aynı değeri veriyor.",
};

const NORSOK_SHEAR_STRESS_BASE_EXPONENT: Coefficient<number> = {
  id: "norsok.mainEquation.shearStressBaseExponent",
  module: MODULE,
  value: 0.146,
  unit: "-",
  description: "(S/19) üssündeki sabit terim",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes: "Üç kaynakta da 0.146 olarak geçiyor.",
};

const NORSOK_SHEAR_STRESS_FCO2_COEFF: Coefficient<number> = {
  id: "norsok.mainEquation.shearStressFco2Coefficient",
  module: MODULE,
  value: 0.0324,
  unit: "-",
  description: "(S/19) üssündeki log10(fCO2) katsayısı",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes: "Üç kaynakta da 0.0324 olarak geçiyor.",
};

const NORSOK_REFERENCE_SHEAR_STRESS_PA: Coefficient<number> = {
  id: "norsok.mainEquation.referenceShearStressPa",
  module: MODULE,
  value: 19,
  unit: "Pa",
  description: "Kayma gerilmesi normalizasyon referansı (S/19)",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes: "Üç kaynakta da 19 Pa olarak geçiyor.",
};

// ─────────────────────────────────────────────────────────────────────────
// Kt tablosu (sıcaklığa bağlı denge sabiti)
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_KT_TABLE: Coefficient<NorsokKtPoint[]> = {
  id: "norsok.ktTable",
  module: MODULE,
  value: [
    { temperatureC: 5, kt: 0.42 },
    { temperatureC: 15, kt: 1.59 },
    { temperatureC: 20, kt: 4.762 },
    { temperatureC: 40, kt: 8.927 },
    { temperatureC: 60, kt: 10.695 },
    { temperatureC: 80, kt: 9.949 },
    { temperatureC: 90, kt: 6.25 },
    { temperatureC: 120, kt: 7.77 },
    { temperatureC: 150, kt: 5.203 },
  ],
  unit: "-",
  description:
    "NORSOK M-506 Kt sabiti, standart sıcaklık noktalarında (5-150°C); ara sıcaklıklarda doğrusal enterpolasyon kullanılır.",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE],
  confidence: "HIGH",
  notes:
    "Standardın aynası ile bağımsız açık kaynak kod (dungnguyen2) tam olarak aynı 9 değeri veriyor.",
};

// ─────────────────────────────────────────────────────────────────────────
// f(pH)t tablosu — parçalı polinom / üstel fonksiyonlar
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_PH_TABLE: Coefficient<NorsokPhTemperatureRow[]> = {
  id: "norsok.fPhTable",
  module: MODULE,
  value: [
    {
      temperatureC: 5,
      segments: [
        // NOT: dungnguyen2 kaynak kodunda bu aralık "2.0676 + 0.2309*pH" (artı işaretli).
        // 15/20/40°C satırlarındaki aynı sabitler "-0.2309*pH" (eksi işaretli) kullanıyor ve
        // f(pH)'ın pH arttıkça azalması fiziksel olarak beklenen davranış. Bu, komşu
        // sıcaklıklarla tutarsız ve muhtemelen kaynak kodda bir işaret hatası. İkinci bağımsız
        // kaynak bu hücreyi doğrulamadığı için MUHAFAZAKÂR ve komşu sıcaklıklarla tutarlı olan
        // eksi işaretli hali kullanıldı. Aşağıdaki confidence bu hücre için düşürülmüştür.
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [2.0676, -0.2309] },
        { kind: "polynomial", phMin: 4.6, phMax: 6.5, coeffs: [4.342, -1.061, 0.0708] },
      ],
    },
    {
      temperatureC: 15,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [2.0676, -0.2309] },
        { kind: "polynomial", phMin: 4.6, phMax: 6.5, coeffs: [4.986, -1.191, 0.0708] },
      ],
    },
    {
      temperatureC: 20,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [2.0676, -0.2309] },
        { kind: "polynomial", phMin: 4.6, phMax: 6.5, coeffs: [5.1885, -1.2353, 0.0708] },
      ],
    },
    {
      temperatureC: 40,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [2.0676, -0.2309] },
        { kind: "polynomial", phMin: 4.6, phMax: 6.5, coeffs: [5.1885, -1.2353, 0.0708] },
      ],
    },
    {
      temperatureC: 60,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [1.836, -0.1818] },
        {
          kind: "polynomial",
          phMin: 4.6,
          phMax: 6.5,
          coeffs: [15.444, -6.1291, 0.8204, -0.0371],
        },
      ],
    },
    {
      temperatureC: 80,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.6, coeffs: [2.6727, -0.3636] },
        { kind: "exponential", phMin: 4.6, phMax: 6.5, a: 331.68, k: -1.2618 },
      ],
    },
    {
      temperatureC: 90,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.57, coeffs: [3.1355, -0.4673] },
        { kind: "exponential", phMin: 4.57, phMax: 5.62, a: 21254, k: -2.1811 },
        { kind: "polynomial", phMin: 5.62, phMax: 6.5, coeffs: [0.4014, -0.0538] },
      ],
    },
    {
      temperatureC: 120,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 4.3, coeffs: [1.5375, -0.125] },
        { kind: "polynomial", phMin: 4.3, phMax: 5.0, coeffs: [5.9757, -1.157] },
        { kind: "polynomial", phMin: 5.0, phMax: 6.5, coeffs: [0.546125, -0.071225] },
      ],
    },
    {
      temperatureC: 150,
      segments: [
        { kind: "polynomial", phMin: 3.5, phMax: 3.8, coeffs: [1] },
        { kind: "polynomial", phMin: 3.8, phMax: 5.0, coeffs: [17.634, -7.0945, 0.715] },
        { kind: "polynomial", phMin: 5.0, phMax: 6.5, coeffs: [0.037] },
      ],
    },
  ],
  unit: "-",
  description:
    "NORSOK M-506 f(pH)t tablosu; 9 standart sıcaklıkta pH'a bağlı parçalı polinom/üstel fonksiyonlar. Ara sıcaklıklarda doğrusal enterpolasyon kullanılır.",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT],
  confidence: "HIGH",
  notes:
    "GÜNCELLEME (bu oturumda): standardın Tablo 2'si TAM METİNDEN, 400dpi sayfa görüntüsü olarak da " +
    "render edilip PİKSEL PİKSEL doğrulandı — bu tablodaki HER hücre (5°C/pH 3.5-4.6 dahil, EKSİ işaretli " +
    "hali \"f(pH)=2,0676-(0,2309×pH)\") standardın kendi basılı Tablo 2'siyle BİREBİR eşleşiyor. Önceki " +
    "oturumda yalnızca dungnguyen2 koduyla (aynı kökenden gelme ihtimali olan) çapraz kontrol " +
    "yapıldığından MEDIUM işaretliydi; artık birincil metinden görsel doğrulamayla teyit edildiği için " +
    "HIGH'a yükseltildi. dungnguyen2 kodu ile standart metni arasındaki 5°C/pH 3.5-4.6 hücresi işaret " +
    "farkı da bu doğrulamayla KESİN olarak çözüldü: standardın kendisi EKSİ işareti kullanıyor " +
    "(dungnguyen2'nin ARTI işareti bir kod hatasıdır).",
};

// ─────────────────────────────────────────────────────────────────────────
// CO2 fugasite sabitleri: fCO2 = a × pCO2,  a = 10^(P·(0.0031 - 1.4/T_K))
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_FUGACITY_PRESSURE_COEFF: Coefficient<number> = {
  id: "norsok.fugacity.pressureCoefficient",
  module: MODULE,
  value: 0.0031,
  unit: "1/bar",
  description: "CO2 fugasite katsayısı üstel ifadesindeki basınç katsayısı",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes: "Üç kaynakta da 0.0031 olarak geçiyor.",
};

const NORSOK_FUGACITY_TEMPERATURE_COEFF: Coefficient<number> = {
  id: "norsok.fugacity.temperatureCoefficient",
  module: MODULE,
  value: 1.4,
  unit: "K",
  description: "CO2 fugasite katsayısı üstel ifadesindeki sıcaklık katsayısı",
  source: SRC_NORSOK_STANDARD,
  crossChecked: true,
  crossCheckSources: [SRC_DUNGNGUYEN_CODE, SRC_MOHYALDIN_2011],
  confidence: "HIGH",
  notes: "Üç kaynakta da 1.4 olarak geçiyor.",
};

const NORSOK_FUGACITY_PRESSURE_CAP_BAR: Coefficient<number> = {
  id: "norsok.fugacity.pressureCapBar",
  module: MODULE,
  value: 250,
  unit: "bar",
  description:
    "Fugasite katsayısı formülünde toplam basınç 250 bar'ı geçerse, üstel ifadede P yerine 250 kullanılır",
  source: SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "GÜNCELLEME (bu oturumda): standardın TAM METNİ bu kez doğrudan indirilip okundu — Eq.8 \"a = 10^" +
    "(250×(0,0031-1,4/T)) for P > 250 bar\" ve hemen altındaki \"The total pressure is set to 250 bar in " +
    "the fugacity constant for all pressures above 250 bar\" cümlesiyle BİREBİR doğrulandı (sayfa " +
    "görüntüsü olarak da kontrol edildi). Önceki oturumda yalnızca dolaylı bir arama özetiyle " +
    "bulunduğundan UNVERIFIED işaretliydi; artık birincil metinden doğrudan teyit edildiği için HIGH'a " +
    "yükseltildi.",
};

export interface NorsokMainEquationNode {
  temperatureC: number;
  co2FugacityExponent: number;
  /** false ise ana denklemde kayma gerilmesi terimi (S/19)^... HİÇ YOKTUR (yalnızca 5°C düğümü) */
  includesShearStressTerm: boolean;
}

const NORSOK_MAIN_EQUATION_NODES: Coefficient<NorsokMainEquationNode[]> = {
  id: "norsok.mainEquation.temperatureNodes",
  module: MODULE,
  value: [
    { temperatureC: 5, co2FugacityExponent: 0.36, includesShearStressTerm: false },
    { temperatureC: 15, co2FugacityExponent: 0.36, includesShearStressTerm: true },
    { temperatureC: 20, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 40, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 60, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 80, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 90, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 120, co2FugacityExponent: 0.62, includesShearStressTerm: true },
    { temperatureC: 150, co2FugacityExponent: 0.62, includesShearStressTerm: true },
  ],
  unit: "-",
  description:
    "⚠ NORSOK M-506'nın ana denkleminin sıcaklık düğümüne göre DEĞİŞEN biçimi: Eq.1 (20-150°C " +
    "düğümlerinde, fCO2 üssü 0,62, kayma gerilmesi terimi VAR), Eq.2 (yalnızca 15°C düğümünde, üs 0,36, " +
    "kayma gerilmesi terimi VAR), Eq.3 (yalnızca 5°C düğümünde, üs 0,36, kayma gerilmesi terimi YOK — " +
    "CRt=Kt×fCO2^0,36×f(pH)t). Ara sıcaklıklardaki hız, İKİ KOMŞU DÜĞÜMÜN KENDİ DOĞRU DENKLEMİYLE " +
    "hesaplanan HIZLARI arasında DOĞRUSAL ENTERPOLASYONLA bulunur (Kt'yi enterpole edip TEK bir formül " +
    "uygulamak YANLIŞTIR — standardın kendi metni: \"corrosion rate between temperatures... is found by " +
    "a linear extrapolation between the CALCULATED CORROSION RATE at the temperature above and below\").",
  source: SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın Bölüm 5.2'sinden (Eq.1, Eq.2, Eq.3, ayrıca Tablo 1) doğrudan, sayfa görüntüsüyle " +
    "doğrulanarak okundu. ÖNEMLİ: bu proje içindeki packages/engine/src/corrosion/norsok.ts (önceki " +
    "oturumda yazılmış, hâlâ geçerli/test edilmiş bir modül) bu 3-formlu yapıyı BASİTLEŞTİRİP her yerde " +
    "üs=0,62 kullanıyor ve Kt'yi enterpole ediyor — bu, 5-20°C aralığında (özellikle 5°C ve 15°C " +
    "düğümlerinin kendisinde) standarttan sapan bir yaklaşıklıktır. Yeni corrosion/norsokM506.ts modülü " +
    "bu tabloyu kullanarak DOĞRU (3-formlu + hız-enterpolasyonu) hesabı yapar; norsok.ts kasıtlı olarak " +
    "değiştirilmedi (geriye dönük uyumluluk, bkz. proje notları).",
};

// ─────────────────────────────────────────────────────────────────────────
// Geçerlilik aralıkları
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_VALIDITY_TEMPERATURE_C: Coefficient<[number, number]> = {
  id: "norsok.validity.temperatureC",
  module: MODULE,
  value: [5, 150],
  unit: "°C",
  description: "NORSOK M-506 modelinin geçerli sıcaklık aralığı",
  source: SRC_HOSSEINI_2015,
  crossChecked: true,
  crossCheckSources: [SRC_NORSOK_STANDARD],
  confidence: "HIGH",
  notes: "Hosseini (2015) hakemli bildirisi ile standardın aynası aynı aralığı veriyor.",
};

const NORSOK_VALIDITY_PH: Coefficient<[number, number]> = {
  id: "norsok.validity.ph",
  module: MODULE,
  value: [3.5, 6.5],
  unit: "-",
  description: "NORSOK M-506 modelinin geçerli pH aralığı",
  source: SRC_HOSSEINI_2015,
  crossChecked: true,
  crossCheckSources: [SRC_NORSOK_STANDARD],
  confidence: "HIGH",
  notes: "Hosseini (2015) hakemli bildirisi ile standardın aynası aynı aralığı veriyor.",
};

const NORSOK_VALIDITY_CO2_PARTIAL_PRESSURE_BAR: Coefficient<[number, number]> = {
  id: "norsok.validity.co2PartialPressureBar",
  module: MODULE,
  value: [0.1, 10],
  unit: "bar",
  description: "NORSOK M-506 modelinin geçerli CO2 kısmi basıncı aralığı (gaz fazında)",
  source: SRC_HOSSEINI_2015,
  crossChecked: true,
  crossCheckSources: [SRC_NORSOK_STANDARD],
  confidence: "HIGH",
  notes: "Hosseini (2015) hakemli bildirisi ile standardın aynası aynı aralığı veriyor.",
};

const NORSOK_VALIDITY_SHEAR_STRESS_PA: Coefficient<[number, number]> = {
  id: "norsok.validity.shearStressPa",
  module: MODULE,
  value: [1, 150],
  unit: "Pa",
  description: "NORSOK M-506 modelinin geçerli et duvar kayma gerilmesi aralığı",
  source: SRC_HOSSEINI_2015,
  crossChecked: true,
  crossCheckSources: [SRC_NORSOK_STANDARD],
  confidence: "HIGH",
  notes: "Hosseini (2015) hakemli bildirisi ile standardın aynası aynı aralığı veriyor.",
};

const NORSOK_VALIDITY_H2S_PARTIAL_PRESSURE_MAX_BAR: Coefficient<number> = {
  id: "norsok.validity.h2sPartialPressureMaxBar",
  module: MODULE,
  value: 0.5,
  unit: "bar",
  description:
    "Modelin CO2-baskın kabul edildiği üst H2S kısmi basıncı sınırı (bu değerin üzerinde H2S korozyon mekanizması da devreye girer)",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Yalnızca Hosseini (2015) kaynağında bulundu; ikinci bağımsız kaynakla çapraz doğrulanamadı.",
};

const NORSOK_VALIDITY_CO2_H2S_RATIO_MIN: Coefficient<number> = {
  id: "norsok.validity.co2H2sRatioMin",
  module: MODULE,
  value: 20,
  unit: "-",
  description:
    "ppCO2/ppH2S oranı bu değerin altına düştüğünde model CO2-baskın korozyon varsayımı geçerliliğini yitirir",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Yalnızca Hosseini (2015) kaynağında bulundu; ikinci bağımsız kaynakla çapraz doğrulanamadı.",
};

// ─────────────────────────────────────────────────────────────────────────
// Glikol azaltma faktörü (Bölüm 5.3)
// ─────────────────────────────────────────────────────────────────────────

export interface NorsokGlycolFactorConstants {
  exponentCoefficient: number;
  offsetConstant: number;
  highConcentrationThresholdWtPercent: number;
  highConcentrationFactor: number;
}

const NORSOK_GLYCOL_FACTOR: Coefficient<NorsokGlycolFactorConstants> = {
  id: "norsok.glycolFactor",
  module: MODULE,
  value: {
    exponentCoefficient: 1.6,
    offsetConstant: 2,
    highConcentrationThresholdWtPercent: 95,
    highConcentrationFactor: 0.008,
  },
  unit: "-",
  description:
    "Glikol azaltma faktörü (Bölüm 5.3): faktör=10^(1,6×(log10(100-ağırlık%Glikol)-2)) %95 ağırlık " +
    "glikolün ALTINDA; %95 VE ÜZERİNDE faktör sabit 0,008'dir.",
  source: SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın Bölüm 5.3'ünden (\"The effect of glycol and corrosion inhibitors\") 400dpi sayfa " +
    "görüntüsü üzerinden piksel piksel doğrulanarak okundu: \"glycol reduction factor = 10^1,6(log(100-" +
    "wt%Glycol)-2) for less than 95 weight % glycol; for > 95 weight % glycol, the glycol reduction " +
    "factor is set to 0,008.\" Standart, orijinal kaynağı olarak kendi bibliyografyasındaki /2/ " +
    "referansını gösteriyor (bu oturumda o ikincil kaynağa ayrıca erişilip çapraz doğrulanmadı, ancak " +
    "birincil standart metninden doğrudan ve görsel olarak teyit edildiği için HIGH).",
};

const NORSOK_INHIBITOR_COMBINATION_RULE_NOTE: Coefficient<string> = {
  id: "norsok.inhibitorGlycolCombinationRule",
  module: MODULE,
  value:
    "İnhibitör VE glikol birlikte uygulanıyorsa, İKİSİ TOPLANMAZ — yalnızca DAHA BÜYÜK azaltmayı veren " +
    "etki kullanılır.",
  unit: "-",
  description: "İnhibitör+glikol birlikte varlığında hangi azaltma faktörünün uygulanacağına dair kural",
  source: SRC_NORSOK_STANDARD_PRIMARY_FULLTEXT,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın Bölüm 5.3'ünden birebir: \"When both addition of corrosion inhibitors and glycol is " +
    "entered into the computer program, the one effect giving the greatest corrosion rate reduction " +
    "factor will be used for calculation of the resulting corrosion rate, i.e. the two effects will not " +
    "be combined.\" Bu, sayısal bir katsayı değil bir MODELLEME KURALIDIR; registry'ye kaydedilme " +
    "nedeni, kodda \"sihirli\" bir if/else olarak gömülü kalmaması, kaynağının izlenebilir olmasıdır.",
};

// ─────────────────────────────────────────────────────────────────────────
// Ek geçerlilik uyarıları: organik asit / düşük fCO2 (Hosseini 2015)
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_VALIDITY_ORGANIC_ACID_THRESHOLD_PPM: Coefficient<number> = {
  id: "norsok.validity.organicAcidThresholdPpm",
  module: MODULE,
  value: 100,
  unit: "ppm",
  description:
    "Bu organik asit derişimi eşiğinin (özellikle düşük fCO2 ile birlikte) üzerinde model hızı olduğundan " +
    "düşük tahmin edebilir",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "Hosseini (2015)'ten BİREBİR alıntı: \"concentration of organic acid>100ppm when ppCO2<0.5 bar [15]\" " +
    "— \"Type 3 hata\" (geçerlilik aralığı dışı kullanım) listesinde. Hosseini'nin cümlesi, bu iki koşulu " +
    "(organik asit>100ppm VE ppCO2<0,5bar) BİRLEŞİK bir sınırlama olarak mı yoksa iki AYRI sınırlama " +
    "olarak mı sunduğu konusunda küçük bir belirsizlik taşıyor — bu proje, kullanıcı talimatına uyarak " +
    "bunları İKİ AYRI (VEYA) tetikleyici olarak uygular (her biri ayrı ayrı bir uyarı üretir). Standardın " +
    "kendi birincil metninde bu SAYISAL eşikler (100ppm, 0,5bar) bulunamadı — yalnızca niteliksel bir " +
    "organik asit/pH tartışması var (Bölüm 8.2.1) — bu yüzden MEDIUM (tek kaynak, Hosseini 2015).",
};

const NORSOK_VALIDITY_LOW_CO2_PRESSURE_WARNING_THRESHOLD_BAR: Coefficient<number> = {
  id: "norsok.validity.lowCo2PressureWarningThresholdBar",
  module: MODULE,
  value: 0.5,
  unit: "bar",
  description: "Bu fCO2 eşiğinin altında model hızı olduğundan düşük tahmin edebilir",
  source: SRC_HOSSEINI_2015,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes: "Bkz. norsok.validity.organicAcidThresholdPpm notları — aynı cümleden, aynı kaynak.",
};

// ─────────────────────────────────────────────────────────────────────────
// norsokM506 belirsizlik bandı (varsayılan, kullanıcı talimatıyla verilmiş)
// ─────────────────────────────────────────────────────────────────────────

const NORSOK_M506_UNCERTAINTY_BAND: Coefficient<{ p10Multiplier: number; p90Multiplier: number }> = {
  id: "norsokM506.uncertaintyBand",
  module: MODULE,
  value: { p10Multiplier: 0.5, p90Multiplier: 2.5 },
  unit: "-",
  description: "corrosion/norsokM506.ts için varsayılan belirsizlik bandı: P10=0,5×P50, P90=2,5×P50",
  source: {
    type: "PROJECT_DOCUMENT",
    citation:
      "Bu oturumda ÖNCE literatür araştırıldı (bkz. shared.ts::uncertainty.defaultMultiplicativeBandFactor " +
      "notları, önceki oturumdan — Hosseini 2015 ve genel CO2 korozyon modelleme literatürü yalnızca " +
      "niteliksel \"çok büyük belirsizlik\" ifadeleri kullanıyor, sayısal bir P10/P90 çifti " +
      "yayımlanmamış). Bu oturumda AYRICA \"NORSOK M-506 uncertainty P10 P90\" için ayrı bir arama " +
      "yapıldı, yine sayısal bir değer bulunamadı. Bu nedenle görev talimatında AÇIKÇA verilen varsayılan " +
      "(\"Bulamazsan varsayılan: P10=0,5×P50, P90=2,5×P50, confidence MEDIUM\") kullanıldı.",
    accessedDate: "2026-08-11",
  },
  crossChecked: false,
  crossCheckSources: [],
  confidence: "MEDIUM",
  notes:
    "NOT: bu, packages/engine/src/corrosion/norsok.ts'in kullandığı " +
    "uncertainty.defaultMultiplicativeBandFactor (simetrik, ×2,5 / ÷2,5, UNVERIFIED) katsayısından " +
    "FARKLI bir bant biçimidir (asimetrik: P10=0,5× ama P90=2,5×, çarpımsal tersi DEĞİL) — kasıtlı " +
    "olarak görev talimatının kendi verdiği biçimde uygulandı, projenin genel simetrik varsayılanıyla " +
    "KARIŞTIRILMAMALIDIR.",
};

export const NORSOK_COEFFICIENTS: Coefficient[] = [
  NORSOK_CO2_EXPONENT,
  NORSOK_SHEAR_STRESS_BASE_EXPONENT,
  NORSOK_SHEAR_STRESS_FCO2_COEFF,
  NORSOK_REFERENCE_SHEAR_STRESS_PA,
  NORSOK_KT_TABLE as Coefficient,
  NORSOK_PH_TABLE as Coefficient,
  NORSOK_MAIN_EQUATION_NODES as Coefficient,
  NORSOK_FUGACITY_PRESSURE_COEFF,
  NORSOK_FUGACITY_TEMPERATURE_COEFF,
  NORSOK_FUGACITY_PRESSURE_CAP_BAR,
  NORSOK_VALIDITY_TEMPERATURE_C as Coefficient,
  NORSOK_VALIDITY_PH as Coefficient,
  NORSOK_VALIDITY_CO2_PARTIAL_PRESSURE_BAR as Coefficient,
  NORSOK_VALIDITY_SHEAR_STRESS_PA as Coefficient,
  NORSOK_VALIDITY_H2S_PARTIAL_PRESSURE_MAX_BAR,
  NORSOK_VALIDITY_CO2_H2S_RATIO_MIN,
  NORSOK_GLYCOL_FACTOR as Coefficient,
  NORSOK_INHIBITOR_COMBINATION_RULE_NOTE as Coefficient,
  NORSOK_VALIDITY_ORGANIC_ACID_THRESHOLD_PPM,
  NORSOK_VALIDITY_LOW_CO2_PRESSURE_WARNING_THRESHOLD_BAR,
  NORSOK_M506_UNCERTAINTY_BAND as Coefficient,
];
