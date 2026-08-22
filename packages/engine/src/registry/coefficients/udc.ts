// packages/engine/src/registry/coefficients/udc.ts
//
// Birikinti altı korozyonu (UDC) — katı taşınım (kritik taşıma hızı).
// NOT: bu oturumda tam türetilmiş bir katı-taşıma modeli (ör. Oroskar-Turian
// 1980, AIChE J. — gerçek, hakemli bir korelasyondur ama hindered-settling
// alt-terimi χ kendi başına ayrı bir korelasyon zinciri gerektirir) BULUNDU
// ama bu oturumda GÜVENİLİR biçimde tam olarak yeniden üretilemedi (bkz.
// notlar) — bunun yerine literatürde yaygın olarak atıfta bulunulan PRATİK
// bir minimum taşıma hızı ARALIĞI kullanıldı.

import type { Coefficient, Source } from "../types";

const MODULE = "udc";

const SRC_OROSKAR_TURIAN: Source = {
  type: "JOURNAL",
  citation:
    "Oroskar, A.R. ve Turian, R.M., \"The critical velocity in pipeline flow of slurries\", AIChE Journal, " +
    "Cilt 26, Sayı 4 (1980), s. 550-558 — kum/katı-sıvı karışımları için kritik çökelme hızı korelasyonunun " +
    "KÖKEN kaynağı (hakemli, yaygın atıfta bulunulan bir model). Bu oturumda makalenin TAM METNİNE " +
    "erişilmedi (paywall) — yalnızca formülün YAPISI (Vc=f(parçacık çapı, yoğunluk oranı, konsantrasyon, " +
    "boru çapı, karışım viskozitesi, hindered-settling faktörü χ)) ikincil kaynaklardan doğrulandı.",
  accessedDate: "2026-08-12",
};

const SRC_PRACTICAL_SAND_VELOCITY: Source = {
  type: "TEXTBOOK",
  citation:
    "Kum taşınımı/slurry taşıma tasarımı için yaygın endüstri pratiği özetleri (\"Slurry Transport: Minimum " +
    "Flow Velocity\" derleme notu ve ilişkili tasarım rehberleri) — kum için tipik minimum askıda tutma hızı " +
    "1,5-2 m/s aralığında bildiriliyor; ayrı bir tasarım kuralı olarak işletme hızının çökelme hızının " +
    "üzerinde en az ~0,5 m/s pay bırakacak şekilde seçilmesi öneriliyor.",
  accessedDate: "2026-08-12",
};

const MINIMUM_TRANSPORT_VELOCITY_RANGE_MS: Coefficient<[number, number]> = {
  id: "udc.minimumTransportVelocityRangeMs",
  module: MODULE,
  value: [1.5, 2.0],
  unit: "m/s",
  description:
    "Kum/katı parçacıkların askıda kalması (birikinti oluşturmaması) için gerekli tipik minimum taşıma hızı " +
    "aralığı — alt sınır MUHAFAZAKÂR (tarama için kullanılır).",
  source: SRC_PRACTICAL_SAND_VELOCITY,
  crossChecked: false,
  crossCheckSources: [SRC_OROSKAR_TURIAN],
  confidence: "LOW",
  notes:
    "KDP kural 4 açıkça uygulanıyor: bu SAYININ kendisi (1,5-2 m/s) yalnızca arama motoru sentezinden " +
    "ikincil/derleme kaynaklarla elde edildi — hiçbir BİRİNCİL doküman (ör. Oroskar-Turian'ın kendi makalesi) " +
    "bu oturumda tam olarak okunup DOĞRULANMADI. Gerçek kritik hız; parçacık boyutu/yoğunluğu, katı " +
    "konsantrasyonu, boru çapı ve karışım viskozitesine GÜÇLÜ bağımlıdır (Oroskar-Turian'ın kendi " +
    "denkleminin YAPISI bunu doğruluyor) — bu tek aralık yalnızca KABA bir tarama eşiğidir, kesin " +
    "mühendislik hesabı için tam korelasyonun (veya bir CFD/deneysel çalışmanın) uygulanması gerekir. " +
    "confidence=LOW (UNVERIFIED değil çünkü en azından tutarlı bir aralık/tasarım-kuralı bulundu, ama " +
    "birincil doğrulama YOK).",
};

export const UDC_COEFFICIENTS: Coefficient[] = [MINIMUM_TRANSPORT_VELOCITY_RANGE_MS as Coefficient];
