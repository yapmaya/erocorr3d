# Sorumluluk Reddi

> Bu sonuçlar mühendislik tahminidir. Model belirsizliği tipik olarak 2-3
> kat mertebesindedir. Nihai malzeme seçimi yetkin bir korozyon
> mühendisinin onayını gerektirir.

Bu metin, motorun kendisinin (`packages/engine/src/corrosion/types.ts` →
`ENGINEERING_DISCLAIMER_TR`) ürettiği ve uygulamanın her sonuç ekranında/
raporunda AYNEN gösterdiği uyarıdır — burada ayrıca yazılmamış, tek
kaynaktan alınmıştır.

## Neden "doğruluk yüzdesi" yok?

Korozyon/erozyon tahmini doğası gereği belirsizdir. Kabul görmüş
metodolojilerin (NORSOK M-506, DNV-RP-O501, API 14E vb.) kendisinde 3-10
kata varan sapmalar literatürde bildirilmiştir. Bu nedenle EroCorr3D:

- **Asla** "%95 doğruluk" gibi bir ifade kullanmaz.
- Her sonucu tek bir "kesin" sayı olarak DEĞİL, merkezi değer (P50) +
  belirsizlik bandı (P10/P90) olarak sunar.
- Bunun yerine **model sadakati** (motorun, ilgili standardın kendi
  referans/örnek hesaplarını ne kadar yakın yeniden ürettiği) raporlar —
  bkz. [Doğrulama Raporu](dogrulama-raporu.md).

## Kaynak Doğrulama Protokolü (KDP)

Motordaki her mühendislik katsayısı bir kaynak atfıyla birlikte
kayıtlıdır (bkz. [Katsayı Kayıt Defteri](katsayi-kayit-defteri.md)).
Kaynağı bulunamayan/doğrulanamayan katsayılar **UNVERIFIED** olarak
işaretlenir; bu tür bir katsayı kullanıldığında hem tarayıcı konsoluna
hem de sonuç ekranındaki bir rozete otomatik uyarı yazılır. UNVERIFIED
bir sonuç, yetkin bir korozyon mühendisi tarafından bağımsız olarak
doğrulanmadan sahada/tasarımda kullanılmamalıdır.

## Genel

Bu yazılım bir **karar destek aracıdır**, nihai mühendislik onayının
YERİNE GEÇMEZ. Gerçek tesis verileriyle (ölçülmüş pH, gerçek akış hızı,
gerçek malzeme sertifikaları vb.) beslenmeyen şablon/varsayılan
değerlerle üretilen sonuçlar yalnızca kaba mertebe (order-of-magnitude)
göstergedir.
