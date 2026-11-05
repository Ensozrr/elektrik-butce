/* =====================================================================
   APP.JS — Arayüz: ekranlar arası geçiş, cihaz ekleme/silme,
   sonuçları gösterme ve verileri localStorage'da saklama.
   ===================================================================== */

/* ---------- Kısa yardımcılar ---------- */
const $ = (id) => document.getElementById(id);

// Türkçe sayı biçimi: 1234.5 → "1.234,5"
function sayi(n, ondalik = 0) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik });
}

/* ---------- Uygulama durumu (tüm veriler burada) ---------- */
const KAYIT_ANAHTARI = "elektrikButce";

let durum = {
  hedef: null,        // hedef fatura (TL)
  cihazlar: [],       // eklenen cihazlar
  ayrintilar: {},     // { kisi, oda, isinma, mevsim } — boş olabilir
  sabitSaatler: {},   // sonuç ekranında elle değiştirilen süreler
  tema: null,         // "light" | "dark" | null (sisteme uy)
  renk: null          // "kirmizi" | "mavi" | "mor" | null (turuncu)
};

// localStorage'a kaydet. Gizli sekmede hata verebilir, o yüzden try/catch.
function kaydet() {
  try { localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify(durum)); } catch (e) {}
}

function yukle() {
  try {
    const veri = JSON.parse(localStorage.getItem(KAYIT_ANAHTARI));
    if (veri) durum = { ...durum, ...veri };
  } catch (e) {}
}

/* ---------- Ekranlar arası geçiş ---------- */
const EKRAN_BASLIKLARI = {
  "ekran-ana": "⚡ Elektrik Bütçe",
  "ekran-cihaz": "Cihaz Ekle",
  "ekran-ayrinti": "Ayrıntılar",
  "ekran-sonuc": "Kullanım Bütçen"
};

function ekranGoster(id) {
  document.querySelectorAll(".ekran").forEach(e => (e.hidden = e.id !== id));
  $("baslik").textContent = EKRAN_BASLIKLARI[id];
  $("geri-btn").hidden = id === "ekran-ana";
  window.scrollTo(0, 0);
}

/* ---------- Tema ---------- */
// <html> etiketine data-theme (açık/koyu) ve data-renk (vurgu rengi) yazar.
// style.css bu iki etikete bakıp renkleri değiştirir.
function temaUygula() {
  const kok = document.documentElement;
  if (durum.tema) kok.setAttribute("data-theme", durum.tema);
  else kok.removeAttribute("data-theme");        // Otomatik: telefonun ayarına uy
  if (durum.renk) kok.setAttribute("data-renk", durum.renk);
  else kok.removeAttribute("data-renk");         // Varsayılan: turuncu

  // Paneldeki seçili düğmeleri vurgula
  document.querySelectorAll("#mod-secenekler button").forEach(b =>
    b.classList.toggle("secili", b.dataset.mod === (durum.tema || "")));
  document.querySelectorAll("#renk-secenekler button").forEach(b =>
    b.classList.toggle("secili", b.dataset.renk === (durum.renk || "")));
}

function temaPaneliAcKapa(ac) {
  const panel = $("tema-panel");
  panel.hidden = ac === undefined ? !panel.hidden : !ac;
  $("tema-btn").setAttribute("aria-expanded", String(!panel.hidden));
}

function temaPaneliHazirla() {
  $("tema-btn").onclick = (olay) => { olay.stopPropagation(); temaPaneliAcKapa(); };
  document.querySelectorAll("#mod-secenekler button").forEach(b => b.onclick = () => {
    durum.tema = b.dataset.mod || null; temaUygula(); kaydet();
  });
  document.querySelectorAll("#renk-secenekler button").forEach(b => b.onclick = () => {
    durum.renk = b.dataset.renk || null; temaUygula(); kaydet();
  });
  // Panelin dışına dokununca kapansın
  document.addEventListener("click", (olay) => {
    if (!$("tema-panel").hidden && !$("tema-panel").contains(olay.target)) temaPaneliAcKapa(false);
  });
}

/* =====================================================================
   EKRAN 1: ANA SAYFA
   ===================================================================== */
function cihazListesiCiz() {
  const ul = $("cihaz-listesi");
  ul.innerHTML = "";
  durum.cihazlar.forEach(c => {
    const li = document.createElement("li");
    // Alt satır: "6 × 9 W = 54 W · günde 5 sa" gibi
    let bilgi = c.ampulSayisi
      ? `${c.ampulSayisi} × ${sayi(c.ampulWatt)} W = ${sayi(c.watt)} W`
      : `${sayi(c.watt)} W`;
    const aliskanlik = aliskanlikMetni(c);
    if (aliskanlik) bilgi += ` · ${aliskanlik}`;
    li.innerHTML = `
      <div class="ad">
        <b></b>
        <small>${bilgi} ${c.surekli ? '<span class="rozet">sürekli</span>' : ""}</small>
      </div>
      <button class="sil-btn" aria-label="Sil">✕</button>`;
    li.querySelector("b").textContent = c.ad; // kullanıcı metni: güvenli yazım
    li.querySelector(".sil-btn").onclick = () => cihazSil(c.id);
    ul.appendChild(li);
  });
  $("bos-liste").hidden = durum.cihazlar.length > 0;
}

