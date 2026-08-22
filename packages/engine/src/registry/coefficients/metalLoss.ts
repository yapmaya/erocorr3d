// packages/engine/src/registry/coefficients/metalLoss.ts
//
// Toplam metal kaybı (SLC — Service Life Corrosion) hesabı: senaryo başına
// kısmi-çalışma düzeltmesi (bkz. corrosion/rules.ts::applyPartialOperationFactor
// — burada TEKRAR EDİLMEZ) + tasarım ömrü çarpanı. BİREBİR bir BOTAŞ proje
// dokümanından (kullanıcının "yüklediğim doküman"ı — bu oturumda diskte
// BULUNDU) doğrudan okundu.

import type { Coefficient, Source } from "../types";

const MODULE = "metalLoss";

const SRC_BOTAS_PSS0002: Source = {
  type: "PROJECT_DOCUMENT",
  citation:
    "BOTAŞ, \"Corrosion Assessment and Materials Selection Onshore (KMGS&NSP)\", Doküman No: " +
    "F3-500-ME-SPC-PSS-0002, Rev. AE (18.08.2021) — Tablo 10-3 \"Corrosion Evaluation Results for Process " +
    "Piping\", SLC (mm) sütun başlıkları: \"(0.25×30×Cru)\" ve \"(0.25×30×Cri)\" — 0,25=91 gün/365 gün " +
    "(kısmi çekiş/withdrawal işletmesi), 30=tasarım ömrü (yıl), Cru/Cri=uninhibited/inhibited korozyon hızı " +
    "(mm/yıl). Metin (§10.2): \"the specified design life of 30 years assuming withdrawal operation is only " +
    "for 91 days per annum\". Bu oturumda dosyanın tam metninden (pdftotext ile) doğrudan okundu — " +
    "kullanıcının diskinde bulundu.",
  accessedDate: "2026-08-12",
};

const SLC_FORMULA: Coefficient<string> = {
  id: "metalLoss.slcFormula",
  module: MODULE,
  value: "SLC [mm] = (işletme günü/365) × tasarım ömrü [yıl] × korozyon hızı [mm/yıl]",
  unit: "-",
  description: "Servis ömrü boyunca beklenen toplam metal kaybı (SLC) hesap formülü — tek bir senaryo için.",
  source: SRC_BOTAS_PSS0002,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes:
    "Standardın kendi Tablo 10-3'ünden BİREBİR okundu, kısmi-çalışma çarpanı (işletme günü/365) zaten " +
    "corrosion/rules.ts::applyPartialOperationFactor'da AYNI formülle mevcuttu (bu proje talimatının " +
    "MÜHENDİSLİK KURALLARI bölümünden, bağımsız olarak) — bu, iki bağımsız kaynağın (proje talimatı + şimdi " +
    "bulunan birincil BOTAŞ dokümanı) AYNI formülde örtüştüğü nadir bir durumdur, confidence=HIGH bunu " +
    "yansıtır. örnek doğrulama: 0,25×30×Cru sütun başlığı, işletme günü=91 (91/365≈0,2493≈0,25 yuvarlama) " +
    "ve tasarım ömrü=30 yıl varsayımıyla BİREBİR eşleşiyor.",
};

export const METAL_LOSS_COEFFICIENTS: Coefficient[] = [SLC_FORMULA as Coefficient];
