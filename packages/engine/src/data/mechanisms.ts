// packages/engine/src/data/mechanisms.ts
//
// Hasar mekanizması kataloğu: 16 iç (INTERNAL) + 8 dış (EXTERNAL) = 24
// mekanizma. Her girdi tetikleyici koşullar, tipik konum, ilgili standart/
// kaynak, tipik hız aralığı (varsa), TR önleyici tedbirler ve bir
// spatialSignatureId (MechanismResult.spatialSignatureId ile eşleşen,
// hasarın tipik uzamsal dağılım desenini etiketleyen serbest metin kimlik)
// içerir.
//
// KAYNAK NOTU: Bu oturumda API RP 571 "Damage Mechanisms Affecting Fixed
// Equipment in the Refining and Petrochemical Industries" (2011 baskısı)
// ve NACE SP0169-2013 "Control of External Corrosion on Underground or
// Submerged Metallic Piping Systems" standartlarının TAM METNİ doğrudan
// indirilip okundu (pdftotext ile) — birçok girdi bu birincil kaynaklardan
// DOĞRUDAN alınmıştır (aşağıda "HIGH" confidence). API 571 bir RAFİNERİ
// ekipmanı standardı olduğundan, boru hattı/üretim taşıma sistemine özgü
// bazı mekanizmalar (TOP_OF_LINE, UNDER_DEPOSIT, FLASHING) için akademik
// literatür/ikincil mühendislik kaynakları kullanıldı (MEDIUM confidence).
// PITTING_INTERNAL/CREVICE_INTERNAL/EXTERNAL_PITTING, materials.ts fazında
// zaten doğrulanmış ISSF Duplex broşürünün genel çukurlaşma/crevice
// ilkelerine genellenmesiyle işlendi (MEDIUM — spesifik değil, genelleme).
//
// "typicalRateRangeMmPerYear" alanı KASITLI olarak çoğu girdide BOŞ
// bırakılmıştır: (1) CO2_SWEET için asıl niceliksel model zaten bu
// projede NORSOK M-506'dır (registry module "norsok") — burada ikinci,
// çelişebilecek bir sayı UYDURULMADI; (2) EROSION_* için asıl niceliksel
// model DNV-RP-O501'dir (registry/coefficients/dnvO501.ts, henüz boş,
// ayrı bir faz) — burada yalnızca API 571 Tablo 4-5'in deniz suyu CS
// referans aralığı bağlamsal bilgi olarak verildi; (3) SCC/crevice/stray
// current/CP shielding gibi mekanizmalar zaten "mm/yıl" ile ifade edilen
// bir metal kaybı hızı DEĞİL, çatlama/lokalize başlangıç fenomenidir.

import { z } from "zod";
import { registerCoefficient } from "../registry";
import type { Coefficient, Source } from "../registry/types";

// ─────────────────────────────────────────────────────────────────────────
// Şema
// ─────────────────────────────────────────────────────────────────────────

const RangeTupleSchema = z
  .tuple([z.number(), z.number()])
  .refine(([min, max]) => min <= max, {
    message: "Aralığın ilk değeri (min) ikinci değerden (max) büyük olamaz.",
  });

export const DamageMechanismCategoryEnum = z.enum(["INTERNAL", "EXTERNAL"]);
export type DamageMechanismCategory = z.infer<typeof DamageMechanismCategoryEnum>;

export const DamageMechanismSchema = z.object({
  id: z.string().min(1).describe("Mekanizma kimliği (ör. \"CO2_SWEET\")"),
  nameTr: z.string().min(1).describe("Türkçe mekanizma adı"),
  nameEn: z.string().min(1).describe("İngilizce mekanizma adı"),
  category: DamageMechanismCategoryEnum.describe("İç (INTERNAL) veya dış (EXTERNAL) mekanizma"),
  triggerConditionsTr: z.string().min(1).describe("Bu mekanizmanın tetiklenmesi için gerekli koşullar"),
  typicalLocationTr: z.string().min(1).describe("Bu mekanizmanın tipik olarak görüldüğü konum(lar)"),
  relatedStandardOrSource: z.string().min(1).describe("İlgili standart/kaynak bölümü (ör. \"API RP 571 §4.3.6\")"),
  typicalRateRangeMmPerYear: RangeTupleSchema.optional().describe(
    "Tipik metal kaybı hızı aralığı (mm/yıl) — yalnızca doğrudan bir kaynakta bulunan, düz bir 'genel korozyon hızı' olarak ifade edilebilen mekanizmalar için doldurulmuştur",
  ),
  preventiveMeasuresTr: z.array(z.string().min(1)).min(1).describe("TR önleyici/azaltıcı tedbirler listesi"),
  spatialSignatureId: z.string().min(1).describe("İlişkili tipik uzamsal hasar deseni etiketi"),
});
export type DamageMechanism = z.infer<typeof DamageMechanismSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────────────────────────────────

const SRC_API571: Source = {
  type: "STANDARD",
  citation:
    "API Recommended Practice 571, \"Damage Mechanisms Affecting Fixed Equipment in the Refining and " +
    "Petrochemical Industries\", 1. baskı (Nisan 2011). Bu oturumda dosyanın TAM METNİ (18.3 MB, 2011 " +
    "baskısı) doğrudan indirilip pdftotext ile okundu — ikincil bir özetten alınmadı.",
  url: "https://usercontent.one/wp/www.ing-hti.no/wp-content/uploads/2023/08/API-RP-571-Damage-Mechanisms-Affecting-Refining-Industry_april-2011.pdf",
  accessedDate: "2026-08-11",
};

const SRC_NACE_SP0169: Source = {
  type: "STANDARD",
  citation:
    "NACE SP0169-2013, \"Control of External Corrosion on Underground or Submerged Metallic Piping " +
    "Systems\" — Bölüm 6 (Kriterler ve Değerlendirme) ve Bölüm 9 (Kaçak Akım Kontrolü). Bu oturumda dosyanın " +
    "tam metni doğrudan indirilip pdftotext ile okundu.",
  url: "https://pgparsco.com/wp-content/uploads/2024/12/SP016913-for-State-of-New-York.pdf",
  accessedDate: "2026-08-11",
};

const SRC_TLC_ACADEMIC: Source = {
  type: "JOURNAL",
  citation:
    "Top-of-line korozyonu (TLC) akademik literatürü — Nyborg & Dugstad, \"Top of Line Corrosion and Water " +
    "Condensation Rates in Wet Gas Pipelines\"; Vitse ve ark. (2003), gaz sıcaklığı 40-100°C taranarak " +
    "yapılan deneyler, maksimum hız ~70°C'de gözlendi. Bu oturumda birden fazla akademik makale özetinin " +
    "(ResearchGate/Semantic Scholar) arama sentezinden derlendi, orijinal makalelerin tam metnine erişilmedi.",
  accessedDate: "2026-08-11",
};

const SRC_UDC_NACE_PAPER: Source = {
  type: "CONFERENCE",
  citation:
    "\"Under Deposit Corrosion (UDC) in the Oil and Gas Industry: A Review of Mechanisms, Testing and " +
    "Mitigation\", NACE CORROSION 2012, Paper No. 1379; ayrıca W. ve ark., \"A review on under-deposit " +
    "corrosion of pipelines in oil and gas fields\", Corrosion Communications, 2022 (ScienceDirect). Bu " +
    "oturumda özet/sentez düzeyinde incelendi, tam metne erişilmedi.",
  accessedDate: "2026-08-11",
};