function cihazSil(id) {
  durum.cihazlar = durum.cihazlar.filter(c => c.id !== id);
  delete durum.sabitSaatler[id];
  kaydet();
  cihazListesiCiz();
}

/* =====================================================================
   EKRAN 2: CİHAZ EKLEME
   ===================================================================== */
function katalogDoldur() {
  const sec = $("katalog-sec");
  sec.innerHTML = '<option value="">— Listede yok, elle gireceğim —</option>';
  CIHAZ_KATALOGU.forEach((c, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${c.ad} (~${sayi(c.watt)} W)`;
    sec.appendChild(opt);
  });
}

// Listeden seçilince ad, watt ve "sürekli" kutusunu otomatik doldur
function katalogSecildi() {
  const i = $("katalog-sec").value;
  secilenModel = null;
  secilenModelKategori = null;
  $("model-ara").value = "";

  if (i === "") {
    $("cihaz-ad").value = "";
    $("cihaz-watt").value = "";
    $("cihaz-surekli").checked = false;
    $("model-bolum").hidden = true;
    ekBolumleriHazirla(null);
    return;
  }
  const c = CIHAZ_KATALOGU[i];
  $("cihaz-ad").value = c.ad;
  $("cihaz-watt").value = c.watt;
  $("cihaz-surekli").checked = !!c.surekli;

  // Bu cihazın marka/model listesi varsa göster
  $("model-bolum").hidden = !MODEL_KATALOGU[c.ad];
  if (MODEL_KATALOGU[c.ad]) modelBolumuCiz();
  ekBolumleriHazirla(c);
}

/* ---------- Ampul sayısı ve kullanım sorusu ---------- */
let aktifKullanim = null;   // seçili cihazın kullanım sorusu ayarı (ayarlar.js → kullanim)
let secilenKullanim = null; // kullanıcının cevabı (null = boş bıraktı)

// Seçilen cihaza göre ampul ve kullanım bölümlerini göster/gizle.
// c = katalog kaydı, null = elle girilen cihaz
function ekBolumleriHazirla(c) {
  const ampulMu = !!(c && c.ampul);
  $("ampul-bolum").hidden = !ampulMu;
  $("watt-etiket").textContent = ampulMu ? "Bir ampulün gücü (watt)" : "Güç (watt)";
  $("ampul-sayisi").value = ampulMu ? c.varsayilanAmpul : 1;
  ampulToplamGuncelle();

  // Her cihazın kendi sorusu var; elle girilen cihaza genel soru sorulur.
  // Buzdolabı gibi kullanim ayarı olmayan cihazlarda bölüm gizlenir.
  const sablon = c === null ? OZEL_CIHAZ_VARSAYILAN : c;
  aktifKullanim = sablon.kullanim || null;
  $("kullanim-bolum").hidden = !aktifKullanim;
  secilenKullanim = null;
  $("kullanim-diger").value = "";
  if (aktifKullanim) {
    $("kullanim-etiket").textContent = aktifKullanim.soru;
    $("kullanim-diger").placeholder = aktifKullanim.tur === "kez"
      ? "Daha fazlaysa yaz (ör. 10)" : "Daha fazlaysa yaz (ör. 8)";
    kullanimCipleriCiz();
  }
  kullanimGoster();
}

function ampulSayisiOku() {
  const n = parseInt($("ampul-sayisi").value);
  return n > 0 ? n : 1;
}

// "Toplam: 6 × 9 W = 54 W" yazısını güncelle
function ampulToplamGuncelle() {
  const w = parseFloat($("cihaz-watt").value) || 0;
  const n = ampulSayisiOku();
  $("ampul-toplam").textContent = `Toplam: ${n} × ${sayi(w)} W = ${sayi(n * w)} W`;
}

function ampulDegistir(fark) {
  $("ampul-sayisi").value = Math.min(100, Math.max(1, ampulSayisiOku() + fark));
  ampulToplamGuncelle();
}

// Cihazın hazır cevap düğmelerini oluştur (ör. 1-6 saat, 1-7 yıkama)
function kullanimCipleriCiz() {
  const kutu = $("kullanim-secenekler");
  kutu.innerHTML = "";
  const secenekler = aktifKullanim.secenekler;
  // Düğmeler tek satıra eşit sığsın
  kutu.style.gridTemplateColumns = `repeat(${secenekler.length}, 1fr)`;
  secenekler.forEach(deger => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = deger.toLocaleString("tr-TR"); // 0.5 → "0,5"
    b.dataset.deger = deger;
    b.setAttribute("aria-label", kullanimMetni(aktifKullanim, deger));
    b.onclick = () => {
      // Aynı düğmeye tekrar basınca seçim kalkar
      secilenKullanim = secilenKullanim === deger ? null : deger;
      $("kullanim-diger").value = "";
      kullanimGoster();
    };
    kutu.appendChild(b);
  });
}

// Seçili düğmeyi vurgula ve cevabın aylık karşılığını yaz:
// "haftada 3 yıkama → ayda ~13 yıkama ≈ 19,3 saat"
function kullanimGoster() {
  document.querySelectorAll("#kullanim-secenekler button").forEach(b => {
    b.classList.toggle("secili", Number(b.dataset.deger) === secilenKullanim);
  });
  const ozet = $("kullanim-ozet");
  if (!aktifKullanim || !secilenKullanim) {
    ozet.textContent = "Boş bırakırsan ortalama kullanım varsayılır.";
    return;
  }
  const k = aktifKullanim;
  const aylikSaat = kullanimAylikSaat(k, secilenKullanim);
  let metin = kullanimMetni(k, secilenKullanim);
  if (k.tur === "kez") {
    const aylikKez = secilenKullanim * (k.birim === "gun" ? AYDAKI_GUN : AYDAKI_GUN / 7);
    metin += ` → ayda ~${sayi(aylikKez)} ${k.kezAd || "kez"} ≈ ${sayi(aylikSaat, 1)} saat`;
  } else {
    metin += ` → ayda ${sayi(aylikSaat, aylikSaat < 10 ? 1 : 0)} saat`;
  }
  ozet.textContent = metin;
}

function kullanimDigerYazildi() {
  const v = parseFloat($("kullanim-diger").value.replace(",", "."));
  // Günde 24 saatten fazla olamaz; diğerleri için makul bir üst sınır
  const ust = aktifKullanim.birim === "gun" && aktifKullanim.tur === "saat" ? 24 : 100;
  secilenKullanim = v > 0 ? Math.min(v, ust) : null;
  kullanimGoster();
}

/* ---------- Marka / model seçimi ---------- */
let secilenModel = null;          // seçilen model nesnesi
let secilenModelKategori = null;  // seçili kategori adı (null = hepsi)

// Şu an seçili katalog cihazının model listesi (ör. Buzdolabı)
function aktifModelKatalogu() {
  const i = $("katalog-sec").value;
  return i === "" ? null : MODEL_KATALOGU[CIHAZ_KATALOGU[i].ad];
}

function modelBolumuCiz() {
  const mk = aktifModelKatalogu();

  // Kategori çipleri (ör. "Üstten donduruculu", "55 inç")
  const kutu = $("model-kategoriler");
  kutu.innerHTML = "";
  mk.kategoriler.forEach(kat => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = kat.ad;
    b.classList.toggle("secili", secilenModelKategori === kat.ad);
    b.onclick = () => {
      // Aynı kategoriye tekrar basınca filtre kalkar
      secilenModelKategori = secilenModelKategori === kat.ad ? null : kat.ad;
      modelBolumuCiz();
    };
    kutu.appendChild(b);
  });

  modelListesiCiz();
}

function modelListesiCiz() {
  const mk = aktifModelKatalogu();
  // Türkçe küçük harf: "İ" → "i" doğru çevrilsin diye "tr" veriyoruz
  const aranan = $("model-ara").value.trim().toLocaleLowerCase("tr");
  const ul = $("model-listesi");
  ul.innerHTML = "";

  mk.kategoriler.forEach(kat => {
    if (secilenModelKategori && kat.ad !== secilenModelKategori) return;
    kat.modeller.forEach(m => {
      const metin = `${m.marka} ${m.model}`.toLocaleLowerCase("tr");
      if (aranan && !metin.includes(aranan)) return;

      const w = modelWatt(m, CIHAZ_KATALOGU[$("katalog-sec").value]);
      const etiket = modelEtiketMetni(m);
      const li = document.createElement("li");
      li.innerHTML = `
        <button type="button">
          <span><b></b><small></small></span>
          <span class="w">${sayi(w)} W</span>
        </button>`;
      li.querySelector("b").textContent = `${m.marka} ${m.model}`;
      li.querySelector("small").textContent =
        `${kat.ad} · ${m.not}` + (etiket ? ` · ${etiket}` : "");
      const btn = li.querySelector("button");
      btn.classList.toggle("secili", secilenModel === m);
      btn.onclick = () => modelSecildi(m);
      ul.appendChild(li);
    });
  });

  if (!ul.children.length) {
    ul.innerHTML = '<li class="bos">Bu aramayla model bulunamadı. Watt değerini elle girebilirsin.</li>';
  }
}

// Model seçilince ad ve watt otomatik dolar
function modelSecildi(m) {
  secilenModel = m;
  const cihaz = CIHAZ_KATALOGU[$("katalog-sec").value];
  // "Aydınlatma (ampuller)" → "Aydınlatma": sondaki parantezi at, çift parantez olmasın
  const kisaAd = cihaz.ad.replace(/\s*\(.*\)$/, "");
  $("cihaz-ad").value = `${kisaAd} (${m.marka} ${m.model})`;
  $("cihaz-watt").value = modelWatt(m, cihaz);
  ampulToplamGuncelle();
  modelListesiCiz();
}

function cihazEkranAc() {
  $("katalog-sec").value = "";
  katalogSecildi();
  ekranGoster("ekran-cihaz");
}

function cihazKaydet() {
  const ad = $("cihaz-ad").value.trim();
  const watt = parseFloat($("cihaz-watt").value);
  if (!ad) return alert("Lütfen cihaz adını yaz.");
  if (!(watt > 0)) return alert("Lütfen geçerli bir watt değeri yaz.");

  // Katalogdan seçildiyse onun tipik saat/kategori bilgilerini al
  const i = $("katalog-sec").value;
  const sablon = i !== "" ? CIHAZ_KATALOGU[i] : OZEL_CIHAZ_VARSAYILAN;
  const surekli = $("cihaz-surekli").checked;

  // Aydınlatmada girilen watt bir ampulündür: toplam = watt × ampul sayısı
  const ampulMu = !$("ampul-bolum").hidden;
  const ampulSayisi = ampulMu ? ampulSayisiOku() : null;

  durum.cihazlar.push({
    // Benzersiz kimlik: zaman + rastgele ek (aynı anda eklenenler çakışmasın)
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ad: ad,
    watt: ampulMu ? watt * ampulSayisi : watt,
    ampulSayisi: ampulSayisi,
    ampulWatt: ampulMu ? watt : null,
    // Kullanıcının söylediği günlük kullanım (sürekli cihazlarda anlamsız)
    // Kullanıcının cevabı ve aylık saat karşılığı (sürekli cihazlarda yok)
    kullanim: (!surekli && aktifKullanim) ? aktifKullanim : null,
    kullanimDeger: (!surekli && aktifKullanim) ? secilenKullanim : null,
    aliskanlikAylik: (!surekli && aktifKullanim && secilenKullanim)
      ? kullanimAylikSaat(aktifKullanim, secilenKullanim) : null,
    surekli: surekli,
    calismaOrani: sablon.calismaOrani ?? 1,
    tipikSaat: sablon.tipikSaat,
    kategori: surekli ? "surekli" : sablon.kategori,
    dongu: sablon.dongu || null
  });
  kaydet();
  cihazListesiCiz();
  ekranGoster("ekran-ana");
}

/* =====================================================================
   EKRAN 4: SONUÇ
   ===================================================================== */

// Kullanıcının girdiği alışkanlığı kısa metin yap ("haftada 3 yıkama").
// Eski kayıtlarda sadece gunlukSaat vardı, onları da göster.
function aliskanlikMetni(c) {
  if (c.kullanim && c.kullanimDeger) return kullanimMetni(c.kullanim, c.kullanimDeger);
  if (c.gunlukSaat) return `günde ${sayi(c.gunlukSaat, c.gunlukSaat % 1 ? 1 : 0)} saat`;
  return "";
}

// Aylık saati insanın anlayacağı metne çevir:
// "günde 4 sa 10 dk", "haftada 3 yıkama", "ayda 6 saat" gibi
function sureMetni(s) {
  if (s.surekli) return "7/24 açık";
  const gunluk = s.aylikSaat / AYDAKI_GUN; // saat/gün

  // Cihaz "kez" ile ya da "haftada saat" ile soruluyorsa sonucu da aynı
  // birimle göster: soru "haftada kaç kez fırın?" → cevap "haftada 2 kez"
  const k = s.kullanim;
  if (k && (k.tur === "kez" || k.birim === "hafta")) {
    const birimSaat = k.tur === "kez" ? k.kezSaat : 1;    // bir "kez" kaç saat
    const aylikMiktar = s.aylikSaat / birimSaat;           // ayda kaç kez / saat
    const periyot = k.birim === "gun" ? AYDAKI_GUN : AYDAKI_GUN / 7;
    const miktar = Math.round((aylikMiktar / periyot) * 2) / 2; // yarımlara yuvarla
    const ne = k.tur === "kez" ? (k.kezAd || "kez") : "saat";
    if (miktar >= 0.5) return `${k.birim === "gun" ? "günde" : "haftada"} ${sayi(miktar, miktar % 1 ? 1 : 0)} ${ne}`;
    return `ayda ${sayi(aylikMiktar, aylikMiktar < 10 ? 1 : 0)} ${ne}`;
  }

  if (s.dongu) {
    const aylikDongu = s.aylikSaat / s.dongu.saat;
    const haftalik = aylikDongu / (AYDAKI_GUN / 7);
    if (haftalik >= 1) return `haftada ${sayi(haftalik)} ${s.dongu.ad}`;
    return `ayda ${sayi(aylikDongu)} ${s.dongu.ad}`;
  }
  // Her gün kullanılmayan cihazlar (ütü, fırın...) aylık gösterilir
  if ((s.tipikSaat || 0) < AYDAKI_GUN && gunluk < 1) {
    return `ayda ${sayi(s.aylikSaat)} saat`;
  }
  if (gunluk >= 1) {
    const sa = Math.floor(gunluk);
    const dk = Math.round((gunluk - sa) * 60);
    return dk > 0 ? `günde ${sa} sa ${dk} dk` : `günde ${sa} saat`;
  }
  if (gunluk * 60 >= 10) return `günde ${sayi(gunluk * 60)} dk`;
  return `ayda ${sayi(s.aylikSaat, 1)} saat`;
}

function hesaplaVeGoster() {
  const hedef = parseFloat($("hedef-input").value);
  if (!(hedef > 0)) return alert("Lütfen hedef fatura tutarını yaz.");
  if (durum.cihazlar.length === 0) return alert("Önce en az bir cihaz ekle.");
  durum.hedef = hedef;
  kaydet();
  sonucCiz();
  ekranGoster("ekran-sonuc");
}

/* Sonuç ekranı iki parçada çalışır:
   1) sonucCiz(): satırları BİR KEZ oluşturur (ekrana girerken)
   2) sonucGuncelle(): sadece sayıları yeniler. Böylece kullanıcı bir
      kutuya yazarken kutu yeniden çizilmez ve klavye kapanmaz. */
function sonucCiz() {
  const ul = $("sonuc-listesi");
  ul.innerHTML = "";
  durum.cihazlar.forEach(c => {
    const li = document.createElement("li");
    li.className = "sonuc-satir";
    li.dataset.id = c.id;
    li.innerHTML = `
      <div class="sonuc-ust"><b></b><span class="buyuk"></span></div>
      <div class="sonuc-alt">
        <span class="detay"></span>
        ${c.surekli ? "" : `
        <label class="saat-kutu">
          <input type="number" inputmode="decimal" min="0" step="0.5" aria-label="Aylık saat">
          <span>sa/ay</span>
        </label>`}
      </div>`;
    li.querySelector("b").textContent = c.ad;

    const input = li.querySelector("input");
    if (input) input.oninput = () => saatElleDegisti(c.id, input.value);
    ul.appendChild(li);
  });
  sonucGuncelle();
}

// Kullanıcı bir cihazın aylık saatini yazdı → sabitle ve yeniden hesapla
function saatElleDegisti(id, deger) {
  const saat = parseFloat(String(deger).replace(",", "."));
  if (deger === "" || !(saat >= 0)) delete durum.sabitSaatler[id]; // boşsa otomatiğe dön
  else durum.sabitSaatler[id] = Math.min(saat, 24 * AYDAKI_GUN);
  kaydet();
  sonucGuncelle();
}

function sonucGuncelle() {
  const plan = butcePlaniHesapla(durum.cihazlar, durum.hedef, durum.ayrintilar, durum.sabitSaatler);

  // Özet kartı
  $("ozet-fatura").textContent = sayi(plan.tahminiFatura) + " TL";
  $("ozet-kwh").textContent = sayi(plan.toplamKwh) + " kWh";
  $("ozet-butce").textContent = sayi(plan.butceKwh) + " kWh";

  // Uyarılar
  const uyari = $("uyari");
  if (plan.yetersiz) {
    uyari.textContent = "Sürekli çalışan ve elle sabitlediğin cihazlar bu bütçeyi aşıyor. Hedefi yükselt ya da süreleri azalt.";
    uyari.hidden = false;
  } else if (plan.artanKwh > 1) {
    uyari.textContent = `İyi haber: bu cihazlar ve kullanım alışkanlığınla bütçen yetiyor, yaklaşık ${sayi(plan.artanKwh)} kWh artıyor. Faturan hedefin altında, yaklaşık ${sayi(plan.tahminiFatura)} TL olur.`;
    uyari.hidden = false;
  } else {
    uyari.hidden = true;
  }

  // Satırlar
  plan.cihazlar.forEach(s => {
    const li = document.querySelector(`#sonuc-listesi li[data-id="${s.id}"]`);
    if (!li) return;
    li.querySelector(".buyuk").textContent = sureMetni(s);
    li.querySelector(".detay").textContent = s.surekli
      ? `${sayi(s.kwh, 1)} kWh/ay (bütçeden önce düşüldü)`
      : `Günde ${sayi(s.aylikSaat / AYDAKI_GUN, 1)} sa · ${sayi(s.kwh, 1)} kWh` +
        // Kullanıcı alışkanlığını girdiyse karşılaştırma için göster
        (aliskanlikMetni(s) ? ` · Alışkanlığın: ${aliskanlikMetni(s)}` : "");

    const input = li.querySelector("input");
    if (input) {
      // Kullanıcının şu an yazdığı kutuya dokunma
      if (document.activeElement !== input) input.value = Math.round(s.aylikSaat * 10) / 10;
      input.classList.toggle("elle", s.sabit);
    }
  });

  $("sifirla-btn").hidden = Object.keys(durum.sabitSaatler).length === 0;
  grafikCiz(plan);
  ipuclariCiz(plan);
}

