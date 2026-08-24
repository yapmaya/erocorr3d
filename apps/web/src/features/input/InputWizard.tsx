// apps/web/src/features/input/InputWizard.tsx
//
// Girdi sihirbazının kök bileşeni — TEK react-hook-form örneği
// (`WizardDraftSchema` + zod resolver, bkz. schema.ts'in mimari notu),
// 8 adımlık yönlendirme, otomatik kayıt (persistence/useAutosave.ts) ve
// "Hesapla" eylemi (computeAssessment.ts → useAssessmentStore →
// viewer3d/viewer2d/ResultsPanel'in "ÖZEL" veri kaynağı, bkz. PipeViewer.tsx).

import { useEffect, useState } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WizardDraftSchema, WIZARD_STEPS, type WizardDraft } from "./schema";
import { createBlankDraft } from "./defaultDraft";
import { computeAssessment } from "./computeAssessment";
import { useAssessmentStore } from "../../store/assessmentStore";
import { useUiStore } from "../../store/uiStore";
import { useAutosave } from "./persistence/useAutosave";
import { isEditableTarget, matchShortcut } from "../shortcuts/matchShortcut";
import { StepperNav } from "./components/StepperNav";
import { ColumnMappingWizard } from "./importExcel/ColumnMappingWizard";
import { Step1ComponentSelect } from "./steps/Step1ComponentSelect";
import { Step2Geometry } from "./steps/Step2Geometry";
import { Step3ProcessConditions } from "./steps/Step3ProcessConditions";
import { Step4FluidChemistry } from "./steps/Step4FluidChemistry";
import { Step5Solids } from "./steps/Step5Solids";
import { Step6ProtectionOperation } from "./steps/Step6ProtectionOperation";
import { Step7OperatingScenarios } from "./steps/Step7OperatingScenarios";
import { Step8Uncertainty } from "./steps/Step8Uncertainty";

