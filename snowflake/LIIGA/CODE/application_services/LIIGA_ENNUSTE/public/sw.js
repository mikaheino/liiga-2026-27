// Liiga Ennuste mobiilisovelluksena vähin krediitein (21.11.2026).
//
// App Runtime sammuu käyttämättömänä (auto_suspend_secs) ja herää seuraavasta pyynnöstä,
// mutta laskentapoolin kylmäkäynnistys kestää jopa ~8,5 min, ja sillä välin palvelu
// vastaa 503. Tämä service worker näyttää silloin viimeksi haetun version heti ja kertoo
// sivulle (WakeBanner), että palvelu herää; sivu päivittyy, kun palvelu on ylhäällä.
// Näin sovellus voi sammua nopeammin ilman, että puhelimessa näkyy virhesivu.
//
//   /_next/static, /icons, /logos   välimuisti ensin (muuttumattomat käännöstiedostot)
//   /api/*, POST                    aina verkosta (agentti, skenaariot, kirjoitukset)
//   sivut ja RSC-data               verkko ensin; 503 tai katko -> välimuistin versio
const CACHE = "liiga-v1";
const SHELL = ["/"];
const STATIC = /^\/(_next\/static|icons|logos)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function waking(clientId) {
  const all = await self.clients.matchAll({ type: "window" });
  for (const c of all) if (!clientId || c.id === clientId) c.postMessage({ type: "liiga-waking" });
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(e) {
  const req = e.request;
  try {
    const res = await fetch(req);
    // Kirjautumisohjaus (Snowflaken ingress) ja muut ohjaukset suoraan selaimelle.
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) return res;
    if (res.ok) {
      (await caches.open(CACHE)).put(req, res.clone());
      return res;
    }
    if (res.status !== 503) return res;
  } catch { /* verkkokatko: välimuistin versio alla */ }
  const hit = (await caches.match(req)) || (req.mode === "navigate" ? await caches.match("/") : undefined);
  waking(e.resultingClientId || e.clientId);
  return hit || new Response(WAKING_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  e.respondWith(STATIC.test(url.pathname) ? cacheFirst(req) : networkFirst(e));
});

// Ensimmäinen avaus kylmänä, kun välimuistissa ei vielä ole mitään.
const WAKING_HTML = `<!doctype html><html lang="fi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050403">
<title>Liiga Ennuste herää</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050403;
color:#f4efe4;font:16px/1.5 system-ui,-apple-system,sans-serif;text-align:center;padding:24px}b{color:#ebca68}small{color:#8f8573}</style></head>
<body><div><p><b>Liiga Ennuste herää</b></p><p>Palvelu käynnistyy säästötilasta. Ensimmäinen avaus voi kestää muutaman minuutin.</p>
<small>Sivu päivittyy itsestään.</small></div><script>setInterval(()=>fetch("/manifest.webmanifest",{cache:"no-store"})
.then(r=>{if(r.ok)location.reload()}).catch(()=>{}),15000)</script></body></html>`;
