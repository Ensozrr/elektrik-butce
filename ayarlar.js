/* =====================================================================
   AYARLAR.JS — Uygulamanın tüm "ayar" değerleri burada.
   Kodun geri kalanına dokunmadan tarifeyi, katsayıları ve cihaz
   listesini buradan değiştirebilirsin.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) ELEKTRİK TARİFESİ
   ⚠️ DİKKAT: Aşağıdaki değerler TAHMİNİDİR, gerçek fatura farklı olabilir!
   Güncel değerleri mutlaka şuradan kontrol et ve buraya yaz:
     - EPDK tarife tabloları: https://www.epdk.gov.tr  (Elektrik > Tarifeler)
     - Kendi dağıtım/görevli tedarik şirketinin sitesi ve kendi faturan
   Tarifeler yılda birkaç kez değişebilir.
   --------------------------------------------------------------------- */
const TARIFE = {
  guncellemeTarihi: "Tahmini değerler — kontrol et!",

  // Kademeli tarife: aylık tüketim "sinir" kWh'e kadar olan kısım o
  // kademenin birim fiyatından hesaplanır, üstü bir sonraki kademeden.
  // fiyat = vergiler HARİÇ, enerji + dağıtım bedeli toplamı (TL/kWh).
  kademeler: [
    { sinir: 250,      fiyat: 2.60 }, // 1. kademe: ilk 250 kWh (tahmini)
    { sinir: Infinity, fiyat: 3.90 }  // 2. kademe: 250 kWh üstü (tahmini)
  ],

  // Vergi oranları (0.05 = %5). Tahminidir, faturandan kontrol et.
  vergiler: {
    tuketimVergisi: 0.05, // Elektrik/belediye tüketim vergisi (BTV/ETV)
    kdv: 0.20             // KDV (konut için oran değişmiş olabilir, kontrol et)
  }
};

/* ---------------------------------------------------------------------
   2) AYRINTI KATSAYILARI (Ekran 3'teki cevaplar dağılımı nasıl etkiler)
   Her cihazın bir "kategori"si var (aşağıdaki katalogda). Katsayılar
   kategoriye göre çarpılır. 1.0 = etkisiz, 2.0 = iki kat ağırlık.
   --------------------------------------------------------------------- */
const KATSAYILAR = {
  // Kullanıcı bir soruyu boş bırakırsa bu varsayılanlar kullanılır.
  varsayilanKisi: 3,
  varsayilanOda: 3,

  // Varsayılandan fazla olan HER kişi için ağırlık bu oranda artar
  // (eksik her kişi için aynı oranda azalır). 0.25 = kişi başı %25.
  kisiBasinaArtis: {
    camasir: 0.25,   // çamaşır makinesi
    utu: 0.20,
    bulasik: 0.20,
    mutfak: 0.15,    // fırın, mikrodalga, su ısıtıcısı
    kisisel: 0.25,   // saç kurutma
    eglence: 0.10    // TV, bilgisayar
  },

  // Varsayılandan fazla olan her oda için ağırlık artışı.
  odaBasinaArtis: {
    aydinlatma: 0.20,
    temizlik: 0.15,  // süpürge
    isitma: 0.15,
    sogutma: 0.10
  },

  // Isınma şekli → kategori çarpanları
  isinma: {
    elektrik:  { isitma: 3.0 },
    dogalgaz:  { isitma: 0.4 },
    soba:      { isitma: 0.4 },
    klima:     { isitma: 1.5, sogutma: 1.5 },
    bilinmiyor: {}
  },

  // Mevsim → kategori çarpanları
  mevsim: {
    yaz: { sogutma: 2.5, isitma: 0.05, aydinlatma: 0.8 },
    kis: { sogutma: 0.1, isitma: 2.0,  aydinlatma: 1.3 },
    ara: { sogutma: 0.5, isitma: 0.5 },
    bilinmiyor: {}
  },

  // Bir katsayı bu değerin altına düşmesin (cihaz tamamen yok olmasın).
  enDusukCarpan: 0.05,

  // Gerçekçilik sınırı: bir cihaz, (ayarlanmış) tipik kullanımının en fazla
  // bu kadar katına çıkabilir. Az cihaz varken "TV günde 15 saat" gibi
  // saçma sonuçları önler; kalan bütçe "artan" olarak gösterilir.
  enFazlaKat: 2.5,

  // Kullanıcı "günde X saat kullanıyorum" dediyse plan bunun en fazla bu
  // katına çıkar. 1 = alışkanlığından fazlasını önerme; bütçe artarsa
  // "hedefin altında kalırsın" uyarısı çıkar.
  aliskanlikEnFazlaKat: 1
};

