// apps/web/src/features/projects/CustomMaterialsPanel.tsx
//
// Kullanıcı tanımlı malzeme kataloğu (proje-bağımsız/global). Buraya
// eklenen kayıtlar, gerekli korozyon payı aralığına uyduğunda
// `selectPipingMaterial`'in alternatif önerilerine "(Kullanıcı Tanımlı —
// doğrulanmamış)" etiketiyle EKLENİR (bkz. packages/engine/src/aggregate/
// materialSelection.ts, ComponentList.tsx'in `deriveMaterialRecommendation`
// çağrısı).

import { useEffect, useState } from "react";
import { useProjectsStore } from "../../store/projectsStore";
import type { CustomMaterialRecord } from "./types";

const INPUT_CLASS = "w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900";

function emptyForm() {
  return { nameTr: "", notesTr: "", sourceNoteTr: "", minRequiredCaMm: "0", maxRequiredCaMm: "", relativeCostIndex: "" };
}

export function CustomMaterialsPanel() {
  const customMaterials = useProjectsStore((s) => s.customMaterials);
  const loadCustomMaterials = useProjectsStore((s) => s.loadCustomMaterials);
  const addCustomMaterial = useProjectsStore((s) => s.addCustomMaterial);
  const deleteCustomMaterial = useProjectsStore((s) => s.deleteCustomMaterial);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCustomMaterials();
  }, [loadCustomMaterials]);

  const handleAdd = async () => {
    setError(null);
    if (!form.nameTr.trim() || !form.sourceNoteTr.trim()) {
      setError("Malzeme adı ve kaynak gerekçesi zorunludur (KDP: gerekçesiz kullanıcı verisi kaydedilemez).");
      return;
    }
    const minRequiredCaMm = Number(form.minRequiredCaMm);
    const maxRequiredCaMm = form.maxRequiredCaMm.trim() === "" ? null : Number(form.maxRequiredCaMm);
    if (!Number.isFinite(minRequiredCaMm) || (maxRequiredCaMm !== null && !Number.isFinite(maxRequiredCaMm))) {
      setError("Korozyon payı aralığı sayısal olmalıdır.");
      return;
    }
    const record: CustomMaterialRecord = {
      id: crypto.randomUUID(),
      nameTr: form.nameTr.trim(),
      notesTr: form.notesTr.trim(),
      sourceNoteTr: form.sourceNoteTr.trim(),
      minRequiredCaMm,
      maxRequiredCaMm,
      relativeCostIndex: form.relativeCostIndex.trim() === "" ? null : Number(form.relativeCostIndex),
      createdAt: Date.now(),
    };
    await addCustomMaterial(record);
    setForm(emptyForm());
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Kullanıcı Tanımlı Malzemeler</h3>
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
        Bu kayıtlar motorun §10.3.2 birincil önerisini DEĞİŞTİRMEZ — yalnızca uygun CA aralığında &quot;doğrulanmamış&quot; bir alternatif olarak gösterilir.
      </p>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <input className={INPUT_CLASS} placeholder="Malzeme adı *" value={form.nameTr} onChange={(e) => setForm({ ...form, nameTr: e.target.value })} />
        <input className={INPUT_CLASS} placeholder="Min. CA (mm)" type="number" value={form.minRequiredCaMm} onChange={(e) => setForm({ ...form, minRequiredCaMm: e.target.value })} />
        <input className={INPUT_CLASS} placeholder="Maks. CA (mm, boş=sınırsız)" type="number" value={form.maxRequiredCaMm} onChange={(e) => setForm({ ...form, maxRequiredCaMm: e.target.value })} />
        <input className={INPUT_CLASS} placeholder="Göreli maliyet (CS=1.0)" type="number" value={form.relativeCostIndex} onChange={(e) => setForm({ ...form, relativeCostIndex: e.target.value })} />
        <input className={`${INPUT_CLASS} col-span-2`} placeholder="Notlar" value={form.notesTr} onChange={(e) => setForm({ ...form, notesTr: e.target.value })} />
        <input
          className={`${INPUT_CLASS} col-span-2 sm:col-span-3`}
          placeholder="Kaynak gerekçesi (kullanıcının kendi gerekçesi) *"
          value={form.sourceNoteTr}
          onChange={(e) => setForm({ ...form, sourceNoteTr: e.target.value })}
        />
      </div>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      <button type="button" onClick={() => void handleAdd()} className="w-fit rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700">
        + Ekle
      </button>

      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {customMaterials.map((m) => (
            <tr key={m.id} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="py-1 pr-2 font-medium">{m.nameTr}</td>
              <td className="py-1 pr-2 text-neutral-500 dark:text-neutral-400">
                {m.minRequiredCaMm}–{m.maxRequiredCaMm ?? "∞"} mm CA
              </td>
              <td className="py-1 pr-2 text-neutral-400 dark:text-neutral-500">{m.sourceNoteTr}</td>
              <td className="py-1 text-right">
                <button type="button" onClick={() => void deleteCustomMaterial(m.id)} className="text-neutral-400 hover:text-red-500">
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {customMaterials.length === 0 && <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Henüz kullanıcı tanımlı malzeme yok.</p>}
    </div>
  );
}