/* =====================================================================
   TASARRUF İPUÇLARI
   Plana bakıp en fazla 4 kısa öneri üretir. Tasarruf "kaç TL" diye
   gerçekten hesaplanır: (şimdiki fatura) − (o kadar kWh azsa fatura).
   Kademeli tarife olduğu için bu, kWh × sabit fiyattan daha doğrudur.
   ===================================================================== */
const ENFAZLA_IPUCU = 4;

function ipuclariCiz(plan) {
  const ipuclari = ipuclariOlustur(plan);
  $("ipucu-kart").hidden = ipuclari.length === 0;
  const ul = $("ipucu-listesi");
  ul.innerHTML = "";
  ipuclari.forEach(html => {
    const li = document.createElement("li");
    li.innerHTML = html; // içerik bizim ürettiğimiz metin; cihaz adları aşağıda kaçışlanıyor
    ul.appendChild(li);
  });
}

// Kullanıcının yazdığı cihaz adını HTML içinde güvenle göstermek için
function kacis(metin) {
  const d = document.createElement("div");
  d.textContent = metin;
  return d.innerHTML;
}

// Bu kadar kWh az harcansa fatura kaç TL düşer?
function tasarrufTL(plan, azalanKwh) {
  return faturaHesapla(plan.toplamKwh) - faturaHesapla(Math.max(plan.toplamKwh - azalanKwh, 0));
}

