// apps/web/src/features/input/fieldHelp.ts
//
// ⓘ tooltip metinleri. Ana açıklama metni, motorun kendi Zod şemalarındaki
// `.describe(...)` Türkçe metninden BİREBİR alınmıştır (bkz.
// packages/engine/src/types/geometry.ts, process.ts, mitigation.ts,
// operating.ts) — burada yeniden İCAT EDİLMEMİŞTİR, yalnızca UI'da
// gösterilecek şekilde bir sözlüğe taşınmıştır. `typicalRangeTr` alanı ise
// şemada OLMAYAN, yalnızca kullanıcıya kaba bir mertebe hissi vermek için
// eklenmiş EK bağlamdır — bir mühendislik sabiti/katsayı DEĞİLDİR, KDP
// kapsamı dışıdır ve UI'da "tipik" olarak açıkça etiketlenir.

export interface FieldHelpEntry {
  titleTr: string;
  bodyTr: string;
  typicalRangeTr?: string;
}

export const FIELD_HELP: Record<string, FieldHelpEntry> = {
  "geometry.npsInch": {
    titleTr: "Nominal Boru Çapı (NPS)",
    bodyTr: "Nominal boru çapı (NPS, inç).",
  },
  "geometry.schedule": {
    titleTr: "Boru Cetveli (Schedule)",
    bodyTr: "Boru cetveli (ör. \"40\", \"80\", \"XS\", \"STD\", \"XXS\") — et kalınlığını belirler.",
  },
  "geometry.roughnessMm": {
    titleTr: "İç Yüzey Pürüzlülüğü",
    bodyTr: "İç yüzey mutlak pürüzlülüğü (mm) — sürtünme faktörü ve akış rejimi hesabında kullanılır.",
    typicalRangeTr: "Tipik: yeni ticari çelik boru ~0.045 mm, hafif korozyonlu ~0.15-0.3 mm.",
  },
  "geometry.bendRadiusRatio": {
    titleTr: "Bükme Yarıçapı Oranı (R/D)",
    bodyTr: "Bükme yarıçapı oranı (R/D) — yalnızca dirsek/bükme tiplerinde.",
    typicalRangeTr: "Tipik: uzun radyuslu dirsek R/D=1.5, kısa radyuslu R/D=1.0.",
  },
  "geometry.bendAngleDeg": {
    titleTr: "Bükme Açısı",
    bodyTr: "Bükme açısı (derece) — yalnızca dirsek/bükme tiplerinde.",
  },
  "geometry.installation": {
    titleTr: "Tesis Yöntemi",
    bodyTr: "Bileşenin yer üstü, gömülü ya da deniz altı olarak tesis edilme biçimi — dış korozyon mekanizmasının hangi model ile değerlendirileceğini belirler.",
  },
  "geometry.isInsulated": {
    titleTr: "İzolasyon",
    bodyTr: "İzolasyonlu mu — evet ise izolasyon altı korozyonu (CUI) değerlendirmeye dahil edilir.",
  },
  "geometry.locationClass": {
    titleTr: "Konum Sınıfı (ASME B31.8)",
    bodyTr:
      "Konum sınıfı (ASME B31.8 §840.2 nüfus yoğunluğu sınıfı, 1-4) — Muayene Planı sekmesinde RBI-lite risk matrisinin \"konum\" sonuç eksenini besler. API 570'in kendi (akışkan tehlikesi bazlı) Piping Class'ından FARKLI bir sınıflandırmadır.",
    typicalRangeTr: "Sınıf 1: kırsal/offshore — Sınıf 4: şehir merkezi/çok katlı bina yoğunluğu.",
  },
  "geometry.environmentalSensitivity": {
    titleTr: "Çevresel Hassasiyet",
    bodyTr:
      "Sahanın niteliksel çevresel hassasiyeti (su kaynağına/yerleşime/ekolojik hassas alana yakınlık) — Muayene Planı sekmesinde RBI-lite risk matrisinin \"çevresel etki\" sonuç eksenini besler.",
  },
  "process.pressureBara": {
    titleTr: "Basınç",
    bodyTr: "Basınç (bara, mutlak).",
  },
  "process.temperatureC": {
    titleTr: "Akışkan Sıcaklığı",
    bodyTr: "Akışkan sıcaklığı (°C).",
  },
  "process.ambientTemperatureC": {
    titleTr: "Ortam Sıcaklığı",
    bodyTr: "Ortam (çevre) sıcaklığı (°C) — dış/atmosferik korozyon değerlendirmesinde kullanılır.",
  },
  "process.waterDewpointC": {
    titleTr: "Su Çiy Noktası",
    bodyTr: "Su çiy noktası sıcaklığı (°C). Akışkan sıcaklığı bu değerin ≥10°C üzerindeyse hat \"kuru gaz\" kabul edilir ve korozyon hızı sıfırdır.",
  },
  "process.hydrocarbonDewpointC": {
    titleTr: "Hidrokarbon Çiy Noktası",
    bodyTr: "Hidrokarbon çiy noktası sıcaklığı (°C).",
  },
  "process.isFreeWaterPresent": {
    titleTr: "Serbest Su",
    bodyTr: "Serbest su mevcut mu — hayırsa CO2/H2S ıslak korozyon mekanizmaları devre dışı kalır (yalnızca buhardan yoğuşma varsa yoğuşma faktörü uygulanır).",
  },
  "process.waterCutPercent": {
    titleTr: "Su Kesri",
    bodyTr: "Su kesri (water cut, %) — serbest su yoksa 0 olmalıdır.",
  },
  "process.flowRegime": {
    titleTr: "Akış Rejimi",
    bodyTr: "Akış rejimi — çok-fazlı akışın geometrik dağılım deseni (tabakalı/tıkaç/halkasal/sis vb.). \"Faz özelliklerini hesapla\" butonu Beggs-Brill sınıflandırmasını danışma amaçlı gösterir; kesin seçim mühendisin kararıdır.",
  },
  "process.roughnessMm": {
    titleTr: "Pürüzlülük",
    bodyTr: "bkz. Geometri adımı — sürtünme faktörü hesabında kullanılır.",
  },
  "chemistry.co2MolePercent": {
    titleTr: "CO2 Mol Yüzdesi",
    bodyTr: "CO2 mol yüzdesi (gaz fazında, %) — tatlı (CO2) korozyonunun birincil girdisi.",
    typicalRangeTr: "Tipik doğal gaz: %0.5-5; bazı rezervuarlarda %10'un üzerine çıkabilir.",
  },
  "chemistry.h2sPpmMole": {
    titleTr: "H2S Derişimi",
    bodyTr: "H2S mol derişimi (gaz fazında, ppm) — ekşi (sour) servis ve NACE MR0175 sınıflandırması için kritik.",
  },
  "chemistry.o2Ppb": {
    titleTr: "Çözünmüş Oksijen",
    bodyTr: "Çözünmüş oksijen derişimi (ppb) — az miktarda bile agresif korozyona yol açabilir.",
  },
  "chemistry.phMeasured": {
    titleTr: "Ölçülmüş pH",
    bodyTr: "Ölçülmüş pH değeri (varsa). Bilinmiyorsa \"hesapla\" butonu NORSOK M-506 modeliyle in-situ pH'ı CO2/bikarbonat/klorür verisinden tahmin eder.",
  },
  "chemistry.chlorideMgL": {
    titleTr: "Klorür Derişimi",
    bodyTr: "Klorür derişimi (mg/L) — pitting/crevice/CSCC risk değerlendirmesinde ve iyonik kuvvet tahmininde kullanılır.",
    typicalRangeTr: "Tipik üretim suyu: 1,000-100,000+ mg/L; deniz suyu ~19,000 mg/L.",
  },
  "chemistry.bicarbonateMgL": {
    titleTr: "Bikarbonat Derişimi",
    bodyTr: "Bikarbonat derişimi (mg/L) — in-situ pH hesabında tamponlama etkisi.",
  },
  "chemistry.aceticAcidMgL": {
    titleTr: "Asetik Asit (HAc)",
    bodyTr: "Asetik asit (HAc) derişimi (mg/L) — organik asit korozyonunu tetikleyebilir, bikarbonat düzeltmesinde kullanılır.",
  },
  "chemistry.glycolWeightPercent": {
    titleTr: "Glikol Ağırlık Yüzdesi",
    bodyTr: "Glikol ağırlıkça yüzdesi (%) — su fazındaki glikol korozyon hızını azaltıcı bir faktör (Fcond) uygular.",
  },
  "chemistry.bacteriaPresent": {
    titleTr: "Bakteri Varlığı",
    bodyTr: "Korozyona sebep olabilecek bakteri varlığı bilgisi — MIC (mikrobiyolojik kaynaklı korozyon) nitel risk değerlendirmesinde kullanılır.",
  },
  "solids.sandRateKgDay": {
    titleTr: "Kum Debisi",
    bodyTr: "Kum debisi (kg/gün) — sıfırsa erozyon mekanizması devre dışı kalır ve parçacık ayrıntıları gerekmez.",
  },
  "solids.particleDiameterUm": {
    titleTr: "Parçacık Çapı",
    bodyTr: "Parçacık çapı (μm) — kum debisi sıfırdan büyükse zorunludur.",
    typicalRangeTr: "Tipik saha kumu: 100-250 μm.",
  },
  "solids.particleShapeFactor": {
    titleTr: "Parçacık Şekil Faktörü",
    bodyTr: "Parçacık şekil faktörü (yuvarlak 0.2 → keskin 1.0).",
  },
  "mitigation.inhibitorAvailabilityPercent": {
    titleTr: "İnhibitör Kullanılabilirlik Oranı",
    bodyTr: "İnhibitör kullanılabilirlik oranı (%) — enjeksiyon sisteminin fiilen çalıştığı zaman oranı.",
  },
  "mitigation.inhibitorEfficiencyPercent": {
    titleTr: "İnhibitör Verimliliği",
    bodyTr: "İnhibitör verimliliği (%) — motor, inhibitörlü hızı asla 0.1 mm/yıl altına düşürmez (mühendislik kabulü).",
  },
  "mitigation.internalLining": {
    titleTr: "İç Kaplama/Astar",
    bodyTr: "İç kaplama/astar tipi.",
  },
  "operatingProfile.designLifeYears": {
    titleTr: "Tasarım Ömrü",
    bodyTr: "Tasarım ömrü (yıl) — toplam metal kaybı ve ısı haritası bu süre için biriktirilir.",
  },
  "operatingProfile.corrosionAllowanceMm": {
    titleTr: "Korozyon Payı",
    bodyTr: "Korozyon payı (mm) — kalan ömür ve B31G kalan dayanım hesabında kullanılır.",
  },
  "operatingCase.durationDaysPerYear": {
    titleTr: "Yıllık Çalışma Günü",
    bodyTr: "Bu senaryonun yılda kaç gün geçerli olduğu — tüm senaryoların toplamı 365'i geçemez.",
  },
  "valveGeometry.cvRated": {
    titleTr: "Anma Akış Katsayısı (Cv)",
    bodyTr: "Anma akış katsayısı Cv — vana üreticisinin boyutlandırma tablosundan alınır.",
  },
  "valveGeometry.flFactor": {
    titleTr: "Sıvı Basınç Geri Kazanım Faktörü (FL)",
    bodyTr: "Sıvı basınç geri kazanım faktörü FL (boyutsuz, 0-1) — kavitasyon/flaşlaşma sınırını belirler.",
  },
  "valveGeometry.xtFactor": {
    titleTr: "Kritik Basınç Düşümü Oranı (xT)",
    bodyTr: "Kritik basınç düşümü oranı xT (boyutsuz, 0-1) — gaz servisinde tıkanmış akış sınırını belirler.",
  },
  "valveGeometry.kcFactor": {
    titleTr: "Kavitasyon Başlangıç Katsayısı (Kc)",
    bodyTr: "Kavitasyon başlangıç katsayısı Kc (boyutsuz) — vana üreticisi test verisinden gelir; bu katalogda genel/literatür kaynaklı bir değer bulunamadığından formdaki başlangıç değeri yalnızca KABA bir yer tutucudur.",
  },
  "valveGeometry.openingPercent": {
    titleTr: "Vana Açıklık Oranı",
    bodyTr: "Vana açıklık oranı (%) — erozyon/kavitasyon bölge şiddetini etkiler.",
  },
};

export function getFieldHelp(key: string): FieldHelpEntry | undefined {
  return FIELD_HELP[key];
}
