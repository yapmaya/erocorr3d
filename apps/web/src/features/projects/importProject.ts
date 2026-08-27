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

// `.ec3d` dosyaları GÜVENİLMEYEN kaynaklardan (kullanıcının diskinden) gelir.
// Sınırsız boyutta bir dosya iki ayrı yerde ana thread'i kilitleyebilir:
// `file.text()` ile TAMAMININ belleğe alınması ve `Ec3dFileSchema.safeParse`
// ile HER kaydın tek tek doğrulanması. Ölçüldü: 50.000 bileşenli bir dosyanın
// ayrıştırma+doğrulaması 12,5 sn sürüyor (bkz. proje düzeltme notları).
//
// Sınırlar KEYFİ DEĞİL: örnek proje bileşenleri (demoProjects.ts) JSON'a
// çevrildiğinde ~1,7 KB/bileşen ölçüldü; bu depodaki gerçek kullanım senaryosu
// (tek bir tesis/hat için onlarca-yüzlerce boru/vana bileşeni) bu sınırların
// ÇOK altında kalır. Aşağıdaki sayılar, gerçek kullanıma 10-50 kat pay
// bırakırken 50.000'lik patolojik/bozuk dosya senaryosunu reddeder:
//   - MAX_EC3D_COMPONENTS: 5.000 bileşen ≈ ölçülen orana göre ~1,25 sn
//     ayrıştırma+doğrulama — donma hissi yaratmayacak kadar hızlı.
//   - MAX_EC3D_ASSESSMENT_RUNS: her bileşen zaman içinde birden çok kez
//     yeniden hesaplanabildiği (geçmiş kaydı) için bileşen sınırının 4 katı.
//   - MAX_EC3D_FILE_SIZE_BYTES: yukarıdaki sınırların ima ettiği dosya
//     boyutundan (bileşen+çalıştırma başına birkaç KB) kayda değer ölçüde
//     büyük — `file.text()` çağrılmadan ÖNCE, dosya içeriği hiç okunmadan
//     `File.size` üzerinden kontrol edilir.
export const MAX_EC3D_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_EC3D_COMPONENTS = 5_000;
export const MAX_EC3D_ASSESSMENT_RUNS = 20_000;

/** Ham (henüz Zod ile doğrulanmamış) `.ec3d` JSON'ında verilen anahtarın dizi uzunluğunu okur — Zod'un TÜM öğeleri doğrulamaya çalışmasından ÖNCE sayı sınırını kontrol edebilmek için. */
function readArrayLength(raw: unknown, key: string): number {
  if (typeof raw !== "object" || raw === null) return 0;
  const value = (raw as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : 0;
}

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

  // Zod TÜM bileşen/çalıştırma kayıtlarını tek tek doğrulamaya çalışmadan
  // ÖNCE (asıl 12,5 sn'lik yavaşlığın kaynağı budur) ham dizi uzunluklarını
  // kontrol et — böylece patolojik bir dosya, pahalı doğrulamaya hiç
  // girmeden hızlıca reddedilir.
  const componentCount = readArrayLength(raw, "components");
  if (componentCount > MAX_EC3D_COMPONENTS) {
    return {
      ok: false,
      errorTr: `Dosyada çok fazla bileşen var (${componentCount}, sınır: ${MAX_EC3D_COMPONENTS}) — dosya bozuk olabilir veya bu boyuttaki bir projenin içe aktarılması tarayıcıyı kilitleyebilir.`,
    };
  }
  const runCount = readArrayLength(raw, "assessmentRuns");
  if (runCount > MAX_EC3D_ASSESSMENT_RUNS) {
    return {
      ok: false,
      errorTr: `Dosyada çok fazla hesap çalıştırması var (${runCount}, sınır: ${MAX_EC3D_ASSESSMENT_RUNS}) — dosya bozuk olabilir veya bu boyuttaki bir projenin içe aktarılması tarayıcıyı kilitleyebilir.`,
    };
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
  // `File.size` okumak dosya içeriğine DOKUNMAZ — bu yüzden aşırı büyük bir
  // dosyayı, TAMAMINI belleğe alacak `file.text()` çağrılmadan ÖNCE reddeder.
  if (file.size > MAX_EC3D_FILE_SIZE_BYTES) {
    return {
      ok: false,
      errorTr: `Dosya çok büyük (${(file.size / (1024 * 1024)).toFixed(1)} MB, sınır: ${MAX_EC3D_FILE_SIZE_BYTES / (1024 * 1024)} MB) — dosya bozuk olabilir.`,
    };
  }

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
