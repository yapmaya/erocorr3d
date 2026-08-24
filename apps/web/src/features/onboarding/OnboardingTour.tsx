// apps/web/src/features/onboarding/OnboardingTour.tsx
//
// İlk açılışta (veya HeaderBar'daki "?" yardımından yeniden başlatıldığında)
// 6 adımlık react-joyride turu. Hedefler `AppShell`/`HeaderBar`/
// `WorkspaceLayout`/`BottomDrawer`'daki `data-tour="..."` attribute'larına
// bağlanır — bkz. o dosyalardaki eklemeler.
//
// NOT: react-joyride v3 (ilk denenen sürüm) bu projede tarayıcıda GERÇEK
// RENDER'da yakalanan bir hata içeriyordu — küçük (ör. 32×32) hedeflere
// (nav-menu gibi) sabitlenen adımların tooltip'i floating-ui konumlandırması
// tamamlanmadan hedefin kendi boyutuna SIKIŞIP KALIYOR, görünmez oluyordu
// (yalnızca target="body"/placement="center" olan İLK adım çalışıyordu).
// Bu proje bu yüzden bilinçli olarak olgun/kararlı v2 API'sine sabitlendi
// (`package.json`: "react-joyride": "2.9.3").

import { useMemo } from "react";
import Joyride, { STATUS, type CallBackProps, type Step } from "react-joyride";
import { translate } from "../../i18n/translations";
import { useUiStore } from "../../store/uiStore";

export interface OnboardingTourProps {
  run: boolean;
  onStop: () => void;
}

export function OnboardingTour({ run, onStop }: OnboardingTourProps) {
  const locale = useUiStore((state) => state.locale);
  const theme = useUiStore((state) => state.theme);
  const isDark = theme === "dark";

  const steps: Step[] = useMemo(() => {
    const tr = (key: Parameters<typeof translate>[0]) => translate(key, locale);
    return [
      { target: "body", placement: "center", disableBeacon: true, title: tr("onboardingWelcomeTitle"), content: tr("onboardingWelcomeBody") },
      { target: '[data-tour="nav-menu"]', disableBeacon: true, title: tr("onboardingNavTitle"), content: tr("onboardingNavBody") },
      { target: '[data-tour="input-wizard"]', disableBeacon: true, title: tr("onboardingInputTitle"), content: tr("onboardingInputBody") },
      { target: '[data-tour="pipe-viewer"]', disableBeacon: true, title: tr("onboardingViewerTitle"), content: tr("onboardingViewerBody") },
      { target: '[data-tour="bottom-drawer"]', disableBeacon: true, title: tr("onboardingResultsTitle"), content: tr("onboardingResultsBody") },
      { target: '[data-tour="header-controls"]', disableBeacon: true, title: tr("onboardingHeaderTitle"), content: tr("onboardingHeaderBody") },
    ];
  }, [locale]);

  const joyrideLocale = useMemo(
    () => ({
      back: translate("onboardingBack", locale),
      close: translate("onboardingSkip", locale),
      last: translate("onboardingFinish", locale),
      next: translate("onboardingNext", locale),
      skip: translate("onboardingSkip", locale),
    }),
    [locale],
  );

  const styles = useMemo(
    () => ({
      options: {
        zIndex: 16777301,
        arrowColor: isDark ? "#171717" : "#ffffff",
        backgroundColor: isDark ? "#171717" : "#ffffff",
        overlayColor: "rgba(0, 0, 0, 0.5)",
        primaryColor: "#0284c7",
        textColor: isDark ? "#f5f5f5" : "#171717",
      },
    }),
    [isDark],
  );

  const handleCallback = (data: CallBackProps) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onStop();
    }
  };

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      showSkipButton
      scrollToFirstStep
      callback={handleCallback}
      locale={joyrideLocale}
      styles={styles}
    />
  );
}
