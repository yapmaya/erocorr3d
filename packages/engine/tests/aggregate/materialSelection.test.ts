// packages/engine/tests/aggregate/materialSelection.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import {
  assessCoastalCoatingRequirement,
  assessIsolationKitRequirement,
  assessSourServiceMaterialRequirement,
  getBoltingRecommendation,
  selectAirCooledHeatExchangerMaterial,
  selectHeatExchangerMaterial,
  selectMinDesignTempMaterial,
  selectPipingMaterial,
  selectPressureVesselMaterial,
  selectShellAndTubeHeatExchangerMaterial,
  selectStorageTankMaterial,
} from "../../src/aggregate/materialSelection";
import type { CustomMaterial } from "../../src/types/customMaterial";

// ═══════════════════════════════════════════════════════════════════════
// §10.3.2 Piping — KARAR MERDİVENİNİN HER SINIR DEĞERİ (görev tanımının
// kendi istediği CA=1.49/1.50/2.99/3.00/5.99/6.00/6.01 seti)
// ═══════════════════════════════════════════════════════════════════════
describe("selectPipingMaterial — §10.3.2 CA merdiveni sınır değerleri", () => {
  const cases: [number, string][] = [
    [1.49, "1,5mm"],
    [1.50, "1,5mm"], // sınırda dahil — 1,5mm CA tam olarak 1,50mm ihtiyacı karşılar
    [2.99, "3,0mm"],
    [3.00, "3,0mm"], // sınırda dahil
    [5.99, "6,0mm"],
    [6.00, "6,0mm"], // sınırda dahil
    [6.01, "CRA"], // sınırın hemen üstü — CRA'ya geçer
  ];

  for (const [ca, expectedFragment] of cases) {
    it(`CA=${ca}mm → malzeme adı "${expectedFragment}" içerir`, () => {
      const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: ca, inServiceInspectionPossible: false });
      expect(result.primaryMaterialTr).toContain(expectedFragment);
    });
  }

  it("CA=6.01mm CRA gerektirir ve intergranular korozyon testi ek şart olarak listelenir", () => {
    const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: 6.01, inServiceInspectionPossible: false });
    expect(result.additionalRequirementsTr.some((r) => r.includes("Intergranular"))).toBe(true);
  });

  it("3-6mm bandında servis içi muayene mümkünse birincil öneri 3,0mm CA'lı CS olur", () => {
    const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4.5, inServiceInspectionPossible: true });
    expect(result.primaryMaterialTr).toContain("3,0mm");
    expect(result.alternativeMaterialsTr.some((a) => a.includes("6,0mm"))).toBe(true);
  });

  it("3-6mm bandında muayene mümkün DEĞİLSE 6,0mm CA'lı CS kullanılır", () => {
    const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4.5, inServiceInspectionPossible: false });
    expect(result.primaryMaterialTr).toContain("6,0mm");
  });

  it("negatif CA için hata fırlatır", () => {
    expect(() => selectPipingMaterial({ requiredCorrosionAllowanceMm: -1, inServiceInspectionPossible: false })).toThrowError();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.1 Minimum tasarım sıcaklığı merdiveni
// ═══════════════════════════════════════════════════════════════════════
describe("selectMinDesignTempMaterial", () => {
  it("-29°C ve üzeri → CS", () => {
    expect(selectMinDesignTempMaterial(-29).materialFamily).toBe("CS");
    expect(selectMinDesignTempMaterial(20).materialFamily).toBe("CS");
  });

  it("-45°C ile -29°C arası (üst hariç) → LTCS", () => {
    expect(selectMinDesignTempMaterial(-30).materialFamily).toBe("LTCS");
    expect(selectMinDesignTempMaterial(-45).materialFamily).toBe("LTCS");
  });

  it("-100°C ile -46°C arası → 316L kaplı veya 3½Ni", () => {
    expect(selectMinDesignTempMaterial(-46).materialFamily).toBe("SS316L_COATED_OR_35NI");
    expect(selectMinDesignTempMaterial(-100).materialFamily).toBe("SS316L_COATED_OR_35NI");
  });

  it("-100°C altı → CRA", () => {
    expect(selectMinDesignTempMaterial(-150).materialFamily).toBe("CRA");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.3 Pressure Vessel
// ═══════════════════════════════════════════════════════════════════════
describe("selectPressureVesselMaterial", () => {
  it("CA<3mm → CRA/astar gerekmez", () => {
    const result = selectPressureVesselMaterial({ requiredCorrosionAllowanceMm: 2, operatingTemperatureC: 40, operatingPressureBarg: 20 });
    expect(result.primaryMaterialTr).toContain("3,0mm");
    expect(result.alternativeMaterialsTr.length).toBe(0);
  });

  it("3-6mm bandı + ılıman koşul (T<60°C, P<50barg) → organik astar", () => {
    const result = selectPressureVesselMaterial({ requiredCorrosionAllowanceMm: 4, operatingTemperatureC: 40, operatingPressureBarg: 20 });
    expect(result.primaryMaterialTr).toContain("astar");
  });

  it("3-6mm bandı + şiddetli koşul (T≥60°C veya P≥50barg) → CRA kaplama/dolu CRA", () => {
    const highTemp = selectPressureVesselMaterial({ requiredCorrosionAllowanceMm: 4, operatingTemperatureC: 65, operatingPressureBarg: 20 });
    const highPressure = selectPressureVesselMaterial({ requiredCorrosionAllowanceMm: 4, operatingTemperatureC: 40, operatingPressureBarg: 60 });
    expect(highTemp.primaryMaterialTr).toContain("CRA");
    expect(highPressure.primaryMaterialTr).toContain("CRA");
    expect(highTemp.validityWarnings.length).toBeGreaterThan(0);
  });

  it("negatif CA için hata fırlatır", () => {
    expect(() => selectPressureVesselMaterial({ requiredCorrosionAllowanceMm: -1, operatingTemperatureC: 40, operatingPressureBarg: 20 })).toThrowError();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.4 Heat Exchanger (genel)
// ═══════════════════════════════════════════════════════════════════════
describe("selectHeatExchangerMaterial", () => {
  it("akış yeterince korozif değilse CS önerilir", () => {
    expect(selectHeatExchangerMaterial(true).primaryMaterialTr).toContain("Karbon Çelik");
  });

  it("akış korozifse CRA önerilir", () => {
    expect(selectHeatExchangerMaterial(false).primaryMaterialTr).toContain("CRA");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.5 Air Cooled Heat Exchanger
// ═══════════════════════════════════════════════════════════════════════
describe("selectAirCooledHeatExchangerMaterial", () => {
  it("başlık CA≤3mm → CS+3mm", () => {
    const result = selectAirCooledHeatExchangerMaterial(2, 1);
    expect(result.headerMaterialTr).toContain("3,0mm");
  });

  it("başlık CA>3mm → azami 6mm'e kadar CS (veya CRA kaplamalı alternatif)", () => {
    const result = selectAirCooledHeatExchangerMaterial(4, 1);
    expect(result.headerMaterialTr).toContain("6,0mm");
    expect(result.alternativeMaterialsTr.some((a) => a.includes("CRA"))).toBe(true);
  });

  it("başlık CA>6mm → uyarı üretir", () => {
    const result = selectAirCooledHeatExchangerMaterial(7, 1);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });

  it("tüp CA≤1.5mm → CS tüpler", () => {
    expect(selectAirCooledHeatExchangerMaterial(2, 1).tubeMaterialTr).toContain("Karbon Çelik");
  });

  it("tüp CA>1.5mm → dolu CRA tüpler ZORUNLU", () => {
    expect(selectAirCooledHeatExchangerMaterial(2, 2).tubeMaterialTr).toContain("CRA");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.6 Shell and Tube Heat Exchanger
// ═══════════════════════════════════════════════════════════════════════
describe("selectShellAndTubeHeatExchangerMaterial", () => {
  it("her ikisi de <3mm → her ikisi de CS", () => {
    const result = selectShellAndTubeHeatExchangerMaterial(2, 1);
    expect(result.shellMaterialTr).toContain("Karbon Çelik");
    expect(result.tubeMaterialTr).toContain("Karbon Çelik");
  });

  it("tüp CA>1.5mm → CRA tüp + tüp levhası ZORUNLU", () => {
    expect(selectShellAndTubeHeatExchangerMaterial(2, 2).tubeMaterialTr).toContain("CRA");
  });

  it("gövde CA>6mm → CRA/CRA-clad gövde", () => {
    expect(selectShellAndTubeHeatExchangerMaterial(7, 1).shellMaterialTr).toContain("CRA");
  });

  it("gövde 3-6mm arası → CS+6mm gövde", () => {
    expect(selectShellAndTubeHeatExchangerMaterial(4, 1).shellMaterialTr).toContain("6,0mm");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10.3.7 Storage Tank
// ═══════════════════════════════════════════════════════════════════════
describe("selectStorageTankMaterial", () => {
  it("standart koşulda (iz su + kuru gaz örtülü) CS+3mm önerir, uyarı vermez", () => {
    const result = selectStorageTankMaterial(true, true);
    expect(result.primaryMaterialTr).toContain("3,0mm");
    expect(result.validityWarnings.length).toBe(0);
  });

  it("standart-dışı koşulda uyarı verir", () => {
    const result = selectStorageTankMaterial(false, true);
    expect(result.validityWarnings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Çapraz-kesen kontroller
// ═══════════════════════════════════════════════════════════════════════
describe("assessCoastalCoatingRequirement", () => {
  it("kıyı eşiği (16km) dışındaysa kaplama gerekmez", () => {
    const result = assessCoastalCoatingRequirement(50, 70, "SS316L");
    expect(result.isCoastal).toBe(false);
    expect(result.coatingRequired).toBe(false);
  });

  it("kıyıda + 316L + Top≥50°C (Tablo 8-1 eşiği) → kaplama ZORUNLU", () => {
    const result = assessCoastalCoatingRequirement(10, 55, "SS316L");
    expect(result.isCoastal).toBe(true);
    expect(result.coatingRequired).toBe(true);
  });

  it("kıyıda + 316L + Top<50°C → kaplama gerekmez", () => {
    expect(assessCoastalCoatingRequirement(10, 30, "SS316L").coatingRequired).toBe(false);
  });

  it("CRA seçilmemişse (null) her zaman false döner", () => {
    expect(assessCoastalCoatingRequirement(1, 200, null).coatingRequired).toBe(false);
  });
});

describe("assessIsolationKitRequirement", () => {
  it("CRA-CS birleşimi varsa izolasyon kiti gerekir", () => {
    expect(assessIsolationKitRequirement(true).required).toBe(true);
  });

  it("birleşim yoksa gerekmez", () => {
    expect(assessIsolationKitRequirement(false).required).toBe(false);
  });
});

describe("assessSourServiceMaterialRequirement", () => {
  it("H2S yoksa sour servis değildir", () => {
    expect(assessSourServiceMaterialRequirement(0, 5).isSourService).toBe(false);
  });

  it("belirgin H2S + orta pH → sour servis, ISO 15156 uyumlu malzeme gerektirir", () => {
    const result = assessSourServiceMaterialRequirement(5, 5);
    expect(result.isSourService).toBe(true);
    expect(result.rationaleTr).toContain("ISO 15156");
  });

  it("uygun olmayan sertlikte aday malzeme UYGUN DEĞİL olarak işaretlenir", () => {
    const result = assessSourServiceMaterialRequirement(5, 5, 30);
    expect(result.isoCompliant).toBe(false);
  });

  it("uygun sertlikte aday malzeme UYGUN olarak işaretlenir", () => {
    const result = assessSourServiceMaterialRequirement(5, 5, 18);
    expect(result.isoCompliant).toBe(true);
  });
});

describe("getBoltingRecommendation", () => {
  it("CS boru, -30°C (>-40°C) → standart A193 B7", () => {
    const result = getBoltingRecommendation(-30, "CS_LAS", false);
    expect(result.boltsStandard).toContain("B7");
    expect(result.boltsStandard).not.toContain("B7M");
  });

  it("CS boru, -45°C (<-40°C, >-48°C, katodik korumalı) → A193 B7M", () => {
    const result = getBoltingRecommendation(-45, "CS_LAS", true);
    expect(result.boltsStandard).toContain("B7M");
  });

  it("316L boru, -80°C (<-73°C, >-101°C) → A320 L7", () => {
    const result = getBoltingRecommendation(-80, "SS316L", false);
    expect(result.boltsStandard).toContain("L7");
  });

  it("316L boru, -60°C (>-73°C, katodik korumalı) → A320 L7M", () => {
    const result = getBoltingRecommendation(-60, "SS316L", true);
    expect(result.boltsStandard).toContain("L7M");
  });
});

describe("materialSelection — KDP kayıt defteri entegrasyonu", () => {
  it("piping CA merdiveni ve bolting tablosu UNVERIFIED confidence taşır (kimliği anonim iç proje dokümanı)", () => {
    const pipingEntry = listCoefficients().find((c) => c.id === "materialSelection.pipingCaLadder");
    const boltingEntry = listCoefficients().find((c) => c.id === "materialSelection.boltingTable");
    expect(pipingEntry?.confidence).toBe("UNVERIFIED");
    expect(boltingEntry?.confidence).toBe("UNVERIFIED");
    expect(pipingEntry?.source.type).toBe("PROJECT_DOCUMENT");
  });

  it("kıyı mesafesi eşiği anonim iç proje dokümanına dayandığı için UNVERIFIED confidence taşır", () => {
    const entry = listCoefficients().find((c) => c.id === "materialSelection.coastalDistanceThresholdKm");
    expect(entry?.confidence).toBe("UNVERIFIED");
  });
});

describe("selectPipingMaterial — customMaterials (kullanıcı tanımlı alternatifler)", () => {
  const customMaterial: CustomMaterial = {
    id: "custom-1",
    nameTr: "Özel Alaşım X",
    notesTr: "Tedarikçi verisi",
    sourceNoteTr: "Tedarikçi X'in 2024 test raporu (bağımsız doğrulanmadı)",
    minRequiredCaMm: 3,
    maxRequiredCaMm: 6,
    relativeCostIndex: 4.2,
  };

  it("parametre verilmezse davranış AYNI kalır (geriye dönük uyumlu)", () => {
    const withoutParam = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4, inServiceInspectionPossible: false });
    const withEmptyArray = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4, inServiceInspectionPossible: false }, []);
    expect(withoutParam).toEqual(withEmptyArray);
  });

  it("gerekli CA aralığına uyan kullanıcı malzemesi 'doğrulanmamış' etiketiyle alternatiflere eklenir", () => {
    const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4, inServiceInspectionPossible: false }, [customMaterial]);
    const match = result.alternativeMaterialsTr.find((a) => a.includes("Özel Alaşım X"));
    expect(match).toBeDefined();
    expect(match).toContain("Kullanıcı Tanımlı");
    expect(match).toContain("doğrulanmamış");
  });

  it("gerekli CA aralığının DIŞINDAKİ kullanıcı malzemesi eklenmez", () => {
    const result = selectPipingMaterial({ requiredCorrosionAllowanceMm: 1, inServiceInspectionPossible: false }, [customMaterial]);
    expect(result.alternativeMaterialsTr.some((a) => a.includes("Özel Alaşım X"))).toBe(false);
  });

  it("kullanıcı malzemesi birincil öneriyi VEYA confidence'ı DEĞİŞTİRMEZ", () => {
    const withoutCustom = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4, inServiceInspectionPossible: false });
    const withCustom = selectPipingMaterial({ requiredCorrosionAllowanceMm: 4, inServiceInspectionPossible: false }, [customMaterial]);
    expect(withCustom.primaryMaterialTr).toBe(withoutCustom.primaryMaterialTr);
    expect(withCustom.confidence).toBe(withoutCustom.confidence);
    expect(withCustom.sourcesUsed).toEqual(withoutCustom.sourcesUsed);
  });
});
