// apps/web/src/components/layout/WorkspaceLayout.tsx

import { useEffect, useRef } from "react";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import { BottomDrawer } from "./BottomDrawer";
import { InputWizard } from "../../features/input";
import { ResultsPanel } from "../../features/results";
import { PipeViewer } from "../../features/viewer3d/PipeViewer";
import { useUiStore } from "../../store/uiStore";

const HORIZONTAL_SEPARATOR_CLASS =
  "h-full w-1 cursor-col-resize bg-neutral-200 transition-colors hover:bg-sky-600 dark:bg-neutral-800";
const VERTICAL_SEPARATOR_CLASS =
  "h-1 w-full cursor-row-resize bg-neutral-200 transition-colors hover:bg-sky-600 dark:bg-neutral-800";

const BOTTOM_DRAWER_COLLAPSED_SIZE = "4%";
const BOTTOM_DRAWER_EXPANDED_SIZE = "30%";
const BOTTOM_DRAWER_MAX_SIZE = "60%";

/** SOL/ORTA/SAĞ panel + alt çekmece — asıl çalışma alanı yerleşimi. */
export function WorkspaceLayout() {
  const isBottomDrawerOpen = useUiStore((state) => state.isBottomDrawerOpen);
  const setBottomDrawerOpen = useUiStore((state) => state.setBottomDrawerOpen);
  const bottomPanelRef = useRef<PanelImperativeHandle>(null);

  // Başlık çubuğundaki düğmeden tetiklenen açma/kapama — kullanıcı çekmece
  // sınırını doğrudan sürüklediğinde bu etki devreye girmez (aşağıdaki
  // onResize zaten o durumu ayrıca senkronize eder).
  useEffect(() => {
    const panel = bottomPanelRef.current;
    if (!panel) return;
    if (isBottomDrawerOpen && panel.isCollapsed()) {
      panel.expand();
    } else if (!isBottomDrawerOpen && !panel.isCollapsed()) {
      panel.collapse();
    }
  }, [isBottomDrawerOpen]);

  return (
    <Group orientation="vertical" className="h-full">
      <Panel defaultSize="96%" minSize="40%">
        <Group orientation="horizontal">
          <Panel defaultSize="25%" minSize="15%" className="min-w-0">
            <InputWizard />
          </Panel>
          <Separator className={HORIZONTAL_SEPARATOR_CLASS} />
          <Panel defaultSize="50%" minSize="20%" className="min-w-0">
            <PipeViewer />
          </Panel>
          <Separator className={HORIZONTAL_SEPARATOR_CLASS} />
          <Panel defaultSize="25%" minSize="15%" className="min-w-0">
            <ResultsPanel />
          </Panel>
        </Group>
      </Panel>
      <Separator className={VERTICAL_SEPARATOR_CLASS} />
      <Panel
        panelRef={bottomPanelRef}
        collapsible
        collapsedSize={BOTTOM_DRAWER_COLLAPSED_SIZE}
        defaultSize={isBottomDrawerOpen ? BOTTOM_DRAWER_EXPANDED_SIZE : BOTTOM_DRAWER_COLLAPSED_SIZE}
        minSize="15%"
        maxSize={BOTTOM_DRAWER_MAX_SIZE}
        className="min-h-0"
        onResize={(_size, _id, prevSize) => {
          // prevSize yalnızca ilk mount sonrasında (gerçek bir yeniden
          // boyutlandırmada) tanımlıdır; mount sırasında store ile
          // çakışmayı önlemek için ilk çağrıyı yoksayıyoruz.
          if (!prevSize) return;
          const panel = bottomPanelRef.current;
          if (panel) setBottomDrawerOpen(!panel.isCollapsed());
        }}
      >
        <BottomDrawer />
      </Panel>
    </Group>
  );
}
