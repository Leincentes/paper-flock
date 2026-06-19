const CACHE_NAME = "paper-flock-static-v1.2";
const CACHE_PREFIX = "paper-flock-static-";
const APP_STATIC_RESOURCES = Object.freeze([
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./assets/paper-flock-icon.svg",
  "./assets/paper-flock-icon-192.png",
  "./assets/paper-flock-icon-512.png",
  "./assets/paper-flock-icon-maskable-192.png",
  "./assets/paper-flock-icon-maskable-512.png",
  "./assets/screenshots/paper-flock-phone.png",
  "./src/boot-guard.js",
  "./src/tutorial-core.js",
  "./src/tutorial-player-ui.js",
  "./src/game-core.js",
  "./src/game-player-ui.js",
  "./src/progress-core.js",
  "./src/experience-core.js",
  "./src/mastery-core.js",
  "./src/storage-player-core.js",
  "./src/settings-core.js",
  "./src/settings-ui.js",
  "./src/app-platform-ui.js",
  "./src/mobile-lifecycle-ui.js",
  "./src/mobile-viewport-core.js",
  "./src/mobile-viewport-player-ui.js",
  "./src/accessibility-core.js",
  "./src/accessibility-ui.js",
  "./src/public-pages-ui.js",
  "./app-config.json",
  "./known-issues.json",
  "./release-notes.json",
  "./privacy.html",
  "./support.html",
  "./release-notes.html",
  "./known-issues.html",
  "./accessibility.html",
  "./terms.html",
  "./credits.html",
  "./404.html",
  "./legal.css",
  "./build-info.json"
]);

function resourceRequests() {
  return APP_STATIC_RESOURCES.map(
    (path) =>
      new Request(new URL(path, self.location), {
        cache: "reload"
      })
  );
}

async function primeCurrentCache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(resourceRequests());
  return cache;
}

async function deleteOldCaches({ includeCurrent = false } = {}) {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        (name) =>
          name.startsWith(CACHE_PREFIX) &&
          (includeCurrent || name !== CACHE_NAME)
      )
      .map((name) => caches.delete(name))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(primeCurrentCache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      deleteOldCaches(),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(
        new Request(new URL("./index.html", self.location)),
        response.clone()
      );
    }
    return response;
  } catch {
    return (
      (await cache.match(
        new Request(new URL("./index.html", self.location))
      )) ||
      (await cache.match(
        new Request(new URL("./", self.location))
      )) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}

async function cacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const missing = [];

  for (const path of APP_STATIC_RESOURCES) {
    const request = new Request(new URL(path, self.location));
    const response = await cache.match(request, { ignoreSearch: true });
    if (!response) {
      missing.push(path);
    }
  }

  return {
    type: "CACHE_STATUS",
    cacheName: CACHE_NAME,
    expectedCount: APP_STATIC_RESOURCES.length,
    cachedCount: APP_STATIC_RESOURCES.length - missing.length,
    missing,
    complete: missing.length === 0
  };
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "GET_CACHE_STATUS") {
    event.waitUntil(
      cacheStatus().then((status) => {
        event.ports?.[0]?.postMessage(status);
      })
    );
    return;
  }

  if (
    event.data?.type === "CLEAR_CACHES" ||
    event.data?.type === "REFRESH_CACHE"
  ) {
    event.waitUntil(
      deleteOldCaches({ includeCurrent: true })
        .then(() => primeCurrentCache())
        .then(() => cacheStatus())
        .then((status) => {
          event.ports?.[0]?.postMessage(status);
        })
    );
  }
});
