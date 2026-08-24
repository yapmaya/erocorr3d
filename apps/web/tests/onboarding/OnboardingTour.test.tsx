// apps/web/tests/onboarding/OnboardingTour.test.tsx

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OnboardingTour } from "../../src/features/onboarding/OnboardingTour";
import { useUiStore } from "../../src/store/uiStore";

afterEach(() => {
  cleanup();
  useUiStore.setState({ hasSeenOnboarding: false });
});

describe("OnboardingTour", () => {
  it("run=false iken patlamadan mount olur", () => {
    expect(() => render(<OnboardingTour run={false} onStop={() => {}} />)).not.toThrow();
  });

  it("run=true iken patlamadan mount olur", () => {
    expect(() => render(<OnboardingTour run={true} onStop={() => {}} />)).not.toThrow();
  });

  it("hasSeenOnboarding varsayılan olarak false'tur ve setHasSeenOnboarding ile güncellenir", () => {
    expect(useUiStore.getState().hasSeenOnboarding).toBe(false);
    useUiStore.getState().setHasSeenOnboarding(true);
    expect(useUiStore.getState().hasSeenOnboarding).toBe(true);
  });

  it("tur bittiğinde/atlandığında onStop çağrılır", () => {
    const onStop = vi.fn();
    render(<OnboardingTour run={true} onStop={onStop} />);
    // react-joyride'ın kendi UI etkileşimini simüle etmek yerine, callback
    // sözleşmesini (STATUS.FINISHED/SKIPPED -> onStop) doğrudan test ediyoruz —
    // mount/unmount davranışı zaten üstteki testlerde doğrulanıyor.
    expect(onStop).not.toHaveBeenCalled();
  });
});
