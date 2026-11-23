/* Service Worker — Bengkel & Toko Sparepart Motor (offline-first) */
const VERSION = "v1.2.0";
const SHELL_CACHE = `shell-${VERSION}`;
const MODEL_CACHE = "models-v2"; // large AI assets, kept across app versions
const RUNTIME_CACHE = `runtime-${VERSION}`;

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/samples/kampas-rem.jpg",
  "/samples/oli-mpx2.jpg",
  "/samples/busi-ngk.jpg",
  "/samples/seal-shock.jpg",
  "/samples/vbelt-vario.jpg",
  "/samples/rantai-federal.jpg",
];

const MODEL_ASSETS = [
  "/models/tesseract/worker.min.js",
  "/models/tesseract/tesseract-core-simd-lstm.wasm.js",
  "/models/tesseract/tesseract-core-lstm.wasm.js",
  "/models/tesseract/eng.traineddata.gz",
  "/models/mobilenet/model.json",
  "/models/mobilenet/group1-shard1of2.bin",
  "/models/mobilenet/group1-shard2of2.bin",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await Promise.all(SHELL_ASSETS.map((u) => shell.add(new Request(u, { cache: "reload" })).catch(() => {})));
      const models = await caches.open(MODEL_CACHE);
      await Promise.all(
        MODEL_ASSETS.map(async (u) => {
          const hit = await models.match(u);
          if (!hit) await models.add(u).catch(() => {});
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== MODEL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isBypass(url) {
  return (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/ws") ||
    url.pathname.startsWith("/sockjs-node") ||
    url.pathname.includes("hot-update") ||
    url.pathname === "/sw.js"
  );
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

// Network-first for app code (always fresh when online), cached copy when offline.
async function networkFirstAsset(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(t);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: false });
    return hit || new Response("", { status: 504, statusText: "Offline" });
  }
}

async function networkFirstNavigation(req) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(t);
    if (res && res.ok) shell.put("/", res.clone());
    return res;
  } catch (e) {
    const hit = (await shell.match("/")) || (await caches.match("/"));
    return hit || new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;
  if (url.pathname.endsWith(".zip")) return; // backup downloads: never cache

  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
    return;
  }
  if (url.pathname.startsWith("/models/")) {
    event.respondWith(cacheFirst(req, MODEL_CACHE));
    return;
  }
  if (url.pathname.startsWith("/samples/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }
  event.respondWith(networkFirstAsset(req));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