// "Bir birim az" kullanım kaç saat eder? (günde 1 saat, haftada 1 yıkama...)
function birBirimAz(s) {
  const k = s.kullanim;
  if (!k) return { saat: s.aylikSaat * 0.2, metin: "%20 daha az kullanırsan" };
  const periyot = k.birim === "gun" ? AYDAKI_GUN : AYDAKI_GUN / 7;
  const birimSaat = k.tur === "kez" ? k.kezSaat : 1;
  const ne = k.tur === "kez" ? (k.kezAd || "kez") : "saat";
  return {
    saat: Math.min(periyot * birimSaat, s.aylikSaat),
    metin: `${k.birim === "gun" ? "günde" : "haftada"} 1 ${ne} az kullanırsan`
  };
}

function ipuclariOlustur(plan) {
  const ipuclari = [];
  const toplam = plan.toplamKwh || 1;
  const tl = n => `<b>~${sayi(n)} TL</b>`;

  // 1) Bütçe yetmiyorsa: alışkanlığından en çok kısılması gereken cihazlar
  const kisilanlar = plan.cihazlar
    .filter(s => !s.surekli && !s.sabit && aliskanlikAylikSaat(s) > s.aylikSaat * 1.02)
    .map(s => ({ s, fark: (aliskanlikAylikSaat(s) - s.aylikSaat) * s.watt / 1000 }))
    .sort((a, b) => b.fark - a.fark)
    .slice(0, 2);
  if (kisilanlar.length) {
    const liste = kisilanlar.map(({ s }) =>
      `${kacis(s.ad)} (${aliskanlikMetni(s)} → <b>${sureMetni(s)}</b>)`).join(", ");
    ipuclari.push(`Hedefine ulaşmak için en çok buradan kısmalısın: ${liste}.`);
  }

  // 2) En çok harcayan cihaz ve "biraz azaltırsan" ne kazanırsın
  const sirali = plan.cihazlar.filter(s => s.kwh > 0).sort((a, b) => b.kwh - a.kwh);
  const enCok = sirali.find(s => !s.surekli);
  if (enCok) {
    const pay = (enCok.kwh / toplam) * 100;
    const az = birBirimAz(enCok);
    const kazanc = tasarrufTL(plan, enCok.watt * az.saat / 1000);
    // "%32'si / %40'ı" eki sayıya göre değişir; o yüzden "payı %32" diyoruz
    ipuclari.push(`En çok <b>${kacis(enCok.ad)}</b> harcıyor (payı %${sayi(pay)}). ` +
      `${az.metin.charAt(0).toUpperCase() + az.metin.slice(1)} ayda ${tl(kazanc)} tasarruf edersin.`);
  }

  // 3) Eski tip ampul varsa: LED'e geçince ne kazanılır
  plan.cihazlar.filter(s => s.ampulWatt >= 15 && s.ampulSayisi).forEach(s => {
    // Aynı ışığı veren LED: akkor/halojen ≈ %15'i, tasarruflu ≈ %60'ı kadar watt
    const ledWatt = Math.max(5, Math.round(s.ampulWatt * (s.ampulWatt >= 40 ? 0.15 : 0.6)));
    const azalanKwh = (s.ampulWatt - ledWatt) * s.ampulSayisi * s.aylikSaat / 1000;
    if (azalanKwh > 0.5) {
      ipuclari.push(`Ampullerin ${sayi(s.ampulWatt)} W. Aynı ışığı veren ~${ledWatt} W LED'e geçersen ` +
        `ayda ${tl(tasarrufTL(plan, azalanKwh))} kazanırsın.`);
    }
  });

  // 4) İkinci en çok harcayan da büyükse onu da öner
  const ikinci = sirali.filter(s => !s.surekli && s !== enCok)[0];
  if (ikinci && ikinci.kwh / toplam > 0.15) {
    const az = birBirimAz(ikinci);
    ipuclari.push(`<b>${kacis(ikinci.ad)}</b>: ${az.metin} ayda ${tl(tasarrufTL(plan, ikinci.watt * az.saat / 1000))} daha.`);
  }

  // 5) Cihaza göre genel alışkanlık önerisi (yer kaldıysa)
  const varMi = ad => plan.cihazlar.some(s => s.ad.startsWith(ad));
  const genel = [
    [varMi("Çamaşır"), "Çamaşırı tam dolu ve 30–40°C'de yıkamak her yıkamada elektrik kazandırır."],
    [varMi("Klima"), "Klimayı yazın 24–26°C'ye ayarla; her derece düşürmek tüketimi artırır."],
    [varMi("Elektrikli ısıtıcı"), "Isıtıcıyı odanın kapısı kapalıyken kullan, ısı boşa gitmesin."],
    [varMi("Su ısıtıcısı"), "Su ısıtıcısına sadece ihtiyacın kadar su koy."],
    [varMi("Televizyon") || varMi("Bilgisayar"), "Kullanmadığında TV ve bilgisayarı tamamen kapat; beklemede de az da olsa elektrik harcar."]
  ];
  for (const [uygun, metin] of genel) {
    if (ipuclari.length >= ENFAZLA_IPUCU) break;
    if (uygun) { ipuclari.push(metin); break; } // sadece bir genel öneri
  }

  return ipuclari.slice(0, ENFAZLA_IPUCU);
}