const SRC_FLASHING_SECONDARY: Source = {
  type: "TEXTBOOK",
  citation:
    "Kontrol vanası \"flashing\" (buharlaşma sonrası buharın yeniden yoğuşmaması) fenomeni — enstrümantasyon " +
    "mühendisliği referans siteleri (instrunexus.com, epcland.com, valmet.com Flow Control Manual). Orijinal " +
    "birincil bir standart/akademik makale bu oturumda bulunup okunmadı.",
  accessedDate: "2026-08-11",
};

const SRC_ISSF_DUPLEX_GENERALIZED: Source = {
  type: "STANDARD",
  citation:
    "International Stainless Steel Forum (ISSF), \"ISSF Duplex Stainless Steels\" broşürü (bkz. " +
    "data/materials.ts'te aynı kaynağın PREN/CPT/CCT için kullanımı) — burada çukurlaşma (pitting) ve " +
    "crevice korozyonunun genel elektrokimyasal ilkelerine (klorür konsantrasyonu, sıcaklık, oksijen, alaşım " +
    "PREN'i) genellenerek kullanıldı. Broşür özellikle duplex/paslanmaz çeliklere odaklıdır; burada genel " +
    "pitting/crevice mekanizması AÇIKLAMASI için bir genelleme yapıldığı NOT edilmelidir.",
  url: "https://worldstainless.org/wp-content/uploads/2021/11/ISSF_Duplex_Stainless_Steels.pdf",
  accessedDate: "2026-08-11",
};

// ─────────────────────────────────────────────────────────────────────────
// Mekanizma tanımları
// ─────────────────────────────────────────────────────────────────────────

interface MechanismDefinition {
  mechanism: DamageMechanism;
  source: Source;
  crossChecked: boolean;
  crossCheckSources: Source[];
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  notes: string;
}

