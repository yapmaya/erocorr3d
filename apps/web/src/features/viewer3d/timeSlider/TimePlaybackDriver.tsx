// apps/web/src/features/viewer3d/timeSlider/TimePlaybackDriver.tsx
//
// Canvas İÇİNE monte edilen, görünmez "saat" — `useFrame` sadece burada
// çalışır (bkz. useTimePlaybackState.ts'in başlığı). Hiçbir şey render
// ETMEZ, sadece oynatma AÇIKKEN her karede `onAdvance`ı çağırır.

import { useFrame } from "@react-three/fiber";
import type { PlaybackSpeed } from "./useTimePlaybackState";

// 1x hızda tasarım ömrünün ne kadar gerçek-zaman saniyesinde oynatılacağı —
// mühendislik değeri DEĞİL, salt kullanıcı-deneyimi tempo tercihi (bkz.
// geometry/valveHelpers.ts'in VALVE_VISUAL_RATIOS için aynı "KDP kapsamı
// dışı, görsel/UX amaçlı" gerekçesi).
const BASE_YEARS_PER_SECOND = 1.5;

export interface TimePlaybackDriverProps {
  playing: boolean;
  speed: PlaybackSpeed;
  onAdvance: (deltaYears: number) => void;
}

export function TimePlaybackDriver({ playing, speed, onAdvance }: TimePlaybackDriverProps) {
  useFrame((_state, deltaSeconds) => {
    if (!playing) return;
    onAdvance(deltaSeconds * speed * BASE_YEARS_PER_SECOND);
  });
  return null;
}
