/* global shell */
const scope = self.registration.scope;
const prefix = `touchflow:${scope}:`;
const cacheName = prefix + shell.version;
const index = new URL("index.html", scope).href;
const assets = new Set(shell.files.map((file) => new URL(file, scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) =>
    cache.addAll([...assets].map((url) => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  url.search = "";
  const navigation = request.mode === "navigate" && (url.href === scope || url.href === index);
  if (!navigation && !assets.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(navigation ? index : request)) ?? fetch(request);
  })());
});