function InputWizardInner() {
  const form = useFormContext<WizardDraft>();
  const { control, setValue, getValues, trigger } = form;
  const activeStep = useWatch({ control, name: "activeStep" });
  const category = useWatch({ control, name: "componentCategory" });
  const valveGeometry = useWatch({ control, name: "valveGeometry" });
  const unitSystem = useUiStore((s) => s.unitSystem);
  const setUnitSystem = useUiStore((s) => s.setUnitSystem);
  const restoreStatus = useAutosave(form);
  const assessmentStatus = useAssessmentStore((s) => s.status);
  const assessmentError = useAssessmentStore((s) => s.errorMessageTr);
  const [isImportOpen, setImportOpen] = useState(false);
  const [computeMessage, setComputeMessage] = useState<string | null>(null);

  // valveGeometry, kategori=VALVE iken TÜM Geometry alanlarını içerir (bkz.
  // schema.ts'in mimari notu) — ortak alt-küme `geometry`'ye senkron edilir
  // ki önizleme/motor girdisi TEK bir yerden (geometry) okunabilsin.
  useEffect(() => {
    if (category !== "VALVE" || !valveGeometry) return;
    const {
      pressureClass: _pressureClass,
      bodyStyle: _bodyStyle,
      trimType: _trimType,
      seatMaterial: _seatMaterial,
      trimMaterial: _trimMaterial,
      cvRated: _cvRated,
      flFactor: _flFactor,
      xtFactor: _xtFactor,
      kcFactor: _kcFactor,
      openingPercent: _openingPercent,
      flowDirection: _flowDirection,
      stemType: _stemType,
      packingType: _packingType,
      bodyCavityVolumeMl: _bodyCavityVolumeMl,
      ...geometryFields
    } = valveGeometry;
    setValue("geometry", geometryFields, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, valveGeometry]);

  const goToStep = (step: number) => setValue("activeStep", Math.min(Math.max(step, 1), WIZARD_STEPS.length));
  const goNext = () => goToStep(activeStep + 1);
  const goPrev = () => goToStep(activeStep - 1);

  const handleCompute = async () => {
    const isValid = await trigger();
    if (!isValid) {
      setComputeMessage("Formda doğrulama hataları var — kırmızı işaretli alanları düzeltin.");
      return;
    }
    const draft = getValues();
    const result = computeAssessment(draft);
    setComputeMessage(
      result.ok
        ? 'Hesaplandı — 3B görüntüleyicide ve Sonuçlar panelinde "Özel Veri" kaynağına geçerek görüntüleyin.'
        : result.messageTr,
    );
  };

  // Ctrl/Cmd+Enter — bkz. features/shortcuts/matchShortcut.ts. Odak bir
  // metin girdisinde OLSA BİLE tetiklenir (modifiye tuşu formu bozmaz).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (matchShortcut(e, isEditableTarget(e.target)) === "CALCULATE") {
        e.preventDefault();
        void handleCompute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTitle = WIZARD_STEPS.find((s) => s.step === activeStep)?.titleTr ?? "";
  const activeCaseIndex = getValues("activeCaseIndex");
  const cases = getValues("operatingProfile.cases");
  const baseCase = cases[activeCaseIndex] ?? cases[0];

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto bg-white p-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Girdi Sihirbazı</h2>
        <div className="flex gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setUnitSystem("SI")}
            className={`rounded px-1.5 py-0.5 ${unitSystem === "SI" ? "bg-sky-600 text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}
          >
            SI
          </button>
          <button
            type="button"
            onClick={() => setUnitSystem("IMPERIAL")}
            className={`rounded px-1.5 py-0.5 ${unitSystem === "IMPERIAL" ? "bg-sky-600 text-white" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}
          >
            Imperial
          </button>
        </div>
      </div>

      {restoreStatus === "RESTORED" && (
        <div className="rounded border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Kaldığınız yerden devam ediyorsunuz (otomatik kayıtlı taslak yüklendi).
        </div>
      )}

      <StepperNav activeStep={activeStep} onSelect={goToStep} />
      <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{currentTitle}</h3>

      {activeStep === 1 && <Step1ComponentSelect onNext={goNext} />}
      {activeStep === 2 && <Step2Geometry onNext={goNext} onPrev={goPrev} />}
      {activeStep === 3 && <Step3ProcessConditions onNext={goNext} onPrev={goPrev} />}
      {activeStep === 4 && <Step4FluidChemistry onNext={goNext} onPrev={goPrev} />}
      {activeStep === 5 && <Step5Solids onNext={goNext} onPrev={goPrev} />}
      {activeStep === 6 && <Step6ProtectionOperation onNext={goNext} onPrev={goPrev} />}
      {activeStep === 7 && (
        <Step7OperatingScenarios
          onNext={goNext}
          onPrev={goPrev}
          onEditCase={(caseIndex) => {
            setValue("activeCaseIndex", caseIndex);
            goToStep(3);
          }}
          onImportClick={() => setImportOpen(true)}
        />
      )}
      {activeStep === 8 && <Step8Uncertainty onPrev={goPrev} />}

      <div className="sticky bottom-0 mt-2 border-t border-neutral-200 bg-white pt-2 dark:border-neutral-800 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => void handleCompute()}
          className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Hesapla
        </button>
        {computeMessage && (
          <div
            className={`mt-1 text-[11px] ${
              assessmentStatus === "COMPUTED" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {computeMessage}
          </div>
        )}
        {assessmentStatus === "ERROR" && assessmentError && !computeMessage && (
          <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">{assessmentError}</div>
        )}
      </div>

      <ColumnMappingWizard
        isOpen={isImportOpen}
        onClose={() => setImportOpen(false)}
        baseCase={baseCase}
        onImport={(importedCases, mode) => {
          if (mode === "REPLACE") {
            setValue("operatingProfile.cases", importedCases, { shouldValidate: true, shouldDirty: true });
          } else {
            setValue("operatingProfile.cases", [...getValues("operatingProfile.cases"), ...importedCases], {
              shouldValidate: true,
              shouldDirty: true,
            });
          }
        }}
      />
    </div>
  );
}

export function InputWizard() {
  const form = useForm<WizardDraft>({
    resolver: zodResolver(WizardDraftSchema),
    defaultValues: createBlankDraft(),
    mode: "onBlur",
  });

  return (
    <FormProvider {...form}>
      <InputWizardInner />
    </FormProvider>
  );
}
