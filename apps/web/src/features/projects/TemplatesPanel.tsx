// apps/web/src/features/projects/TemplatesPanel.tsx
//
// Kullanıcının kaydettiği bileşen ön ayarları (proje-bağımsız/global).
// "Bu bileşeni ön ayar olarak kaydet" mevcut bir bileşenin `WizardDraft`
// verisini (etiket/id/updatedAt HARİÇ) bir `TemplateRecord`e kopyalar;
// "Ön ayardan yeni bileşen" ise TAM TERSİ — yeni bir id/etiketle bir
// `WizardDraft` üretip projeye ekler.

import { useEffect, useState } from "react";
import { useProjectsStore } from "../../store/projectsStore";
import type { ProjectComponentRecord, TemplateRecord } from "./types";

export function TemplatesPanel({ projectId }: { projectId: string }) {
  const templates = useProjectsStore((s) => s.templates);
  const components = useProjectsStore((s) => s.components);
  const loadTemplates = useProjectsStore((s) => s.loadTemplates);
  const addTemplate = useProjectsStore((s) => s.addTemplate);
  const deleteTemplate = useProjectsStore((s) => s.deleteTemplate);
  const addComponent = useProjectsStore((s) => s.addComponent);
  const [sourceComponentId, setSourceComponentId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [newComponentLabel, setNewComponentLabel] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSaveAsTemplate = async () => {
    const source = components.find((c) => c.id === sourceComponentId);
    if (!source || !templateName.trim()) return;
    const { id: _id, projectId: _projectId, componentLabel: _componentLabel, updatedAt: _updatedAt, ...draftRest } = source;
    void _id;
    void _projectId;
    void _componentLabel;
    void _updatedAt;
    const template: TemplateRecord = { id: crypto.randomUUID(), name: templateName.trim(), notesTr: "", createdAt: Date.now(), draft: draftRest };
    await addTemplate(template);
    setTemplateName("");
  };

  const handleCreateFromTemplate = async () => {
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template || !newComponentLabel.trim()) return;
    const draft: ProjectComponentRecord = {
      ...template.draft,
      id: crypto.randomUUID(),
      projectId,
      componentLabel: newComponentLabel.trim(),
      updatedAt: Date.now(),
    };
    await addComponent(draft);
    setNewComponentLabel("");
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Bileşen Ön Ayarları</h3>

      <div className="flex flex-wrap items-center gap-1.5">
        <select value={sourceComponentId} onChange={(e) => setSourceComponentId(e.target.value)} className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">— Kaynak bileşen —</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.componentLabel}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          placeholder="Ön ayar adı"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
        />
        <button type="button" onClick={() => void handleSaveAsTemplate()} className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300">
          Ön Ayar Olarak Kaydet
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <option value="">— Ön ayar seçin —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          placeholder="Yeni bileşen adı"
          value={newComponentLabel}
          onChange={(e) => setNewComponentLabel(e.target.value)}
        />
        <button type="button" onClick={() => void handleCreateFromTemplate()} className="rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700">
          Ön Ayardan Bileşen Oluştur
        </button>
      </div>

      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="py-1 pr-2 font-medium">{t.name}</td>
              <td className="py-1 pr-2 text-neutral-400 dark:text-neutral-500">{new Date(t.createdAt).toLocaleDateString("tr-TR")}</td>
              <td className="py-1 text-right">
                <button type="button" onClick={() => void deleteTemplate(t.id)} className="text-neutral-400 hover:text-red-500">
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {templates.length === 0 && <p className="text-[11px] text-neutral-400 dark:text-neutral-500">Henüz kaydedilmiş ön ayar yok.</p>}
    </div>
  );
}
