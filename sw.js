/* sw.js — il SERVICE WORKER: un aiutante che vive nel telefono anche ad app chiusa.
   Versione 2
   1. Tiene una COPIA dei file ("prima la rete": con internet prende la versione nuova, senza usa la copia).
   2. Riceve le NOTIFICHE PUSH da Supabase e le mostra; toccandole apre l'app. */
const COPIA = "abundance-file";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.hostname.endsWith("supabase.co")) return;   // i dati li gestisce dati.js
  const nostro = u.origin === self.location.origin;
  e.respondWith(
    fetch(r, nostro ? { cache: "no-cache" } : {})
      .then(risposta => {
        if (risposta.ok || risposta.type === "opaque") {
          const copia = risposta.clone();
          caches.open(COPIA).then(c => c.put(r, copia));
        }
        return risposta;
      })
      .catch(() => caches.match(r, { ignoreSearch: true }))
  );
});

self.addEventListener("push", e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.titolo || "Abundance", {
    body: d.testo || "", icon: "icona-192.png", tag: d.tag || "abundance", data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of finestre) { if ("focus" in f) return f.focus(); }
    return self.clients.openWindow(url);
  })());
});
