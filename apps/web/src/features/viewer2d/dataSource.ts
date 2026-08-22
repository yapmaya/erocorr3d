// apps/web/src/features/viewer2d/dataSource.ts
//
// viewer2d'nin (2B tamamlayıcı görünümler) veri kaynağı hook'u. viewer3d/
// PipeViewer.tsx'in "DEMO ↔ Gerçek Veri (BOTAŞ)" desenini AYNEN izler, ama
// KENDİ bağımsız state'iyle (bkz. master görev: "tamamlayıcı" görünüm —
// bilinen sınırlama: bu panel 3B görünümle SENKRONİZE DEĞİLDİR, kendi
// senaryo/zaman seçimini taşır).
//
// TEMEL SADELEŞTİRME (matematiksel olarak KAYIPSIZ): spatial/fields.ts'in
// "hız×süre" modeli DOĞRUSAL olduğundan (bkz. spatial/timeScaling.ts::
// scaleSpatialDamageField'ın kendi notu), herhangi bir (u,v) noktasındaki
// t anındaki hasar = tasarım-ömrü-SONUNDAKİ hasar × (t/tasarım_ömrü). Bu
// yüzden bu modül yalnızca "tasarım ömrü sonundaki" bir örnekleme
// fonksiyonu tutar (sampleFullLifeMm) ve zamanı BASİT bir çarpanla uygular
// — botasFieldSampling.ts'in scaleSpatialDamageField+sampleSpatialDamageFieldMm
// çağrısıyla SAYISAL OLARAK ÖZDEŞTİR (yalnızca ara SpatialDamageField nesnesi
// oluşturmadan, doğrudan çarpar).

import { useMemo, useState } from "react";
import { sampleSpatialDamageFieldMm, vToClockPosition, type CaseAssessment, type SpatialDamageField } from "@erocorr3d/engine";
import { BOTAS_SCENARIO_TABS, getBotasFixture, getBotasScenarioAssessment } from "../viewer3d/botas/botasScenarios";
import { DEMO_SCENARIOS, computeDemoTimeDependentDamageMm, type DemoScenario } from "../viewer3d/timeSlider/demoTimeDependentField";
import { DEFAULT_LENGTH_MM, DEFAULT_OUTER_DIAMETER_MM, DEFAULT_WALL_THICKNESS_MM } from "../viewer3d/PipeMesh";
import { useAssessmentStore } from "../../store/assessmentStore";

export type Viewer2dDataSourceKind = "DEMO" | "BOTAS" | "CUSTOM";

/**
 * RadialSection/TimeSeries sekmelerinin t_min çizgisi için kullandığı
 * VARSAYILAN boru derecesi ve konum sınıfı — bu iki sekme kendi derece
 * seçicisini TAŞIMAZ (yalnızca RemainingStrengthTab tam kontrol sunar,
 * bkz. tabs/RemainingStrengthTab.tsx). Kullanıcı gerçek dereceyi
 * "Kalan Dayanım" sekmesinde değiştirebilir; buradaki varsayılan yalnızca
 * diğer sekmelerdeki t_min GÖRSEL referans çizgisi içindir.
 */
export const DEFAULT_PIPE_GRADE_ID = "api5l-l360-x52";
export const DEFAULT_LOCATION_CLASS = 1 as const;

const PA_PER_BAR = 1e5; // tanımsal SI önek dönüşümü (1 bar = 100.000 Pa) — KDP kapsamı dışı, mechanismRunners.ts ile AYNI kullanım.

// DEMO geometri/proses sabitleri — GERÇEK bir hat DEĞİLDİR (viewer3d/PipeMesh.tsx'in
// AYNI DEFAULT_* sabitleri + bu panelin kendi temsili basınç/CA/sıcaklık varsayımı,
// yalnızca B31G panelinin hesap yapabilmesi için bir mertebe sağlar).
const DEMO_DESIGN_LIFE_YEARS = 20;
const DEMO_CORROSION_ALLOWANCE_MM = 3;
const DEMO_DESIGN_PRESSURE_BARA = 70;
const DEMO_TEMPERATURE_C = 15;

export interface Viewer2dGeometryInfo {
  odMm: number;
  wallThicknessMm: number;
  lengthMm: number;
  corrosionAllowanceMm: number;
  designPressurePa: number;
  temperatureC: number;
  caseNameTr: string;
  /** DEMO modunda gerçek bir hattı TEMSİL ETMEZ — yalnızca gösterim amaçlı temsili değerlerdir. */
  isRepresentative: boolean;
}

