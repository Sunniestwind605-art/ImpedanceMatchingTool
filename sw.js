const CACHE_NAME = "impedance-matching-shell-v1";
const APP_FILES = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/smith-chart.svg",
  "./src/app.css",
  "./src/app.js",
  "./src/index.js",
  "./src/core/complex.js",
  "./src/core/transmissionLine.js",
  "./src/calculators/lNetwork.js",
  "./src/calculators/singleStub.js",
  "./src/calculators/lossySingleStub.js",
  "./src/calculators/doubleStub.js",
  "./src/calculators/quarterWave.js",
  "./src/renderers/svg.js",
  "./src/renderers/lNetworkSvg.js",
  "./src/renderers/singleStubSvg.js",
  "./src/renderers/doubleStubSvg.js",
  "./src/renderers/quarterWaveSvg.js",
  "./src/renderers/smithChartSvg.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith("impedance-matching-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    const refresh = fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const key = new URL(request.url);
        key.search = "";
        cache.put(key.href, response.clone());
      }
      return response;
    });

    if (cached) {
      event.waitUntil(refresh.catch(() => undefined));
      return cached;
    }

    try {
      return await refresh;
    } catch {
      if (request.mode === "navigate") {
        return (await cache.match(new URL("./index.html", scopeUrl).href)) ?? Response.error();
      }
      return Response.error();
    }
  })());
});
