/* =====================================================================
   HESAP.JS — Saf hesap fonksiyonları (ekranla ilgisi yok).
   Burada sadece sayılar girer, sayılar çıkar. Böylece test etmesi kolay.
   ===================================================================== */

/* Bir cihazın tüketimi: kWh = Watt × Saat / 1000 */
function kwhHesapla(watt, saat) {
  return (watt * saat) / 1000;
}

/* kWh → TL fatura (kademeli tarife + vergiler)
   Örnek: 300 kWh, kademe sınırı 250 ise:
   ilk 250 kWh 1. fiyattan, kalan 50 kWh 2. fiyattan. */
function faturaHesapla(kwh) {
  let kalan = kwh;
  let oncekiSinir = 0;
  let bedel = 0;

  for (const kademe of TARIFE.kademeler) {
    const buKademedekiKwh = Math.min(kalan, kademe.sinir - oncekiSinir);
    if (buKademedekiKwh <= 0) break;
    bedel += buKademedekiKwh * kademe.fiyat;
    kalan -= buKademedekiKwh;
    oncekiSinir = kademe.sinir;
  }

  // Önce tüketim vergisi, sonra KDV (KDV, vergili tutar üzerinden alınır)
  const tuketimVergisi = bedel * TARIFE.vergiler.tuketimVergisi;
  const kdv = (bedel + tuketimVergisi) * TARIFE.vergiler.kdv;
  return bedel + tuketimVergisi + kdv;
}

/* TERS HESAP: TL hedef → kaç kWh kullanılabilir?
   Fatura kWh arttıkça hep artar; o yüzden "ikili arama" (binary search)
   ile doğru kWh'i buluruz: aralığı her adımda ikiye bölüp daraltırız. */
function hedeftenKwhBul(hedefTL) {
  if (hedefTL <= 0) return 0;
  let alt = 0;
  let ust = 100000; // 100.000 kWh — hiçbir evin geçemeyeceği bir üst sınır
  for (let i = 0; i < 60; i++) {
    const orta = (alt + ust) / 2;
    if (faturaHesapla(orta) > hedefTL) ust = orta;
    else alt = orta;
  }
  return alt;
}

/* Kullanıcının söylediği alışkanlığın AYLIK saat karşılığı (yoksa 0).
   aliskanlikAylik: yeni kayıtlar (cihaz eklerken hesaplanır)
   gunlukSaat     : eski kayıtlar (önceki sürümde sadece günlük saat vardı) */
function aliskanlikAylikSaat(c) {
  if (c.aliskanlikAylik > 0) return c.aliskanlikAylik;
  if (c.gunlukSaat > 0) return c.gunlukSaat * AYDAKI_GUN;
  return 0;
}

/* Sürekli çalışan cihazın aylık kWh'i (ör. buzdolabı):
   watt × 24 saat × 30 gün × çalışma oranı / 1000 */
function surekliKwh(cihaz) {
  const oran = cihaz.calismaOrani ?? 1;
  return kwhHesapla(cihaz.watt, 24 * AYDAKI_GUN * oran);
}

/* Ayrıntılara göre bir kategorinin çarpanını bul.
   ayrintilar = { kisi, oda, isinma, mevsim } — boş olanlar varsayılan sayılır */
function kategoriCarpani(kategori, ayrintilar) {
  const K = KATSAYILAR;
  const a = ayrintilar || {};
  let carpan = 1;

  // Kişi sayısı etkisi
  const kisi = a.kisi || K.varsayilanKisi;
  if (K.kisiBasinaArtis[kategori] !== undefined) {
    carpan *= 1 + (kisi - K.varsayilanKisi) * K.kisiBasinaArtis[kategori];
  }

  // Oda sayısı etkisi
  const oda = a.oda || K.varsayilanOda;
  if (K.odaBasinaArtis[kategori] !== undefined) {
    carpan *= 1 + (oda - K.varsayilanOda) * K.odaBasinaArtis[kategori];
  }

  // Isınma şekli ve mevsim etkisi
  const isinma = K.isinma[a.isinma || "bilinmiyor"] || {};
  if (isinma[kategori] !== undefined) carpan *= isinma[kategori];

  const mevsim = K.mevsim[a.mevsim || "bilinmiyor"] || {};
  if (mevsim[kategori] !== undefined) carpan *= mevsim[kategori];

  return Math.max(carpan, K.enDusukCarpan);
}

/* ANA FONKSİYON: Bütçe planını çıkarır.
   cihazlar   : [{ id, ad, watt, surekli, calismaOrani, tipikSaat, kategori }]
   hedefTL    : kullanıcının istediği fatura
   ayrintilar : { kisi, oda, isinma, mevsim } (boş olabilir)
   sabitSaatler: { cihazId: aylıkSaat } — kullanıcının elle sabitlediği süreler

   Döndürdüğü nesne: her cihazın aylık saati, kWh'i ve toplamlar. */