/* HALKA (DONUT) GRAFİK: her cihaz toplam tüketimin yüzde kaçını harcıyor.
   Kütüphane yok, sadece SVG çemberler. Püf noktası: pathLength="100"
   dersek çemberin çevresi 100 birim sayılır. Yani %30'luk dilim, 30 birim
   uzunluğunda bir çizgi parçası olur (stroke-dasharray ile çizilir). */
const RENK_SAYISI = 7; // style.css'teki --seri-1 ... --seri-7

function grafikCiz(plan) {
  const kutu = $("grafik");
  kutu.innerHTML = "";
  const toplam = plan.toplamKwh;
  if (!(toplam > 0)) return;

  // 1) Dilimleri hazırla. Renk cihazın listedeki SIRASINA göre verilir
  //    (payına göre değil), böylece süre değişince renkler yer değiştirmez.
  //    8. ve sonraki cihazlar gri "Diğer" diliminde toplanır.
  const dilimler = [];
  let diger = 0;
  plan.cihazlar.forEach((s, i) => {
    if (s.kwh <= 0) return;
    if (i < RENK_SAYISI) dilimler.push({ ad: s.ad, kwh: s.kwh, renk: `var(--seri-${i + 1})` });
    else diger += s.kwh;
  });
  if (diger > 0) dilimler.push({ ad: "Diğer", kwh: diger, renk: "var(--seri-diger)" });
  dilimler.forEach(d => (d.yuzde = (d.kwh / toplam) * 100));
  dilimler.sort((a, b) => b.kwh - a.kwh); // en çok harcayan önce

  // 2) Halkayı çiz
  const ARALIK = dilimler.length > 1 ? 0.8 : 0; // dilimler arası ince boşluk
  let baslangic = 0;
  const cemberler = dilimler.map(d => {
    const uzunluk = Math.max(d.yuzde - ARALIK, 0.3);
    const c = `<circle cx="50" cy="50" r="40" pathLength="100"
      stroke="${d.renk}" stroke-dasharray="${uzunluk} ${100 - uzunluk}"
      stroke-dashoffset="${-baslangic}"></circle>`;
    baslangic += d.yuzde;
    return c;
  }).join("");

  kutu.innerHTML = `
    <div class="halka-kutu">
      <svg viewBox="0 0 100 100" role="img" aria-label="Cihazların tüketim payları">${cemberler}</svg>
      <div class="halka-orta"><b></b><small></small></div>
    </div>
    <ul class="aciklama"></ul>`;

  // 3) Açıklama listesi: renk, ad, yüzde, kWh (renge bakmadan da okunur)
  const ul = kutu.querySelector(".aciklama");
  dilimler.forEach(d => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="renk" style="background:${d.renk}"></span>
      <span class="ad"></span>
      <span class="deger"><b>%${sayi(d.yuzde)}</b><small>${sayi(d.kwh)} kWh</small></span>`;
    li.querySelector(".ad").textContent = d.ad;
    ul.appendChild(li);
  });

  // 4) Dokununca/üstüne gelince: dilim kalınlaşır, ortada o cihaz yazar
  const daireler = kutu.querySelectorAll("circle");
  const satirlar = ul.querySelectorAll("li");
  const orta = kutu.querySelector(".halka-orta");
  function vurgula(i) {
    daireler.forEach((c, j) => c.classList.toggle("vurgu", j === i));
    satirlar.forEach((l, j) => l.classList.toggle("vurgu", j === i));
    if (i === null) {
      orta.querySelector("b").textContent = `${sayi(toplam)} kWh`;
      orta.querySelector("small").textContent = "aylık toplam tüketim";
    } else {
      orta.querySelector("b").textContent = `%${sayi(dilimler[i].yuzde)}`;
      orta.querySelector("small").textContent = dilimler[i].ad;
    }
  }
  [daireler, satirlar].forEach(grup => grup.forEach((el, i) => {
    el.onmouseenter = () => vurgula(i);
    el.onmouseleave = () => vurgula(null);
    el.onclick = () => vurgula(el.classList.contains("vurgu") ? null : i);
  }));
  vurgula(null);
}

/* =====================================================================
   EKRAN 3: AYRINTILAR
   Seçimler önce "taslak"ta tutulur, "Kaydet"e basınca durum'a yazılır.
   ===================================================================== */
let taslak = {};

function ayrintiEkranAc() {
  taslak = { ...durum.ayrintilar };
  $("ay-kisi").value = taslak.kisi || "";
  $("ay-oda").value = taslak.oda || "";
  secenekleriBoya();
  ekranGoster("ekran-ayrinti");
}

// Çip düğmelerinden seçili olanı vurgula
function secenekleriBoya() {
  document.querySelectorAll(".secenekler").forEach(grup => {
    const alan = grup.dataset.alan;
    grup.querySelectorAll("button").forEach(b => {
      b.classList.toggle("secili", taslak[alan] === b.dataset.deger);
    });
  });
}

function secenekTiklandi(olay) {
  const b = olay.target.closest("button");
  if (!b) return;
  const alan = olay.currentTarget.dataset.alan;
  // Aynı seçeneğe tekrar basınca seçim kalkar
  taslak[alan] = taslak[alan] === b.dataset.deger ? undefined : b.dataset.deger;
  secenekleriBoya();
}

function ayrintiKaydet() {
  const kisi = parseInt($("ay-kisi").value);
  const oda = parseInt($("ay-oda").value);
  durum.ayrintilar = {
    kisi: kisi > 0 ? kisi : undefined,
    oda: oda > 0 ? oda : undefined,
    isinma: taslak.isinma,
    mevsim: taslak.mevsim
  };
  kaydet();
  ekranGoster("ekran-ana");
}

function ayrintiTemizle() {
  taslak = {};
  $("ay-kisi").value = "";
  $("ay-oda").value = "";
  secenekleriBoya();
}

/* =====================================================================
   BAŞLANGIÇ
   ===================================================================== */
function baslat() {
  yukle();
  temaUygula();
  katalogDoldur();
  cihazListesiCiz();
  if (durum.hedef) $("hedef-input").value = durum.hedef;

  // Olaylar (tıklama vb.)
  temaPaneliHazirla();
  $("geri-btn").onclick = () => ekranGoster("ekran-ana");
  $("cihaz-ekle-btn").onclick = cihazEkranAc;
  $("katalog-sec").onchange = katalogSecildi;
  $("model-ara").oninput = modelListesiCiz;
  $("kullanim-diger").oninput = kullanimDigerYazildi;
  $("ampul-eksi").onclick = () => ampulDegistir(-1);
  $("ampul-arti").onclick = () => ampulDegistir(1);
  $("ampul-sayisi").oninput = ampulToplamGuncelle;
  $("cihaz-watt").addEventListener("input", ampulToplamGuncelle);
  $("cihaz-kaydet-btn").onclick = cihazKaydet;
  $("hesapla-btn").onclick = hesaplaVeGoster;
  $("ayrinti-btn").onclick = ayrintiEkranAc;
  $("ayrinti-kaydet-btn").onclick = ayrintiKaydet;
  $("ayrinti-temizle-btn").onclick = ayrintiTemizle;
  // Sadece Ayrıntılar ekranındaki çipler (data-alan olanlar); model çiplerinin kendi olayı var
  document.querySelectorAll(".secenekler[data-alan]").forEach(g => (g.onclick = secenekTiklandi));
  $("sifirla-btn").onclick = () => {
    durum.sabitSaatler = {};
    kaydet();
    sonucCiz(); // kutuları da sıfırdan doldur
  };
  $("hedef-input").oninput = () => {
    durum.hedef = parseFloat($("hedef-input").value) || null;
    kaydet();
  };

  // Service worker: uygulamayı çevrimdışı çalışır yapar.
  // Sadece https veya localhost üzerinde çalışır.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

baslat();
