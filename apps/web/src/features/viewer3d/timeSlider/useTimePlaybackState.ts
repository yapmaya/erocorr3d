// apps/web/src/features/viewer3d/timeSlider/useTimePlaybackState.ts
//
// Zaman kaydırıcısının DURUMU (elapsedYears/oynatma/hız) — SAF React state,
// `useFrame` İÇERMEZ. Neden ayrı: bu durumu hem Canvas İÇİNDEKİ `PipeMesh`
// (hasar alanını hesaplamak için) hem Canvas DIŞINDAKİ `TimeSliderPanel`
// (HTML overlay — kaydırıcı/oynat düğmesi) okumalı/değiştirmeli; `useFrame`
// SADECE Canvas içinde çalışabildiği için gerçek "her karede ilerlet"
// mantığı ayrı bir bileşende yaşar (bkz. TimePlaybackDriver.tsx, Canvas
// içine monte edilir ve BU hook'un `advanceYears`ını çağırır).

import { useCallback, useState } from "react";

export const PLAYBACK_SPEEDS = [1, 2, 5, 10] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export interface UseTimePlaybackStateParams {
  designLifeYears: number;
}

export function useTimePlaybackState({ designLifeYears }: UseTimePlaybackStateParams) {
  const [elapsedYears, setElapsedYearsRaw] = useState(designLifeYears / 2);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  const setElapsedYears = useCallback(
    (value: number) => setElapsedYearsRaw(Math.min(Math.max(value, 0), designLifeYears)),
    [designLifeYears],
  );

  /** `TimePlaybackDriver.tsx`nin HER KAREDE çağırdığı ilerletme — sona ulaşınca otomatik durur. */
  const advanceYears = useCallback(
    (deltaYears: number) => {
      setElapsedYearsRaw((prev) => {
        const next = prev + deltaYears;
        if (next >= designLifeYears) {
          setPlaying(false);
          return designLifeYears;
        }
        return next;
      });
    },
    [designLifeYears],
  );

  const togglePlaying = useCallback(() => {
    setPlaying((prev) => {
      if (!prev && elapsedYears >= designLifeYears) {
        setElapsedYearsRaw(0);
      }
      return !prev;
    });
  }, [elapsedYears, designLifeYears]);

  return { elapsedYears, setElapsedYears, advanceYears, playing, togglePlaying, speed, setSpeed };
}
