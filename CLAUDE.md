# EroCorr3D

Petrol/gaz tesislerindeki boru ve vanalarda erozyon/korozyon hasarını hesaplayan
mühendislik yazılımı. Sonuçları sayısal (tablo/grafik/rapor) ve 3B ısı haritası
olarak gösterir. Tamamen tarayıcıda çalışır — sunucu veya backend yok.

## Yapı (npm workspaces monorepo)

- `packages/engine` — saf hesap motoru (korozyon/erozyon/akışkan modelleri), UI'dan
  bağımsız, yalnızca `zod` dependency'si var.
- `apps/web` — React + Three.js arayüzü (`@react-three/fiber`/`drei`).

## Komutlar (repo kökünden)

```
npm run dev     # apps/web dev server (vite, http://localhost:5173)
npm run test    # tüm workspace'lerde vitest
npm run build   # tsc --noEmit + vite build (apps/web); tsc build (engine)
npm run lint    # eslint . (repo geneli)
```

Bir değişiklik sonrası bu üçünün (test/build/lint) temiz geçmesi beklenir.

## Kaynak Doğrulama Protokolü (kritik, ihlal etme)

`packages/engine/src/registry/coefficients.ts` içindeki her mühendislik katsayısı
kaynağıyla (standart/makale atfı) birlikte kayıtlıdır. Yeni bir katsayı eklerken
veya değiştirirken **atıf olmadan ekleme** — doğrulanmamış (UNVERIFIED) katsayılar
kullanıldığında tarayıcı konsoluna otomatik uyarı yazılır ve bu bilinçli bir
tasarım kararıdır, susturma. Bu, gerçek petrol/gaz tesislerinde kullanılabilecek
bir hesaplamanın güvenilirliğiyle ilgili — kaynağından emin olmadığın bir sayıyı
asla "VERIFIED" gibi işaretleme.

## Motor mimarisi (`packages/engine/src`)

- `corrosion/`, `erosion/` — mekanizma bazlı modeller (NORSOK, DNV, API 14E, de Waard vb.)
- `fluids/` — akış rejimi, sürtünme, PR-EOS, karışım özellikleri
- `mechanicalIntegrity/` — B31G değerlendirmesi
- `spatial/` — 3B alan/örnekleme, valf/fitting geometrisi
- `uncertainty/` — Monte Carlo, tornado, kalibrasyon
- `orchestrate/` — bileşen/senaryo değerlendirmesini birleştiren üst katman
- `registry/` — katsayı kaynak kaydı (yukarıya bakın)

## Web mimarisi (`apps/web/src`)

- `store/` — zustand (assessmentStore, uiStore, assessmentHistoryStore)
- `features/{input,results,report,registry,viewer2d,viewer3d,valveViewer}/`
- `geometry/` — parametrik boru/valf geometrisi (elbow, tee, reducer, weldJoint...)
- `shaders/` — hasar ısı haritası (WebGL shader + colormap)
- `i18n/` — TR/EN çeviri (`translations.ts`)

## Kod kuralları

- TypeScript strict mode, `@typescript-eslint/no-explicit-any` hata seviyesinde —
  `any` kullanma.
- Kullanılmayan değişkenler hata verir; kasıtlı olarak kullanılmayan parametreler
  `_` ile başlamalı (`_unused`).
- Node 18+, ESM (`"type": "module"`).

## Bilinen durum (README'den, değişebilir)

- 3B boru şu an yer tutucu ölçülerle gösteriliyor, girdi paneli henüz gerçek
  boru hattı verisini işlemiyor.
- Sonuç paneli ve alt tablo/grafik alanı henüz boş yer tutuculardır.
- 3B görüntüleyici her zaman koyu arka plan kullanır (tema seçiminden bağımsız).

Bu sınırlamaları "bug" sanıp kendiliğinden düzeltmeye çalışma — bunlar bilinen,
sıradaki aşamaya bırakılmış konular.
