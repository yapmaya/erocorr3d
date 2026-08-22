// apps/web/src/features/viewer3d/PipeViewer.tsx
//
// Ana çalışma alanının tam donanımlı 3B görüntüleyicisi (bkz. master
// görev): kamera araçları, kesit düzlemi (eksen/serbest açı/sürüklenebilir
// gizmo/yarım kesit/et kalınlığı taraması), zaman kaydırıcısı (oynatma/
// senaryo sekmeleri/duvar delinme yılı) ve ısı haritası entegrasyonu.
//
// HTML HUD panelleri (CameraToolbar/SectionPlaneControls/TimeSliderPanel)
// drei `<Html fullscreen>` İÇİNDE render edilir — `useCameraController`/
// `TimePlaybackDriver` gibi Canvas-bağımlı (`useThree`/`useFrame`) hook'lar
// SADECE Canvas'ın React-reconciler ağacı içinde çalışabildiği için, bu
// panellerin de AYNI ağaçta (Html portalı üzerinden) yaşaması gerekiyor —
// aksi halde kamera/zaman state'ini imperatif bir ref-köprüsüyle dışarı
// taşımak gerekirdi (bkz. bu dosyanın ilk taslağının terk edilen tasarımı).

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Detailed, Environment, Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Vector3 } from "three";
import { describeClockPositionTr, vToClockPosition } from "@erocorr3d/engine";
import { SectionCapPlane } from "../../components/three/SectionCapPlane";
import { DEFAULT_LENGTH_MM, DEFAULT_OUTER_DIAMETER_MM, DEFAULT_WALL_THICKNESS_MM, PipeMesh, type PipeHeatmapProps } from "./PipeMesh";
import { usePipeGeometry, type PipeGeometrySource } from "./usePipeGeometry";
import { useCameraController } from "./useCameraController";
import { CameraToolbar } from "./CameraToolbar";
import { SceneHelpers } from "./SceneHelpers";
import { useSectionPlane } from "./sectionPlane/useSectionPlane";
import { SectionPlaneControls } from "./sectionPlane/SectionPlaneControls";
import { SectionGizmo } from "./sectionPlane/SectionGizmo";
import { WallThicknessCap } from "./sectionPlane/WallThicknessCap";
import { DEMO_SCENARIOS, computeDemoBreachYear, computeDemoTimeDependentField } from "./timeSlider/demoTimeDependentField";
import { useTimePlaybackState } from "./timeSlider/useTimePlaybackState";
import { TimePlaybackDriver } from "./timeSlider/TimePlaybackDriver";
import { TimeSliderPanel } from "./timeSlider/TimeSliderPanel";
import { useDemoHotspots } from "./hotspots/useDemoHotspots";
import { buildDemoHotspotDetail, type DemoHotspotDetail } from "./hotspots/hotspotDetail";
import { HotspotMarker } from "./hotspots/HotspotMarker";
import { HotspotPanel } from "./hotspots/HotspotPanel";
import { REFERENCE_FACILITY_SCENARIO_TABS, getReferenceFacilityFixture, getReferenceFacilityScenarioAssessment } from "./referenceFacility/referenceFacilityScenarios";
import { computeReferenceFacilityBreachYears, computeReferenceFacilityHotspotsAtYears, computeReferenceFacilityTimeDependentField } from "./referenceFacility/referenceFacilityFieldSampling";
import { buildReferenceFacilityHotspotDetail } from "./referenceFacility/referenceFacilityHotspotDetail";
import { useMeasurementState } from "./measurement/useMeasurementState";
import { computeWallProbeResult } from "./measurement/measurementMath";
import { MeasurementToolbar } from "./measurement/MeasurementToolbar";
import { MeasurementOverlay } from "./measurement/MeasurementOverlay";
import { FpsCounter } from "./performance/FpsCounter";
import { ExportPanel } from "./export/ExportPanel";
import { capturePngDataUrl, downloadDataUrl } from "./export/exportPng";
import { downloadGlb, exportPipeAsGlb } from "./export/exportGltf";
import { buildShareUrl, decodeCameraStateFromParams } from "./export/cameraShareUrl";
import { ComparisonViewer } from "./comparison/ComparisonViewer";
import { useTranslation } from "../../i18n/translations";
import { useUiStore } from "../../store/uiStore";
import { useAssessmentStore } from "../../store/assessmentStore";
import { useViewer3dCaptureStore } from "../../store/viewer3dCaptureStore";

