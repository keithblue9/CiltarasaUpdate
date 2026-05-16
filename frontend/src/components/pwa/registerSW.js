/**
 * Service worker registration helper.
 * Only registers on production-like origins (avoids dev hot-reload issues).
 */
export function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Skip on localhost dev unless explicitly enabled
  const enabled = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!enabled) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Check for updates every hour
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {
        // silent fail
      });
  });
}