/* ---------------------------------------------------------------------
   3) HAZIR CİHAZ KATALOĞU
   watt       : ortalama güç (kullanıcı değiştirebilir)
   tipikSaat  : tipik bir hanede AYLIK kullanım saati. Kullanıcı kullanım
                sorusunu boş bırakırsa bu kullanılır (dağıtım ağırlığı)
   kategori   : katsayıların hangi gruba uygulanacağı
   surekli    : true ise 7/24 prizde (buzdolabı gibi), önce bütçeden düşülür
   calismaOrani: sürekli cihazın gerçekte çalıştığı zaman oranı
   dongu      : sonuçta saat yerine "yıkama" gibi döngüyle gösterilecekse
   ampul      : true ise "ampul sayısı" sorulur, toplam watt = watt × sayı

   kullanim   : cihaz eklerken sorulacak KULLANIM sorusu
     soru       : ekranda görünen soru
     birim      : "gun" (günde) ya da "hafta" (haftada)
     tur        : "saat" (kaç saat) ya da "kez" (kaç kez / kaç yıkama)
     kezSaat    : tur "kez" ise bir kullanım kaç saat sürer (ör. yıkama 1,5)
     kezAd      : sonuçta nasıl yazılsın ("yıkama", "kez")
     secenekler : hazır düğmeler (daha fazlası için kutuya yazılır)
   Uygulama cevabı AYLIK saate çevirir:
     günde  : değer × 30 gün
     haftada: değer × 30/7 (bir ayda ~4,3 hafta)
     kez    : ayrıca × kezSaat
   --------------------------------------------------------------------- */

// Hazır düğme listeleri (tekrar yazmamak için)
const SAAT_1_6 = [1, 2, 3, 4, 5, 6];
const KEZ_1_7 = [1, 2, 3, 4, 5, 6, 7];

