# ⚡ Elektrik Bütçe

Hedef aylık faturanı yaz, uygulama cihazların için bir **kullanım bütçesi** çıkarsın.
Saf HTML + CSS + JavaScript, framework yok. Telefonda ana ekrana eklenebilen PWA.

## Dosyalar

| Dosya | Ne işe yarar |
|---|---|
| `index.html` | Tüm ekranlar (Ana sayfa, Cihaz ekle, Ayrıntılar, Sonuç) |
| `style.css` | Mobil öncelikli tasarım, açık/koyu tema |
| `ayarlar.js` | **Tarife, katsayılar, cihaz kataloğu**: değiştireceğin yer burası |
| `hesap.js` | Hesaplar: fatura, ters hesap (TL → kWh), bütçe dağıtımı |
| `app.js` | Arayüz: ekran geçişleri, localStorage, olaylar |
| `manifest.json` | PWA kimliği (ad, ikon, renk) |
| `sw.js` | Service worker: çevrimdışı çalışma |

## Bilgisayarda çalıştırma

Klasörün içinde bir terminal aç ve şunu çalıştır:

```bash
python -m http.server 8000
```

Sonra tarayıcıda **http://localhost:8000** adresini aç. Durdurmak için terminalde `Ctrl + C`.

> `index.html`'e çift tıklayarak da açılır ama service worker (çevrimdışı) sadece
> `localhost` veya `https` üzerinde çalışır.

**Kodu değiştirdiğinde:** sayfayı yenile (F5). Değişmiyorsa `Ctrl + Shift + R`.
Telefona yüklediysen `sw.js` içindeki `ONBELLEK` sürümünü artır (`v2` → `v3`).

## Telefonda deneme

1. Bilgisayar ve telefon aynı Wi-Fi'de olsun.
2. Bilgisayarın IP adresini bul: PowerShell'de `ipconfig` (ör. `192.168.1.35`).
3. Telefonda `http://192.168.1.35:8000` adresini aç.

Bu şekilde uygulama çalışır, ama **ana ekrana tam PWA olarak ekleme ve çevrimdışı çalışma
https ister.** Bunun için klasörü ücretsiz olarak GitHub Pages veya Netlify'a yükleyebilirsin.
Sonra Chrome'da (Android) "Ana ekrana ekle", Safari'de (iPhone) Paylaş → "Ana Ekrana Ekle".

## Hesap nasıl çalışıyor?

1. **Fatura:** `kWh = Watt × Saat / 1000`. kWh kademeli tarifeyle TL'ye çevrilir, üstüne tüketim vergisi ve KDV eklenir.
2. **Ters hesap:** Hedef TL'ye denk gelen kWh, ikili arama ile bulunur (`hedeftenKwhBul`).
3. **Sürekli cihazlar** (buzdolabı) ve **elle sabitlediğin süreler** önce bütçeden düşülür.
4. **Kalan kWh** diğer cihazlara dağıtılır. Her cihazın ağırlığı = *tipik aylık saat × ayrıntı çarpanı*.
   Hepsi aynı oranda büyütülür ya da küçültülür. Bir cihaz gerçekçi üst sınırına
   (`enFazlaKat`) ulaşırsa orada durur ve artan pay diğerlerine geçer.

## Marka / model seçimi

Buzdolabı, Televizyon, Klima veya Çamaşır makinesi seçince "Kendi modelini bul" bölümü açılır.
Kategori seç (ör. "Alttan donduruculu", "55 inç", "12000 BTU") ya da marka/model yaz,
modelini seç: watt otomatik dolar.

- Veriler `ayarlar.js` → `MODEL_KATALOGU` içinde, her modelin `kaynak` alanıyla.
- **Buzdolabı:** etiketteki yıllık kWh → ortalama watt (`yıllık kWh × 1000 ÷ 8760`).
- **Televizyon:** etiketteki SDR açık mod gücü (W ya da "kWh/1000 saat", aynı sayı).
- **Klima:** etiketteki yıllık soğutma kWh. AB etiketi bunu 350 saat için hesaplar,
  o yüzden `watt = kWh × 1000 ÷ 350`. Sadece soğutma; ısıtmada tüketim farklıdır.
- **Çamaşır makinesi:** etiketteki "kWh/100 yıkama" (Eko 40-60) → bir yıkama = kWh ÷ 100,
  `watt = bir yıkama ÷ 1,5 saat`. Sıcak programlar daha çok yakar.
