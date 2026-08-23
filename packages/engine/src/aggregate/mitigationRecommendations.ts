// packages/engine/src/aggregate/mitigationRecommendations.ts
//
// Otomatik azaltma (mitigation) önerileri (master görev madde 4). VAR OLAN
// `ScenarioAssessment`in belirleyici (governing) senaryosunun mekanizma
// sonuçlarını (`mechanismResults`) ve niteliksel risk bulgularını
// (`qualitativeRiskFindings`) okur — YENİ bir hesap/eşik İCAT ETMEZ, yalnızca
// "bu mekanizma bu senaryoda uygulanabilir mi" (isApplicable) sorusuna göre
// eşleştirilmiş standart mühendislik pratiği önerileri üretir. Zaten
// yapılandırılmış önlemler (mitigation girdisi) varsa bu AÇIKÇA belirtilir
// (aynı öneri iki kez "yeni öneri" gibi sunulmaz).
//
// Vana bileşenleri (kavitasyon, seri vana vb.) BU MODÜLÜN KAPSAMI DIŞINDA —
// runMechanismAssessment zaten vanaları kapsam dışı bırakıyor (bkz.
// orchestrate/assessComponent.ts başlığı), bu modül o sınırı GENİŞLETMEZ.

import type { CaseAssessment, QualitativeRiskFinding, ScenarioAssessment } from "../orchestrate/types";
import type { Mitigation } from "../types/mitigation";
import { ENGINEERING_DISCLAIMER_TR } from "../corrosion/types";

export interface MitigationRecommendation {
  triggerTr: string;
  recommendationsTr: string[];
  alreadyAddressed: boolean;
}

export interface MitigationRecommendationsResult {
  governingCaseName: string;
  recommendations: MitigationRecommendation[];
  assumptionsTr: string[];
  disclaimer: string;
}

function findQualitative(findings: QualitativeRiskFinding[], mechanismId: string): QualitativeRiskFinding | undefined {
  return findings.find((f) => f.mechanismId === mechanismId);
}

function buildNumericMechanismRecommendations(caseAssessment: CaseAssessment, mitigation: Mitigation): MitigationRecommendation[] {
  const recs: MitigationRecommendation[] = [];

  const co2 = caseAssessment.mechanismResults.find((r) => r.mechanismId === "CO2_SWEET");
  if (co2?.isApplicable && co2.rateP50 > 0) {
    recs.push({
      triggerTr: "CO2 (tatlı) korozyonu aktif",
      recommendationsTr: mitigation.inhibitorUsed
        ? ["Mevcut korozyon inhibitörü dozajı/verimliliğini gözden geçirin (hedef verimlilik ≥%90, sürekli enjeksiyon)."]
        : ["Kimyasal korozyon inhibitörü dozajı başlatın (sürekli enjeksiyon)."],
      alreadyAddressed: mitigation.inhibitorUsed,
    });
  }

  const tlc = caseAssessment.mechanismResults.find((r) => r.mechanismId === "TOP_OF_LINE");
  if (tlc?.isApplicable && tlc.rateP50 > 0) {
    recs.push({
      triggerTr: "Üst-hat korozyonu (TLC) riski aktif — su çiy noktası aşımı/yoğuşma",
      recommendationsTr: [
        "Isı kaybını azaltarak (izolasyon) yoğuşmayı önleyin.",
        "Periyodik ıslak pigging (sıvı biriktirme temizliği) uygulayın.",
        mitigation.inhibitorUsed ? "TLC uçucu faz inhibitörü kullanımını değerlendirin (mevcut sıvı-faz inhibitörü üst-hattı kapsamayabilir)." : "TLC'ye özgü uçucu faz inhibitörünü değerlendirin.",
      ],
      alreadyAddressed: false,
    });
  }

  const erosionMechanismIds = ["EROSION_SAND", "EROSION_DROPLET", "EROSION_CORROSION_SYNERGY"];
  const activeErosion = caseAssessment.mechanismResults.filter((r) => erosionMechanismIds.includes(r.mechanismId) && r.isApplicable && r.rateP50 > 0);
  if (activeErosion.length > 0) {
    recs.push({
      triggerTr: `Erozyon/erozyon-korozyon aktif (${activeErosion.map((r) => r.nameTr).join(", ")})`,
      recommendationsTr: [
        "Akış hızını API 14E izin verilen erozyonel hız sınırının altına düşürün.",
        "Dirsek/te gibi yön değiştiren bileşenlerde R/D (bükme yarıçapı oranı) arttırın.",
        "Sert kaplama veya erozyon dirençli malzeme (ör. sertleştirilmiş çelik, seramik astar) uygulayın.",
        "Akış düzenleyici (flow straightener) veya çarpma plakası ekleyin.",
      ],
      alreadyAddressed: false,
    });
  }

  return recs;
}

