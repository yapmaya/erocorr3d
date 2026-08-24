# Yayınlama (kendi kopyanızı ücretsiz internete çıkarma)

Bu sayfa, depoyu forklayıp **kendi** ücretsiz canlı adresinizi kurmak
isteyenler içindir. Tüm adımlar ücretsizdir, kredi kartı gerekmez.

## 1) Uygulamayı barındırma (Vercel)

1. [vercel.com](https://vercel.com) adresine gidin, **"Sign Up"** →
   **"Continue with GitHub"** ile GitHub hesabınızla giriş yapın (yeni bir
   şifre oluşturmanız gerekmez, doğrudan GitHub'ınızla bağlanır).
2. Panelde **"Add New..." → "Project"** düğmesine tıklayın.
3. GitHub depolarınızın listesinde `erocorr3d`'yi bulup **"Import"**
   tıklayın (ilk seferde Vercel'e hangi depolara erişebileceğini
   sormasını istiyorsa, `erocorr3d` deposunu seçin).
4. Karşınıza çıkan yapılandırma ekranında:
   - **Root Directory:** `apps/web` yazıp seçin (bu proje bir monorepo —
     asıl web uygulaması bu alt klasörde).
   - **Framework Preset:** "Vite" otomatik algılanmalı; algılanmazsa
     elle "Vite" seçin.
   - **Build Command** ve **Output Directory**: varsayılan bırakın
     (Vercel, `apps/web/package.json`'daki `build`/`vite build`
     komutlarını otomatik kullanır).
5. **"Deploy"** düğmesine tıklayın. 1-2 dakika içinde bir
   `https://erocorr3d-....vercel.app` adresi alırsınız.

Bundan sonra `main` dalına her `git push` yaptığınızda (veya bu depoyu
GitHub üzerinden düzenlediğinizde) Vercel OTOMATİK olarak yeniden
derleyip yayınlar — ek bir işlem gerekmez.

**Netlify alternatifi:** Aynı akış [netlify.com](https://netlify.com) →
"Add new site" → "Import an existing project" → GitHub → `erocorr3d`
seçilerek de kurulabilir; **Base directory** alanına `apps/web` yazmanız
yeterlidir.

## 2) Gerçek "geçmezse yayınlanmasın" garantisi

Vercel'in kendi otomatik derlemesi yalnızca `vite build`'i çalıştırır —
testleri veya lint'i ÇALIŞTIRMAZ. Bu depoda gerçek kalite kapısı
`.github/workflows/ci.yml`'dir (lint + tip kontrolü + testler, testler
motorun doğrulama paketini de içerir). Bunun GERÇEKTEN "geçmezse
birleşmesin" anlamına gelmesi için:

1. Depo ayarlarında **Settings → Branches → Add branch protection rule**
   ile `main` dalını koruyun, "Require status checks to pass before
   merging" seçeneğini işaretleyip `validate` check'ini zorunlu kılın.
2. Değişiklikleri doğrudan `main`'e push etmek yerine bir **Pull
   Request** açıp birleştirin — bu sayede CI kırmızıysa GitHub
   birleştirmeyi engeller.

(Doğrudan `main`'e push ederseniz Vercel yine de derlemeyi dener —
yalnızca tip hatası varsa reddeder, test/lint hatası varsa RETMEZ.)

## 3) Dokümantasyon sitesi (GitHub Pages)

Bu depo herkese açık (public) olduğunda ve **Settings → Pages → Source**
"GitHub Actions" olarak ayarlandığında, `.github/workflows/docs.yml` her
`main` push'unda dokümantasyon sitesini otomatik olarak
`https://<kullanıcı-adınız>.github.io/erocorr3d/` adresinde yayınlar —
ek bir hesap/servis gerekmez, tamamen GitHub'ın kendi ücretsiz altyapısı.
