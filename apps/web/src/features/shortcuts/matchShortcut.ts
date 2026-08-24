// apps/web/src/features/shortcuts/matchShortcut.ts
//
// Klavye kısayollarının saf eşleştirme mantığı — DOM/React'tan bağımsız,
// test edilebilir. Uygulamadaki 5 kısayol: Ctrl/Cmd+Enter (Hesapla),
// C (Kesit), Space (Oynat/Duraklat), S (Ekran görüntüsü), ? (Yardım).

export type ShortcutAction = "CALCULATE" | "SECTION" | "PLAY_PAUSE" | "SCREENSHOT" | "HELP";

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Odak bir metin girdisinde mi — böyleyse tek harfli kısayollar (C/S/Space) YOKSAYILMALI. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.contentEditable === "true";
}

/**
 * Bir klavye olayının hangi kısayol eylemine karşılık geldiğini döndürür
 * (hiçbiri değilse null). `editableTargetFocused=true` iken yalnızca
 * Ctrl/Cmd+Enter (CALCULATE) değerlendirilir — tek harfli kısayollar
 * yazarken kazayla tetiklenmesin diye yoksayılır.
 */
export function matchShortcut(event: ShortcutKeyEvent, editableTargetFocused: boolean): ShortcutAction | null {
  const isCalculateCombo = (event.ctrlKey || event.metaKey) && event.key === "Enter";
  if (isCalculateCombo) return "CALCULATE";

  if (editableTargetFocused) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  switch (event.key) {
    case "c":
    case "C":
      return "SECTION";
    case " ":
    case "Spacebar":
      return "PLAY_PAUSE";
    case "s":
    case "S":
      return "SCREENSHOT";
    case "?":
      return "HELP";
    default:
      return null;
  }
}