const DEFAULT_HOTSPOT_COUNT = 5;

const DESIGN_LIFE_YEARS = 20;
const HEATMAP_COLORMAP = "corrosion" as const;

// DEMO modunun (bkz. dosya başı Referans Tesis/Özel Veri notu) girdi sihirbazından
// bağımsız, sabit gösterim geometrisi — sihirbazda seçilen bileşen tipi
// yalnızca "Gerçek Veri (Referans Tesis)"/"Özel Veri" modlarında yansıtılır.
const DEFAULT_GEOMETRY_SOURCE: PipeGeometrySource = {
  componentType: "STRAIGHT_PIPE",
  odMm: DEFAULT_OUTER_DIAMETER_MM,
  wallThicknessMm: DEFAULT_WALL_THICKNESS_MM,
  idMm: DEFAULT_OUTER_DIAMETER_MM - 2 * DEFAULT_WALL_THICKNESS_MM,
  lengthMm: DEFAULT_LENGTH_MM,
  schedule: "STD",
};

export function PipeViewer() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fpsVisible, setFpsVisible] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  // "Gerçek Veri (Referans Tesis)" / "Özel Veri" modları: ısı haritası/hotspot/
  // duvar-delinme-yılı artık sentetik demo desen DEĞİL,
  // @erocorr3d/engine'in orkestrasyon katmanının (assessComponentScenario)
  // ürettiği GERÇEK hesap sonucudur — referans tesis sabit fixture'dan (bkz.
  // referenceFacility/referenceFacilityScenarios.ts), CUSTOM ise girdi sihirbazının "Hesapla"
  // eyleminden (bkz. store/assessmentStore.ts) gelir. İkisi de AYNI
  // jenerik `CaseAssessment` şeklini paylaştığından referenceFacilityFieldSampling.ts'in
  // fonksiyonları HER İKİSİ için de değişmeden yeniden kullanılır. Ölçüm
  // probu (duvar kalınlığı) bu sürümde HENÜZ bu modlara bağlanmadı —
  // bilinen sınırlama, bkz. referenceFacilityFieldSampling.ts'in dosya başı notu.
  const [dataSource, setDataSource] = useState<"DEMO" | "REFERENCE" | "CUSTOM">("DEMO");

  if (comparisonMode) {
    return <ComparisonViewer onClose={() => setComparisonMode(false)} />;
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full bg-neutral-950">
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <span>{t("viewer3dTitle")}</span>
        <button
          type="button"
          className="pointer-events-auto rounded bg-neutral-800/70 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-neutral-300 hover:bg-neutral-700"
          onClick={() => setFpsVisible((v) => !v)}
        >
          FPS
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded bg-neutral-800/70 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-neutral-300 hover:bg-neutral-700"
          onClick={() => setComparisonMode(true)}
        >
          {t("viewer3dComparisonToggle")}
        </button>
        <button
          type="button"
          className={`pointer-events-auto rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal ${
            dataSource === "REFERENCE" ? "bg-emerald-700 text-white" : "bg-neutral-800/70 text-neutral-300 hover:bg-neutral-700"
          }`}
          onClick={() => setDataSource((v) => (v === "REFERENCE" ? "DEMO" : "REFERENCE"))}
          title={dataSource === "REFERENCE" ? t("viewer3dRealDataToggleOnTitle") : t("viewer3dRealDataToggleOffTitle")}
        >
          {dataSource === "REFERENCE" ? `✓ ${t("viewer3dRealDataToggle")}` : t("viewer3dRealDataToggle")}
        </button>
        <button
          type="button"
          className={`pointer-events-auto rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal ${
            dataSource === "CUSTOM" ? "bg-sky-700 text-white" : "bg-neutral-800/70 text-neutral-300 hover:bg-neutral-700"
          }`}
          onClick={() => setDataSource((v) => (v === "CUSTOM" ? "DEMO" : "CUSTOM"))}
          title="Girdi sihirbazından hesaplanan kendi verinizi gösterir"
        >
          {dataSource === "CUSTOM" ? "✓ Özel Veri" : "Özel Veri"}
        </button>
      </div>
      {fpsVisible && <FpsCounter parentRef={wrapperRef} />}
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ stencil: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        <color attach="background" args={[theme === "dark" ? "#0a0a0a" : "#dbe1ea"]} />
        <ambientLight intensity={theme === "dark" ? 0.4 : 0.75} />
        <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <Environment preset="warehouse" />
          <SceneRoot dataSource={dataSource} />
        </Suspense>
      </Canvas>
    </div>
  );
}

