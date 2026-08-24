// apps/web/tests/shortcuts/matchShortcut.test.ts

import { describe, expect, it } from "vitest";
import { isEditableTarget, matchShortcut, type ShortcutKeyEvent } from "../../src/features/shortcuts/matchShortcut";

function key(overrides: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return { key: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...overrides };
}

describe("matchShortcut", () => {
  it("Ctrl+Enter -> CALCULATE, odak metin girdisinde olsa bile", () => {
    expect(matchShortcut(key({ key: "Enter", ctrlKey: true }), false)).toBe("CALCULATE");
    expect(matchShortcut(key({ key: "Enter", ctrlKey: true }), true)).toBe("CALCULATE");
  });

  it("Cmd+Enter (Mac) -> CALCULATE", () => {
    expect(matchShortcut(key({ key: "Enter", metaKey: true }), false)).toBe("CALCULATE");
  });

  it("C -> SECTION, S -> SCREENSHOT, Space -> PLAY_PAUSE, ? -> HELP (odak metin girdisinde DEĞİLKEN)", () => {
    expect(matchShortcut(key({ key: "c" }), false)).toBe("SECTION");
    expect(matchShortcut(key({ key: "s" }), false)).toBe("SCREENSHOT");
    expect(matchShortcut(key({ key: " " }), false)).toBe("PLAY_PAUSE");
    expect(matchShortcut(key({ key: "?" }), false)).toBe("HELP");
  });

  it("tek harfli kısayollar odak metin girdisindeyken YOKSAYILIR", () => {
    expect(matchShortcut(key({ key: "c" }), true)).toBeNull();
    expect(matchShortcut(key({ key: "s" }), true)).toBeNull();
    expect(matchShortcut(key({ key: " " }), true)).toBeNull();
  });

  it("modifiye tuşlarla (Ctrl/Cmd/Alt) birlikte tek harfli kısayollar tetiklenmez", () => {
    expect(matchShortcut(key({ key: "c", ctrlKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ key: "s", metaKey: true }), false)).toBeNull();
    expect(matchShortcut(key({ key: "c", altKey: true }), false)).toBeNull();
  });

  it("eşleşmeyen tuş -> null", () => {
    expect(matchShortcut(key({ key: "x" }), false)).toBeNull();
  });
});

describe("isEditableTarget", () => {
  it("input/textarea/select/contentEditable -> true", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const div = document.createElement("div");
    div.contentEditable = "true";
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(div)).toBe(true);
  });

  it("düz bir div/buton -> false", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
