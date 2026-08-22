// apps/web/src/components/layout/AppShell.tsx

import { HeaderBar } from "./HeaderBar";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { RegistryPage } from "../../features/registry";
import { GeometryLab } from "../../pages/GeometryLab";
import { useUiStore } from "../../store/uiStore";

export function AppShell() {
  const activePage = useUiStore((state) => state.activePage);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <HeaderBar />
      <div className="min-h-0 flex-1">
        {activePage === "workspace" && <WorkspaceLayout />}
        {activePage === "registry" && <RegistryPage />}
        {activePage === "geometryLab" && <GeometryLab />}
      </div>
    </div>
  );
}
