// ─── Web Push utility for Buyer PWA ───
// Buyer subscribes with their auth token (= user id), not the seller PIN.
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

// Subscribe the current device to buyer push notifications.
export async function subscribeBuyer({ token, phone, label } = {}) {
  if (!(await isPushSupported())) throw new Error('Browser tidak support notifikasi');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Izin notifikasi ditolak');

  const r = await fetch(`${API}/api/push/vapid-key`);
  const j = await r.json();
  if (!j.available || !j.key) throw new Error('Notifikasi belum siap di server');
  const appKey = urlBase64ToUint8Array(j.key);

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try { await existing.unsubscribe(); } catch (e) { /* ignore stale */ }
  }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  const subJson = sub.toJSON();

  const resp = await fetch(`${API}/api/push/buyer/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token || null,
      phone: phone || null,
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      user_agent: navigator.userAgent,
      label: label || ('HP ' + (navigator.platform || 'Web')),
    }),
  });
  if (!resp.ok) {
    let detail = '';
    try { detail = (await resp.json()).detail || ''; } catch (e) { /* noop */ }
    if (resp.status === 401) throw new Error('Sesi tidak valid. Login ulang ya.');
    throw new Error(`Gagal aktifkan notifikasi (${resp.status})${detail ? ': ' + detail : ''}`);
  }
  return await resp.json();
}

export async function unsubscribeBuyer() {
  const sub = await getExistingSubscription();
  if (!sub) return { ok: true, already: true };
  try { await sub.unsubscribe(); } catch (e) { /* ignore */ }
  const resp = await fetch(`${API}/api/push/buyer/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  return await resp.json();
}