const CIHAZ_KATALOGU = [
  { ad: "Televizyon",             watt: 100,  tipikSaat: 120, kategori: "eglence",
    kullanim: { soru: "Televizyon günde kaç saat açık kalıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } },
  // Ütü her gün yapılmaz → haftalık saat sormak daha kolay
  { ad: "Ütü",                    watt: 2000, tipikSaat: 6,   kategori: "utu",
    kullanim: { soru: "Haftada kaç saat ütü yapıyorsun?", birim: "hafta", tur: "saat", secenekler: [0.5, 1, 2, 3, 4] } },
  // Çamaşır makinesi: 600 W × 1,5 sa ≈ 0,9 kWh/yıkama (40–60°C karışık kullanım).
  // Isıtıcı sadece suyu ısıtırken 2000 W çeker, yıkamanın çoğu düşük güçtedir.
  { ad: "Çamaşır makinesi",       watt: 600,  tipikSaat: 18,  kategori: "camasir",
    dongu: { ad: "yıkama", saat: 1.5 },
    kullanim: { soru: "Haftada kaç kez çamaşır yıkıyorsun?", birim: "hafta", tur: "kez",
                kezSaat: 1.5, kezAd: "yıkama", secenekler: KEZ_1_7 } },
  { ad: "Bulaşık makinesi",       watt: 1300, tipikSaat: 20,  kategori: "bulasik",
    dongu: { ad: "yıkama", saat: 1.5 },
    kullanim: { soru: "Haftada kaç kez bulaşık makinesi çalıştırıyorsun?", birim: "hafta", tur: "kez",
                kezSaat: 1.5, kezAd: "yıkama", secenekler: KEZ_1_7 } },
  // Buzdolabı: watt = ORTALAMA güç. Yıllık ~300 kWh ÷ 8,76 ≈ 34 W.
  // 7/24 çalıştığı için kullanım sorusu YOK.
  { ad: "Buzdolabı",              watt: 34,   tipikSaat: 720, kategori: "surekli",
    surekli: true, calismaOrani: 1 },
  { ad: "Klima",                  watt: 1200, tipikSaat: 60,  kategori: "sogutma",
    kullanim: { soru: "Klima günde kaç saat çalışıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } },
  // Isıtıcı mevsimde her gün açılır → günlük saat
  { ad: "Elektrikli ısıtıcı",     watt: 2000, tipikSaat: 30,  kategori: "isitma",
    kullanim: { soru: "Isıtıcı günde kaç saat açık kalıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } },
  // Fırın: bir pişirme ~1 saat
  { ad: "Fırın",                  watt: 2200, tipikSaat: 10,  kategori: "mutfak",
    kullanim: { soru: "Haftada kaç kez fırın yakıyorsun?", birim: "hafta", tur: "kez",
                kezSaat: 1, kezAd: "kez", secenekler: KEZ_1_7 } },
  // Saç kurutma: bir kullanım ~10 dakika (evdeki herkesin toplamı)
  { ad: "Saç kurutma makinesi",   watt: 1500, tipikSaat: 4,   kategori: "kisisel",
    kullanim: { soru: "Evde haftada toplam kaç kez saç kurutuluyor?", birim: "hafta", tur: "kez",
                kezSaat: 10 / 60, kezAd: "kez", secenekler: KEZ_1_7 } },
  { ad: "Bilgisayar",             watt: 150,  tipikSaat: 90,  kategori: "eglence",
    kullanim: { soru: "Bilgisayar günde kaç saat açık kalıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } },
  // Süpürge: bir temizlik ~30 dakika
  { ad: "Elektrikli süpürge",     watt: 1200, tipikSaat: 4,   kategori: "temizlik",
    kullanim: { soru: "Haftada kaç kez süpürge yapıyorsun?", birim: "hafta", tur: "kez",
                kezSaat: 0.5, kezAd: "kez", secenekler: KEZ_1_7 } },
  // Aydınlatma: watt = BİR ampulün gücü. Kullanıcı ampul sayısını girer,
  // toplam güç = ampul watt × ampul sayısı. Varsayılan: 6 adet 9 W LED.
  { ad: "Aydınlatma (ampuller)",  watt: 9,    tipikSaat: 150, kategori: "aydinlatma",
    ampul: true, varsayilanAmpul: 6,
    kullanim: { soru: "Işıklar günde ortalama kaç saat yanıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } },
  // Su ısıtıcısı ve mikrodalga her gün birkaç kez, kısa süre (~3 dk) çalışır
  // → "günde kaç kez" sormak saatten çok daha kolay
  { ad: "Su ısıtıcısı (kettle)",  watt: 2000, tipikSaat: 5,   kategori: "mutfak",
    kullanim: { soru: "Günde kaç kez su ısıtıyorsun (çay, kahve)?", birim: "gun", tur: "kez",
                kezSaat: 3 / 60, kezAd: "kez", secenekler: SAAT_1_6 } },
  { ad: "Mikrodalga",             watt: 900,  tipikSaat: 5,   kategori: "mutfak",
    kullanim: { soru: "Günde kaç kez mikrodalga kullanıyorsun?", birim: "gun", tur: "kez",
                kezSaat: 3 / 60, kezAd: "kez", secenekler: SAAT_1_6 } }
];

/* ---------------------------------------------------------------------
   4) MARKA / MODEL KATALOĞU
   Katalogdaki bir cihazın (anahtar = yukarıdaki "ad") popüler modelleri.
   Kullanıcı kategori seçer veya marka yazar, kendi modelini seçer,
   watt otomatik gelir.

   Değerler AB enerji etiketlerinden ve Türk satıcı/karşılaştırma
   sitelerinden alındı (Kasım 2026). Her modelin "kaynak" alanında
   nereden alındığı yazıyor. Etiket değerleri standart test sonucudur;
   evdeki gerçek tüketim biraz farklı olabilir.

   Etiketlerde birim cihaza göre farklıdır, hepsi watt'a çevrilir:
   yillikKwh  : BUZDOLABI "kWh/yıl" → watt = yillikKwh × 1000 / 8760 saat
   watt       : TELEVİZYON SDR "açık mod" gücü (W = kWh/1000 saat)
   sogutmaKwh : KLİMA yıllık soğutma tüketimi. AB etiketi bunu yılda
                350 saat soğutma için hesaplar → watt = kWh × 1000 / 350
   yikamaKwh  : ÇAMAŞIR MAKİNESİ "kWh/100 yıkama" (Eko 40-60 programı)
                → bir yıkama = kWh / 100 → watt = bir yıkama ÷ döngü saati
   --------------------------------------------------------------------- */
const MODEL_KATALOGU = {
  "Buzdolabı": {
    kategoriler: [
      { ad: "Üstten donduruculu", modeller: [
        { marka: "Arçelik", model: "570475 EI", yillikKwh: 274, not: "No Frost, 475 L, E sınıfı",
          kaynak: "mediamarkt.com.tr" },
        { marka: "Beko", model: "978556 EB", yillikKwh: 303, not: "No Frost, 557 L, E sınıfı",
          kaynak: "koctas.com.tr" },
        { marka: "Vestel", model: "NF6002 E", yillikKwh: 334, not: "No Frost, 600 L, Wi-Fi",
          kaynak: "epey.com" }
      ]},
      { ad: "Alttan donduruculu (kombi)", modeller: [
        { marka: "Bosch", model: "KGN56IJE0N", yillikKwh: 262, not: "No Frost, E sınıfı",
          kaynak: "epey.com" },
        { marka: "Samsung", model: "RB34C675EBN", yillikKwh: 254, not: "No Frost, 344 L, E sınıfı",
          kaynak: "ox.ee (AB etiketi)" },
        { marka: "Beko", model: "670475 MG", yillikKwh: 285, not: "No Frost, 475 L, E sınıfı",
          kaynak: "epey.com" }
      ]},
      { ad: "Gardırop (side-by-side)", modeller: [
        { marka: "Samsung", model: "RS62DG5003S9", yillikKwh: 351, not: "635 L, E sınıfı",
          kaynak: "alternate.de (AB etiketi)" }
      ]},
      { ad: "Tek kapılı / küçük", modeller: [
        { marka: "Vestel", model: "NFT44011 EX", yillikKwh: 121, not: "Sadece soğutucu, E sınıfı",
          kaynak: "epey.com" },
        { marka: "Siemens", model: "KI20FA50", yillikKwh: 151, not: "93 L, ankastre",
          kaynak: "icecat" }
      ]}
    ]
  },

  "Televizyon": {
    kategoriler: [
      { ad: "32 inç", modeller: [
        { marka: "Vestel", model: "32H9530M", watt: 26, not: "HD, E sınıfı",
          kaynak: "epey.com (26 kWh/1000 sa)" }
      ]},
      { ad: "43 inç", modeller: [
        { marka: "Samsung", model: "UE43DU7100", watt: 53, not: "4K Crystal UHD",
          kaynak: "tvsfaq / satıcı etiketi" },
        { marka: "Philips", model: "43PUS8118", watt: 51, not: "4K Ambilight, F sınıfı",
          kaynak: "ürün fişi (EPREL)" }
      ]},
      { ad: "55 inç", modeller: [
        { marka: "Samsung", model: "UE55DU7100", watt: 80, not: "4K Crystal UHD, G sınıfı",
          kaynak: "EPREL (UE55DU7192U kardeş model)" },
        { marka: "LG", model: "55UT73", watt: 84, not: "4K UHD, G sınıfı",
          kaynak: "EPREL (55UT73003LA)" },
        { marka: "LG", model: "OLED55C4", watt: 81, not: "OLED evo",
          kaynak: "EPREL (OLED55C44LA)" }
      ]},
      { ad: "65 inç", modeller: [
        { marka: "Samsung", model: "UE65DU7100", watt: 110, not: "4K Crystal UHD, G sınıfı",
          kaynak: "EPREL (UE65DU7105K kardeş model)" }
      ]}
    ]
  },

  // Ampul türleri: watt = BİR ampulün gücü. Değerler piyasadaki tipik
  // ampullerin etiket gücüdür. "Işık" = yaklaşık hangi eski akkor ampul
  // kadar aydınlattığı (ör. 9 W LED ≈ 60 W akkor, ~806 lümen).
  "Aydınlatma (ampuller)": {
    kategoriler: [
      { ad: "LED", modeller: [
        { marka: "LED", model: "5 W", watt: 5, not: "≈ 40 W akkor ışığı" },
        { marka: "LED", model: "9 W", watt: 9, not: "≈ 60 W akkor ışığı, en yaygın" },
        { marka: "LED", model: "13 W", watt: 13, not: "≈ 100 W akkor ışığı" }
      ]},
      { ad: "Tasarruflu (floresan)", modeller: [
        { marka: "Tasarruflu", model: "15 W", watt: 15, not: "≈ 60 W akkor ışığı" },
        { marka: "Tasarruflu", model: "23 W", watt: 23, not: "≈ 100 W akkor ışığı" }
      ]},
      { ad: "Akkor / halojen (eski tip)", modeller: [
        { marka: "Halojen", model: "42 W", watt: 42, not: "≈ 60 W akkor ışığı" },
        { marka: "Akkor", model: "60 W", watt: 60, not: "Klasik sarı ampul" },
        { marka: "Akkor", model: "100 W", watt: 100, not: "Klasik sarı ampul" }
      ]}
    ]
  },

  // Klima: değerler SOĞUTMA modu içindir. Isıtmada tüketim farklıdır.
  "Klima": {
    kategoriler: [
      { ad: "9000 BTU", modeller: [
        { marka: "Arçelik", model: "Ekolojik 09325", sogutmaKwh: 125, not: "Inverter, A++",
          kaynak: "epey.com / mediamarkt.com.tr" },
        { marka: "Vestel", model: "Vega Plus Inverter G 096", sogutmaKwh: 133, not: "Inverter",
          kaynak: "epey.com" }
      ]},
      { ad: "12000 BTU", modeller: [
        { marka: "Arçelik", model: "12670", sogutmaKwh: 135, not: "Inverter, A+++",
          kaynak: "mediamarkt.com.tr" },
        { marka: "Vestel", model: "Flora Doğa Inverter 126", sogutmaKwh: 180, not: "Inverter, A++, SEER 6,6",
          kaynak: "epey.com" },
        { marka: "Arçelik", model: "Ekolojik 12325", sogutmaKwh: 186, not: "Inverter, A++",
          kaynak: "epey.com" }
      ]},
      { ad: "18000 BTU", modeller: [
        { marka: "Beko", model: "Ekolojik 31825", sogutmaKwh: 250, not: "Inverter",
          kaynak: "epey.com" },
        { marka: "Baymak", model: "Elegant Plus 18", sogutmaKwh: 263, not: "Inverter, A++",
          kaynak: "epey.com" },
        { marka: "Vestel", model: "Vega Plus Inverter 186", sogutmaKwh: 285, not: "Inverter",
          kaynak: "epey.com" }
      ]},
      { ad: "24000 BTU", modeller: [
        { marka: "LG", model: "S3-M24K22FA Dual Plus", sogutmaKwh: 335, not: "Dual Inverter, A++",
          kaynak: "lg.com/tr" }
      ]}
    ]
  },

  // Çamaşır makinesi: hepsi 9 kg. Kategoriler 100 yıkamadaki tüketime göre.
  // Etiket "Eko 40-60" programına göredir; sıcak (60°C+) yıkamalar daha çok yakar.
  "Çamaşır makinesi": {
    kategoriler: [
      { ad: "Çok verimli (≤50 kWh/100)", modeller: [
        { marka: "Beko", model: "CMB 9120 OG", yikamaKwh: 44, not: "9 kg, 1200 devir, A sınıfı",
          kaynak: "epey.com" },
        { marka: "Bosch", model: "WGA244F0TR", yikamaKwh: 46, not: "9 kg, 1400 devir, A sınıfı",
          kaynak: "Bosch teknik föyü" },
        { marka: "Bosch", model: "WGA242X3TR", yikamaKwh: 49, not: "9 kg, 1200 devir, A sınıfı",
          kaynak: "BSH teknik föyü" },
        { marka: "Beko", model: "CM 9120 BI", yikamaKwh: 49, not: "9 kg, 1200 devir",
          kaynak: "idefix.com" }
      ]},
      { ad: "Orta (51–65 kWh/100)", modeller: [
        { marka: "Arçelik", model: "9120 M", yikamaKwh: 57, not: "9 kg, 1200 devir, B sınıfı",
          kaynak: "epey.com" }
      ]},
      { ad: "Yüksek (>65 kWh/100)", modeller: [
        { marka: "Bosch", model: "WAU24T91TR", yikamaKwh: 66, not: "9 kg, 1200 devir, C sınıfı",
          kaynak: "Bosch teknik föyü" },
        { marka: "Samsung", model: "WW90T4040CE", yikamaKwh: 76, not: "9 kg, 1400 devir",
          kaynak: "alza.cz (AB etiketi)" }
      ]}
    ]
  }
};

// Bir modelin watt değerini bul. Etiketteki birim cihaza göre değiştiği
// için her türü ayrı çeviriyoruz. "cihaz" = CIHAZ_KATALOGU'ndaki kayıt.
function modelWatt(m, cihaz) {
  if (m.watt) return m.watt;                                        // TV
  if (m.yillikKwh) return Math.round((m.yillikKwh * 1000) / 8760);  // buzdolabı
  if (m.sogutmaKwh) return Math.round((m.sogutmaKwh * 1000) / 350); // klima
  if (m.yikamaKwh) {                                                // çamaşır
    const birYikamaKwh = m.yikamaKwh / 100;
    const saat = (cihaz && cihaz.dongu) ? cihaz.dongu.saat : 1.5;
    return Math.round((birYikamaKwh * 1000) / saat);
  }
  return 0;
}

// Model listesinde gösterilecek etiket bilgisi (ör. "274 kWh/yıl")
function modelEtiketMetni(m) {
  if (m.yillikKwh) return `${m.yillikKwh} kWh/yıl`;
  if (m.sogutmaKwh) return `${m.sogutmaKwh} kWh/yıl soğutma`;
  if (m.yikamaKwh) return `${(m.yikamaKwh / 100).toLocaleString("tr-TR")} kWh/yıkama`;
  return "";
}

// Elle eklenen (katalogda olmayan) cihazlar için varsayılanlar
const OZEL_CIHAZ_VARSAYILAN = { tipikSaat: 30, kategori: "diger", calismaOrani: 1,
  kullanim: { soru: "Bu cihaz günde kaç saat çalışıyor?", birim: "gun", tur: "saat", secenekler: SAAT_1_6 } };

// Kullanım cevabını AYLIK saate çevir. k = kullanim ayarı, deger = cevap
function kullanimAylikSaat(k, deger) {
  const ayda = k.birim === "gun" ? AYDAKI_GUN : AYDAKI_GUN / 7;  // ayda kaç gün/hafta
  const saat = k.tur === "kez" ? deger * k.kezSaat : deger;       // bir gün/haftadaki saat
  return saat * ayda;
}

// "haftada 3 yıkama", "günde 4 saat" gibi kısa metin
function kullanimMetni(k, deger) {
  const sayiMetni = deger.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  const birim = k.birim === "gun" ? "günde" : "haftada";
  const ne = k.tur === "kez" ? (k.kezAd || "kez") : "saat";
  return `${birim} ${sayiMetni} ${ne}`;
}

// Ay kaç gün sayılsın (günlük süre = aylık / bu sayı)
const AYDAKI_GUN = 30;
