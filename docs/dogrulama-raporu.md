# Doğrulama Raporu

Bu rapor motorun `packages/engine/scripts/generateValidationReport.ts`
tarafından üretilir — motorun CO2 korozyon hızı, SLC/ATL-CTL kategorisi ve
malzeme seçimi merdiveni hesaplarının, ilgili standardın kendi
referans/örnek vakalarını ne kadar yakın yeniden ürettiğini gösterir
("model sadakati" — bkz. [Sorumluluk Reddi](sorumluluk-reddi.md), bu
proje asla "%95 doğruluk" gibi bir ifade kullanmaz).

Rapor her `main` push'unda ve her sürüm etiketinde (`.github/workflows/
docs.yml` / `release.yml`) OTOMATİK olarak yeniden üretilir — elle
düzenlenmez, aşağıdaki gömülü içerik her zaman en güncel motor koduna
aittir.

[Raporu tam sayfa aç](../dogrulama-raporu-tam.html){ target=_blank }

<iframe src="../dogrulama-raporu-tam.html" style="width:100%; height:1400px; border:1px solid var(--md-default-fg-color--lightest);"></iframe>
