/**
 * Detect browser & OS for PWA install instructions.
 * Returns { browser, os, isStandalone, supportsInstall }.
 */
export function detectEnv() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const platform = (typeof navigator !== 'undefined' && (navigator.userAgentData?.platform || navigator.platform)) || '';

  // Browser
  let browser = 'chrome';
  if (/EdgA|EdgiOS|Edg\//.test(ua)) browser = 'edge';
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/FxiOS|Firefox/.test(ua)) browser = 'firefox';
  else if (/Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)) browser = 'safari';
  else if (/CriOS|Chrome/.test(ua)) browser = 'chrome';

  // OS
  let os = 'desktop';
  const iOSDetect = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  if (iOSDetect) os = 'ios';
  else if (/Android/.test(ua)) os = 'android';
  else if (/Win|Mac|Linux/.test(platform)) os = 'desktop';

  const isStandalone =
    (typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true));

  return { browser, os, isStandalone, ua };
}
