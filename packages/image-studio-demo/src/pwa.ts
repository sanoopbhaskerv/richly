/** Registers the standalone demo service worker when the browser supports it. */
export function registerStudioServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Image Studio demo service worker registration failed', error);
    });
  });
}
