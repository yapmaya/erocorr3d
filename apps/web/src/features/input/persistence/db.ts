// apps/web/src/features/input/persistence/db.ts
//
// "Otomatik kaydetme (IndexedDB), kaldığın yerden devam et" — bu sürümün
// kapsamı TEK bir aktif taslaktır (sabit anahtar `CURRENT_DRAFT_ID`); çoklu
// kayıtlı proje kütüphanesi kapsam dışıdır (bkz. onaylı plan'ın kapsam
// kararı #4). `WizardDraft` tamamen düz/serileştirilebilir veridir (Float32Array
// gibi motor-özel tipler TAŞIMAZ — bkz. schema.ts), bu yüzden doğrudan
// Dexie'ye yazılabilir.

import Dexie, { type EntityTable } from "dexie";
import type { WizardDraft } from "../schema";

export const CURRENT_DRAFT_ID = "current";

class EroCorr3DInputDb extends Dexie {
  drafts!: EntityTable<WizardDraft, "id">;

  constructor() {
    super("erocorr3d-input-wizard");
    this.version(1).stores({ drafts: "id" });
  }
}

export const db = new EroCorr3DInputDb();

export async function saveDraft(draft: WizardDraft): Promise<void> {
  await db.drafts.put({ ...draft, id: CURRENT_DRAFT_ID });
}

export async function loadDraft(): Promise<WizardDraft | undefined> {
  return db.drafts.get(CURRENT_DRAFT_ID);
}

export async function clearDraft(): Promise<void> {
  await db.drafts.delete(CURRENT_DRAFT_ID);
}
