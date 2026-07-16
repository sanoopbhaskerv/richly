/* global caches, self */

const DEMO_CACHE_PREFIX = 'richly-image-studio-demo-';

async function deleteDemoCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(DEMO_CACHE_PREFIX)).map((key) => caches.delete(key))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(deleteDemoCaches().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteDemoCaches()
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
