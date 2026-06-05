// ─── Web Push utility for Seller PWA ───
// Convert VAPID public key (base64url) to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

const API = process.env.REACT_APP_BACKEND_URL;

export async function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getCurrentPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function requestSubscribe(pin, label) {
  if (!(await isPushSupported())) throw new Error('Browser tidak support Web Push');
  // Request notification permission
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak');

  // Get VAPID public key from server
  const r = await fetch(`${API}/api/push/vapid-key`);
  const j = await r.json();
  if (!j.available || !j.key) throw new Error('VAPID belum di-setup di server');
  const appKey = urlBase64ToUint8Array(j.key);

  const reg = await navigator.serviceWorker.ready;
  // Unsubscribe existing first (in case of stale)
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try { await existing.unsubscribe(); } catch (e) { console.warn('Existing sub unsubscribe failed:', e?.message); }
  }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  const subJson = sub.toJSON();

  // POST to backend
  const resp = await fetch(`${API}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Seller-PIN': pin },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      user_agent: navigator.userAgent,
      label: label || 'Device ' + (navigator.platform || 'Web'),
    }),
  });
  if (!resp.ok) throw new Error('Gagal subscribe ke server');
  return await resp.json();
}

export async function unsubscribe(pin) {
  const sub = await getExistingSubscription();
  if (!sub) return { ok: true, already: true };
  try { await sub.unsubscribe(); } catch (e) { console.warn('Local unsubscribe failed (proceeding with server cleanup):', e?.message); }
  const resp = await fetch(`${API}/api/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Seller-PIN': pin },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  return await resp.json();
}

export async function sendTestPush(pin) {
  const resp = await fetch(`${API}/api/push/test`, {
    method: 'POST',
    headers: { 'X-Seller-PIN': pin, 'Content-Type': 'application/json' },
  });
  return await resp.json();
}

// ─── Manifest swap: switch to seller-manifest while on seller route ───
let _originalManifestHref = null;
export function setSellerManifest() {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  if (!_originalManifestHref) _originalManifestHref = link.getAttribute('href');
  if (link.getAttribute('href') !== '/seller-manifest.json') {
    link.setAttribute('href', '/seller-manifest.json');
  }
  // Update theme-color meta for seller (warmer brown)
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', '#7C2D12');
}

export function restoreBuyerManifest() {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return;
  link.setAttribute('href', _originalManifestHref || '/manifest.json');
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', '#6B0F1A');
}
