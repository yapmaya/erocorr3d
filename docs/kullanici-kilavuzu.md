# Kullanıcı Kılavuzu

Bu kılavuz, uygulamayı ilk kez açan biri için adım adım yazılmıştır. Her
adımda o anda ekranda ne göreceğinizi anlatıyoruz (gerçek ekran görüntüsü
dosyası yerine metinsel tarif kullanılıyor — arayüz güncellendikçe bir
görsel dosyası eskiyip yanıltıcı hale gelebilir, metin açıklaması her
zaman güncel kalır).

## 1) İlk açılış

Uygulamayı açtığınızda ortada, koyu bir arka plan üzerinde "EroCorr3D'ye
Hoş Geldiniz" başlıklı küçük bir kutu (tanıtım turu) görürsünüz — **İleri**
düğmesiyle 6 adımda arayüzün ana bölgelerini (menü, girdi paneli, 3B
görüntüleyici, sonuçlar çekmecesi, dil/tema/yardım düğmeleri) tek tek
gösterir. **Atla** ile geçebilir, istediğiniz zaman sağ üstteki **?**
(soru işareti) düğmesinden yeniden başlatabilirsiniz.

Üst çubukta (soldan sağa): sol üstte ☰ menü simgesi (Ana Ekran / Projeler
/ Katsayı Kayıt Defteri / Geometri Laboratuvarı arasında geçiş), sağ üstte
sırasıyla göz simgesi (renk körlüğü modu), soru işareti (klavye
kısayolları yardımı), "TR"/"EN" dil düğmesi, güneş/ay simgesi (açık/koyu
tema).

Ana ekran üç ana bölgeye ayrılır: solda **Girdi Sihirbazı**, ortada **3B
Görüntüleyici**, sağda **Sonuçlar** özet paneli; en altta açılıp
kapanabilen bir **Tablo/Grafik** çekmecesi vardır. Panellerin arasındaki
ince dikey/yatay çizgileri fareyle sürükleyerek boyutlarını
değiştirebilirsiniz.

## 2) En hızlı başlangıç: örnek bir proje yükleyin

Kod yazmadan, gerçek sayılarla uygulamayı tanımanın en hızlı yolu budur.

1. Sol üstteki ☰ menüden **"Projeler"**e tıklayın.
2. Sol tarafta **"Örnek Projeler"** başlığı altında üç hazır senaryo
   görürsünüz: *Islak Gaz Toplama Hattı*, *Kum İçeren Kuyu Başı Hattı*,
   *Deniz Suyu Hattı*. Herhangi birinin yanındaki **"Yükle"** düğmesine
   tıklayın.
3. Yeni bir proje otomatik oluşturulur ve seçilir; ortada projenin tek
   bileşeni ("Boru/Fitting") listelenir. Bileşene tıklayıp **"Düzenle"**
   ile girdi sihirbazını açabilir, değerleri inceleyip **"Hesapla"**
   diyebilirsiniz.

## 3) Girdi Sihirbazı (8 adım)

Ana ekranın sol panelinde, üstte 1'den 8'e numaralı adım göstergesi
vardır (herhangi birine tıklayıp doğrudan atlayabilirsiniz):

1. **Bileşen Seçimi** — Boru/Fitting mi Vana mı olduğunu ve şeklini
   (düz boru, dirsek, Te, redüksiyon vb.) seçersiniz. "Hazır Şablonlar"
   satırından (Islak Gaz Toplama Hattı, Kuru Satış Gazı, Yoğuşan Su
   Hattı, Deniz Suyu Hattı, Yangın Suyu Hattı, Kum İçeren Kuyu Başı
   Hattı) birine tıklarsanız TÜM formu o senaryonun temsili
   değerleriyle doldurur — sahaya özgü gerçek verinizle üzerine
   yazmanız beklenir.
2. **Geometri** — Nominal boru boyutu (NPS), cidar programı (schedule),
   uzunluk, kurulum (yer üstü/gömülü), yalıtım, konum sınıfı gibi
   alanlar.
3. **Proses Koşulları** — Basınç, sıcaklık, akış rejimi, hız, serbest su
   varlığı.
4. **Akışkan Kimyası** — CO2/H2S mol yüzdesi, klorür/bikarbonat, pH,
   çözünmüş oksijen vb.
5. **Katı Partikül** — Kum oranı, partikül boyutu/yoğunluğu/şekli (yalnızca
   erozyon hesabı için gerekliyse doldurulur).
6. **Koruma ve İşletme** — İnhibitör/biyosit/oksijen tutucu kullanımı,
   iç kaplama, katodik koruma.
