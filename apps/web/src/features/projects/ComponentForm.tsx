// apps/web/src/features/projects/ComponentForm.tsx
//
// Proje bileşeni formu — InputWizard'a DOKUNMAZ, TAMAMEN AYRI bir bileşen
// ağacıdır (onaylı plan'ın kararı). Ama InputWizard'ın 8 adım BÖLÜM
// bileşenini (Step1ComponentSelect..Step8Uncertainty, hepsi `WizardDraft`
// form context'ine bağlı ve `onNext`/`onPrev`'i OPSİYONEL alıyor — bkz. o
// dosyaların StepProps tanımı) DOĞRUDAN YENİDEN KULLANIR: `StepperNav`'ı
// adım-geçitleme OLMADAN, serbest sekme olarak kullanır — "basitleştirilmiş"
// (lineer zorunluluk yok) + "ayrı form" isteğinin karşılığı budur.

import { useState } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WizardDraftSchema, WIZARD_STEPS, type WizardDraft } from "../input/schema";
import { createBlankDraft } from "../input/defaultDraft";
import { computeAssessment } from "../input/computeAssessment";
import { StepperNav } from "../input/components/StepperNav";
import { ColumnMappingWizard } from "../input/importExcel/ColumnMappingWizard";
import { Step1ComponentSelect } from "../input/steps/Step1ComponentSelect";
import { Step2Geometry } from "../input/steps/Step2Geometry";
import { Step3ProcessConditions } from "../input/steps/Step3ProcessConditions";
import { Step4FluidChemistry } from "../input/steps/Step4FluidChemistry";
import { Step5Solids } from "../input/steps/Step5Solids";
import { Step6ProtectionOperation } from "../input/steps/Step6ProtectionOperation";
import { Step7OperatingScenarios } from "../input/steps/Step7OperatingScenarios";
import { Step8Uncertainty } from "../input/steps/Step8Uncertainty";
import { useProjectsStore } from "../../store/projectsStore";
import { persistAssessmentRun } from "./persistAssessmentRun";
import type { ProjectComponentRecord } from "./types";

export interface ComponentFormProps {
  projectId: string;
  /** Düzenlenecek mevcut bileşen — verilmezse boş/yeni bir bileşen taslağıyla başlar. */
  existing: ProjectComponentRecord | null;
  onClose: () => void;
}

function ComponentFormInner({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const form = useFormContext<WizardDraft>();
  const { control, setValue, getValues, trigger } = form;
  const activeStep = useWatch({ control, name: "activeStep" });
  const [isImportOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // `addComponent` Dexie `put()` (id'ye göre EKLE veya ÜZERİNE YAZ) kullanır —
  // hem YENİ hem MEVCUT bir bileşeni kaydetmek için AYNI çağrı yeterlidir
  // (`draft.id`, düzenleme modunda `existing.id`'yi KORUR, bkz. ComponentForm's
  // defaultValues).
  const addComponent = useProjectsStore((s) => s.addComponent);

  const goToStep = (step: number) => setValue("activeStep", Math.min(Math.max(step, 1), WIZARD_STEPS.length));

  const handleSave = async () => {
    const isValid = await trigger();
    if (!isValid) {
      setMessage("Formda doğrulama hataları var — kırmızı işaretli alanları düzeltin.");
      return;
    }
    setIsSaving(true);
    const draft = getValues();
    await addComponent({ ...draft, updatedAt: Date.now() });
    setIsSaving(false);
    setMessage("Bileşen kaydedildi.");
  };

  const handleCompute = async () => {
    const isValid = await trigger();
    if (!isValid) {
      setMessage("Formda doğrulama hataları var — kırmızı işaretli alanları düzeltin.");
      return;
    }
    setIsSaving(true);
    const draft = getValues();
    await addComponent(draft); // Hesapla ÖNCESİ bileşeni de kaydeder (kaydedilmemiş bir bileşenin çalıştırma geçmişi olamaz).
    const liveResult = computeAssessment(draft); // Canlı 3B/2B görünüm — DEĞİŞTİRİLMEDEN.
    const persistResult = await persistAssessmentRun(projectId, draft.id, draft); // Kalıcı AssessmentRunRecord.
    setIsSaving(false);
    if (!persistResult.ok) {
      setMessage(persistResult.errorTr);
      return;
    }
    setMessage(
      liveResult.ok
        ? "Hesaplandı ve kaydedildi — 3B görüntüleyicide görüntüleyebilir, bileşen listesindeki çalıştırma geçmişinden inceleyebilirsiniz."
        : `Kalıcı kayıt oluşturuldu ama canlı görünüm güncellenemedi: ${liveResult.messageTr}`,
    );
  };

  const cases = getValues("operatingProfile.cases");
  const activeCaseIndex = getValues("activeCaseIndex");
  const baseCase = cases[activeCaseIndex] ?? cases[0];
  const currentTitle = WIZARD_STEPS.find((s) => s.step === activeStep)?.titleTr ?? "";

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto bg-white p-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Bileşen: {getValues("componentLabel")}</h2>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800">
          ✕ Kapat
        </button>
      </div>

      <StepperNav activeStep={activeStep} onSelect={goToStep} />
      <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{currentTitle}</h3>

      {activeStep === 1 && <Step1ComponentSelect />}
      {activeStep === 2 && <Step2Geometry />}
      {activeStep === 3 && <Step3ProcessConditions />}
      {activeStep === 4 && <Step4FluidChemistry />}
      {activeStep === 5 && <Step5Solids />}
      {activeStep === 6 && <Step6ProtectionOperation />}
      {activeStep === 7 && (
        <Step7OperatingScenarios
          onEditCase={(caseIndex) => {
            setValue("activeCaseIndex", caseIndex);
            goToStep(3);
          }}
          onImportClick={() => setImportOpen(true)}
        />
      )}
      {activeStep === 8 && <Step8Uncertainty />}

      <div className="mt-2 flex items-center gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-200"
        >
          Kaydet
        </button>
        <button
          type="button"
          onClick={() => void handleCompute()}
          disabled={isSaving}
          className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Hesapla
        </button>
        {message && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{message}</span>}
      </div>

      {baseCase && (
        <ColumnMappingWizard
          isOpen={isImportOpen}
          onClose={() => setImportOpen(false)}
          baseCase={baseCase}
          onImport={(importedCases, mode) => {
            setValue("operatingProfile.cases", mode === "REPLACE" ? importedCases : [...cases, ...importedCases]);
          }}
        />
      )}
    </div>
  );
}

export function ComponentForm({ projectId, existing, onClose }: ComponentFormProps) {
  const defaultValues: WizardDraft = existing ?? createBlankDraft();
  const form = useForm<WizardDraft>({
    resolver: zodResolver(WizardDraftSchema),
    defaultValues,
    mode: "onBlur",
  });

  return (
    <FormProvider {...form}>
      <ComponentFormInner projectId={projectId} onClose={onClose} />
    </FormProvider>
  );
}
