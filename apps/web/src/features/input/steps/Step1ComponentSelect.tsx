// apps/web/src/features/input/steps/Step1ComponentSelect.tsx
//
// Adım 1 — Bileşen Seçimi: hazır şablonlar, kategori sekmesi (Boru &
// Fitting | Vana), arama kutusu, görsel kartlar. "Ekipman" sekmesi (master
// talimatta anılan üçüncü kategori) motorun hiçbir şemasında karşılığı
// olmadığından (yalnızca Geometry/ValveGeometry modellenmiştir) BU
// sürümde YOKTUR — var olmayan bir işlevi ima etmemek için eklenmedi.

import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import type { ComponentType } from "@erocorr3d/engine";
import type { WizardDraft, ComponentCategory } from "../schema";
import { filterCatalog } from "../componentCatalog";
import { WIZARD_TEMPLATES, getTemplate } from "../templates";
import { createDefaultValveGeometry } from "../defaultDraft";
import { ComponentIcon } from "../components/ComponentIcon";

function tabClass(active: boolean): string {
  return `flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "bg-sky-600 text-white"
      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
  }`;
}

export interface StepProps {
  onNext?: () => void;
  onPrev?: () => void;
}

export function Step1ComponentSelect({ onNext }: StepProps) {
  const { watch, setValue, register } = useFormContext<WizardDraft>();
  const category = watch("componentCategory");
  const selectedType = category === "VALVE" ? watch("valveGeometry.componentType") : watch("geometry.componentType");
  const [query, setQuery] = useState("");

  const entries = useMemo(() => filterCatalog(category, query), [category, query]);

  const selectCategory = (next: ComponentCategory) => {
    setValue("componentCategory", next, { shouldDirty: true });
    if (next === "VALVE" && !watch("valveGeometry")) {
      setValue("valveGeometry", createDefaultValveGeometry(), { shouldDirty: true });
    }
  };

  const selectComponentType = (componentType: ComponentType) => {
    setValue("geometry.componentType", componentType, { shouldDirty: true, shouldValidate: true });
    if (category === "VALVE") {
      setValue("valveGeometry.componentType", componentType, { shouldDirty: true, shouldValidate: true });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = getTemplate(templateId);
    if (!template) return;
    const values = template.apply();
    setValue("componentCategory", "PIPE_FITTING", { shouldDirty: true });
    setValue("componentLabel", values.componentLabel, { shouldDirty: true });
    setValue("geometry", values.geometry, { shouldDirty: true, shouldValidate: true });
    setValue("mitigation", values.mitigation, { shouldDirty: true, shouldValidate: true });
    setValue("operatingProfile", values.operatingProfile, { shouldDirty: true, shouldValidate: true });
    setValue("activeCaseIndex", 0, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="block text-xs">
        <span className="mb-1 block text-neutral-600 dark:text-neutral-300">Bileşen / Hat Adı</span>
        <input
          type="text"
          {...register("componentLabel")}
          className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </label>

      <div>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Hazır Şablonlar
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WIZARD_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              title={template.descriptionTr}
              onClick={() => applyTemplate(template.id)}
              className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-900"
            >
              {template.nameTr}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-neutral-400 dark:text-neutral-500">
          Şablon değerleri temsilidir — sahaya özgü gerçek verinizle güncelleyin.
        </p>
      </div>

      <div className="flex gap-1">
        <button type="button" onClick={() => selectCategory("PIPE_FITTING")} className={tabClass(category === "PIPE_FITTING")}>
          Boru & Fitting
        </button>
        <button type="button" onClick={() => selectCategory("VALVE")} className={tabClass(category === "VALVE")}>
          Vana
        </button>
      </div>

      {category === "VALVE" && (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Vana geometrisi toplanır ve önizlenir, ama bu sürümde motor yalnızca boru/fitting bileşenleri için sayısal
          korozyon/erozyon sonucu üretir (bkz. Adım 7&apos;deki &quot;Hesapla&quot; notu).
        </p>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Bileşen ara..."
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />

      <div className="grid grid-cols-2 gap-2">
        {entries.map((entry) => (
          <button
            key={entry.componentType}
            type="button"
            onClick={() => selectComponentType(entry.componentType)}
            className={`flex flex-col items-center gap-1 rounded border p-2 text-center transition-colors ${
              selectedType === entry.componentType
                ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
                : "border-neutral-200 bg-white hover:border-sky-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-sky-700"
            }`}
          >
            <ComponentIcon kind={entry.iconKind} />
            <span className="text-[11px] leading-tight text-neutral-700 dark:text-neutral-200">{entry.labelTr}</span>
          </button>
        ))}
      </div>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!selectedType}
          className="mt-2 rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Devam Et: Geometri →
        </button>
      )}
    </div>
  );
}