const MECHANISM_DEFINITIONS: MechanismDefinition[] = [
  // ─────────────────────────── İÇ (INTERNAL) — 16 ───────────────────────────
  {
    mechanism: {
      id: "CO2_SWEET",
      nameTr: "CO2 (Tatlı) Korozyonu",
      nameEn: "CO2 (Sweet) Corrosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "CO2'nin suda çözünüp karbonik asit (H2CO3) oluşturması; serbest su fazının varlığı şarttır. CO2 " +
        "kısmi basıncı, pH ve sıcaklık kritik faktörlerdir; artan pCO2 pH'ı düşürür ve hızı artırır.",
      typicalLocationTr:
        "Su fazının biriktiği/yoğunlaştığı noktalar; türbülans ve çarpma (impingement) bölgeleri (dirsek, " +
        "Te, kaynak dikişi kökü) özellikle şiddetlidir.",
      relatedStandardOrSource: "API RP 571 §4.3.6",
      preventiveMeasuresTr: [
        "Korozyon inhibitörü enjeksiyonu",
        "300 Serisi paslanmaz çeliğe veya 400 Serisi/duplex paslanmaz çeliğe malzeme yükseltmesi",
        "pH artırma (uygulanabilir sistemlerde)",
      ],
      spatialSignatureId: "GENERAL_THINNING_TURBULENCE_LOCALIZED",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.6'dan DOĞRUDAN okundu. API 571, hidrojen tesisi shift converter çıkışı gibi ÖZEL bir " +
      "vaka için 1000 mpy (~25.4 mm/yıl) gibi uç bir değer veriyor ama bu genel bir \"tipik aralık\" DEĞİLDİR " +
      "— bu yüzden typicalRateRangeMmPerYear KASITLI olarak boş bırakıldı. Bu projede CO2_SWEET için asıl " +
      "NİCELİKSEL model NORSOK M-506'dır (bkz. registry module \"norsok\", computeNorsokCo2Rate) — burada " +
      "ikinci, çelişebilecek bir sayı üretilmedi.",
  },
  {
    mechanism: {
      id: "H2S_SOUR",
      nameTr: "H2S (Ekşi) Korozyonu — Asidik Sulu Faz",
      nameEn: "H2S (Sour) Corrosion — Acidic Water Phase",
      category: "INTERNAL",
      triggerConditionsTr:
        "H2S içeren, pH 4.5-7.0 arası asidik sulu faz. H2S içeriği, pH, sıcaklık, hız ve oksijen " +
        "konsantrasyonu kritik faktörlerdir. pH>4.5'te ince, koruyucu bir demir sülfür tabakası oluşarak " +
        "hızı sınırlar; bazen daha kalın/gözenekli bir sülfür film, sülfür birikintisi altında çukurlaşmayı " +
        "teşvik edebilir.",
      typicalLocationTr:
        "Yüksek hız/türbülans bölgeleri, özellikle su fazının yoğunlaştığı noktalar; hava/oksitleyici " +
        "girişi olan noktalarda çukurlaşma/birikinti-altı saldırısı riski artar.",
      relatedStandardOrSource: "API RP 571 §5.1.1.10 (Sour Water Corrosion, Acidic)",
      preventiveMeasuresTr: [
        "Oksijen girişini önleme (deaerasyon, sistem sızdırmazlığı)",
        "300 Serisi paslanmaz çelik kullanımı yalnızca ~60°C altında (üzerinde klorürlü SCC riski)",
        "Bakır/nikel alaşımlarına yükseltme (amonyak yokluğunda)",
      ],
      spatialSignatureId: "BOTTOM_6_OCLOCK",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §5.1.1.10'dan DOĞRUDAN okundu. Bölüm herhangi bir sayısal \"tipik mm/yıl\" hızı VERMİYOR " +
      "(hasar \"genel incelme, bazen lokalize\" olarak nitelendiriliyor) — bu yüzden typicalRateRangeMmPerYear " +
      "UYDURULMADI, boş bırakıldı.",
  },
  {
    mechanism: {
      id: "TOP_OF_LINE",
      nameTr: "Hat Üstü (Top-of-Line) Korozyonu",
      nameEn: "Top-of-Line Corrosion (TLC)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Stratifiye çok-fazlı (gaz+su) akışta, boru üst yüzeyinin çevre ile soğuması nedeniyle su buharının " +
        "burada yoğunlaşması (asıl sıvı su fazı borunun ALTINDA olsa bile). Tatlı (CO2) TLC mekanizması, " +
        "sürdürülebilmek için ~0.25 g/m²s üzerinde bir yoğunlaşma hızı gerektirir (daha düşük hızlarda " +
        "korozyon ürünleri korozyonu baskılar); ekşi (H2S) TLC mekanizmasında böyle bir alt sınır yoktur.",
      typicalLocationTr:
        "Boru üst yüzeyi (12 yönü), özellikle yalıtımsız/gömülmemiş, çevre sıcaklığının düşük olduğu hat " +
        "kesimlerinde (deniz altı, hava üstü soğuk iklim).",
      relatedStandardOrSource: "Nyborg & Dugstad; Vitse ve ark. (2003) — akademik TLC literatürü",
      typicalRateRangeMmPerYear: [1, 3],
      preventiveMeasuresTr: [
        "Isıl yalıtım (yoğunlaşmayı azaltmak için boru yüzey sıcaklığını yükseltmek)",
        "Uçucu/film oluşturan korozyon inhibitörü (buhar fazında taşınabilen tip)",
        "Pigging ile su birikintisi/korozyon ürünü temizliği",
      ],
      spatialSignatureId: "TOP_12_OCLOCK",
    },
    source: SRC_TLC_ACADEMIC,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "typicalRateRangeMmPerYear=[1,3], 2-3 yıllık ortalama uzun dönem hızını temsil eder (arama sentezinde " +
      "birden fazla akademik kaynak sentezinden derlendi); İLK üretim döneminde ANLIK hızların 10 mm/yıl'a " +
      "kadar çıkabildiği ayrıca belirtiliyor (bu uç değer aralığa DAHİL EDİLMEDİ, notta ayrıca belirtildi). " +
      "Orijinal akademik makalelerin (Nyborg&Dugstad, Vitse 2003) tam metnine bu oturumda erişilmedi, yalnızca " +
      "arama motoru sentezi kullanıldı — MEDIUM confidence bunu yansıtır. API 571 bu mekanizmayı İÇERMEZ " +
      "(rafineri ekipmanı odaklı bir standarttır, boru hattı çok-fazlı akış fenomeni değildir).",
  },
  {
    mechanism: {
      id: "UNDER_DEPOSIT",
      nameTr: "Birikinti Altı Korozyonu",
      nameEn: "Under-Deposit Corrosion (UDC)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Katı birikinti (kum, korozyon ürünü, demir sülfür ölçeği, mumsu/parafinik tortu vb.) metal yüzeyinde " +
        "biriktiğinde, birikinti altında oksijen/tuz konsantrasyon farkı nedeniyle galvanik hücre oluşması. " +
        "Düşük hız/durgun akış bölgelerinde birikinti oluşumu daha olasıdır.",
      typicalLocationTr:
        "Düşük noktalar, durgun/düşük hızlı bölgeler, boru altı (birikinti yer çekimiyle biriktiğinden), " +
        "pigging sıklığı düşük uzun düz hat kesimleri.",
      relatedStandardOrSource: "NACE CORROSION 2012 Paper #1379; Corrosion Communications (2022) derleme makalesi",
      preventiveMeasuresTr: [
        "Düzenli pigging/temizlik ile birikinti kontrolü",
        "Minimum taşıma hızının altına düşülmemesi (katı taşınım için)",
        "Ölçek/tortu kontrol kimyasalları",
      ],
      spatialSignatureId: "BOTTOM_6_OCLOCK",
    },
    source: SRC_UDC_NACE_PAPER,
    crossChecked: true,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "Bu oturumda birikinti-altı korozyonu için sayısal bir \"tipik mm/yıl\" değeri BULUNAMADI (mekanizma " +
      "doğası gereği son derece lokalize ve durum-özgüdür) — typicalRateRangeMmPerYear UYDURULMADI, boş " +
      "bırakıldı. Kaynaklar özet/soyut düzeyinde incelendi (NACE CORROSION tam metnine bu oturumda erişilmedi, " +
      "yalnızca konferans özetine ve ikincil bir derleme makalesinin özetine erişildi) — MEDIUM confidence.",
  },
  {
    mechanism: {
      id: "MIC",
      nameTr: "Mikrobiyolojik Kaynaklı Korozyon",
      nameEn: "Microbiologically Induced Corrosion (MIC)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Bakteri, alg veya mantar gibi canlı organizmaların varlığı; durgun/düşük akışlı sulu ortamlar " +
        "organizma büyümesini teşvik eder. Organizmalar pH 0-12, sıcaklık -17°C ile 113°C arasında hayatta " +
        "kalabilir. Hidrotest suyunun sistemde bırakılması yaygın bir tetikleyicidir.",
      typicalLocationTr:
        "Depolama tankı dip suyu, durgun/düşük akışlı boru hatları, ısı eşanjörleri, bazı topraklarla temas " +
        "eden borular.",
      relatedStandardOrSource: "API RP 571 §4.3.8",
      preventiveMeasuresTr: [
        "Biyosit dozajlama (klor, brom, ozon, UV veya özel bileşikler)",
        "Minimum akış hızının korunması, durgun/düşük akış bölgelerinin en aza indirilmesi",
        "Hidrotest suyunun mümkün olan en kısa sürede boşaltılması ve kurutulması",
        "Yerleşik organizmaların tam giderimi (pigging, kumlama, kimyasal temizlik + biyosit kombinasyonu)",
      ],
      spatialSignatureId: "LOCALIZED_PITTING_RANDOM",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.8'den DOĞRUDAN okundu. Bölümde sayısal bir \"tipik mm/yıl\" hızı YOK (yalnızca bir " +
      "örnek olay için \"6 inç CS ekşi ham petrol hattında 2.5 yıl sonra 1-2 inç genişliğinde çukurlar\" " +
      "figürü var, ama bu derinlik/hız verisi içermiyor) — typicalRateRangeMmPerYear UYDURULMADI.",
  },
  {
    mechanism: {
      id: "OXYGEN",
      nameTr: "Oksijen Korozyonu",
      nameEn: "Oxygen Corrosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "Çözünmüş oksijenin sulu fazda bulunması — normalde oksijensiz (deoksijenlenmiş) olması beklenen " +
        "sistemlere sızıntı/giriş yoluyla oksijen girmesi (pompa salmastraları, tank nefeslikleri, uygun " +
        "olmayan depolama). Sıcaklığın hızlı yükseldiği noktalarda özellikle agresiftir.",
      typicalLocationTr:
        "Ani sıcaklık artışı olan ekipman (ısıtıcılar, ekonomizerler); genel olarak oksijen giderme " +
        "(deaerasyon) sistemi arızalandığında sistemin herhangi bir noktası.",
      relatedStandardOrSource: "API RP 571 §4.3.5 (Boiler Water Condensate Corrosion — oksijen çukurlaşması bölümü)",
      preventiveMeasuresTr: [
        "Mekanik deaerasyon + kimyasal oksijen alıcı (katalizlenmiş sodyum sülfit veya hidrazin) dozajlama",
        "Sistem sızdırmazlığının sağlanması (negatif basınç bölgelerinde hava girişini önleme)",
        "Depolama tanklarında uygun nefeslik/örtü gazı yönetimi",
      ],
      spatialSignatureId: "LOCALIZED_PITTING_RANDOM",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "API 571 §4.3.5'ten DOĞRUDAN okundu, ANCAK bu bölüm kazan besisuyu/kondensat sistemi bağlamındadır, " +
      "üretim/taşıma boru hattı bağlamı DEĞİLDİR — bu yüzden confidence HIGH değil MEDIUM olarak işaretlendi " +
      "(temel elektrokimya aynı olsa da, bağlam farkı var). Sayısal bir \"tipik mm/yıl\" hızı verilmiyor, " +
      "typicalRateRangeMmPerYear boş bırakıldı.",
  },
  {
    mechanism: {
      id: "GALVANIC_INTERNAL",
      nameTr: "Galvanik Korozyon (İç)",
      nameEn: "Galvanic Corrosion (Internal)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Üç koşul birlikte gerekir: (1) bir elektrolit (nemli/sulu ortam), (2) anot ve katot olarak işlev " +
        "gören iki farklı metal/alaşım, (3) anot-katot arasında elektriksel bağlantı. Anot/katot yüzey alanı " +
        "oranı kritik — küçük anot/büyük katot oranı en yüksek anot korozyon hızını verir.",
      typicalLocationTr:
        "Farklı malzemelerin kaynaklı veya cıvatalı bağlantı noktaları (ör. karbon çelik-paslanmaz çelik " +
        "geçişleri).",
      relatedStandardOrSource: "API RP 571 §4.3.1",
      preventiveMeasuresTr: [
        "Farklı alaşımların iletken ortamda doğrudan temasından kaçınma (uygun anot/katot alan oranı " +
        "sağlanamıyorsa)",
        "Elektriksel izolasyon (cıvata kılıfı, conta) kullanımı",
        "Daha soy malzemenin kaplanması (aktif/anodik malzeme DEĞİL — ters kaplama korozyonu hızlandırır)",
      ],
      spatialSignatureId: "WELD_HAZ_OR_JOINT_LOCALIZED",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.1'den DOĞRUDAN okundu (Tablo 4-6 Deniz Suyunda Galvanik Seri dahil). Sayısal bir " +
      "\"tipik mm/yıl\" hızı verilmiyor (anot/katot alan oranına aşırı duyarlı olduğundan tek bir sayı " +
      "anlamlı değildir) — typicalRateRangeMmPerYear UYDURULMADI.",
  },
  {
    mechanism: {
      id: "EROSION_SAND",
      nameTr: "Katı Parçacık (Kum) Erozyonu",
      nameEn: "Sand/Solid Particle Erosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "Akışkanla taşınan katı parçacıkların (kum, üretim tortusu) yüzeye çarpması. Metal kaybı hızı; " +
        "parçacık hızı ve konsantrasyonu, parçacık boyutu/sertliği, malzeme sertliği/korozyon direnci ve " +
        "çarpma açısına bağlıdır. Her ortam-malzeme çifti için, üzerinde metal kaybının hızlandığı bir eşik " +
        "hız vardır.",
      typicalLocationTr:
        "Dirsekler, Te'ler, redüksiyonlar, kısma/blok vanası çıkışları — akış yönü değişen veya daralan " +
        "her nokta.",
      relatedStandardOrSource: "API RP 571 §4.2.14 (Tablo 4-5, deniz suyunda erozyon-korozyon hızları)",
      typicalRateRangeMmPerYear: [0.15, 1.19],
      preventiveMeasuresTr: [
        "Boru çapını artırarak hızı düşürme",
        "Dirsekleri akış çizgisine uygun (streamlined) hale getirme, değiştirilebilir çarpma plakaları " +
        "(impingement baffle) kullanma",
        "Daha sert alaşım/sertleştirme kaplaması (hardfacing) uygulama",
        "Kum ayırıcı/filtre ile parçacık yükünü azaltma",
      ],
      spatialSignatureId: "DOWNSTREAM_OF_RESTRICTION",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "typicalRateRangeMmPerYear=[0.15,1.19], API 571 Tablo 4-5'teki KARBON ÇELİK-DENİZ SUYU erozyon-korozyon " +
      "verisinden (6-47 mpy, 1-27 fps hız aralığında) DOĞRUDAN dönüştürüldü (1 mpy=0.0254 mm/yıl). Bu, KUM " +
      "erozyonu için değil deniz suyu akışı için bir REFERANS aralıktır — gerçek kum erozyonu hızı parçacık " +
      "konsantrasyonu/boyutuna güçlü bağımlıdır ve bu projede asıl niceliksel model DNV-RP-O501'dir " +
      "(registry/coefficients/dnvO501.ts, henüz boş — ayrı bir faz). Bu aralık yalnızca BAĞLAMSAL bir " +
      "referans olarak verildi, kesin bir kum erozyonu hızı DEĞİLDİR.",
  },
  {
    mechanism: {
      id: "EROSION_DROPLET",
      nameTr: "Sıvı Damlacığı Çarpma Erozyonu",
      nameEn: "Liquid Droplet Impingement Erosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "Yüksek hızlı gaz/buhar akışı içinde taşınan sıvı damlacıklarının (yoğuşma veya sürüklenme yoluyla) " +
        "yüzeye çarpması — katı parçacık gerektirmez. Islak gaz/kondensat hatlarında ve buhar hatlarında " +
        "görülür.",
      typicalLocationTr:
        "Türbin kanatları, buhar/ıslak gaz hatlarındaki dirsekler ve daralmalar, kısma vanası çıkışları.",
      relatedStandardOrSource: "API RP 571 §4.2.14 (\"liquid impingement erosion\" — erozyon/erozyon-korozyon şemsiyesi altında)",
      preventiveMeasuresTr: [
        "Akış hızını düşürme",
        "Daha sert/aşınma dirençli malzeme veya kaplama",
        "Damlacık ayırıcı (demister/separator) ile sıvı taşınımını azaltma",
      ],
      spatialSignatureId: "DOWNSTREAM_OF_RESTRICTION",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.2.14.8 \"Related Mechanisms\" bölümü \"liquid impingement erosion\"u erozyon/erozyon-" +
      "korozyon şemsiyesinin bir alt-terimi olarak AÇIKÇA adlandırıyor, ancak AYRI bir sayısal tablo VERMİYOR " +
      "— typicalRateRangeMmPerYear bu nedenle boş bırakıldı (EROSION_SAND'deki Tablo 4-5 verisi katı " +
      "parçacık/genel erozyon-korozyon içindir, damlacık-özel değildir, bu yüzden buraya KOPYALANMADI).",
  },
  {
    mechanism: {
      id: "EROSION_CORROSION_SYNERGY",
      nameTr: "Erozyon-Korozyon Sinerjisi",
      nameEn: "Erosion-Corrosion Synergy",
      category: "INTERNAL",
      triggerConditionsTr:
        "Korozyonun, koruyucu film/tabakayı mekanik olarak kaldırarak erozyonu artırdığı VE erozyonun taze " +
        "metal yüzeyi sürekli açığa çıkararak korozyonu artırdığı birleşik mekanizma. İki etkinin toplamı, " +
        "ayrı ayrı etkilerin toplamından daha büyük olabilir (gerçek sinerji).",
      typicalLocationTr: "Erozyonun görüldüğü her yer (dirsek, Te, redüksiyon, vana çıkışı) ile aynıdır.",
      relatedStandardOrSource: "API RP 571 §4.2.14.1(b), §4.2.14.3(g-h)",
      preventiveMeasuresTr: [
        "Korozyon direncini artırma (daha dirençli alaşım) VE erozyon direncini artırma (sertlik/kaplama) " +
        "BİRLİKTE ele alınmalı — yalnızca sertlik artırmak korozyon payı yüksekse yeterli olmayabilir",
        "Deaerasyon, kondensat enjeksiyonu veya inhibitör ekleyerek ortamın korozifliğini azaltma",
      ],
      spatialSignatureId: "DOWNSTREAM_OF_RESTRICTION",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.2.14.1(b) bu sinerjiyi açıkça TANIMLIYOR (\"Erosion-corrosion is a description for the " +
      "damage that occurs when corrosion contributes to erosion... under the combined action of erosion and " +
      "corrosion\"), §4.2.14.3(g-h) katkıda bulunan faktörleri listeliyor. Sayısal bir sinerji-özel çarpan " +
      "bulunamadı — typicalRateRangeMmPerYear boş bırakıldı (bu proje kapsamında sinerji etkisinin " +
      "nicelleştirilmesi ayrı bir hesap modeli gerektirir, bu katalog girdisi yalnızca tanımlayıcıdır).",
  },
  {
    mechanism: {
      id: "CAVITATION",
      nameTr: "Kavitasyon",
      nameEn: "Cavitation",
      category: "INTERNAL",
      triggerConditionsTr:
        "Yerel basıncın sıvının buhar basıncının altına düşmesi sonucu sayısız küçük buhar kabarcığının " +
        "oluşup ANİ olarak çökmesi (kollaps). Kollaps sırasında oluşan lokalize darbe kuvvetleri metal kaybına " +
        "yol açar. Katı/aşındırıcı parçacık VARLIĞI gerekmez ama hasarı hızlandırır.",
      typicalLocationTr:
        "Pompa gövdeleri, pompa çarkları (alçak basınç tarafı), orifis veya kontrol vanası ÇIKIŞINDAKİ boru " +
        "hattı, venturi, sızdırmazlık elemanları.",
      relatedStandardOrSource: "API RP 571 §4.2.15",
      preventiveMeasuresTr: [
        "Mutlak basıncın sıvının buhar basıncının altına düşmesini önleme (akış yolunu düzleştirme, hızı " +
        "azaltma, pompa emme basıncını artırma)",
        "Sürüklenmiş havanın giderilmesi",
        "Malzeme değişikliği TEK BAŞINA genellikle yeterli değildir — mekanik/tasarım/işletme değişikliği " +
        "gerekir",
      ],
      spatialSignatureId: "DOWNSTREAM_OF_RESTRICTION",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.2.15'ten DOĞRUDAN okundu. \"Piping downstream of orifices or control valves\" AÇIKÇA " +
      "kritik konum olarak listeleniyor — bu, valveCatalog.ts'teki vana erozyon bölgesi mantığıyla TUTARLI. " +
      "Sayısal bir \"tipik mm/yıl\" hızı verilmiyor (hasar son derece lokalize ve NPSH/basınç koşullarına " +
      "duyarlıdır) — typicalRateRangeMmPerYear boş bırakıldı.",
  },
  {
    mechanism: {
      id: "FLASHING",
      nameTr: "Ani Buharlaşma (Flashing) Erozyonu",
      nameEn: "Flashing Erosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "Bir kısma elemanından (vana, choke) sonra basıncın sıvının buhar basıncının ALTINDA KALMASI — " +
        "kavitasyondan farklı olarak oluşan buhar kabarcıkları KOLLAPS OLMAZ, akış boyunca buhar fazı olarak " +
        "kalır ve büyük hacim artışı nedeniyle çok yüksek hızlı iki-fazlı bir akım oluşur.",
      typicalLocationTr:
        "Kısma elemanı (vana/choke) gövdesi ve HEMEN sonrasındaki boru hattı — pürüzsüz, \"kumlanmış\" " +
        "(sandblasted) görünümlü aşınma tipiktir.",
      relatedStandardOrSource: "Enstrümantasyon mühendisliği referansları (instrunexus.com, epcland.com, Valmet Flow Control Manual)",
      preventiveMeasuresTr: [
        "Çok kademeli basınç düşürme trim'i (tek kademede büyük basınç düşümünden kaçınma)",
        "Kısma sonrası akışı boru merkezine yönlendiren \"flow-to-close\" açı vana konfigürasyonu",
        "Aşınmaya dayanıklı gövde/çıkış malzemesi veya kaplama",
      ],
      spatialSignatureId: "DOWNSTREAM_OF_RESTRICTION",
    },
    source: SRC_FLASHING_SECONDARY,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "Bu oturumda flashing için birincil bir standart/akademik makale BULUNAMADI, yalnızca enstrümantasyon " +
      "mühendisliği referans siteleri kullanıldı — MEDIUM confidence. Sayısal bir \"tipik mm/yıl\" hızı " +
      "bulunamadı, typicalRateRangeMmPerYear boş bırakıldı. Kavitasyondan AYRI bir mekanizma olarak " +
      "modellendi (kabarcık kollapsı YOK, sürekli buhar fazı VAR) ama pratikte ikisi sıkça birlikte anılır.",
  },
  {
    mechanism: {
      id: "PITTING_INTERNAL",
      nameTr: "Çukurlaşma Korozyonu (İç)",
      nameEn: "Pitting Corrosion (Internal)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Klorür (veya benzeri agresif anyon) konsantrasyonu, sıcaklık, çözünmüş oksijen ve alaşımın PREN " +
        "değeri kritik faktörlerdir — malzemenin CPT'sinin (kritik çukurlaşma sıcaklığı) üzerindeki bir " +
        "sıcaklıkta çalışması çukurlaşma başlatır (bkz. data/materials.ts'teki cptC alanı).",
      typicalLocationTr:
        "Pasif film zayıflıklarının olduğu rastgele noktalar; genellikle durgun/düşük hız bölgelerinde daha " +
        "sık görülür (birikinti/klorür konsantrasyonu için zaman tanır).",
      relatedStandardOrSource: "ISSF Duplex Stainless Steels broşürü (genel çukurlaşma ilkeleri); ASTM G48 test metodolojisi",
      preventiveMeasuresTr: [
        "Malzemenin CPT'sinin operasyon sıcaklığının üzerinde olmasını sağlama (PREN'i yeterli alaşım " +
        "seçimi)",
        "Klorür konsantrasyonunu sınırlama/seyreltme",
        "Oksijen girişini önleme",
      ],
      spatialSignatureId: "LOCALIZED_PITTING_RANDOM",
    },
    source: SRC_ISSF_DUPLEX_GENERALIZED,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes:
      "Bu, materials.ts fazında zaten doğrulanmış ISSF broşürünün DUPLEX/paslanmaz çeliğe özgü PREN/CPT " +
      "ilişkisinin GENEL çukurlaşma mekanizması AÇIKLAMASINA genellenmesidir — spesifik bir \"pitting " +
      "corrosion\" API 571 bölümü YOKTUR (API 571'de pitting, diğer birçok mekanizmanın bir GÖRÜNÜM/appearance " +
      "biçimi olarak geçer, kendi başına bir bölüm değildir). Bu nedenle MEDIUM (genelleme, spesifik değil).",
  },
  {
    mechanism: {
      id: "CREVICE_INTERNAL",
      nameTr: "Crevice (Aralık) Korozyonu (İç)",
      nameEn: "Crevice Corrosion (Internal)",
      category: "INTERNAL",
      triggerConditionsTr:
        "Dar bir geometrik aralık (flanş contası altı, gevşek conta, birikinti altı, kaynak kusuru) içinde " +
        "durgun elektrolitin oksijen tükenmesi ve pH düşmesi yoluyla lokalize saldırı başlatması. Pitting'e " +
        "göre DAHA DÜŞÜK bir kritik sıcaklıkta (CCT < CPT) başlar.",
      typicalLocationTr: "Flanş conta yüzeyleri, contalı/cıvatalı bağlantılar, birikinti altı, sıkı geçmeli parçalar.",
      relatedStandardOrSource: "ISSF Duplex Stainless Steels broşürü (genel crevice ilkeleri); ASTM G48 Method B",
      preventiveMeasuresTr: [
        "Tasarımda dar aralık/durgun bölge oluşturan geometrilerden kaçınma",
        "CCT'si operasyon sıcaklığının üzerinde olan malzeme seçimi",
        "Conta/bağlantı temizliği ve düzenli bakım",
      ],
      spatialSignatureId: "CREVICE_GEOMETRIC_GAP",
    },
    source: SRC_ISSF_DUPLEX_GENERALIZED,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "MEDIUM",
    notes: "PITTING_INTERNAL ile aynı gerekçeyle (genelleme, spesifik bir API 571 bölümü yok) MEDIUM işaretlendi.",
  },
  {
    mechanism: {
      id: "CSCC_INTERNAL",
      nameTr: "Klorürlü Gerilmeli Korozyon Çatlaması (İç)",
      nameEn: "Chloride Stress Corrosion Cracking (Internal)",
      category: "INTERNAL",
      triggerConditionsTr:
        "300 Serisi paslanmaz çelik/bazı nikel alaşımlarında; çekme gerilmesi (uygulanan veya kalıntı), " +
        "sıcaklık (tipik olarak ~60°C üzerinde) ve sulu klorür ortamının BİRLİKTE bulunması. Çözünmüş oksijen " +
        "çatlamayı hızlandırır. Ni içeriği %8-12 olan alaşımlar EN duyarlı, %35 üzeri YÜKSEK dirençli, %45 " +
        "üzeri neredeyse bağışıktır. Karbon çelik/düşük alaşımlı çelik/400 Serisi PC BAĞIŞIKTIR.",
      typicalLocationTr:
        "Tüm 300 Serisi PÇ boru/basınçlı ekipman bileşenleri; ısıl transfer koşulları (klorürlerin " +
        "konsantre olmasına izin verir) özellikle risklidir.",
      relatedStandardOrSource: "API RP 571 §4.5.1",
      preventiveMeasuresTr: [
        "Dirençli malzeme kullanımı (duplex PÇ veya yüksek Ni alaşımı)",
        "Hidrotestte düşük klorürlü su kullanımı, hızlı ve eksiksiz kurutma",
        "Klorürlerin konsantre olabileceği durgun bölge tasarımlarından kaçınma",
      ],
      spatialSignatureId: "SURFACE_CRAZE_CRACK_NETWORK",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.5.1'den DOĞRUDAN okundu. SCC bir ÇATLAMA mekanizmasıdır, düz bir \"mm/yıl\" metal kaybı " +
      "hızıyla anlamlı biçimde ifade EDİLEMEZ — typicalRateRangeMmPerYear bu nedenle KASITLI olarak boş " +
      "bırakıldı (metal kaybı yerine çatlak başlama/ilerleme zamanı ile karakterize edilir).",
  },
  {
    mechanism: {
      id: "ORGANIC_ACID",
      nameTr: "Organik Asit Korozyonu (Sulu)",
      nameEn: "Aqueous Organic Acid Corrosion",
      category: "INTERNAL",
      triggerConditionsTr:
        "Düşük moleküler ağırlıklı organik asitlerin (formik, asetik, propiyonik, bütirik asit) sulu fazda " +
        "çözünüp pH'ı düşürmesi. Formik ve asetik asit en korozif olanlarıdır. Etki, diğer asitlerin " +
        "(HCl, H2S, karbonik asit) varlığıyla MASKELENEBİLİR.",
      typicalLocationTr:
        "Suyun biriktiği veya hidrokarbon akışının su damlacıklarını yüzeye çarptırdığı noktalar — " +
        "eşanjör dipleri, ayırıcı tankı çizmeleri (boot), dirsek/Te, kontrol vanası çıkışları.",
      relatedStandardOrSource: "API RP 571 §5.1.1.12",
      preventiveMeasuresTr: [
        "Kimyasal nötrleştirici enjeksiyonu",
        "Film oluşturan amin kullanımı (organik asitle reaksiyona girmeyen tip seçilirse)",
        "Korozyon dirençli alaşıma yükseltme",
      ],
      spatialSignatureId: "GENERAL_THINNING_TURBULENCE_LOCALIZED",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §5.1.1.12'den DOĞRUDAN okundu. Bölüm asıl olarak RAFİNERİ ham petrol kulesi tepe sistemi " +
      "bağlamındadır (üretim/taşıma boru hattı değil) — ancak temel mekanizma (organik asit + su fazı) " +
      "üretim sularında da geçerlidir, bu context farkı notta belirtildi ama confidence'ı düşürmedi (API 571 " +
      "birincil kaynak olarak DOĞRUDAN okundu). Sayısal bir \"tipik mm/yıl\" hızı verilmiyor.",
  },

  // ─────────────────────────── DIŞ (EXTERNAL) — 8 ───────────────────────────
  {
    mechanism: {
      id: "ATMOSPHERIC_MARINE",
      nameTr: "Atmosferik Korozyon (Deniz/Endüstriyel Ortam)",
      nameEn: "Atmospheric Corrosion (Marine/Industrial)",
      category: "EXTERNAL",
      triggerConditionsTr:
        "Atmosferik nemin metal yüzeyde yoğunlaşması. Deniz ortamları (tuz) ve endüstriyel ortamlar " +
        "(asit/sülfür bileşikleri) en şiddetlisidir; kuru kırsal ortamlar çok düşük hız gösterir. ~121°C " +
        "üzerinde yüzeyler genellikle çok kuru olduğundan korozyon durur (yalıtım altı hariç).",
      typicalLocationTr:
        "Boru desteklerinin temas noktaları (su tutulumu), nemi hapseden tasarım detayları, boyasız/kaplama " +
        "arızalı bölgeler.",
      relatedStandardOrSource: "API RP 571 §4.3.2",
      typicalRateRangeMmPerYear: [0.13, 0.51],
      preventiveMeasuresTr: [
        "Uygun yüzey hazırlığı ve kaplama uygulaması",
        "Su tutulumunu önleyen tasarım (boru desteği detayları, drenaj eğimi)",
        "Periyodik kaplama bakımı/yenileme",
      ],
      spatialSignatureId: "SOIL_AIR_INTERFACE_OR_HOLIDAY",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "typicalRateRangeMmPerYear=[0.13,0.51], API 571 §4.3.2(b)'deki AÇIK mpy rakamlarından DOĞRUDAN " +
      "dönüştürüldü: deniz ortamı ~20 mpy (0.51 mm/yıl), endüstriyel ortam 5-10 mpy (0.13-0.25 mm/yıl) — " +
      "verilen aralık bu ikisini kapsıyor (kırsal <1 mpy hariç tutuldu, bu mekanizma özellikle deniz/endüstriyel " +
      "için tanımlı).",
  },
  {
    mechanism: {
      id: "CUI",
      nameTr: "Yalıtım Altı Korozyonu",
      nameEn: "Corrosion Under Insulation (CUI)",
      category: "EXTERNAL",
      triggerConditionsTr:
        "Yalıtım altında su hapsolması. Karbon/düşük alaşımlı çelik için -12°C ile 175°C, östenitik/duplex " +
        "PÇ için 60°C ile 205°C arasındaki İŞLETME sıcaklıkları en risklidir (özellikle 100-121°C arası, su " +
        "buharlaşmadan uzun süre ıslak kalır). Aralıklı servis (siklik ısıl işletme) riski artırır.",
      typicalLocationTr:
        "Yalıtım sonlanma noktaları (flanş), hasarlı buhar izleme (steam tracing) hattı, yalıtım destek " +
        "halkaları (özellikle standoff'suz kaynaklı), ölü uçlar (deadleg), boru askıları, düşük noktalar.",
      relatedStandardOrSource: "API RP 571 §4.3.3",
      preventiveMeasuresTr: [
        "Nem geçirmeyen buhar bariyeri/mastik ve düzenli yalıtım sızdırmazlık bakımı",
        "Alev püskürtmeli alüminyum kaplama (CS için, galvanik koruma sağlar)",
        "300 Serisi PÇ için düşük klorürlü yalıtım malzemesi kullanımı",
        "Isı korunumunun önemli olmadığı ekipmanda yalıtımın kaldırılmasının değerlendirilmesi",
      ],
      spatialSignatureId: "INSULATION_LOW_POINT_OR_TERMINATION",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.3'ten DOĞRUDAN okundu (tam 20 maddelik kritik konum listesi dahil, burada kısaltılmış " +
      "temsili bir alt küme verildi). Sayısal bir \"tipik mm/yıl\" hızı verilmiyor (CUI şiddeti yalıtım tipi/" +
      "tasarım/iklime aşırı duyarlıdır) — typicalRateRangeMmPerYear boş bırakıldı.",
  },
  {
    mechanism: {
      id: "EXTERNAL_CSCC",
      nameTr: "Klorürlü Gerilmeli Korozyon Çatlaması (Dış)",
      nameEn: "Chloride Stress Corrosion Cracking (External)",
      category: "EXTERNAL",
      triggerConditionsTr:
        "CSCC_INTERNAL ile AYNI temel elektrokimya (300 Serisi PÇ + çekme gerilmesi + ~60°C üzeri + klorür), " +
        "ancak klorür KAYNAĞI dış çevreden gelir — özellikle ISLANMIŞ yalıtım altında (yalıtım malzemesinden " +
        "sızan klorürler, özellikle eski kalsiyum silikat yalıtımlarda) veya deniz atmosferinde.",
      typicalLocationTr: "Yalıtımlı 300 Serisi PÇ yüzeyler (yalıtım ıslandığında), deniz atmosferine açık PÇ yüzeyler.",
      relatedStandardOrSource: "API RP 571 §4.5.1(e) — \"External Cl-SCC has also been a problem on insulated surfaces when insulation gets wet\"",
      preventiveMeasuresTr: [
        "Düşük klorürlü yalıtım malzemesi seçimi (bkz. CUI önlemleri)",
        "Yalıtım altında uygun kaplama uygulaması",
        "Duplex PÇ'ye yükseltme (300 Seriye göre belirgin şekilde daha dirençli)",
      ],
      spatialSignatureId: "SURFACE_CRAZE_CRACK_NETWORK",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.5.1(e)'den DOĞRUDAN okundu — bölüm AÇIKÇA hem iç (proses tarafı) hem dış (yalıtım altı " +
      "ıslanma) Cl-SCC'yi TEK bölümde ele alıyor, bu yüzden CSCC_INTERNAL ile aynı kaynak paylaşıldı. " +
      "typicalRateRangeMmPerYear, SCC bir çatlama mekanizması olduğundan KASITLI boş bırakıldı.",
  },
  {
    mechanism: {
      id: "EXTERNAL_PITTING",
      nameTr: "Çukurlaşma Korozyonu (Dış)",
      nameEn: "Pitting Corrosion (External)",
      category: "EXTERNAL",
      triggerConditionsTr:
        "PITTING_INTERNAL ile aynı temel ilkeler (klorür, sıcaklık, oksijen, alaşım PREN'i), ancak dış " +
        "yüzeyde tetiklenir — atmosferik tuz birikintisi, toprak klorürleri veya deniz suyu sıçraması yoluyla.",
      typicalLocationTr: "Bare (kaplamasız) veya kaplaması hasarlı dış yüzeyler, deniz/kıyı ortamındaki ekipman.",
      relatedStandardOrSource: "ISSF Duplex Stainless Steels broşürü (genel ilkeler); API RP 571 §4.3.2 (atmosferik bağlam)",
      preventiveMeasuresTr: [
        "Uygun dış kaplama/boya sistemi",
        "CPT'si ortam sıcaklığının üzerinde olan malzeme seçimi",
        "Deniz/kıyı ortamında periyodik kaplama muayenesi",
      ],
      spatialSignatureId: "LOCALIZED_PITTING_RANDOM",
    },
    source: SRC_ISSF_DUPLEX_GENERALIZED,
    crossChecked: true,
    crossCheckSources: [SRC_API571],
    confidence: "MEDIUM",
    notes: "PITTING_INTERNAL ile aynı gerekçeyle (genelleme) MEDIUM işaretlendi; API 571 atmosferik korozyon " +
      "bölümüyle bağlamsal olarak çapraz kontrol edildi.",
  },
  {
    mechanism: {
      id: "SOIL_CORROSION",
      nameTr: "Toprak Korozyonu",
      nameEn: "Soil Corrosion",
      category: "EXTERNAL",
      triggerConditionsTr:
        "Toprağa gömülü metalin toprak nemi/elektrolitiyle teması. Toprak direnci (özdirenç) korozifliğin en " +
        "kolay ölçülen göstergesidir — düşük özdirenç (yüksek nem/tuz/asidite) en korozif koşuldur. Tek bir " +
        "parametre yeterli DEĞİLDİR, birden fazla toprak özelliği birlikte değerlendirilmelidir (ASTM STP 741, " +
        "API RP 580/581).",
      typicalLocationTr: "Toprak-hava arayüzü (yüzeye çıkış noktaları) — nem VE oksijen birlikte bulunduğundan " +
        "yapının geri kalanından belirgin şekilde DAHA KORROZİF.",
      relatedStandardOrSource: "API RP 571 §4.3.9; NACE SP0169-2013",
      preventiveMeasuresTr: [
        "Özel dolgu malzemesi (backfill) kullanımı",
        "Kaplama + katodik koruma kombinasyonu (en etkili yöntem)",
        "Toprak-hava arayüzü noktalarında ek muayene/koruma",
      ],
      spatialSignatureId: "SOIL_AIR_INTERFACE_OR_HOLIDAY",
    },
    source: SRC_API571,
    crossChecked: true,
    crossCheckSources: [SRC_NACE_SP0169],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.9'dan DOĞRUDAN okundu, NACE SP0169-2013'ün ilgili katodik koruma bölümleriyle bağlamsal " +
      "olarak çapraz kontrol edildi (her iki birincil kaynak da bu oturumda tam metin okundu). Sayısal bir " +
      "\"tipik mm/yıl\" hızı verilmiyor (toprak korozifliği son derece yer-özgüdür) — typicalRateRangeMmPerYear " +
      "boş bırakıldı.",
  },
  {
    mechanism: {
      id: "STRAY_CURRENT",
      nameTr: "Kaçak Akım Korozyonu",
      nameEn: "Stray-Current Corrosion",
      category: "EXTERNAL",
      triggerConditionsTr:
        "Yapıya AİT OLMAYAN, harici bir DC/AC akım kaynağından (CP redresörleri, DC tren/tramvay sistemleri, " +
        "kaynak makineleri, HVDC güç sistemleri) gelen akımın toprak yoluyla yapıya girip başka bir noktadan " +
        "çıkması. Akımın YAPIDAN ÇIKTIĞI nokta anodik olur ve şiddetli lokalize korozyona uğrar.",
      typicalLocationTr: "Akımın elektrolitten yapıya toplandığı veya yapıdan elektrolite boşaldığı noktalar " +
        "— genellikle bir kaçak akım kaynağına (tren hattı, redresör) en yakın/en uzak nokta.",
      relatedStandardOrSource: "NACE SP0169-2013 §9",
      preventiveMeasuresTr: [
        "Kaçak akım kaynağının tespiti ve izolasyonu/yönlendirilmesi (bonding, drenaj sistemleri)",
        "Düzenli boru-elektrolit potansiyel izleme (yabancı kaynak etkisini tespit için)",
        "AC kaçak akımlar için NACE SP0177'ye uygun azaltma tedbirleri",
      ],
      spatialSignatureId: "SOIL_AIR_INTERFACE_OR_HOLIDAY",
    },
    source: SRC_NACE_SP0169,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "NACE SP0169-2013 §9'dan (\"Control of Stray Currents\") DOĞRUDAN okundu. Sayısal bir \"tipik mm/yıl\" " +
      "hızı standart tarafından VERİLMİYOR (kaçak akım şiddeti kaynağın büyüklüğü/mesafesine son derece " +
      "duyarlıdır, Faraday yasasıyla akım yoğunluğundan hesaplanabilir ama bu proje kapsamında ayrı bir " +
      "hesap modeli gerektirir) — typicalRateRangeMmPerYear boş bırakıldı.",
  },
  {
    mechanism: {
      id: "GALVANIC_EXTERNAL",
      nameTr: "Galvanik Korozyon (Dış)",
      nameEn: "Galvanic Corrosion (External)",
      category: "EXTERNAL",
      triggerConditionsTr:
        "GALVANIC_INTERNAL ile AYNI üç koşul (elektrolit + iki farklı metal + elektriksel bağlantı), ancak " +
        "dış ortamda — gömülü boru hatları, elektrik iletim direkleri ve gemi gövdeleri API 571'de AÇIKÇA " +
        "tipik konum olarak listelenmiştir.",
      typicalLocationTr:
        "Gömülü boru hatlarında farklı malzeme geçişleri (ör. eski/yeni çelik boru bağlantısı), toprakla " +
        "temas eden bimetalik bağlantılar (ör. bakır-alüminyum elektrik bağlantıları).",
      relatedStandardOrSource: "API RP 571 §4.3.1(4)(a-b)",
      preventiveMeasuresTr: [
        "Gömülü hatlarda dielektrik yalıtım contası/rakoru kullanımı",
        "Katodik koruma sistemi ile galvanik hücrenin baskılanması",
        "Toprakla temas eden bimetalik bağlantılarda izolasyon",
      ],
      spatialSignatureId: "WELD_HAZ_OR_JOINT_LOCALIZED",
    },
    source: SRC_API571,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "API 571 §4.3.1.4(b) \"Buried pipelines... are typical locations for galvanic corrosion\" ifadesiyle " +
      "AÇIKÇA doğrulanıyor — GALVANIC_INTERNAL ile aynı bölümden, dış bağlam vurgusuyla ayrıştırıldı.",
  },
  {
    mechanism: {
      id: "CP_SHIELDING",
      nameTr: "Katodik Koruma Perdeleme (Shielding)",
      nameEn: "Cathodic Protection Shielding",
      category: "EXTERNAL",
      triggerConditionsTr:
        "Bir engelin (ayrılmış/disbonde kaplama, ısıl yalıtım, gevşek sargı, yüksek özdirençli kaya/toprak, " +
        "yakın bir metal yapı) katodik koruma akımının yapıya ulaşmasını FİZİKSEL olarak engellemesi — bu " +
        "bölgelerde yapı KORUNMASIZ kalır ve normal (perdelenmemiş) korozyon hızıyla aşınmaya devam eder, " +
        "CP potansiyeli ölçümü de bu bölgelerde YANILTICI olabilir.",
      typicalLocationTr:
        "Ayrılmış/disbonde kaplama altı, ısıl yalıtım altı gömülü/deniz altı hatlar, gevşek sargı altı, " +
        "yakın komşu yapıların altında kalan bölgeler.",
      relatedStandardOrSource: "NACE SP0169-2013 §2 (Tanımlar: \"Electrical Shielding\"), §6.3.7",
      preventiveMeasuresTr: [
        "Perdeleme YAPMAYAN (nonshielding) kaplama sistemleri seçimi",
        "Kaplama bütünlüğünün düzenli denetimi (özellikle ıslak/gömülü hatlarda)",
        "Perdeleme riski taşıyan tasarım detaylarından (yakın hat geçişleri, kaya doldurgu) kaçınma",
      ],
      spatialSignatureId: "SOIL_AIR_INTERFACE_OR_HOLIDAY",
    },
    source: SRC_NACE_SP0169,
    crossChecked: false,
    crossCheckSources: [],
    confidence: "HIGH",
    notes:
      "NACE SP0169-2013'ün \"Electrical Shielding\" tanımından (§2) ve §6.3.7'den (\"Reliable measurement of " +
      "potentials... can be significantly affected by the presence of electrical shielding\") DOĞRUDAN okundu. " +
      "CP shielding kendisi bir korozyon MEKANİZMASI değil, korumanın ETKİSİZLEŞTİĞİ bir DURUMDUR — bu " +
      "nedenle typicalRateRangeMmPerYear anlamlı değildir ve boş bırakıldı (perdelenmiş bölgedeki gerçek hız, " +
      "altındaki asıl mekanizmaya — genellikle SOIL_CORROSION — bağlıdır).",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Doğrulama + dışa aktarım
// ─────────────────────────────────────────────────────────────────────────

export const MECHANISMS: DamageMechanism[] = MECHANISM_DEFINITIONS.map((def) =>
  DamageMechanismSchema.parse(def.mechanism),
);

export function getMechanism(id: string): DamageMechanism {
  const mechanism = MECHANISMS.find((m) => m.id === id);
  if (!mechanism) {
    const available = MECHANISMS.map((m) => m.id).join(", ");
    throw new Error(`"${id}" kimlikli bir hasar mekanizması bulunamadı. Tanımlı mekanizmalar: ${available}.`);
  }
  return mechanism;
}

export function listMechanismsByCategory(category: DamageMechanismCategory): DamageMechanism[] {
  return MECHANISMS.filter((m) => m.category === category);
}

// ─────────────────────────────────────────────────────────────────────────
// KDP kayıt defteri entegrasyonu
// ─────────────────────────────────────────────────────────────────────────

for (const def of MECHANISM_DEFINITIONS) {
  const coefficient: Coefficient<DamageMechanism> = {
    id: `data.mechanisms.${def.mechanism.id}`,
    module: "mechanisms",
    value: def.mechanism,
    unit: "-",
    description: `${def.mechanism.nameTr} — hasar mekanizması kataloğu girdisi (tetikleyiciler, konum, önleyici tedbirler${def.mechanism.typicalRateRangeMmPerYear ? ", tipik hız aralığı" : ""})`,
    source: def.source,
    crossChecked: def.crossChecked,
    crossCheckSources: def.crossCheckSources,
    confidence: def.confidence,
    notes: def.notes,
  };
  registerCoefficient(coefficient as Coefficient);
}
