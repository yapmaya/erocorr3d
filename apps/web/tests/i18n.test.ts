// apps/web/tests/i18n.test.ts

import { describe, expect, it } from "vitest";
import { translate, translateUnverifiedBadgeLabel } from "../src/i18n/translations";

describe("translate", () => {
  it("TR ve EN için doğru metni döner", () => {
    expect(translate("appTitle", "tr")).toBe("EroCorr3D");
    expect(translate("menu", "tr")).toBe("Menü");
    expect(translate("menu", "en")).toBe("Menu");
  });

  it("her sözlük anahtarı hem tr hem en için tanımlıdır", () => {
    const keys: Array<Parameters<typeof translate>[0]> = [
      "appTitle",
      "menu",
      "inputPanelTitle",
      "inputPanelPlaceholder",
      "resultsPanelTitle",
      "resultsPanelPlaceholder",
      "bottomDrawerTitle",
      "bottomDrawerPlaceholder",
      "bottomDrawerToggleOpen",
      "bottomDrawerToggleClose",
      "themeToggleToLight",
      "themeToggleToDark",
      "viewer3dTitle",
      "navWorkspace",
      "navRegistry",
      "registryPageTitle",
      "registrySearchPlaceholder",
      "registryFilterModuleAll",
      "registryFilterConfidenceAll",
      "registryColumnId",
      "registryColumnValue",
      "registryColumnUnit",
      "registryColumnDescription",
      "registryColumnSource",
      "registryColumnCrossCheck",
      "registryColumnConfidence",
      "registryCrossCheckYes",
      "registryCrossCheckNo",
      "registryExportCsv",
      "registryEmpty",
      "registryStatTotal",
      "unverifiedBadgePopoverTitle",
      "confidenceHigh",
      "confidenceMedium",
      "confidenceLow",
      "confidenceUnverified",
    ];
    for (const key of keys) {
      expect(translate(key, "tr").length).toBeGreaterThan(0);
      expect(translate(key, "en").length).toBeGreaterThan(0);
    }
  });
});

describe("translateUnverifiedBadgeLabel", () => {
  it("TR için sayıyı içeren doğru metni döner", () => {
    expect(translateUnverifiedBadgeLabel(3, "tr")).toBe(
      "⚠ Bu sonuç 3 adet doğrulanmamış katsayı kullanıyor",
    );
  });

  it("EN için tekil/çoğul doğru şekilde ayrılır", () => {
    expect(translateUnverifiedBadgeLabel(1, "en")).toBe(
      "⚠ This result uses 1 unverified coefficient",
    );
    expect(translateUnverifiedBadgeLabel(2, "en")).toBe(
      "⚠ This result uses 2 unverified coefficients",
    );
  });
});