interface SceneRootProps {
  dataSource: "DEMO" | "REFERENCE" | "CUSTOM";
}

function SceneRoot({ dataSource }: SceneRootProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const threeCamera = useThree((s) => s.camera);

  const [scenarioId, setScenarioId] = useState(DEMO_SCENARIOS[0].id);
  const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0];

  // ── "Gerçek Veri (Referans Tesis)" modu — bkz. PipeViewer()'ın dosya başı notu ──
  const [referenceScenarioTabId, setReferenceScenarioTabId] = useState(REFERENCE_FACILITY_SCENARIO_TABS[0].id);
  const referenceTab = REFERENCE_FACILITY_SCENARIO_TABS.find((t) => t.id === referenceScenarioTabId) ?? REFERENCE_FACILITY_SCENARIO_TABS[0];
  const referenceFixture = useMemo(() => getReferenceFacilityFixture(referenceTab.streamId), [referenceTab.streamId]);
  const referenceScenario = useMemo(() => getReferenceFacilityScenarioAssessment(referenceTab.streamId), [referenceTab.streamId]);
  const referenceCase = referenceScenario.perCase[referenceTab.caseIndex];

  // ── "Özel Veri" modu — girdi sihirbazının "Hesapla" eyleminin sonucu
  // (bkz. store/assessmentStore.ts). Referans Tesis'in AKSİNE bu veri KULLANICI
  // eylemine bağlı olarak boş olabilir (henüz hiç hesaplanmamış) — bu
  // yüzden `customCase` null olabilir, çağıran taraf DEMO'ya güvenli
  // şekilde geri düşer (bkz. aşağıdaki `isCustomReady`).
  const customAssessment = useAssessmentStore((s) => s.assessment);
  const customGeometry = useAssessmentStore((s) => s.geometry);
  const customOperatingProfile = useAssessmentStore((s) => s.operatingProfile);
  const customScenarioTabs = useMemo(
    () => (customAssessment ? customAssessment.perCase.map((c) => ({ id: c.caseName, labelTr: c.caseName })) : []),
    [customAssessment],
  );
  const [customScenarioTabId, setCustomScenarioTabId] = useState<string | null>(null);
  const customCase = customAssessment
    ? (customAssessment.perCase.find((c) => c.caseName === customScenarioTabId) ?? customAssessment.perCase[0])
    : null;

  const isReference = dataSource === "REFERENCE";
  const isCustomReady = dataSource === "CUSTOM" && customCase !== null && customGeometry !== null && customOperatingProfile !== null;

  // Görüntülenen ŞEKİL (düz boru/dirsek/te/redüksiyon/...) — Referans Tesis/Özel Veri
  // modlarında ilgili fixture/sihirbaz `componentType`'ını takip eder; bkz.
  // usePipeGeometry.ts'in dosya başı notu (önceki hata: bu hook seçilen
  // bileşen tipini HİÇ okumuyordu, HER ZAMAN düz boru çiziyordu).
  const geometrySource: PipeGeometrySource = isReference
    ? referenceFixture.geometry
    : isCustomReady && customGeometry
      ? customGeometry
      : DEFAULT_GEOMETRY_SOURCE;
  const geometryInfo = usePipeGeometry(geometrySource);
  const { geometry, outerRadiusM, innerRadiusM, lengthM } = geometryInfo;
  const targetM = useMemo<[number, number, number]>(() => [lengthM / 2, 0, 0], [lengthM]);
  const boundingRadiusM = useMemo(() => Math.sqrt((lengthM / 2) ** 2 + outerRadiusM ** 2), [lengthM, outerRadiusM]);

  const camera = useCameraController({ targetM, boundingRadiusM });
  const sectionPlane = useSectionPlane({ lengthM, outerRadiusM });

  const effectiveDesignLifeYears = isReference
    ? referenceFixture.operatingProfile.designLifeYears
    : isCustomReady && customOperatingProfile
      ? customOperatingProfile.designLifeYears
      : DESIGN_LIFE_YEARS;
  const effectiveWallThicknessMm = isReference
    ? referenceFixture.geometry.wallThicknessMm
    : isCustomReady && customGeometry
      ? customGeometry.wallThicknessMm
      : DEFAULT_WALL_THICKNESS_MM;

  const timePlayback = useTimePlaybackState({ designLifeYears: effectiveDesignLifeYears });
  // Demo↔Referans Tesis geçişinde tasarım ömrü değişir (20↔30 yıl) — mevcut elapsedYears
  // yeni üst sınırı aşıyorsa (input[type=range] görsel olarak kırpsa da state
  // kırpılmaz) bir kereliğine kırp, aksi halde ısı haritası/duvar-delinme
  // hesapları geçici olarak tutarsız bir "aralık dışı" yılla çalışır.
  useEffect(() => {
    if (timePlayback.elapsedYears > effectiveDesignLifeYears) {
      timePlayback.setElapsedYears(effectiveDesignLifeYears);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDesignLifeYears]);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  // Referans Tesis ve Özel Veri AYNI jenerik `CaseAssessment` şeklini paylaştığı için
  // (bkz. yukarıdaki dosya başı notu) tek bir `realCase` değişkeninde
  // birleştirilebilir — referenceFacilityFieldSampling.ts'in fonksiyonları İKİSİ için
  // de değişmeden çalışır.
  const realCase = isReference ? referenceCase : isCustomReady ? customCase : null;

  const breachYears = useMemo(
    () =>
      realCase
        ? computeReferenceFacilityBreachYears(realCase, effectiveWallThicknessMm, effectiveDesignLifeYears)
        : computeDemoBreachYear(DEFAULT_WALL_THICKNESS_MM, scenario),
    [realCase, effectiveWallThicknessMm, effectiveDesignLifeYears, scenario],
  );

  const heatmapValues = useMemo(
    () =>
      realCase
        ? computeReferenceFacilityTimeDependentField(geometry, realCase, timePlayback.elapsedYears, effectiveDesignLifeYears)
        : computeDemoTimeDependentField(geometry, timePlayback.elapsedYears, scenario),
    [realCase, geometry, timePlayback.elapsedYears, effectiveDesignLifeYears, scenario],
  );

  const heatmapMaxValue = realCase
    ? Math.max(realCase.spatialDamageFieldFullLife.maxValueMm, 0.05)
    : Math.max(scenario.peakRateMmPerYear * DESIGN_LIFE_YEARS * 0.6, 0.5);

  const heatmapProps: PipeHeatmapProps | null = heatmapEnabled
    ? {
        values: heatmapValues,
        colormap: HEATMAP_COLORMAP,
        minValue: 0,
        maxValue: heatmapMaxValue,
        opacity: 1,
        thresholdWarn: effectiveWallThicknessMm * 0.5,
        thresholdCritical: effectiveWallThicknessMm * 0.8,
        wallThicknessMm: effectiveWallThicknessMm,
        isoStepMm: 1,
        deformEnabled: false,
        deformExaggeration: 1,
        invertColormap: false,
      }
    : null;

  // Kapak yüzeyi HERHANGİ bir eksen/offset'te geometrinin tamamını
  // kapsayacak kadar büyük (bkz. WallThicknessCap.tsx'in kendi gerekçesi) —
  // X ekseni kesitinde SADECE et-kalınlığı halkası, Y/Z/FREE'de borunun
  // TÜM UZUNLUĞU görünür olabileceğinden ikisinin de büyük tarafı esas alınır.
  const capSizeM = Math.max(lengthM, outerRadiusM) * 2.5;
  // Varsayılan İZO kamera mesafesi ZATEN ~boundingRadiusM×4,2'dir (bkz.
  // cameraViews.ts::computeFitDistanceM, marjin 1,6/fov 45°) — bu eşik
  // AÇILIŞTA bile yanlışlıkla yer-tutucuya düşmesin diye (tarayıcıda
  // GERÇEK RENDER'da yakalanan gerçek bir hata: 2.5× çarpanı varsayılan
  // görünümün HEMEN altında kalıyordu, ısı haritası hiç görünmüyordu) bol
  // bir pay bırakır.
  const lodFarDistanceM = boundingRadiusM * 8;

  // ── Hotspot'lar (Faz 2) ──────────────────────────────────────────────
  const [hotspotsVisible, setHotspotsVisible] = useState(true);
  const [hotspotMaxCount, setHotspotMaxCount] = useState(DEFAULT_HOTSPOT_COUNT);
  const [selectedHotspotIndex, setSelectedHotspotIndex] = useState<number | null>(null);
  // React hook kuralı gereği useDemoHotspots KOŞULSUZ çağrılır (realCase mevcutken sonucu kullanılmaz).
  const demoHotspots = useDemoHotspots({ scenario, elapsedYears: timePlayback.elapsedYears, maxCount: hotspotMaxCount });
  const realHotspots = useMemo(
    () => (realCase ? computeReferenceFacilityHotspotsAtYears(realCase, timePlayback.elapsedYears, effectiveDesignLifeYears, hotspotMaxCount) : []),
    [realCase, timePlayback.elapsedYears, effectiveDesignLifeYears, hotspotMaxCount],
  );
  const hotspots = realCase ? realHotspots : demoHotspots;
  const selectedHotspot = selectedHotspotIndex !== null ? (hotspots[selectedHotspotIndex] ?? null) : null;
  const selectedHotspotDetail: DemoHotspotDetail | null = selectedHotspot
    ? realCase
      ? buildReferenceFacilityHotspotDetail(selectedHotspot, realCase, effectiveWallThicknessMm)
      : buildDemoHotspotDetail(selectedHotspot, scenario, DEFAULT_WALL_THICKNESS_MM)
    : null;

  // ── Ölçüm araçları (Faz 2) ───────────────────────────────────────────
  const measurement = useMeasurementState();
  const probeUV = useMemo(
    () => (measurement.probePoint ? geometryInfo.uvMap.pointToUV(new Vector3(...measurement.probePoint)) : null),
    [measurement.probePoint, geometryInfo.uvMap],
  );
  const probeResult = useMemo(
    () => (probeUV ? computeWallProbeResult(probeUV.u, probeUV.v, DEFAULT_WALL_THICKNESS_MM, timePlayback.elapsedYears, scenario) : null),
    [probeUV, timePlayback.elapsedYears, scenario],
  );
  const clockUV = useMemo(
    () => (measurement.clockPoint ? geometryInfo.uvMap.pointToUV(new Vector3(...measurement.clockPoint)) : null),
    [measurement.clockPoint, geometryInfo.uvMap],
  );
  const clockDescriptionTr = useMemo(() => (clockUV ? describeClockPositionTr(vToClockPosition(clockUV.v)) : null), [clockUV]);

  const handleSurfaceClick = (point: Vector3) => {
    if (measurement.mode !== "NONE") {
      measurement.handleSurfaceClick([point.x, point.y, point.z]);
    } else {
      setSelectedHotspotIndex(null);
    }
  };

  // ── Dışa aktarma (Faz 3) ─────────────────────────────────────────────
  const handleExportPng = (transparentBackground: boolean) => {
    const dataUrl = capturePngDataUrl({ gl, scene, camera: threeCamera, transparentBackground });
    downloadDataUrl(dataUrl, "erocorr3d-boru.png");
  };

  // Rapor üretimi (features/report/) Canvas ağacı DIŞINDA çalıştığı için
  // "o anki görünümü PNG olarak ver" ihtiyacını bir closure üzerinden
  // viewer3dCaptureStore'a kaydeder — bkz. o dosyanın başlık notu.
  const registerCapture = useViewer3dCaptureStore((s) => s.registerCapture);
  const unregisterCapture = useViewer3dCaptureStore((s) => s.unregisterCapture);
  useEffect(() => {
    registerCapture(() => capturePngDataUrl({ gl, scene, camera: threeCamera, transparentBackground: false }));
    return unregisterCapture;
  }, [gl, scene, threeCamera, registerCapture, unregisterCapture]);

  const handleExportGlb = () => {
    exportPipeAsGlb({
      geometry,
      damageValues: heatmapProps ? heatmapValues : null,
      minValue: heatmapProps?.minValue ?? 0,
      maxValue: heatmapProps?.maxValue ?? 1,
      colormap: HEATMAP_COLORMAP,
      invertColormap: false,
    })
      .then((buffer) => downloadGlb(buffer, "erocorr3d-boru.glb"))
      .catch((error: unknown) => {
        console.error("[EroCorr3D] GLB dışa aktarımı başarısız oldu:", error);
      });
  };

  const handleCopyShareLink = () => {
    const snapshot = camera.getCameraSnapshot();
    const url = buildShareUrl(
      { positionM: snapshot.positionM, targetM: snapshot.targetM, orthographic: camera.orthographic, zoom: snapshot.zoom },
      window.location.href,
    );
    navigator.clipboard.writeText(url).catch((error: unknown) => {
      console.error("[EroCorr3D] Kamera bağlantısı panoya kopyalanamadı:", error);
    });
  };

  // Sayfa yüklenirken URL'de paylaşılmış bir kamera durumu varsa (bkz.
  // export/cameraShareUrl.ts) BİR KEZ uygular. Tarayıcıda GERÇEK RENDER'da
  // yakalanan bir hata: mount sonrası kamera nesnesi ÖNCE bir yer tutucuya,
  // SONRA `<PerspectiveCamera makeDefault>`in kaydettiği GERÇEK kameraya
  // değişir (bkz. useCameraController.ts'in "YENİ bir kamera nesnesi
  // kaydeder" notu) — geri yükleme SADECE İLK effect çalışmasında (henüz
  // yer tutucu kamerayken) uygulanırsa, `useCameraController`in KENDİ
  // mount-effect'i hemen ardından GERÇEK kamerayı varsayılan İZO görünüme
  // döndürüp bu geri yüklemeyi SESSİZCE EZER. Çözüm: `requestAnimationFrame`
  // ile BİR KARE ertelemek — `threeCamera` her değiştiğinde ÖNCEKİ bekleyen
  // rAF iptal edilip YENİSİ kurulur, böylece SADECE kamera artık gerçekten
  // KARARLI olduğunda (son `threeCamera` değişiminden bir kare sonra) tek
  // seferlik uygulama gerçekleşir.
  const restoredFromUrlRef = useRef(false);
  useEffect(() => {
    if (restoredFromUrlRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const state = decodeCameraStateFromParams(params);
    if (!state) {
      restoredFromUrlRef.current = true;
      return;
    }
    const rafId = requestAnimationFrame(() => {
      camera.applyExplicitCamera(state.positionM, state.targetM, state.zoom);
      restoredFromUrlRef.current = true;
    });
    return () => cancelAnimationFrame(rafId);
  }, [threeCamera, camera]);

  return (
    <>
      <PerspectiveCamera makeDefault={!camera.orthographic} position={[boundingRadiusM * 1.6, boundingRadiusM, boundingRadiusM * 1.6]} fov={45} />
      <OrthographicCamera makeDefault={camera.orthographic} position={[boundingRadiusM * 1.6, boundingRadiusM, boundingRadiusM * 1.6]} zoom={40} />
      <OrbitControls ref={camera.controlsRef} makeDefault enableDamping dampingFactor={0.08} minDistance={0.05} maxDistance={boundingRadiusM * 20} />

      {/* LOD (master görev madde 8): kamera UZAKTAYKEN tam geometri+ısı-haritası
          shader'ı yerine TEK basit bir silindir çizilir — `features/valveViewer/
          ValveScene.tsx`nin ZATEN kurduğu AYNI drei `Detailed` deseni. Kesit/
          hotspot/ölçüm katmanları LOD DIŞINDA tutulur (ucuz DOM/Html öğeleri,
          uzaklıktan etkilenmezler). */}
      <Detailed distances={[0, lodFarDistanceM]}>
        <PipeMesh
          geometry={geometry}
          sectionEnabled={sectionPlane.enabled}
          sectionPlane={sectionPlane.plane}
          heatmap={heatmapProps}
          onSurfaceClick={handleSurfaceClick}
        />
        <mesh rotation={[0, 0, Math.PI / 2]} position={[lengthM / 2, 0, 0]}>
          <cylinderGeometry args={[outerRadiusM, outerRadiusM, lengthM, 12]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.6} roughness={0.5} />
        </mesh>
      </Detailed>

      {sectionPlane.enabled &&
        (sectionPlane.axis === "X" ? (
          <WallThicknessCap plane={sectionPlane.plane} outerRadiusM={outerRadiusM} innerRadiusM={innerRadiusM} capSize={capSizeM} />
        ) : (
          <SectionCapPlane plane={sectionPlane.plane} size={capSizeM} />
        ))}

      {sectionPlane.enabled && !sectionPlane.halfSectionEnabled && (
        <SectionGizmo
          normal={sectionPlane.plane.normal.toArray() as [number, number, number]}
          offsetM={sectionPlane.offsetM}
          onOffsetChange={sectionPlane.setOffsetM}
          orbitControlsRef={camera.controlsRef}
        />
      )}

      {hotspotsVisible &&
        hotspots.map((hotspot, index) => (
          <HotspotMarker
            key={index}
            hotspot={hotspot}
            positionM={geometryInfo.uvMap.uvToPoint(hotspot.u, hotspot.v, "outer")}
            rank={index + 1}
            selected={selectedHotspotIndex === index}
            onSelect={() => setSelectedHotspotIndex(index)}
          />
        ))}

      <MeasurementOverlay
        mode={measurement.mode}
        distancePoints={measurement.distancePoints}
        probePoint={measurement.probePoint}
        probeResult={probeResult}
        clockPoint={measurement.clockPoint}
        clockDescriptionTr={clockDescriptionTr}
      />

      <SceneHelpers lengthM={lengthM} />

      <TimePlaybackDriver playing={timePlayback.playing} speed={timePlayback.speed} onAdvance={timePlayback.advanceYears} />

      {/* `position={targetM}`: `Html fullscreen`in kendi -width/2/-height/2
          ortalama düzeltmesi, YALNIZCA 3B çapa noktası ekranın merkezine
          YAKIN bir yere izdüşürülüyorsa doğru kapsamayı verir (bkz. bu
          oturumda tarayıcıda GERÇEK RENDER denenip yakalanan gerçek bir hata:
          çapa varsayılan (0,0,0)=borunun BAŞLANGICINDAYKEN panel içeriği
          kısmen kırpılıyor/kayboluyordu) — kameranın ZATEN baktığı nokta
          (targetM, borunun MERKEZİ) ile aynı konum kullanılarak düzeltildi.

          `style={{pointerEvents:"none"}}` — GENERİK `style` prop'u, `pointerEvents`
          adlı ÖZEL prop DEĞİL (bkz. bu oturumda tarayıcıda yakalanan İKİNCİ gerçek
          hata: drei'nin Html.js kaynağında `pointerEvents` prop'u SADECE
          `transform=true` modunda kullanılıyor — bu projenin `transform`
          ayarlamadığı, yani VARSAYILAN `false` olan HER Html çağrısında o prop
          SESSİZCE YOK SAYILIYOR, div CSS varsayılanı olan `pointer-events:auto`da
          kalıyordu. Sonuç: bu tam-ekran panel, ALTINDAKİ TÜM canvas'ı (hotspot
          işaretçileri, OrbitControls fare tekerleği zoom'u dahil) görünmez şekilde
          tıklama/scroll'a KAPATIYORDU — çocuk panellerin kendi `pointer-events-auto`
          class'ı bunu "geri açmıyordu", zaten üst div auto olduğu için gereksizdi.
          Doğru çözüm HER YERDE `style` prop'u kullanmak — bkz. HotspotMarker.tsx/
          MeasurementOverlay.tsx'in AYNI düzeltmesi. */}
      <Html position={targetM} fullscreen style={{ pointerEvents: "none" }}>
        <CameraToolbar
          currentView={camera.currentView}
          orthographic={camera.orthographic}
          onGoToView={camera.goToView}
          onFit={camera.fitToObject}
          onReset={camera.resetView}
          onTogglePerspective={camera.togglePerspective}
        />
        <SectionPlaneControls
          enabled={sectionPlane.enabled}
          onToggleEnabled={() => sectionPlane.setEnabled((v) => !v)}
          axis={sectionPlane.axis}
          onSetAxis={sectionPlane.setAxis}
          offsetM={sectionPlane.offsetM}
          offsetRangeM={sectionPlane.offsetRangeM}
          onSetOffsetM={sectionPlane.setOffsetM}
          thetaDeg={sectionPlane.angles.thetaDeg}
          phiDeg={sectionPlane.angles.phiDeg}
          onSetThetaDeg={(thetaDeg) => sectionPlane.setAngles((prev) => ({ ...prev, thetaDeg }))}
          onSetPhiDeg={(phiDeg) => sectionPlane.setAngles((prev) => ({ ...prev, phiDeg }))}
          halfSectionEnabled={sectionPlane.halfSectionEnabled}
          onToggleHalfSection={sectionPlane.toggleHalfSection}
        />
        <HotspotPanel
          visible={hotspotsVisible}
          onToggleVisible={() => setHotspotsVisible((v) => !v)}
          maxCount={hotspotMaxCount}
          onSetMaxCount={setHotspotMaxCount}
          selectedDetail={selectedHotspotDetail}
          onCloseDetail={() => setSelectedHotspotIndex(null)}
        />
        <MeasurementToolbar mode={measurement.mode} onSetMode={measurement.setMode} />
        <ExportPanel onExportPng={handleExportPng} onExportGlb={handleExportGlb} onCopyShareLink={handleCopyShareLink} />
        <TimeSliderPanel
          elapsedYears={timePlayback.elapsedYears}
          designLifeYears={effectiveDesignLifeYears}
          onSetElapsedYears={timePlayback.setElapsedYears}
          playing={timePlayback.playing}
          onTogglePlaying={timePlayback.togglePlaying}
          speed={timePlayback.speed}
          onSetSpeed={timePlayback.setSpeed}
          breachYears={breachYears}
          scenarios={isReference ? REFERENCE_FACILITY_SCENARIO_TABS : isCustomReady ? customScenarioTabs : DEMO_SCENARIOS}
          selectedScenarioId={isReference ? referenceScenarioTabId : isCustomReady ? (customCase?.caseName ?? "") : scenarioId}
          onSelectScenario={isReference ? setReferenceScenarioTabId : isCustomReady ? setCustomScenarioTabId : setScenarioId}
          heatmapEnabled={heatmapEnabled}
          onToggleHeatmap={() => setHeatmapEnabled((v) => !v)}
        />
        {dataSource === "CUSTOM" && !isCustomReady && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded bg-amber-900/80 px-3 py-1.5 text-xs text-amber-100">
            Özel veri henüz hesaplanmadı — Girdi panelinden bir bileşen tanımlayıp &quot;Hesapla&quot;ya basın.
          </div>
        )}
      </Html>
    </>
  );
}
