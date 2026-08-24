// apps/web/tests/projects/demoProjects.test.ts

import { describe, expect, it } from "vitest";
import { DEMO_PROJECT_DEFS, buildDemoComponentDraft } from "../../src/features/projects/demoProjects";
import { WizardDraftSchema } from "../../src/features/input/schema";

describe("demoProjects", () => {
  it("3 demo proje tanımı var", () => {
    expect(DEMO_PROJECT_DEFS).toHaveLength(3);
  });

  for (const def of DEMO_PROJECT_DEFS) {
    it(`${def.templateId} -> WizardDraftSchema'dan geçerli bir taslak üretir`, () => {
      const draft = buildDemoComponentDraft(def.templateId, "test-project-id");
      expect(draft.projectId).toBe("test-project-id");
      const parsed = WizardDraftSchema.safeParse(draft);
      expect(parsed.success).toBe(true);
    });
  }

  it("bilinmeyen şablon id'si hata fırlatır (sessizce geçmez)", () => {
    expect(() => buildDemoComponentDraft("olmayan-sablon", "x")).toThrow();
  });
});
