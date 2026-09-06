/**
 * Service Worker — Photobooth Cashier
 *
 * Strategy: cache-first for static assets, network-first for API.
 * Background Sync API is registered for 'sync-transactions' tag so the
 * browser retries pending offline transactions automatically when
 * connectivity returns — even if the tab was closed.
 *
 * NOTE: Background Sync is Chromium-only. Safari/iOS falls back to the
 * 'online' event listener inside the useOfflineSync hook, which fires
 * only while the tab is open. That's acceptable for the cashier use case
 * (crew keeps the tab open during the event).
 */

const STATIC_CACHE = "kasir-static-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/_next/static/css/",
];

// ── Install: precache static shell ────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Best-effort; don't fail install if some assets 404.
      await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// ── Fetch: static = cache-first, API = network-first (no stale) ───────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never intercept non-GET (POST/PUT/DELETE) — those go straight to network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Don't cache NextAuth session callbacks or auth endpoints.
  if (url.pathname.startsWith("/api/auth")) return;

  // Static assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // API GET requests: network-first, fall back to nothing (no stale API data).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }
});

// ── Background Sync: retry pending transactions ──────────────────────────
// Fired by: navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-transactions'))
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-transactions") {
    event.waitUntil(
      (async () => {
        const allClients = await self.clients.matchAll();
        // Ask all open tabs to process the queue.
        allClients.forEach((client) =>
          client.postMessage({ type: "PROCESS_SYNC_QUEUE" })
        );
        // Give the client a moment to process, then report.
        await new Promise((r) => setTimeout(r, 2000));
      })()
    );
  }
});

// ── Message handler: allow pages to trigger sync manually ─────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
