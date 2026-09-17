/* The service worker behind the installed app.
 *
 * It is deliberately narrow. Two things only:
 *
 *   1. Build assets -- the hashed files under /_next/static -- are served from
 *      the cache after their first download. Their names change whenever their
 *      contents change, so a cached copy can never be the wrong one, and the
 *      app opens without waiting on the network for them.
 *
 *   2. A navigation that cannot reach the network falls back to /offline, so
 *      the app says it is waiting for a connection instead of showing the
 *      browser's error page.
 *
 * What it deliberately does NOT do is cache pages. Prices, stock, carts and
 * order status are the whole point of this shop; a page served from a cache
 * could show yesterday's price, or one shopper's cart to the next person on a
 * shared phone. Anything that must be current is left to the network.
 */

const VERSION = "v1";
const ASSET_CACHE = `zupona-assets-${VERSION}`;
const SHELL_CACHE = `zupona-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

/* Kept in the cache so the offline page can draw itself with no network. */
const SHELL_FILES = [OFFLINE_URL, "/icon-192.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One at a time and forgiving: a single missing file should not leave the
      // app with no offline page at all.
      await Promise.all(
        SHELL_FILES.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* Skipped; the network fallback still applies. */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([ASSET_CACHE, SHELL_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.map((name) =>
          name.startsWith("zupona-") && !keep.has(name)
            ? caches.delete(name)
            : Promise.resolve(false)
        )
      );
      await self.clients.claim();
    })()
  );
});

/** True for the immutable build output, and only that.
 *
 * The check is on the response rather than the path because `next dev` serves
 * the same paths without content hashes; caching those would hand a stale
 * chunk back after an edit. */
function isImmutable(response) {
  const control = response.headers.get("cache-control") || "";
  return control.includes("immutable");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nothing under /api is cacheable: it is media, uploads, auth and webhooks.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;

        const response = await fetch(request);
        if (response.ok && isImmutable(response)) {
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  // A page request. Always the network; the cache only catches the failure.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("You are offline.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
  }
});
