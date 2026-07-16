const DEMO_CACHE_PREFIX = 'richly-image-studio-demo-';

/**
 * Disables the demo's offline shell by unregistering existing workers and
 * deleting Image Studio demo caches left by earlier PWA builds.
 */
export function disableStudioOfflineSupport(): void {
  if (typeof window === 'undefined') return;

  const cleanup = (): void => {
    void cleanupStudioOfflineSupport().catch((error: unknown) => {
      console.warn('Image Studio demo offline cleanup failed', error);
    });
  };

  if (document.readyState === 'complete') {
    cleanup();
    return;
  }

  window.addEventListener('load', cleanup, { once: true });
}

async function cleanupStudioOfflineSupport(): Promise<void> {
  await Promise.all([unregisterDemoServiceWorkers(), deleteDemoCaches()]);
}

async function unregisterDemoServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(isDemoServiceWorkerRegistration)
      .map((registration) => registration.unregister())
  );
}

function isDemoServiceWorkerRegistration(registration: ServiceWorkerRegistration): boolean {
  const scriptURL =
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL ??
    '';
  if (!scriptURL) return registration.scope === `${window.location.origin}/`;

  const parsed = new URL(scriptURL);
  return parsed.origin === window.location.origin && parsed.pathname === '/sw.js';
}

async function deleteDemoCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const keys = await window.caches.keys();
  await Promise.all(
    keys.filter((key) => key.startsWith(DEMO_CACHE_PREFIX)).map((key) => window.caches.delete(key))
  );
}