function buildQualitativeRecommendations(findings: QualitativeRiskFinding[], mitigation: Mitigation): MitigationRecommendation[] {
  const recs: MitigationRecommendation[] = [];

  const mic = findQualitative(findings, "MIC");
  if (mic?.isMechanismActive && (mic.riskLevel === "YÜKSEK" || mic.riskLevel === "ÇOK_YÜKSEK")) {
    recs.push({
      triggerTr: `Mikrobiyolojik korozyon (MIC) riski ${mic.riskLevel}`,
      recommendationsTr: mitigation.biocideUsed
        ? ["Mevcut biyosit dozaj programının etkinliğini (bakteri sayımı ile) periyodik doğrulayın."]
        : ["Biyosit dozajı başlatın.", "Periyodik temizlik pigi (mekanik temizlik) programı uygulayın."],
      alreadyAddressed: mitigation.biocideUsed,
    });
  }

  const udc = findQualitative(findings, "UNDER_DEPOSIT");
  if (udc?.isMechanismActive && (udc.riskLevel === "YÜKSEK" || udc.riskLevel === "ÇOK_YÜKSEK")) {
    recs.push({
      triggerTr: `Birikinti altı korozyonu / durgun bölge (ölü bacak) riski ${udc.riskLevel}`,
      recommendationsTr: [
        "Düşük noktalara drenaj noktası ekleyin.",
        "Mümkünse hat yeniden düzenlemesiyle ölü bacağı (dead-leg) elimine edin.",
        "Periyodik sediment/birikinti temizliği (pigging) uygulayın.",
      ],
      alreadyAddressed: false,
    });
  }

  const h2s = findQualitative(findings, "H2S_SOUR");
  if (h2s?.isMechanismActive && (h2s.riskLevel === "YÜKSEK" || h2s.riskLevel === "ÇOK_YÜKSEK")) {
    recs.push({
      triggerTr: `H2S/sour servis riski ${h2s.riskLevel}`,
      recommendationsTr: [
        "ISO 15156 (NACE MR0175) uyumlu malzeme sertlik/metalurji gereksinimlerini doğrulayın.",
        "Sabit H2S gaz dedektörü/alarm sistemi kurun (personel güvenliği).",
      ],
      alreadyAddressed: false,
    });
  }

  const oxygen = findQualitative(findings, "OXYGEN");
  if (oxygen?.isMechanismActive && (oxygen.riskLevel === "YÜKSEK" || oxygen.riskLevel === "ÇOK_YÜKSEK")) {
    recs.push({
      triggerTr: `Çözünmüş oksijen korozyonu riski ${oxygen.riskLevel}`,
      recommendationsTr: mitigation.o2ScavengerUsed
        ? ["Mevcut oksijen tutucu (O2 scavenger) dozajını/kalıntı O2 seviyesini periyodik doğrulayın."]
        : ["Oksijen tutucu (O2 scavenger) dozajı başlatın.", "Sistemde havayla temas noktalarını (açık tanklar, sızdıran contalar) gözden geçirin."],
      alreadyAddressed: mitigation.o2ScavengerUsed,
    });
  }

  const cui = findQualitative(findings, "CUI");
  if (cui?.isMechanismActive && (cui.riskLevel === "YÜKSEK" || cui.riskLevel === "ÇOK_YÜKSEK")) {
    recs.push({
      triggerTr: `İzolasyon altı korozyon (CUI) riski ${cui.riskLevel}`,
      recommendationsTr: [
        "Periyodik izolasyon açma/muayene programı uygulayın (özellikle nozul/destek çevresi).",
        "Nem bariyeri kaplama veya izolasyon sistemini nem sızdırmaz tipe yükseltmeyi değerlendirin.",
      ],
      alreadyAddressed: false,
    });
  }

  return recs;
}

/**
 * Belirleyici (governing) senaryonun mekanizma sonuçları + niteliksel
 * bulgularından otomatik azaltma önerileri üretir (master görev madde 4).
 */
export function recommendMitigations(assessment: ScenarioAssessment, mitigation: Mitigation): MitigationRecommendationsResult {
  const governingCase = assessment.perCase.find((c) => c.caseName === assessment.governingCaseName);
  if (!governingCase) {
    throw new Error(
      `Belirleyici senaryo ("${assessment.governingCaseName}") perCase içinde bulunamadı — tutarsız bir ScenarioAssessment.`,
    );
  }

  const recommendations = [
    ...buildNumericMechanismRecommendations(governingCase, mitigation),
    ...buildQualitativeRecommendations(governingCase.qualitativeRiskFindings, mitigation),
  ];

  const assumptionsTr = [
    "Öneriler yalnızca belirleyici (governing) senaryonun sonuçlarına dayanır — diğer senaryolarda aktif olup " +
      "belirleyici senaryoda aktif OLMAYAN mekanizmalar için ayrı öneri üretilmez.",
    "Vana bileşenlerine özgü önlemler (kavitasyon trimi, seri vana vb.) bu modülün kapsamı DIŞINDADIR — " +
      "runMechanismAssessment vanaları henüz orkestre etmiyor.",
  ];

  return { governingCaseName: assessment.governingCaseName, recommendations, assumptionsTr, disclaimer: ENGINEERING_DISCLAIMER_TR };
}
