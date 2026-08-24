// apps/web/src/components/layout/AppShell.tsx

import { useEffect, useState } from "react";
import { HeaderBar } from "./HeaderBar";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { RegistryPage } from "../../features/registry";
import { GeometryLab } from "../../pages/GeometryLab";
import { useUiStore } from "../../store/uiStore";
import { CalculationTraceDrawer } from "../../features/report/traceability/CalculationTraceDrawer";
import { ProjectsPage } from "../../features/projects/ProjectsPage";
import { OnboardingTour } from "../../features/onboarding/OnboardingTour";
import { ShortcutsHelpModal } from "../../features/shortcuts/ShortcutsHelpModal";
import { isEditableTarget, matchShortcut } from "../../features/shortcuts/matchShortcut";
import { DevPerfOverlay } from "../DevPerfOverlay";

export function AppShell() {
  const activePage = useUiStore((state) => state.activePage);
  const hasSeenOnboarding = useUiStore((state) => state.hasSeenOnboarding);
  const setHasSeenOnboarding = useUiStore((state) => state.setHasSeenOnboarding);
  const [tourRun, setTourRun] = useState(false);
  const [isShortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  useEffect(() => {
    if (!hasSeenOnboarding) setTourRun(true);
    // Yalnızca ilk mount'ta değerlendirilir — tur bittiğinde `hasSeenOnboarding`
    // true olur ama bu tekrar tetiklenip turu YENİDEN başlatmamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = matchShortcut(e, isEditableTarget(e.target));
      if (action === "HELP") {
        e.preventDefault();
        setShortcutsHelpOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <HeaderBar onHelpClick={() => setShortcutsHelpOpen(true)} />
      <div className="min-h-0 flex-1">
        {activePage === "workspace" && <WorkspaceLayout />}
        {activePage === "projects" && <ProjectsPage />}
        {activePage === "registry" && <RegistryPage />}
        {activePage === "geometryLab" && <GeometryLab />}
      </div>
      <CalculationTraceDrawer />

      <OnboardingTour
        run={tourRun}
        onStop={() => {
          setTourRun(false);
          setHasSeenOnboarding(true);
        }}
      />
      {isShortcutsHelpOpen && (
        <ShortcutsHelpModal
          onClose={() => setShortcutsHelpOpen(false)}
          onRestartTour={() => setTourRun(true)}
        />
      )}
      <DevPerfOverlay />
    </div>
  );
}