- Yeni model eklemek için ilgili kategoriye bir satır ekle. Yeni bir cihaz türü için
  (ör. "Klima") `MODEL_KATALOGU`'na `CIHAZ_KATALOGU`'ndaki adıyla bir anahtar ekle.

## Ampul sayısı ve kullanım soruları

- **Aydınlatma:** ampul türünü seç (LED, tasarruflu, akkor/halojen), sonra **ampul sayısını**
  −/+ ile gir. Toplam güç = bir ampulün watt'ı × ampul sayısı.
- **Kullanım sorusu:** her cihaz en doğal birimle sorulur, hazır düğmelerle cevaplanır
  (fazlası kutuya yazılır). Boş bırakılırsa ortalama kullanım varsayılır.

| Cihaz | Soru | Bir "kez" |
|---|---|---|
| TV, klima, ısıtıcı, bilgisayar, aydınlatma, elle eklenen | günde kaç **saat** | – |
| Çamaşır, bulaşık makinesi | haftada kaç **yıkama** | 1,5 sa |
| Fırın | haftada kaç **kez** | 1 sa |
| Saç kurutma | haftada kaç **kez** (evdeki herkes) | 10 dk |
| Süpürge | haftada kaç **kez** | 30 dk |
| Ütü | haftada kaç **saat** | – |
| Su ısıtıcısı, mikrodalga | günde kaç **kez** | 3 dk |
| Buzdolabı | sorulmaz (7/24) | – |

- Cevap aylık saate çevrilir: günde → × 30, haftada → × 30/7, "kez" → ayrıca × bir kezin süresi.
  Dağıtımda tahmin yerine **senin alışkanlığın** kullanılır.
- Plan alışkanlığını aşmaz (`aliskanlikEnFazlaKat: 1`). Bütçe fazla gelirse "faturan hedefin
  altında kalır" uyarısı çıkar. Bütçe azsa süreler orantılı kısılır ve sonuç aynı birimle
  gösterilir ("haftada 1,5 yıkama").
- Sorular, düğmeler ve süreler `ayarlar.js` → `CIHAZ_KATALOGU` içindeki `kullanim` alanında.

## Tasarruf ipuçları ve renkler

- Sonuç ekranında grafiğin altında **"Nerelerden kısabilirsin?"** kartı çıkar (en fazla 4 öneri):
  bütçe yetmiyorsa en çok kısılması gereken cihazlar, en çok harcayan cihaz ve "biraz azaltırsan
  ayda ~X TL", eski ampuller için LED'e geçiş kazancı, cihaza göre genel bir öneri.
  TL tasarrufu kademeli tarifeyle gerçekten hesaplanır (`tasarrufTL`).
- Sağ üstteki 🎨 düğmesi: **Görünüm** (Otomatik / Açık / Koyu) ve **Renk** (Turuncu, Kırmızı,
  Mavi, Mor). Renkler `style.css` → `[data-renk="..."]` kurallarında, açık ve koyu tema için ayrı ton.

## Canlı site ve iPhone'a yükleme (App Store olmadan)

- **Site:** https://ensozrr.github.io/elektrik-butce/
- **Kod:** https://github.com/Ensozrr/elektrik-butce (GitHub Pages, `main` dalının kökünden yayınlanır)

iPhone'da linki **Safari** ile aç → Paylaş düğmesi → **Ana Ekrana Ekle**. Uygulama ana ekrandan
tam ekran açılır, internet olmadan da çalışır, veriler telefonda kalır.

**Güncelleme yayınlamak:** kodu değiştir, `sw.js` içindeki `ONBELLEK` sürümünü artır, sonra:

```bash
git add -A
git commit -m "Ne değişti"
git push
```

1-2 dakika içinde site güncellenir. Telefonda uygulamayı kapatıp açınca yeni sürüm gelir.

## ⚠️ Tarifeyi güncelle

`ayarlar.js` içindeki `TARIFE` değerleri **tahminidir**. Kademe sınırlarını, birim fiyatları
ve vergi oranlarını şuralardan kontrol et:
- **EPDK** tarife tabloları: https://www.epdk.gov.tr
- Bölgendeki **elektrik dağıtım / görevli tedarik şirketinin** sitesi
- Kendi faturan: kWh ve TL'yi karşılaştırıp kalibre edebilirsin.

## Sonraki aşamalar (henüz yapılmadı)
- Google Play / App Store'a taşıma
- HomeKit ve ESP32 ile gerçek ölçüm
- Geçmiş faturaları kaydedip karşılaştırma
