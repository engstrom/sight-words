/* Network first: online, every request goes to the server (revalidating past the HTTP cache), so an
   update shows on the next launch. The cache is only read when the network fails, so the Home Screen
   app still opens offline. Fonts come from Google and are not cached; offline falls back to system ones. */
const CACHE = "sight-words";
const SHELL = ["./", "manifest.json", "apple-touch-icon.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: "no-cache" })
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })
    .catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === "navigate" ? caches.match("./") : undefined))
      .then(hit => hit || Response.error())));
});