7. **İşletme Senaryoları** — Birden fazla işletme durumu (ör. "Normal
   İşletme" + "Bakım Modu") tanımlayıp her birine yıllık gün sayısı
   atayabilirsiniz (toplam 365 günü aşamaz). Bir Excel/CSV hat listesini
   buradan içe aktarabilirsiniz.
8. **Belirsizlik (opsiyonel)** — Hangi girdilerin tahmini/belirsiz
   olduğunu not düşebileceğiniz serbest bir alan.

Panelin altındaki yeşil **"Hesapla"** düğmesi (veya **Ctrl+Enter**
kısayolu) formu doğrular ve motoru çalıştırır; sonuç ortadaki 3B
görüntüleyiciye ve sağdaki/alttaki sonuç panellerine "Özel Veri" olarak
yansır.

## 4) 3B Görüntüleyici

Orta paneldeki 3B boru/vana modelini fareyle sürükleyerek döndürebilir,
kaydırma tekerleğiyle yakınlaştırabilirsiniz. Üst-sol köşede **DEMO /
Gerçek Veri (Referans Tesis) / Özel Veri** arasında geçiş yapan
düğmeler vardır — "Özel Veri", sizin girdi sihirbazından hesapladığınız
sonucu gösterir.

Ekranın çeşitli köşelerinde küçük araç panelleri belirir:

- **Sağ üst:** kamera araçları (Ön/Üst/Yan/İzo hızlı görünümler, Sığdır,
  Sıfırla, Perspektif↔Ortografik geçişi).
- **Sağ üstün altı:** Hotspot'lar paneli — en yüksek hasarlı noktaların
  bir LİSTESİ (fareyle 3B modele hiç dokunmadan, klavyeyle de gezip
  seçilebilir) + seçilen noktanın hız/kalan et kalınlığı/kaynak atfı
  detayı.
- **Sol üst:** Kesit Düzlemi (X/Y/Z eksen veya serbest açı, yarım kesit).
  **C** kısayoluyla açıp kapatabilirsiniz.
- **Sol alt:** Ölçüm araçları (Mesafe, Duvar Probu, Saat Okuyucu).
- **Sağ alt:** Dışa Aktar (PNG ekran görüntüsü — **S** kısayolu — veya
  GLB 3B model dosyası, kamera bağlantısını panoya kopyalama).
- **Alt tam genişlik:** Zaman kaydırıcısı — senaryo sekmeleri, **Oynat/
  Duraklat** (**Space** kısayolu) ve hız seçenekleri (1×-10×) ile
  hasarın yıllar içindeki gelişimini izlersiniz; "Isı Haritası" düğmesi
  renkli hasar dokusunu açıp kapatır.

Renk skalasını (ısı haritasının kırmızı/sarı/yeşil renkleri) renk
körlüğü olan kullanıcılar için üst çubuktaki göz simgesiyle mavi-kırmızı
uyumlu bir skalaya değiştirebilirsiniz.

## 5) Sonuçlar / Tablo / Grafik

Ekranın en altındaki çekmeceyi başlığına tıklayarak açarsınız. İçinde
iki sekme vardır:

- **2B Görünüm** — Radyal kesit (saat kadranı), eksenel profil, açısal
  profil, zaman serisi, kalan dayanım (ASME B31G) grafikleri.
- **Sonuçlar** — sonuç tablosu, mekanizma dökümü (yığılmış/şelale
  grafikleri), senaryo karşılaştırma, zaman serisi, tornado (duyarlılık)
  analizi, Monte Carlo, hız-erozyon eğrisi, malzeme matrisi, ve **Muayene
  Planı** (Kritik İzleme Noktaları, RBI-lite matrisi, önerilen aralıklar).

## 6) Rapor üretimi

Sağ üstteki **"PDF Rapor"**/**"Excel Rapor"** düğmeleriyle, o ana kadar
hesaplanmış TÜM bileşenleri kapsayan bir doküman indirirsiniz. Dişli
simgesinden (Rapor Ayarları) şirket adı/logosu, doküman no, revizyon,
hazırlayan/kontrol eden/onaylayan bilgisi ve rapor dilini (TR/EN)
ayarlayabilirsiniz.

## 7) Projeler sayfası

Bileşenlerinizi ve hesap geçmişinizi tarayıcınızda kalıcı olarak
(IndexedDB — sunucuya hiçbir şey gönderilmez) saklamak için kullanılır:
proje oluşturma, bileşen ekleme, `.ec3d` dosyası olarak içe/dışa aktarma,
bir Excel hat listesini toplu içe aktarma, birden fazla bileşeni toplu
hesaplama, iki hesap koşusunu karşılaştırma, özel malzeme tanımlama ve
sık kullanılan girdi kombinasyonlarını "ön ayar" olarak kaydetme.

## 8) Klavye kısayolları

| Tuş | Eylem |
| --- | --- |
| `Ctrl`/`Cmd` + `Enter` | Hesapla |
| `C` | 3B görüntüleyicide kesit düzlemini aç/kapat |
| `Space` | Zaman oynatmayı başlat/duraklat |
| `S` | Ekran görüntüsü al (PNG) |
| `?` | Bu kısayol listesini aç/kapat |

`C`/`Space`/`S` kısayolları bir metin kutusuna yazarken kazayla
tetiklenmez.

## 9) Katsayı Kayıt Defteri (uygulama içi)

☰ menüden erişilen bu sayfa, motorun kullandığı HER sabitin kaynağını ve
güven seviyesini arama/filtreleme ile gösterir; CSV olarak dışa
aktarılabilir. Aynı verinin statik bir dökümü bu dokümantasyon sitesinde
de vardır — bkz. [Katsayı Kayıt Defteri](katsayi-kayit-defteri.md).
