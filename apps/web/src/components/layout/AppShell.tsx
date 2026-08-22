// apps/web/src/components/layout/AppShell.tsx

import { HeaderBar } from "./HeaderBar";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { RegistryPage } from "../../features/registry";
import { GeometryLab } from "../../pages/GeometryLab";
import { useUiStore } from "../../store/uiStore";
import { CalculationTraceDrawer } from "../../features/report/traceability/CalculationTraceDrawer";
import { ProjectsPage } from "../../features/projects/ProjectsPage";

export function AppShell() {
  const activePage = useUiStore((state) => state.activePage);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <HeaderBar />
      <div className="min-h-0 flex-1">
        {activePage === "workspace" && <WorkspaceLayout />}
        {activePage === "projects" && <ProjectsPage />}
        {activePage === "registry" && <RegistryPage />}
        {activePage === "geometryLab" && <GeometryLab />}
      </div>
      <CalculationTraceDrawer />
    </div>
  );
}
