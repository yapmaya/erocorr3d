// apps/web/src/features/viewer3d/SceneHelpers.tsx

import { ContactShadows, Grid, GizmoHelper, GizmoViewport, Line, Text } from "@react-three/drei";
import { useUiStore } from "../../store/uiStore";

const FLOOR_Y = -1.2;

/**
 * Sabit 1 metrelik referans çizgisi.
 *
 * NOT: Bu, kameraya göre otomatik güncellenen dinamik bir HUD ölçek çubuğu
 * DEĞİLDİR — sahnedeki gerçek dünya birimini (1 sahne birimi = 1 metre)
 * göstermek için sabit uzunlukta bir 3B referans nesnesidir.
 */
function ScaleReference({ color }: { color: string }) {
  const y = FLOOR_Y + 0.02;
  const z = 2.2;
  const start: [number, number, number] = [-2, y, z];
  const end: [number, number, number] = [-1, y, z];
  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={2} />
      <Text position={[-1.5, y + 0.18, z]} fontSize={0.14} color={color} anchorX="center">
        1 m (referans)
      </Text>
    </group>
  );
}

export interface SceneHelpersProps {
  /** Bileşenin uzunluğu (metre) — ızgara/gölge boyutunu içeriğe göre ölçeklemek için. */
  lengthM?: number;
}

export function SceneHelpers({ lengthM = 4 }: SceneHelpersProps) {
  // 3B görüntüleyici, açık/koyu tema seçimine göre ızgara/gölge/etiket
  // renklerini uyarlar (bkz. master görev madde 7 "Koyu/açık tema") — önceki
  // oturumda burası "CAD araçlarındaki yaygın kabule uygun olarak HER ZAMAN
  // koyu" idi (bkz. proje hafızası); bu görev o kararı AÇIKÇA genişletiyor.
  const theme = useUiStore((state) => state.theme);
  const isDark = theme === "dark";
  const groundSize = Math.max(lengthM * 3, 20);
  const shadowScale = Math.max(lengthM * 2, 10);

  return (
    <>
      <Grid
        args={[groundSize, groundSize]}
        position={[0, FLOOR_Y, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor={isDark ? "#3f3f46" : "#a1a1aa"}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={isDark ? "#52525b" : "#71717a"}
        fadeDistance={30}
        infiniteGrid
      />
      <ContactShadows position={[0, FLOOR_Y + 0.001, 0]} opacity={isDark ? 0.55 : 0.35} scale={shadowScale} blur={2} far={2} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={["#f87171", "#4ade80", "#60a5fa"]} labelColor="black" />
      </GizmoHelper>
      <ScaleReference color={isDark ? "#e5e7eb" : "#1f2937"} />
    </>
  );
}
