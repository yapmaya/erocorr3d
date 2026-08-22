// apps/web/src/features/input/persistence/useAutosave.ts
//
// Mount'ta kayıtlı taslağı geri yükler ("kaldığın yerden devam et") ve her
// form değişikliğinde debounce'lu (800ms) otomatik kayıt yapar.

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { WizardDraft } from "../schema";
import { loadDraft, saveDraft } from "./db";

const AUTOSAVE_DEBOUNCE_MS = 800;

export type RestoreStatus = "LOADING" | "RESTORED" | "BLANK";

export function useAutosave(form: UseFormReturn<WizardDraft>): RestoreStatus {
  const [status, setStatus] = useState<RestoreStatus>("LOADING");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);
  const { reset, watch } = form;

  useEffect(() => {
    let cancelled = false;
    loadDraft()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          reset(saved);
          setStatus("RESTORED");
        } else {
          setStatus("BLANK");
        }
        hasRestoredRef.current = true;
      })
      .catch((error: unknown) => {
        console.error("Kayıtlı taslak yüklenemedi:", error);
        hasRestoredRef.current = true;
        setStatus("BLANK");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = watch((values) => {
      if (!hasRestoredRef.current) return; // geri yükleme bitmeden üzerine yazma
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveDraft({ ...(values as WizardDraft), updatedAt: Date.now() }).catch((error: unknown) => {
          console.error("Taslak otomatik kaydedilemedi:", error);
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watch]);

  return status;
}