export interface Viewer2dScenarioTab {
  id: string;
  labelTr: string;
}

export interface Viewer2dDataSource {
  dataSourceKind: Viewer2dDataSourceKind;
  setDataSourceKind: (kind: Viewer2dDataSourceKind) => void;
  isBotas: boolean;
  /** CUSTOM seçili VE girdi sihirbazında en az bir "Hesapla" çalıştırılmış mı. */
  isCustomReady: boolean;
  scenarioTabs: Viewer2dScenarioTab[];
  scenarioId: string;
  setScenarioId: (id: string) => void;
  designLifeYears: number;
  elapsedYears: number;
  setElapsedYears: (years: number) => void;
  geometry: Viewer2dGeometryInfo;
  /** Tasarım ömrü SONUNDAKİ (t=designLifeYears) hasar değeri (mm), (u,v) parametrik koordinatında — u∈[0,1) eksenel, v∈[0,1) çevresel (bkz. spatial/fields.ts::vToClockPosition). */
  sampleFullLifeMm: (u: number, v: number) => number;
  /** Şu anki (elapsedYears) hasar değeri — sampleFullLifeMm(u,v) × (elapsedYears/designLifeYears). */
  sampleMm: (u: number, v: number, elapsedYearsOverride?: number) => number;
  fullLifeMaxValueMm: number;
  peakClockPosition: number;
}

function clampFraction(elapsedYears: number, designLifeYears: number): number {
  if (designLifeYears <= 0) return 0;
  return Math.min(Math.max(elapsedYears, 0), designLifeYears) / designLifeYears;
}

/** DEMO alanının tasarım-ömrü-sonu tepe değerini KABA bir ızgara taramasıyla bulur (BOTAŞ modunda motor bunu zaten SpatialDamageField.maxValueMm olarak verir, DEMO'da böyle bir yapı yok). */
function scanDemoFullLifeMax(scenario: DemoScenario, designLifeYears: number): { maxMm: number; peakV: number } {
  const RESOLUTION_U = 48;
  const RESOLUTION_V = 32;
  let maxMm = 0;
  let peakV = 0;
  for (let iv = 0; iv < RESOLUTION_V; iv++) {
    const v = (iv + 0.5) / RESOLUTION_V;
    for (let iu = 0; iu < RESOLUTION_U; iu++) {
      const u = (iu + 0.5) / RESOLUTION_U;
      const value = computeDemoTimeDependentDamageMm(u, v, designLifeYears, scenario);
      if (value > maxMm) {
        maxMm = value;
        peakV = v;
      }
    }
  }
  return { maxMm, peakV };
}

const DEMO_SCENARIO_TABS: Viewer2dScenarioTab[] = DEMO_SCENARIOS.map((s) => ({ id: s.id, labelTr: s.labelTr }));
const BOTAS_TABS: Viewer2dScenarioTab[] = BOTAS_SCENARIO_TABS.map((t) => ({ id: t.id, labelTr: t.labelTr }));

/**
 * RemainingStrengthTab (ASME B31G) için `sampleMm`'i (mevcut elapsedYears
 * anındaki hasar) düzenli bir ızgaraya örnekleyip, `findAxialDefectExtentM`
 * (bkz. @erocorr3d/engine) gibi SpatialDamageField-şekilli girdi bekleyen
 * fonksiyonların kullanabileceği bir nesne üretir. Bu panel DEMO'da bile
 * (gerçek bir SpatialDamageField nesnesi taşımadığı için) B31G'nin kusur
 * uzunluğu çıkarımını çalıştırabilsin diye AYNI ızgara-tarama tekniğini
 * (bkz. scanDemoFullLifeMax) hem DEMO hem BOTAŞ için TEK TİP uygular —
 * BOTAŞ modunda motorun kendi (daha yüksek çözünürlüklü, 96×64) alanından
 * BİLE KASITLI olarak YENİDEN örnekler (tutarlı, mod-bağımsız bir kod yolu
 * için) — küçük bir çözünürlük kaybı pahasına (96×64 → varsayılan 96×64,
 * pratikte fark YOKTUR).
 */