function butcePlaniHesapla(cihazlar, hedefTL, ayrintilar, sabitSaatler) {
  sabitSaatler = sabitSaatler || {};
  const toplamButceKwh = hedeftenKwhBul(hedefTL);
  const MAKS_SAAT = 24 * AYDAKI_GUN; // bir ayda en fazla 720 saat olabilir

  // 1) Sürekli çalışanları ve elle sabitlenenleri bütçeden ÖNCE düş
  let kalanKwh = toplamButceKwh;
  const sonuc = cihazlar.map(c => {
    const satir = { ...c, aylikSaat: 0, kwh: 0, sabit: false };
    if (c.surekli) {
      satir.aylikSaat = 24 * AYDAKI_GUN;
      satir.kwh = surekliKwh(c);
      kalanKwh -= satir.kwh;
    } else if (sabitSaatler[c.id] !== undefined) {
      satir.aylikSaat = sabitSaatler[c.id];
      satir.kwh = kwhHesapla(c.watt, satir.aylikSaat);
      satir.sabit = true;
      kalanKwh -= satir.kwh;
    }
    return satir;
  });

  // 2) Kalan bütçeyi diğer cihazlara ağırlıklarına göre dağıt.
  //    Ağırlık = tipik saat × ayrıntı çarpanı. Herkesin saati aynı "k"
  //    katsayısıyla çarpılır: saat = ağırlık × k. k'yi, toplam kWh bütçeye
  //    eşit olacak şekilde seçeriz. Bir cihaz üst sınırını aşarsa orada
  //    kilitlenir ve artan bütçe diğerlerine yeniden dağıtılır.
  let dagitilacaklar = sonuc.filter(s => !s.surekli && !s.sabit && s.watt > 0);
  dagitilacaklar.forEach(s => {
    const aliskanlik = aliskanlikAylikSaat(s);
    if (aliskanlik > 0) {
      // Kullanıcı kullanımını söylediyse ("günde 4 saat", "haftada 3 yıkama")
      // en doğru bilgi bu. Tahmin katsayıları uygulanmaz.
      s.agirlik = aliskanlik;
    } else {
      // Bilgi yoksa tipik kullanım × ayrıntı çarpanı (kişi, oda, mevsim...)
      s.agirlik = (s.tipikSaat || OZEL_CIHAZ_VARSAYILAN.tipikSaat) *
                  kategoriCarpani(s.kategori, ayrintilar);
    }
    // Üst sınır: tipik kullanımın en fazla "enFazlaKat" katı, asla 720 saat üstü değil
    // Kullanıcı gerçek alışkanlığını söylediyse onu çok aşan bir plan anlamsız
    const kat = aliskanlik > 0 ? KATSAYILAR.aliskanlikEnFazlaKat : KATSAYILAR.enFazlaKat;
    s.maksSaat = Math.min(MAKS_SAAT, s.agirlik * kat);
  });

  let dagitilacakKwh = Math.max(kalanKwh, 0);
  for (let tur = 0; tur < 10 && dagitilacaklar.length > 0; tur++) {
    // Σ(ağırlık × watt / 1000) → k = 1 olsaydı kaç kWh harcanırdı
    const birimKwh = dagitilacaklar.reduce((t, s) => t + s.agirlik * s.watt / 1000, 0);
    const k = birimKwh > 0 ? dagitilacakKwh / birimKwh : 0;

    const tasanlar = dagitilacaklar.filter(s => s.agirlik * k > s.maksSaat);
    if (tasanlar.length === 0) {
      dagitilacaklar.forEach(s => {
        s.aylikSaat = s.agirlik * k;
        s.kwh = kwhHesapla(s.watt, s.aylikSaat);
      });
      break;
    }
    // Taşanları üst sınırda sabitle, bütçeden düş, kalanlarla tekrar dene
    tasanlar.forEach(s => {
      s.aylikSaat = s.maksSaat;
      s.kwh = kwhHesapla(s.watt, s.maksSaat);
      s.sinirda = true;
      dagitilacakKwh -= s.kwh;
    });
    dagitilacaklar = dagitilacaklar.filter(s => !tasanlar.includes(s));
  }

  const toplamKwh = sonuc.reduce((t, s) => t + s.kwh, 0);
  return {
    cihazlar: sonuc,
    butceKwh: toplamButceKwh,
    toplamKwh: toplamKwh,
    tahminiFatura: faturaHesapla(toplamKwh),
    // Herkes üst sınırdaysa bütçe tamamen kullanılamaz → artan kWh
    artanKwh: Math.max(toplamButceKwh - toplamKwh, 0),
    yetersiz: kalanKwh < 0 // sürekli/sabit cihazlar tek başına bütçeyi aşıyor
  };
}
