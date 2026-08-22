// packages/engine/src/registry/coefficients/cui.ts
//
// İzolasyon altı korozyonu (CUI) — API RP 571 §4.3.3'ün (data/mechanisms.ts::
// CUI girdisinin AYNI kaynağı, HIGH confidence, tam metin bu projede daha
// önce okunmuştu) sıcaklık penceresi sayısal/yapılandırılmış forma getirildi.

import type { Coefficient, Source } from "../types";

const MODULE = "cui";

const SRC_API571: Source = {
  type: "STANDARD",
  citation:
    "API Recommended Practice 571, 1. baskı (Nisan 2011), §4.3.3 \"Corrosion Under Insulation (CUI)\" — " +
    "karbon/düşük alaşımlı çelik için -12°C (10°F) ile 175°C (350°F), östenitik/duplex paslanmaz çelik için " +
    "60°C (140°F) ile 205°C (400°F) İŞLETME sıcaklık aralığı en risklidir; 100-121°C (212-250°F) arası " +
    "özellikle riskli (su buharlaşmadan uzun süre ıslak kalır). Bu proje daha önce (data/mechanisms.ts::CUI) " +
    "bu belgenin tam metnini doğrudan okumuştu.",
  url: "https://usercontent.one/wp/www.ing-hti.no/wp-content/uploads/2023/08/API-RP-571-Damage-Mechanisms-Affecting-Refining-Industry_april-2011.pdf",
  accessedDate: "2026-08-11",
};

export interface CuiTemperatureWindow {
  carbonSteelMinC: number;
  carbonSteelMaxC: number;
  stainlessMinC: number;
  stainlessMaxC: number;
  worstCaseMinC: number;
  worstCaseMaxC: number;
}

const TEMPERATURE_WINDOW: Coefficient<CuiTemperatureWindow> = {
  id: "cui.temperatureWindow",
  module: MODULE,
  value: {
    carbonSteelMinC: -12,
    carbonSteelMaxC: 175,
    stainlessMinC: 60,
    stainlessMaxC: 205,
    worstCaseMinC: 100,
    worstCaseMaxC: 121,
  },
  unit: "°C",
  description: "CUI için riskli işletme sıcaklığı penceresi (malzeme ailesine göre) ve en riskli alt-bant.",
  source: SRC_API571,
  crossChecked: false,
  crossCheckSources: [],
  confidence: "HIGH",
  notes: "API 571 §4.3.3'ten DOĞRUDAN okundu, °F→°C dönüşümleri kaynağın kendi ikili (dual-unit) gösterimiyle birebir eşleşiyor.",
};

export const CUI_COEFFICIENTS: Coefficient[] = [TEMPERATURE_WINDOW as Coefficient];