export function buildSampledField(
  dataSource: Pick<Viewer2dDataSource, "sampleMm">,
  resolutionU = 96,
  resolutionV = 64,
): SpatialDamageField {
  const valuesMm = new Float32Array(resolutionU * resolutionV);
  let maxValueMm = 0;
  let maxIu = 0;
  let maxIv = 0;
  for (let iv = 0; iv < resolutionV; iv++) {
    const v = (iv + 0.5) / resolutionV;
    for (let iu = 0; iu < resolutionU; iu++) {
      const u = (iu + 0.5) / resolutionU;
      const value = dataSource.sampleMm(u, v);
      valuesMm[iv * resolutionU + iu] = value;
      if (value > maxValueMm) {
        maxValueMm = value;
        maxIu = iu;
        maxIv = iv;
      }
    }
  }
  const peakU = (maxIu + 0.5) / resolutionU;
  const peakV = (maxIv + 0.5) / resolutionV;
  const clockPosition = vToClockPosition(peakV);
  return {
    parameterization: "CYLINDRICAL_UV",
    resolutionU,
    resolutionV,
    valuesMm,
    maxValueMm,
    maxLocation: { u: peakU, v: peakV, descriptionTr: "", clockPosition },
    hotspots: [],
  };
}

export function useViewer2dDataSource(): Viewer2dDataSource {
  const [dataSourceKind, setDataSourceKind] = useState<Viewer2dDataSourceKind>("DEMO");
  const [demoScenarioId, setDemoScenarioId] = useState(DEMO_SCENARIOS[0].id);
  const [botasScenarioId, setBotasScenarioId] = useState(BOTAS_SCENARIO_TABS[0].id);
  const [elapsedYears, setElapsedYearsRaw] = useState(DEMO_DESIGN_LIFE_YEARS / 2);

  const isBotas = dataSourceKind === "BOTAS";
  const isCustom = dataSourceKind === "CUSTOM";

  const demoScenario = DEMO_SCENARIOS.find((s) => s.id === demoScenarioId) ?? DEMO_SCENARIOS[0];
  const botasTab = BOTAS_SCENARIO_TABS.find((t) => t.id === botasScenarioId) ?? BOTAS_SCENARIO_TABS[0];
  const botasFixture = useMemo(() => getBotasFixture(botasTab.streamId), [botasTab.streamId]);
  const botasScenario = useMemo(() => getBotasScenarioAssessment(botasTab.streamId), [botasTab.streamId]);
  const botasCase: CaseAssessment = botasScenario.perCase[botasTab.caseIndex];
  const botasOperatingCase = botasFixture.operatingProfile.cases[botasTab.caseIndex];

  // ── "Özel Veri" — girdi sihirbazının "Hesapla" eyleminin sonucu (bkz.
  // store/assessmentStore.ts). BOTAŞ'ın AKSİNE boş olabilir (henüz
  // hesaplanmamış) — `isCustomReady` bunu yansıtır, hazır değilken DEMO'ya
  // güvenli şekilde geri düşülür.
  const customAssessment = useAssessmentStore((s) => s.assessment);
  const customGeometry = useAssessmentStore((s) => s.geometry);
  const customOperatingProfile = useAssessmentStore((s) => s.operatingProfile);
  const [customScenarioId, setCustomScenarioId] = useState<string | null>(null);
  const customCase: CaseAssessment | null = customAssessment
    ? (customAssessment.perCase.find((c) => c.caseName === customScenarioId) ?? customAssessment.perCase[0] ?? null)
    : null;
  const isCustomReady = isCustom && customCase !== null && customGeometry !== null && customOperatingProfile !== null;
  const customOperatingCase =
    isCustomReady && customOperatingProfile
      ? (customOperatingProfile.cases.find((c) => c.name === customCase?.caseName) ?? customOperatingProfile.cases[0])
      : null;
  const customTabs: Viewer2dScenarioTab[] = customAssessment
    ? customAssessment.perCase.map((c) => ({ id: c.caseName, labelTr: c.caseName }))
    : [];

  const designLifeYears = isBotas
    ? botasFixture.operatingProfile.designLifeYears
    : isCustomReady && customOperatingProfile
      ? customOperatingProfile.designLifeYears
      : DEMO_DESIGN_LIFE_YEARS;

  const geometry: Viewer2dGeometryInfo = isBotas
    ? {
        odMm: botasFixture.geometry.odMm,
        wallThicknessMm: botasFixture.geometry.wallThicknessMm,
        lengthMm: botasFixture.geometry.lengthMm,
        corrosionAllowanceMm: botasFixture.operatingProfile.corrosionAllowanceMm,
        designPressurePa: botasOperatingCase.process.pressureBara * PA_PER_BAR,
        temperatureC: botasOperatingCase.process.temperatureC,
        caseNameTr: botasCase.caseName,
        isRepresentative: false,
      }
    : isCustomReady && customGeometry && customOperatingProfile && customOperatingCase
      ? {
          odMm: customGeometry.odMm,
          wallThicknessMm: customGeometry.wallThicknessMm,
          lengthMm: customGeometry.lengthMm,
          corrosionAllowanceMm: customOperatingProfile.corrosionAllowanceMm,
          designPressurePa: customOperatingCase.process.pressureBara * PA_PER_BAR,
          temperatureC: customOperatingCase.process.temperatureC,
          caseNameTr: customCase?.caseName ?? "",
          isRepresentative: false,
        }
      : {
          odMm: DEFAULT_OUTER_DIAMETER_MM,
          wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
          lengthMm: DEFAULT_LENGTH_MM,
          corrosionAllowanceMm: DEMO_CORROSION_ALLOWANCE_MM,
          designPressurePa: DEMO_DESIGN_PRESSURE_BARA * PA_PER_BAR,
          temperatureC: DEMO_TEMPERATURE_C,
          caseNameTr: demoScenario.labelTr,
          isRepresentative: true,
        };

  const realCase = isBotas ? botasCase : isCustomReady ? customCase : null;

  const sampleFullLifeMm = useMemo(() => {
    if (realCase) {
      const field = realCase.spatialDamageFieldFullLife;
      return (u: number, v: number) => sampleSpatialDamageFieldMm(field, u, v);
    }
    return (u: number, v: number) => computeDemoTimeDependentDamageMm(u, v, designLifeYears, demoScenario);
  }, [realCase, demoScenario, designLifeYears]);

  const sampleMm = useMemo(
    () => (u: number, v: number, elapsedYearsOverride?: number) => {
      const years = elapsedYearsOverride ?? elapsedYears;
      const fraction = clampFraction(years, designLifeYears);
      return sampleFullLifeMm(u, v) * (designLifeYears <= 0 ? 0 : fraction);
    },
    [sampleFullLifeMm, elapsedYears, designLifeYears],
  );

  const { fullLifeMaxValueMm, peakClockPosition } = useMemo(() => {
    if (realCase) {
      const field = realCase.spatialDamageFieldFullLife;
      return { fullLifeMaxValueMm: field.maxValueMm, peakClockPosition: field.maxLocation.clockPosition };
    }
    const { maxMm, peakV } = scanDemoFullLifeMax(demoScenario, designLifeYears);
    return { fullLifeMaxValueMm: maxMm, peakClockPosition: vToClockPosition(peakV) };
  }, [realCase, demoScenario, designLifeYears]);

  const setElapsedYears = (years: number) => setElapsedYearsRaw(Math.min(Math.max(years, 0), designLifeYears));

  return {
    dataSourceKind,
    setDataSourceKind: (kind) => {
      setDataSourceKind(kind);
      const nextDesignLife =
        kind === "BOTAS"
          ? botasFixture.operatingProfile.designLifeYears
          : kind === "CUSTOM" && customOperatingProfile
            ? customOperatingProfile.designLifeYears
            : DEMO_DESIGN_LIFE_YEARS;
      setElapsedYearsRaw((prev) => Math.min(prev, nextDesignLife));
    },
    isBotas,
    isCustomReady,
    scenarioTabs: isBotas ? BOTAS_TABS : isCustom ? customTabs : DEMO_SCENARIO_TABS,
    scenarioId: isBotas ? botasScenarioId : isCustom ? (customScenarioId ?? customTabs[0]?.id ?? "") : demoScenarioId,
    setScenarioId: isBotas ? setBotasScenarioId : isCustom ? setCustomScenarioId : setDemoScenarioId,
    designLifeYears,
    elapsedYears,
    setElapsedYears,
    geometry,
    sampleFullLifeMm,
    sampleMm,
    fullLifeMaxValueMm,
    peakClockPosition,
  };
}
