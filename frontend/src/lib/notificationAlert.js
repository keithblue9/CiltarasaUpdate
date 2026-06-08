/**
 * In-page notification alert: sound + vibrate.
 *
 * Solves 4 root causes that make Web Push silent on seller PWA:
 *   1. When app is in foreground, OS suppresses showNotification() sound.
 *   2. iOS Safari ignores `vibrate` property in showNotification options.
 *   3. WebSocket `order_created` events fire but had no audible feedback.
 *   4. Web Audio API generates a chime programmatically — no audio asset
 *      needed (no download, no cache, works offline).
 *
 * Usage:
 *   import { triggerOrderAlert } from '../lib/notificationAlert';
 *   triggerOrderAlert();  // 2-tone chime + strong vibrate
 *
 * Pref:
 *   localStorage.ciltarasa_seller_alert_sound    "1" | "0"  (default "1")
 *   localStorage.ciltarasa_seller_alert_vibrate  "1" | "0"  (default "1")
 */

const LS_SOUND = 'ciltarasa_seller_alert_sound';
const LS_VIBRATE = 'ciltarasa_seller_alert_vibrate';

export function isSoundEnabled() {
  try { return localStorage.getItem(LS_SOUND) !== '0'; } catch { return true; }
}
export function setSoundEnabled(on) {
  try { localStorage.setItem(LS_SOUND, on ? '1' : '0'); } catch {}
}
export function isVibrateEnabled() {
  try { return localStorage.getItem(LS_VIBRATE) !== '0'; } catch { return true; }
}
export function setVibrateEnabled(on) {
  try { localStorage.setItem(LS_VIBRATE, on ? '1' : '0'); } catch {}
}

// ─── Shared AudioContext (reuse to avoid Safari memory leak) ───
let _audioCtx = null;
function getAudioContext() {
  if (_audioCtx && _audioCtx.state !== 'closed') return _audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
    return _audioCtx;
  } catch {
    return null;
  }
}

// ─── Unlock AudioContext on first user gesture (iOS requirement) ───
// Safari/Chrome on iOS require any user gesture before audio can play.
// We listen once to any touch/click on document and unlock the context.
let _audioUnlocked = false;
export function unlockAudio() {
  if (_audioUnlocked) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => { _audioUnlocked = true; }).catch(() => {});
  } else {
    _audioUnlocked = true;
  }
}

// Auto-attach a one-time gesture listener on first import to unlock audio
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const handler = () => {
    unlockAudio();
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('click', handler);
    document.removeEventListener('keydown', handler);
  };
  document.addEventListener('touchstart', handler, { passive: true, once: false });
  document.addEventListener('click', handler, { passive: true, once: false });
  document.addEventListener('keydown', handler, { passive: true, once: false });
}

// ─── Play a 2-tone "ding-dong" alert chime ───
export function playAlertSound() {
  if (!isSoundEnabled()) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    // If suspended, attempt resume (works if called from event handler)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;

    // ─── Tone 1: G5 (783.99 Hz) ───
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // ─── Tone 2: C6 (1046.50 Hz) — higher to grab attention ───
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.18);
    gain2.gain.setValueAtTime(0, now + 0.18);
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);

    // ─── Tone 3 (echo at 0.5s for emphasis) ───
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(880, now + 0.5);
    gain3.gain.setValueAtTime(0, now + 0.5);
    gain3.gain.linearRampToValueAtTime(0.25, now + 0.52);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(now + 0.5);
    osc3.stop(now + 0.95);

    return true;
  } catch (e) {
    console.warn('[alert] sound failed:', e);
    return false;
  }
}

// ─── Trigger device vibration (Android/desktop browsers; iOS limited) ───
export function vibrateAlert(pattern) {
  if (!isVibrateEnabled()) return false;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
  // Strong pattern: buzz-pause-buzz-pause-long-buzz
  const p = pattern || [200, 100, 200, 100, 400];
  try {
    navigator.vibrate(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Master trigger: sound + vibrate combined ───
export function triggerOrderAlert() {
  const soundOk = playAlertSound();
  const vibrateOk = vibrateAlert();
  return { soundOk, vibrateOk };
}

// ─── Special pattern for "payment proof submitted" (3 quick beeps) ───
export function triggerPaymentAlert() {
  if (!isSoundEnabled()) {
    vibrateAlert([100, 50, 100, 50, 100]);
    return;
  }
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [0, 0.15, 0.3].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1200, now + delay);
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.3, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);
      o.connect(g).connect(ctx.destination);
      o.start(now + delay);
      o.stop(now + delay + 0.12);
    });
    vibrateAlert([100, 50, 100, 50, 100]);
  } catch {}
}
