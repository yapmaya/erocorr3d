// apps/web/src/features/input/components/ComponentIcon.tsx
//
// Adım 1 kartlarının hafif SVG glifleri. 27 `ComponentType` için 27 canlı
// WebGL canvas'ı eşzamanlı çalıştırmak performans açısından gereksiz — bkz.
// onaylı plan'ın "3B önizleme" bölümü. Bu glifler LİTERAL mühendislik
// çizimleri DEĞİLDİR, yalnızca kategoriler arası hızlı görsel ayırt edicidir;
// gerçek geometri Adım 2'nin canlı 3B önizlemesinde gösterilir.

import type { ReactNode } from "react";
import type { ComponentIconKind } from "../componentCatalog";

const STROKE = "currentColor";

function Straight() {
  return <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />;
}
function Elbow() {
  return <path d="M4 6 V16 H28" fill="none" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />;
}
function Miter() {
  return <path d="M4 6 L16 16 L28 6" fill="none" stroke={STROKE} strokeWidth={4} strokeLinecap="round" />;
}
function Tee() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <line x1={16} y1={16} x2={16} y2={28} stroke={STROKE} strokeWidth={4} />
    </>
  );
}
function Reducer() {
  return <path d="M4 10 L4 22 L28 27 L28 5 Z" fill="none" stroke={STROKE} strokeWidth={3} strokeLinejoin="round" />;
}
function Weldolet() {
  return (
    <>
      <line x1={4} y1={20} x2={28} y2={20} stroke={STROKE} strokeWidth={4} />
      <line x1={16} y1={20} x2={16} y2={8} stroke={STROKE} strokeWidth={3} />
    </>
  );
}
function Weld() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <line x1={16} y1={8} x2={16} y2={24} stroke={STROKE} strokeWidth={2} strokeDasharray="2 2" />
    </>
  );
}
function Flange() {
  return (
    <>
      <line x1={6} y1={16} x2={26} y2={16} stroke={STROKE} strokeWidth={4} />
      <line x1={22} y1={6} x2={22} y2={26} stroke={STROKE} strokeWidth={4} />
    </>
  );
}
function Orifice() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <circle cx={16} cy={16} r={4} fill="none" stroke={STROKE} strokeWidth={2} />
    </>
  );
}
function ValveBody({ children }: { children?: ReactNode }) {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <rect x={11} y={9} width={10} height={14} rx={2} fill="none" stroke={STROKE} strokeWidth={2.5} />
      {children}
    </>
  );
}
function GateGlyph() {
  return (
    <ValveBody>
      <line x1={16} y1={9} x2={16} y2={3} stroke={STROKE} strokeWidth={2} />
    </ValveBody>
  );
}
function BallGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <circle cx={16} cy={16} r={8} fill="none" stroke={STROKE} strokeWidth={2.5} />
    </>
  );
}
function ButterflyGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <circle cx={16} cy={16} r={8} fill="none" stroke={STROKE} strokeWidth={2} />
      <ellipse cx={16} cy={16} rx={3} ry={8} fill="none" stroke={STROKE} strokeWidth={2} />
    </>
  );
}
function CheckGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <path d="M12 10 L22 16 L12 22 Z" fill="none" stroke={STROKE} strokeWidth={2} strokeLinejoin="round" />
    </>
  );
}
function PlugGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <path d="M16 8 L24 16 L16 24 L8 16 Z" fill="none" stroke={STROKE} strokeWidth={2.5} />
    </>
  );
}
function NeedleGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <path d="M16 6 L20 22 L12 22 Z" fill="none" stroke={STROKE} strokeWidth={2} />
    </>
  );
}
function ChokeGlyph() {
  return (
    <>
      <line x1={4} y1={16} x2={28} y2={16} stroke={STROKE} strokeWidth={4} />
      <circle cx={16} cy={16} r={6} fill="none" stroke={STROKE} strokeWidth={2} />
      <circle cx={16} cy={16} r={2} fill={STROKE} />
    </>
  );
}
function ControlGlyph() {
  return (
    <ValveBody>
      <line x1={13} y1={11} x2={13} y2={21} stroke={STROKE} strokeWidth={1.5} />
      <line x1={16} y1={11} x2={16} y2={21} stroke={STROKE} strokeWidth={1.5} />
      <line x1={19} y1={11} x2={19} y2={21} stroke={STROKE} strokeWidth={1.5} />
    </ValveBody>
  );
}
function PsvGlyph() {
  return (
    <>
      <line x1={4} y1={22} x2={16} y2={22} stroke={STROKE} strokeWidth={4} />
      <path d="M16 22 L16 10 L24 6" fill="none" stroke={STROKE} strokeWidth={2.5} strokeLinecap="round" />
    </>
  );
}

const ICON_MAP: Record<ComponentIconKind, () => ReactNode> = {
  STRAIGHT: Straight,
  ELBOW: Elbow,
  MITER: Miter,
  TEE: Tee,
  REDUCER: Reducer,
  WELDOLET: Weldolet,
  WELD: Weld,
  FLANGE: Flange,
  ORIFICE: Orifice,
  VALVE_GATE: GateGlyph,
  VALVE_GLOBE: GateGlyph,
  VALVE_BALL: BallGlyph,
  VALVE_BUTTERFLY: ButterflyGlyph,
  VALVE_CHECK: CheckGlyph,
  VALVE_PLUG: PlugGlyph,
  VALVE_NEEDLE: NeedleGlyph,
  VALVE_CHOKE: ChokeGlyph,
  VALVE_CONTROL: ControlGlyph,
  VALVE_PSV: PsvGlyph,
};

export function ComponentIcon({ kind }: { kind: ComponentIconKind }) {
  const Glyph = ICON_MAP[kind];
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 text-neutral-500 dark:text-neutral-400">
      <Glyph />
    </svg>
  );
}
