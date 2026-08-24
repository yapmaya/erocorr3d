# EroCorr3D

[![CI](https://github.com/yapmaya/erocorr3d/actions/workflows/ci.yml/badge.svg)](https://github.com/yapmaya/erocorr3d/actions/workflows/ci.yml)
[![Docs](https://github.com/yapmaya/erocorr3d/actions/workflows/docs.yml/badge.svg)](https://yapmaya.github.io/erocorr3d/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Petrol/gaz tesislerindeki boru ve vanalarda erozyon/korozyon hasarını hesaplayan,
sonucu hem sayısal (tablo/grafik/rapor) hem de 3 boyutlu ısı haritası olarak
gösteren bir mühendislik yazılımı. Tamamen tarayıcıda çalışır, sunucu veya
internet bağlantısı gerektirmez (harici HDRI görsellerinin ilk yüklemesi hariç).

**Dokümantasyon:** https://yapmaya.github.io/erocorr3d/ (kullanıcı kılavuzu,
mühendislik metodolojisi, katsayı kayıt defteri, doğrulama raporu).
**Canlı demo:** yayınlandıktan sonra buraya eklenecek — bkz. [docs/yayinlama.md](docs/yayinlama.md).

Bu belge, **kod bilmeyen** birinin projeyi kendi bilgisayarında çalıştırabilmesi
için yazılmıştır. Aşağıdaki komutları terminale **olduğu gibi kopyalayıp
yapıştırın**.

## 1) Gereksinimler

Bilgisayarınızda [Node.js](https://nodejs.org) kurulu olmalı (18 veya üzeri).
Kurulu olup olmadığını kontrol etmek için terminale şunu yapıştırın:

```
node --version
```

Bir sürüm numarası (örn. `v22.x.x`) görürseniz kuruludur, devam edebilirsiniz.
Görmezseniz, [nodejs.org](https://nodejs.org) adresinden "LTS" sürümünü indirip
kurun.

## 2) Kurulum (yalnızca ilk seferde)

Terminali açın, projeyi indirmek istediğiniz klasöre gidin (örn. Masaüstü)
ve şu komutları sırayla yapıştırın:

```
git clone https://github.com/yapmaya/erocorr3d.git
cd erocorr3d
npm install
```

Bu işlem birkaç dakika sürebilir; internet üzerinden gerekli kütüphaneleri indirir.
Aşağıdaki tüm komutlar bu `erocorr3d` klasörünün İÇİNDEYKEN çalıştırılmalıdır.

## 3) Uygulamayı çalıştırma

```
npm run dev
```

Terminalde şuna benzer bir satır göreceksiniz:

```
➜  Local:   http://localhost:5173/
```

Bu adresi (`http://localhost:5173/`) tarayıcınızda (Chrome, Firefox vb.) açın.

**Ne göreceksiniz:** Koyu temalı bir arayüz; üstte başlık çubuğu (menü, dil
seçici TR/EN, tema düğmesi); solda "Girdi", ortada gri-metalik bir 3B boru,
sağda "Sonuçlar" panelleri; altta açılıp kapanabilen bir "Tablo/Grafik"
çekmecesi. Panellerin arasındaki ince çizgileri fare ile sürükleyerek
boyutlarını değiştirebilir, 3B borunun üzerinde fareyi basılı tutup
sürükleyerek döndürebilir, kaydırma tekerleğiyle yakınlaştırıp
uzaklaştırabilirsiniz.

Uygulamayı durdurmak için terminalde `Ctrl+C` tuşlarına basın.

## 4) Diğer komutlar

Testlerin geçtiğini doğrulamak için:

```
npm run test
```

Kodun üretim için derlenebildiğini doğrulamak için:

```
npm run build
```

Kod kalitesi kontrolü (lint) için:

```
npm run lint
```

Her üç komut da hatasız tamamlanmalıdır (test/build/lint).

## 5) Proje yapısı (kısaca)

```
erocorr3d/
├── packages/
│   └── engine/     # Saf hesap motoru (korozyon/erozyon modelleri) — UI'dan bağımsız
├── apps/
│   └── web/        # Tarayıcı arayüzü (React + 3B görüntüleyici)
├── docs/           # Dokümantasyon sitesi kaynağı (MkDocs — bkz. mkdocs.yml)
└── .github/
    └── workflows/  # CI (doğrulama paketi), sürüm ve dokümantasyon yayın işleri
```

`packages/engine` içindeki her mühendislik katsayısının kaynağı
`packages/engine/src/registry/coefficients.ts` dosyasında atıflarıyla
birlikte kayıtlıdır (Kaynak Doğrulama Protokolü). Doğrulanmamış (UNVERIFIED)
katsayılar kullanıldığında tarayıcı konsoluna otomatik uyarı yazılır. Bu
kayıt defterinin ve motorun 24 hasar mekanizmasının insan-okunur bir dökümü
dokümantasyon sitesinde yayındadır.

## Lisans

[MIT](LICENSE) — özgürce kullanabilir, değiştirebilir ve dağıtabilirsiniz.

## 6) Şu anki durum ve bilinen sınırlamalar

- 3B boru şu an sabit, örnek (yer tutucu) ölçülerle gösteriliyor; girdi paneli
  henüz gerçek boru hattı verisini işlemiyor (sıradaki aşama).
- Sonuç paneli ve alt tablo/grafik alanı henüz boş yer tutuculardır.
- Ölçek çubuğu, kameraya göre otomatik güncellenmez; sahnedeki 1 metrelik
  sabit bir referans çizgisidir.
- 3B görüntüleyici, açık/koyu tema seçiminden bağımsız olarak her zaman koyu
  arka planla gösterilir (metalik malzemenin okunabilirliği için — CAD
  araçlarındaki yaygın kabul).
