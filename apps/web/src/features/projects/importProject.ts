// apps/web/src/features/projects/importProject.ts
//
// `.ec3d` içe aktarma. HER ZAMAN yeni id'lerle YENİ bir proje oluşturur —
// mevcut bir projenin üzerine ASLA YAZILMAZ (onaylı plan'ın kararı, geri
// döndürülemez bir üzerine-yazmadan kaçınmak için). Ayrıştırma+doğrulama+
// yeniden-id'leme SAF bir fonksiyondur (`parseEc3dFile`, test edilir);
// gerçek Dexie yazımı (`importProjectFromFile`) SAF DEĞİLDİR, test edilmez.

import { projectsDb } from "./db";
import { EC3D_FORMAT_VERSION } from "./exportProject";
import { Ec3dFileSchema } from "./ec3dSchema";
import { ec3dJsonReviver } from "./ec3dSerialization";
import type { AssessmentRunRecord, ProjectComponentRecord, ProjectRecord } from "./types";

export interface ParsedEc3dImport {
  project: ProjectRecord;
  components: ProjectComponentRecord[];
  assessmentRuns: AssessmentRunRecord[];
  /** Dosya okunabildi ama İÇERİĞİNDE düzeltilen tutarsızlıklar varsa — sessizce yutulmaz, çağıran taraf kullanıcıya gösterir. */
  warningsTr: string[];
}

export type ParseEc3dResult = { ok: true; data: ParsedEc3dImport } | { ok: false; errorTr: string };

/**
 * `.ec3d` JSON metnini doğrular ve YENİ id'lerle (proje + tüm bileşen/
 * çalıştırma referansları) bir içe aktarma paketine çevirir. Dexie'ye
 * HİÇBİR ŞEY YAZMAZ (SAF) — çağıran taraf (`importProjectFromFile`) yazar.
 */
export function parseEc3dFile(jsonText: string): ParseEc3dResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText, ec3dJsonReviver);
  } catch {
    return { ok: false, errorTr: "Dosya geçerli bir JSON değil — .ec3d dosyası bozuk olabilir." };
  }

  const parsed = Ec3dFileSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const pathTr = firstIssue ? firstIssue.path.join(".") : "";
    return {
      ok: false,
      errorTr: `Dosya beklenen .ec3d biçimine uymuyor${pathTr ? ` (alan: ${pathTr})` : ""}: ${firstIssue?.message ?? "bilinmeyen hata"}.`,
    };
  }

  const file = parsed.data;

  // Sürüm kapısı: `EC3D_FORMAT_VERSION` dışa aktarımda YAZILIYORDU ama okurken
  // HİÇ KONTROL EDİLMİYORDU — daha yeni bir sürümle üretilmiş bir dosya
  // sessizce, kısmen yanlış yorumlanabilirdi. Bilinmeyen bir sürümü kabul
  // etmektense AÇIKÇA reddetmek doğrudur (veri, kullanıcının kendi projesidir).
  if (file.formatVersion !== EC3D_FORMAT_VERSION) {
    return {
      ok: false,
      errorTr:
        file.formatVersion > EC3D_FORMAT_VERSION
          ? `Bu dosya daha yeni bir EroCorr3D sürümüyle oluşturulmuş (dosya biçimi v${file.formatVersion}, bu sürüm v${EC3D_FORMAT_VERSION} okuyor) — uygulamayı güncelleyin.`
          : `Desteklenmeyen .ec3d dosya biçimi sürümü: v${file.formatVersion} (beklenen: v${EC3D_FORMAT_VERSION}).`,
    };
  }

  const newProjectId = crypto.randomUUID();
  const now = Date.now();
  const warningsTr: string[] = [];

  const project: ProjectRecord = { ...file.project, id: newProjectId, updatedAt: now };

  const componentIdMap = new Map<string, string>();
  const components: ProjectComponentRecord[] = file.components.map((component) => {
    const newId = crypto.randomUUID();
    componentIdMap.set(component.id, newId);
    return { ...component, id: newId, projectId: newProjectId, updatedAt: now };
  });

  // Dosyadaki bir çalıştırma kaydı, dosyada BULUNMAYAN bir bileşene işaret
  // ediyorsa: eskiden `?? run.componentId` ile YABANCI id korunuyordu ve
  // kütüphaneye, hiçbir bileşene bağlı olmayan bir "hayalet" kayıt yazılıyordu.
  // Böyle bir kayıt zaten görüntülenemez — içe aktarılmaz, ama SESSİZCE de
  // atılmaz (aşağıdaki uyarı kullanıcıya gösterilir).
  const orphanRunCount = file.assessmentRuns.filter((run) => !componentIdMap.has(run.componentId)).length;
  if (orphanRunCount > 0) {
    warningsTr.push(
      `${orphanRunCount} adet hesap çalıştırması, dosyada bulunmayan bir bileşene işaret ettiği için içe aktarılmadı.`,
    );
  }

  const assessmentRuns: AssessmentRunRecord[] = file.assessmentRuns
    .filter((run) => componentIdMap.has(run.componentId))
    .map((run) => ({
      ...run,
      id: crypto.randomUUID(),
      projectId: newProjectId,
      componentId: componentIdMap.get(run.componentId)!,
    }));

  return { ok: true, data: { project, components, assessmentRuns, warningsTr } };
}

/** Bir `File`i okuyup doğrulanmış/yeniden-id'lenmiş içe aktarma paketini Dexie'ye yazar ve yeni proje id'sini döndürür. */
export async function importProjectFromFile(
  file: File,
): Promise<{ ok: true; projectId: string; warningsTr: string[] } | { ok: false; errorTr: string }> {
  const text = await file.text();
  const result = parseEc3dFile(text);
  if (!result.ok) return result;

  const { project, components, assessmentRuns, warningsTr } = result.data;
  await projectsDb.transaction("rw", projectsDb.projects, projectsDb.components, projectsDb.assessmentRuns, async () => {
    await projectsDb.projects.put(project);
    await projectsDb.components.bulkPut(components);
    await projectsDb.assessmentRuns.bulkPut(assessmentRuns);
  });

  return { ok: true, projectId: project.id, warningsTr };
}
