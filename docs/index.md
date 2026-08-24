# EroCorr3D

Petrol/gaz tesislerindeki boru ve vanalarda erozyon/korozyon hasarını
hesaplayan, sonucu hem sayısal (tablo/grafik/rapor) hem de 3 boyutlu ısı
haritası olarak gösteren bir mühendislik yazılımı. Tamamen tarayıcıda
çalışır — sunucu veya arka uç yok, verileriniz kendi bilgisayarınızda
kalır.

- **Kaynak kodu:** [github.com/yapmaya/erocorr3d](https://github.com/yapmaya/erocorr3d) (MIT lisansı)
- **Canlı uygulama:** https://erocorr3d-web.vercel.app

## Bu dokümantasyonda ne var?

| Sayfa | İçerik |
| --- | --- |
| [Kullanıcı Kılavuzu](kullanici-kilavuzu.md) | Uygulamayı adım adım kullanma — girdi sihirbazı, 3B görüntüleyici, sonuçlar, raporlar |
| [Mühendislik Metodolojisi](metodoloji.md) | Değerlendirilen 24 hasar mekanizması: tetikleyici koşullar, kaynak/standart, önleyici tedbirler (motor kataloğundan otomatik üretilir) |
| [Katsayı Kayıt Defteri](katsayi-kayit-defteri.md) | Motordaki HER mühendislik sabitinin kaynağı ve güven seviyesi (otomatik üretilir) |
| [Doğrulama Raporu](dogrulama-raporu.md) | Motorun referans/standart örnek hesaplarını ne kadar yakın yeniden ürettiği (her sürümde otomatik yenilenir) |
| [Sürümleme](surumleme.md) | Paket sürümü ile motor sürümünün (ENGINE_VERSION) neden ayrı takip edildiği |
| [Yayınlama](yayinlama.md) | Kendi kopyanızı ücretsiz nasıl internete çıkarırsınız |
| [Sorumluluk Reddi](sorumluluk-reddi.md) | **Kullanmadan önce mutlaka okuyun** |

## Hızlı başlangıç

Uygulamayı kendi bilgisayarınızda çalıştırmak için bkz. depo köküdeki
[README.md](https://github.com/yapmaya/erocorr3d#readme). Uygulama içinde
"Projeler" sayfasında hazır **örnek projeler** (ıslak gaz toplama hattı,
kumlu kuyu başı hattı, deniz suyu hattı) tek tıkla yüklenebilir — kod
yazmadan, gerçek sayılarla, uygulamayı tanımanın en hızlı yolu budur.
