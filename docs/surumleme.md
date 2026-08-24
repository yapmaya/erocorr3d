# Sürümleme

EroCorr3D [semantic versioning](https://semver.org/lang/tr/) kullanır:
`MAJOR.MINOR.PATCH` (ör. `0.1.0`).

## İki ayrı sürüm numarası

Bu projede **iki farklı sürüm** bilinçli olarak birbirinden ayrı takip
edilir:

1. **Paket sürümü** (`package.json` → `version`) — npm paketleme/dağıtım
   amaçlıdır. Yeni bir özellik/arayüz değişikliği/bağımlılık güncellemesi
   olduğunda artar.
2. **Motor sürümü** (`packages/engine/src/version.ts` →
   `ENGINE_VERSION`) — YALNIZCA hesap mantığını (korozyon/erozyon
   modelleri, katsayılar, formüller) etkileyen bir değişiklik olduğunda
   ELLE artırılır. Bu sürüm her kayıtlı hesap sonucuna (`AssessmentRunRecord.
   engineVersion`) damgalanır — bir sonucun HANGİ hesap mantığıyla
   üretildiğini geriye dönük izlemek içindir. Uygulama, kayıtlı bir sonuç
   artık geçerli motor sürümünden eskiyse arayüzde "Eski Sürüm" rozeti
   gösterip yeniden hesaplama önerir (bkz. `apps/web/src/features/
   projects/ComponentList.tsx`).

Bu ayrımın nedeni: bir arayüz düzeltmesi (ör. bir düğmenin rengi) paket
sürümünü artırmalı ama motor sürümünü ASLA artırmamalı — aksi halde
kullanıcılar gereksiz yere "sonuçlarınız eskidi, yeniden hesaplayın"
uyarısı alır. Tersine, bir katsayının kaynağı değiştiğinde (aynı arayüzle
bile) motor sürümü MUTLAKA artmalı.

## Yeni bir sürüm çıkarma

Depoyu klonlayıp değişiklikleri `main` dalına birleştirdikten sonra:

```
git tag v0.2.0
git push origin v0.2.0
```

Bu, `.github/workflows/release.yml`'i tetikler: doğrulama paketini
(lint + tip kontrolü + testler) yeniden çalıştırır, motorun doğrulama
raporunu üretir ve bir GitHub Release oluşturup raporu ekler.
