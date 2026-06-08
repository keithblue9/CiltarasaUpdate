/**
 * In-page notification alert: sound + vibrate, with full user control.
 *
 * Improvements over v1:
 *  - Volume slider (0-100%) — fixes "suara kecil banget"
 *  - Vibration intensity (Lembut/Normal/Kuat) — adjustable pattern
 *  - Async resume of AudioContext (fixes silent on idle PWA)
 *  - Falls back to vibrate-only if audio context can't be unlocked
 *  - Detect suspended state and notify caller for UI feedback
 *
 * Storage keys:
 *   ciltarasa_seller_alert_sound       "1" | "0"   (default "1")
 *   ciltarasa_seller_alert_vibrate     "1" | "0"   (default "1")
 *   ciltarasa_seller_alert_volume      "0"-"100"   (default "85")
 *   ciltarasa_seller_alert_vibe_intens "light" | "normal" | "strong" (default "normal")
 */

const LS_SOUND = 'ciltarasa_seller_alert_sound';
const LS_VIBRATE = 'ciltarasa_seller_alert_vibrate';
const LS_VOLUME = 'ciltarasa_seller_alert_volume';
const LS_VIBE_INTENSITY = 'ciltarasa_seller_alert_vibe_intens';

// ─── Preference getters/setters ─────────────────────────────────────
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
export function getVolume() {
  try {
    const v = Number(localStorage.getItem(LS_VOLUME));
    if (!isFinite(v) || v < 0) return 85;
    return Math.min(100, v);
  } catch { return 85; }
}
export function setVolume(vol) {
  try {
    const v = Math.max(0, Math.min(100, Math.round(Number(vol) || 0)));
    localStorage.setItem(LS_VOLUME, String(v));
  } catch {}
}
export function getVibrateIntensity() {
  try {
    const v = localStorage.getItem(LS_VIBE_INTENSITY);
    if (v === 'light' || v === 'normal' || v === 'strong') return v;
    return 'normal';
  } catch { return 'normal'; }
}
export function setVibrateIntensity(intensity) {
  try {
    if (['light', 'normal', 'strong'].includes(intensity)) {
      localStorage.setItem(LS_VIBE_INTENSITY, intensity);
    }
  } catch {}
}

// Vibrate pattern presets — picked to feel distinctive on Android
const VIBE_PATTERNS = {
  light:  [120, 80, 120],
  normal: [200, 100, 200, 100, 400],
  strong: [400, 100, 400, 100, 400, 100, 600],
};
const VIBE_PAYMENT_PATTERNS = {
  light:  [80, 50, 80],
  normal: [100, 50, 100, 50, 100],
  strong: [150, 80, 150, 80, 200],
};

// ─── Shared AudioContext ───────────────────────────────────────
let _audioCtx = null;
function getAudioContext() {
  if (_audioCtx && _audioCtx.state !== 'closed') return _audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
    return _audioCtx;
  } catch { return null; }
}

let _audioUnlocked = false;
export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    ctx.resume()
      .then(() => { _audioUnlocked = true; })
      .catch(() => {});
  } else if (ctx.state === 'running') {
    _audioUnlocked = true;
  }
  return _audioUnlocked;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const handler = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => { _audioUnlocked = true; }).catch(() => {});
    }
  };
  document.addEventListener('touchstart', handler, { passive: true });
  document.addEventListener('click', handler, { passive: true });
  document.addEventListener('keydown', handler, { passive: true });

  // ─── Silent keepalive: prevents iOS/Safari from auto-suspending AudioContext ───
  // Every 8 seconds, schedule an inaudible 5ms oscillator. This keeps the audio
  // graph "active" so when a real notif arrives, we don't have to await resume().
  // Only runs after user unlocked audio (so we don't try before first gesture).
  setInterval(() => {
    if (!_audioUnlocked) return;
    const ctx = _audioCtx;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime); // effectively silent
      osc.frequency.setValueAtTime(20, ctx.currentTime); // sub-audible
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.005);
    } catch {}
  }, 8000);
}

// ─── Core sound primitive (with proper async resume) ─────────────
async function _scheduleChime(envelopes) {
  if (!isSoundEnabled()) return { ok: false, reason: 'disabled' };
  const ctx = getAudioContext();
  if (!ctx) return { ok: false, reason: 'no_audio_api' };

  // ✅ AWAIT resume — fixes silent oscillator bug on idle PWA
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); }
    catch { return { ok: false, reason: 'needs_gesture' }; }
  }
  if (ctx.state !== 'running') return { ok: false, reason: 'not_running' };

  const volMul = getVolume() / 100;
  const now = ctx.currentTime;

  try {
    for (const env of envelopes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = env.type || 'sine';
      osc.frequency.setValueAtTime(env.freq, now + env.start);
      gain.gain.setValueAtTime(0, now + env.start);
      gain.gain.linearRampToValueAtTime(env.peak * volMul, now + env.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + env.start + env.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + env.start);
      osc.stop(now + env.start + env.duration + 0.05);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'schedule_failed', error: String(e) };
  }
}

export async function triggerOrderAlert() {
  let soundResult = { ok: false, reason: 'disabled' };
  if (isSoundEnabled()) {
    soundResult = await _scheduleChime([
      { type: 'sine',     freq: 783.99, start: 0,    peak: 0.55, duration: 0.30 },
      { type: 'sine',     freq: 1046.5, start: 0.18, peak: 0.60, duration: 0.45 },
      { type: 'triangle', freq: 880,    start: 0.50, peak: 0.40, duration: 0.40 },
    ]);
  }
  const vibrateOk = vibrateAlert(VIBE_PATTERNS[getVibrateIntensity()]);
  return { soundOk: soundResult.ok, vibrateOk, soundReason: soundResult.reason };
}

export async function triggerPaymentAlert() {
  let soundResult = { ok: false, reason: 'disabled' };
  if (isSoundEnabled()) {
    soundResult = await _scheduleChime([
      { type: 'sine', freq: 1200, start: 0.00, peak: 0.50, duration: 0.10 },
      { type: 'sine', freq: 1200, start: 0.15, peak: 0.50, duration: 0.10 },
      { type: 'sine', freq: 1200, start: 0.30, peak: 0.50, duration: 0.10 },
    ]);
  }
  const vibrateOk = vibrateAlert(VIBE_PAYMENT_PATTERNS[getVibrateIntensity()]);
  return { soundOk: soundResult.ok, vibrateOk, soundReason: soundResult.reason };
}

// ─── Legacy non-async wrappers ────────────────────────────────
export function playAlertSound() {
  triggerOrderAlert().catch(() => {});
  return true;
}

export function vibrateAlert(pattern) {
  if (!isVibrateEnabled()) return false;
  if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
  const p = pattern || VIBE_PATTERNS[getVibrateIntensity()];
  try { navigator.vibrate(p); return true; } catch { return false; }
}

export function audioStatus() {
  const ctx = _audioCtx;
  if (!ctx) return 'not_initialized';
  return ctx.state;
}
