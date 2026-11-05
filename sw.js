/* =====================================================================
   SW.JS — Service Worker: dosyaları önbelleğe alır, internet yokken
   uygulama yine açılır.
   ⚠️ Dosyalarda değişiklik yaptığında ONBELLEK adındaki sürümü artır
   (v1 → v2), yoksa telefon eski dosyaları göstermeye devam eder.
   ===================================================================== */
const ONBELLEK = "elektrik-butce-v8";

const DOSYALAR = [
  "./",
  "./index.html",
  "./style.css",
  "./ayarlar.js",
  "./hesap.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Kurulum: tüm dosyaları önbelleğe koy
self.addEventListener("install", (olay) => {
  olay.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(DOSYALAR)));
  self.skipWaiting();
});

// Etkinleşme: eski sürüm önbellekleri sil
self.addEventListener("activate", (olay) => {
  olay.waitUntil(
    caches.keys().then((adlar) =>
      Promise.all(adlar.filter((a) => a !== ONBELLEK).map((a) => caches.delete(a)))
    )
  );
  self.clients.claim();
});

// İstek: önce internetten taze dosyayı dene (ve önbelleği güncelle).
// İnternet yoksa önbellekteki kopyayı ver. Böylece kodu değiştirdiğinde
// hemen görürsün, çevrimdışıyken de uygulama açılır.
self.addEventListener("fetch", (olay) => {
  if (olay.request.method !== "GET") return;
  olay.respondWith(
    // cache: "no-cache" → tarayıcının kendi önbelleğine güvenme, sunucuya
    // "dosya değişti mi?" diye sor. Yoksa güncellemeden sonra bazı dosyalar
    // eski kalabiliyor (ör. yeni app.js + eski hesap.js).
    fetch(olay.request, { cache: "no-cache" })
      .then((yanit) => {
        const kopya = yanit.clone();
        caches.open(ONBELLEK).then((c) => c.put(olay.request, kopya));
        return yanit;
      })
      .catch(() => caches.match(olay.request, { ignoreSearch: true }))
  );
});
