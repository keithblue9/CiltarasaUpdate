import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bell, BellOff, BellRing, Smartphone, AlertCircle, CheckCircle2, XCircle, Send, Trash2, Volume2, Vibrate, Upload, Music } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  getCurrentPermission, getExistingSubscription,
  requestSubscribe, unsubscribe, sendTestPush, syncSubscription,
} from '../pwa/sellerPush';
import {
  isSoundEnabled, setSoundEnabled,
  isVibrateEnabled, setVibrateEnabled,
  getVolume, setVolume,
  getVibrateIntensity, setVibrateIntensity,
  triggerOrderAlert, triggerPaymentAlert, unlockAudio, audioStatus,
  listSoundPresets, getSoundPreset, setSoundPreset,
  getCustomSound, setCustomSound, clearCustomSound, previewSound,
} from '../../lib/notificationAlert';

const API = process.env.REACT_APP_BACKEND_URL;
const PIN_KEY = 'seller_pin';
const MAX_SOUND_BYTES = 500 * 1024; // 500KB — keep localStorage happy

export default function SellerPushSettings() {
  const pin = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null;
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [soundOn, setSoundOnState] = useState(isSoundEnabled());
  const [vibrateOn, setVibrateOnState] = useState(isVibrateEnabled());
  const [volume, setVolumeState] = useState(getVolume());
  const [vibIntensity, setVibIntensityState] = useState(getVibrateIntensity());
  const [audioState, setAudioState] = useState('not_initialized');
  const [selectedSound, setSelectedSound] = useState(getCustomSound() ? '_custom' : getSoundPreset());
  const [customLabel, setCustomLabel] = useState(getCustomSound() ? 'Suara tersimpan' : '');
  const fileRef = useRef(null);
  const presets = listSoundPresets();

  // ─── Capability detection (richer than a single boolean) ───
  const caps = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};
    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    return {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      isIOS, standalone,
    };
  }, []);
  const pushSupported = !!(caps.serviceWorker && caps.pushManager && caps.notification);

  // Poll audio state to show suspended/running banner
  useEffect(() => {
    const tick = () => setAudioState(audioStatus());
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  const toggleSound = () => {
    const v = !soundOn;
    setSoundOnState(v);
    setSoundEnabled(v);
    if (v) {
      unlockAudio();
      setTimeout(() => triggerOrderAlert(), 100);
    }
    toast.success(`Suara notif ${v ? 'aktif' : 'mati'}`);
  };
  const toggleVibrate = () => {
    const v = !vibrateOn;
    setVibrateOnState(v);
    setVibrateEnabled(v);
    toast.success(`Getar notif ${v ? 'aktif' : 'mati'}`);
  };

  const handleVolumeChange = (e) => {
    const v = Number(e.target.value);
    setVolumeState(v);
    setVolume(v);
  };
  const handleVolumeCommit = () => {
    unlockAudio();
    previewSound(selectedSound);
  };

  const handleIntensityChange = (intensity) => {
    setVibIntensityState(intensity);
    setVibrateIntensity(intensity);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const patterns = { light: [120, 80, 120], normal: [200, 100, 200, 100, 400], strong: [400, 100, 400, 100, 400, 100, 600] };
      try { navigator.vibrate(patterns[intensity] || patterns.normal); } catch {}
    }
    toast.success(`Getaran: ${intensity === 'light' ? 'Lembut' : intensity === 'strong' ? 'Kuat' : 'Normal'}`);
  };

  // ─── Sound picker ───
  const pickPreset = (id) => {
    setSelectedSound(id);
    setSoundPreset(id);
    clearCustomSound();
    setCustomLabel('');
    unlockAudio();
    previewSound(id);
    toast.success('Suara dipilih & dites');
  };

  const handleUploadClick = () => { if (fileRef.current) fileRef.current.click(); };
  const handleSoundFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (e.target) e.target.value = ''; // allow re-pick same file
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('File harus audio (mp3/wav/m4a/ogg)'); return; }
    if (file.size > MAX_SOUND_BYTES) {
      toast.error('File kebesaran. Maks 500KB — pakai klip pendek 1-3 detik.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setCustomSound(String(reader.result));
        setCustomLabel(file.name);
        setSelectedSound('_custom');
        unlockAudio();
        previewSound('_custom');
        toast.success('🎵 Suara custom dipasang & dites');
      } catch {
        toast.error('Gagal simpan suara (mungkin kebesaran). Coba klip lebih pendek.');
      }
    };
    reader.onerror = () => toast.error('Gagal baca file');
    reader.readAsDataURL(file);
  };
  const removeCustom = () => {
    clearCustomSound();
    setCustomLabel('');
    setSelectedSound(getSoundPreset());
    toast.success('Suara custom dihapus, balik ke nada bawaan');
  };

  const handleUnlockAudio = () => {
    unlockAudio();
    setTimeout(() => {
      setAudioState(audioStatus());
      previewSound(selectedSound);
    }, 100);
    toast.success('🔓 Audio di-unlock — sekarang notif bisa bunyi');
  };
  const testSoundOnly = () => {
    unlockAudio();
    triggerOrderAlert();
    toast.info('🔔 Tes suara order baru — kalau ga kedengeran, cek volume HP & toggle suara di atas.', { duration: 6000 });
  };
  const testPaymentSoundOnly = () => {
    unlockAudio();
    triggerPaymentAlert();
    toast.info('💰 Tes suara bukti transfer (3 beep cepat)', { duration: 4000 });
  };

  const refresh = useCallback(async () => {
    setPermission(await getCurrentPermission());
    const sub = await getExistingSubscription();
    setSubscribed(!!sub);
    let serverSubs = [];
    try {
      const r = await axios.get(`${API}/api/push/subscriptions`);
      serverSubs = r.data.subscriptions || [];
    } catch (e) {
      console.warn('Push subscriptions fetch failed (likely PIN not yet set):', e?.message);
    }
    // Self-heal: browser is SUBSCRIBED but server lost the record → re-save it
    if (sub && sub.endpoint && pin && !serverSubs.some(s => s.endpoint === sub.endpoint)) {
      try {
        const res = await syncSubscription(pin, undefined);
        if (res.ok) {
          const r2 = await axios.get(`${API}/api/push/subscriptions`);
          serverSubs = r2.data.subscriptions || [];
          toast.success('🔄 Langganan disinkronkan ke server');
        }
      } catch (e) {
        console.warn('Resync failed:', e?.message);
      }
    }
    setSubscriptions(serverSubs);
  }, [pin]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await requestSubscribe(pin, label.trim() || undefined);
      toast.success('🔔 Notifikasi push aktif di device ini!');
      setLabel('');
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Gagal subscribe');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      await unsubscribe(pin);
      toast.success('Notifikasi push di device ini dimatikan');
      await refresh();
    } catch (e) {
      toast.error('Gagal unsubscribe');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await sendTestPush(pin);
      if (res.sent > 0) {
        toast.success(`✅ Test push terkirim ke ${res.sent} device!`);
      } else if (!res.total) {
        toast.error('Belum ada device tersimpan di server. Klik "Matikan" lalu "Aktifkan" lagi di device ini.', { duration: 8000 });
      } else if (res.first_error) {
        toast.error(`Device ada (${res.total}) tapi gagal kirim. Penyebab: ${res.first_error}`, { duration: 10000 });
      } else {
        toast.error(`Gagal kirim ke ${res.total} device (${res.failed} gagal).`, { duration: 8000 });
      }
      await refresh();
    } catch {
      toast.error('Error koneksi / PIN. Coba logout lalu login lagi di device ini.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSub = async (endpoint) => {
    if (!window.confirm('Hapus subscription ini? Device tersebut tidak akan menerima notif lagi.')) return;
    try {
      await axios.post(`${API}/api/push/unsubscribe`, { endpoint });
      toast.success('Subscription dihapus');
      await refresh();
    } catch { toast.error('Gagal'); }
  };

  const permLabel = {
    default: { color: 'bg-gray-100 text-gray-700', label: 'Belum diminta' },
    granted: { color: 'bg-green-100 text-green-700', label: 'Diizinkan ✓' },
    denied: { color: 'bg-red-100 text-red-700', label: 'Ditolak — buka settings' },
  }[permission] || { color: 'bg-gray-100', label: permission };

  const CapRow = ({ ok, children }) => (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" /> : <XCircle size={14} className="text-red-500 flex-shrink-0" />}
      <span className={ok ? 'text-green-800' : 'text-red-700'}>{children}</span>
    </li>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Push Notification</h1>
        <p className="text-xs text-[#9A3412] mt-0.5">Setup notifikasi pesanan baru ke device kamu — push (saat app tertutup) + suara/getar (saat app dibuka).</p>
      </div>

      {/* ─── PUSH CARD ─── */}
      {pushSupported ? (
        <div data-testid="push-status-card" className="rounded-2xl bg-white border border-[#FED7AA] p-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${subscribed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              {subscribed ? <BellRing size={28} /> : <BellOff size={28} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-heading font-bold text-[#7C2D12] text-base">Device Ini</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${permLabel.color}`}>{permLabel.label}</span>
                {subscribed && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">SUBSCRIBED</span>}
              </div>
              <p className="text-xs text-[#9A3412] mb-3">
                {subscribed
                  ? 'Device ini akan menerima notif push setiap ada pesanan baru — bahkan saat app tertutup.'
                  : 'Klik "Aktifkan" untuk mulai menerima notif push real-time di device ini.'}
              </p>
              {!subscribed && permission !== 'denied' && (
                <div className="space-y-2 mb-3">
                  <label className="text-xs font-semibold text-[#7C2D12]">Nama Device (opsional)</label>
                  <input
                    data-testid="push-label-input"
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Mis: HP Bunda, iPhone Toko, Tablet Kasir"
                    className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm"
                  />
                </div>
              )}
              {permission === 'denied' && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700">
                  Izin notif <b>ditolak</b>. Buka Settings iPhone → Notifikasi → cari "Ciltarasa Seller" → izinkan. Atau di Android: setelan situs → Notifikasi → izinkan, lalu balik ke sini.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {!subscribed ? (
                  <button
                    data-testid="push-subscribe-btn"
                    onClick={handleSubscribe}
                    disabled={loading || permission === 'denied'}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-4 py-2 rounded-full shadow disabled:opacity-50"
                  >
                    <Bell size={14} /> Aktifkan Notifikasi
                  </button>
                ) : (
                  <>
                    <button
                      data-testid="push-test-btn"
                      onClick={handleTest}
                      disabled={loading}
                      className="flex items-center gap-2 bg-blue-500 text-white font-bold px-4 py-2 rounded-full hover:bg-blue-600 disabled:opacity-50"
                    >
                      <Send size={14} /> Test Kirim
                    </button>
                    <button
                      data-testid="push-unsubscribe-btn"
                      onClick={handleUnsubscribe}
                      disabled={loading}
                      className="flex items-center gap-2 bg-white border border-red-300 text-red-600 font-bold px-4 py-2 rounded-full hover:bg-red-50 disabled:opacity-50"
                    >
                      <BellOff size={14} /> Matikan
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Push NOT supported → show WHY, not a blank wall ─── */
        <div data-testid="push-unsupported-card" className="rounded-2xl bg-amber-50 border border-amber-300 p-5">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Push belum bisa aktif di device ini</p>
              <p className="text-xs text-amber-700 mt-1">Tombol "Aktifkan" muncul setelah semua syarat di bawah ✓ hijau.</p>
            </div>
          </div>
          <ul className="text-[11px] space-y-1 mb-3 bg-white rounded-xl border border-amber-200 p-3">
            <CapRow ok={caps.serviceWorker}>Service Worker</CapRow>
            <CapRow ok={caps.notification}>Notification API</CapRow>
            <CapRow ok={caps.pushManager}>Push Manager</CapRow>
            {caps.isIOS && <CapRow ok={caps.standalone}>Dibuka dari ikon app (bukan tab Safari)</CapRow>}
          </ul>
          {caps.isIOS ? (
            <div className="text-[11px] text-amber-800 space-y-1.5">
              <p className="font-bold">📱 Khusus iPhone:</p>
              {!caps.standalone && (
                <p>• App ini lagi dibuka dari <b>Safari biasa</b>. Tutup, lalu buka lewat <b>ikon Ciltarasa di layar utama</b> (yang sudah diinstall). Push cuma jalan dari ikon app.</p>
              )}
              {caps.standalone && !caps.pushManager && (
                <p>• iPhone-nya perlu <b>iOS 16.4 ke atas</b> buat push. Cek di <b>Settings → Umum → Tentang → Versi iOS</b>. Kalau di bawah 16.4, update dulu (Settings → Umum → Pembaruan Perangkat Lunak).</p>
              )}
              <p>• Setelah itu, buka halaman ini lagi dari ikon app → tombol "Aktifkan" bakal muncul.</p>
              <p className="italic text-amber-600">Catatan: walau push belum aktif, <b>suara di bawah tetap bisa dipakai</b> saat app sedang dibuka.</p>
            </div>
          ) : (
            <p className="text-[11px] text-amber-800">Pakai Chrome/Edge/Firefox versi terbaru, dan buka via HTTPS. Install app ke home screen biar lebih reliable.</p>
          )}
        </div>
      )}

      {/* ─── SOUND & VIBRATE (ALWAYS shown — works in foreground even without push) ─── */}
      <div data-testid="alert-settings-card" className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-amber-300 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 size={20} className="text-amber-700" />
          <h3 className="font-heading font-bold text-[#7C2D12] text-base">Suara & Getar Notif</h3>
        </div>
        <p className="text-xs text-[#9A3412] mb-3">
          Bunyi alarm saat order baru / bukti bayar masuk <b>selama app dibuka</b>.
        </p>
        {caps.isIOS && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
            ℹ️ <b>Di iPhone:</b> suara pilihan/upload di bawah ini bunyi saat <b>app kebuka</b>. Saat app <b>ketutup</b>, iPhone pakai bunyi notif bawaannya (atur di <b>Settings iPhone → Notifikasi → Ciltarasa Seller</b>), dan getar juga dari situ — itu batasan Apple, bukan dari app.
          </div>
        )}

        <div className="space-y-3 mb-4">
          {/* Sound on/off */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className={soundOn ? 'text-green-600' : 'text-gray-400'} />
              <div>
                <p className="font-bold text-sm text-[#7C2D12]">Bunyikan Suara</p>
                <p className="text-[10px] text-[#9A3412]">Alarm saat order baru / bukti bayar masuk</p>
              </div>
            </div>
            <input data-testid="alert-sound-toggle" type="checkbox" checked={soundOn} onChange={toggleSound} className="w-12 h-6 accent-amber-600" />
          </label>

          {/* Sound picker */}
          {soundOn && (
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-2 mb-2">
                <Music size={14} /> Pilih Suara
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {presets.map(p => (
                  <button
                    key={p.id}
                    data-testid={`sound-preset-${p.id}`}
                    onClick={() => pickPreset(p.id)}
                    className={`p-2 rounded-lg border-2 text-xs font-bold transition-all ${
                      selectedSound === p.id
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-amber-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom upload */}
              <div className={`p-2 rounded-lg border-2 ${selectedSound === '_custom' ? 'border-amber-600 bg-amber-50' : 'border-dashed border-amber-300 bg-amber-50/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-1.5">
                      <Upload size={13} /> Suara dari HP
                    </p>
                    <p className="text-[10px] text-[#9A3412] truncate">
                      {customLabel ? `🎵 ${customLabel}` : 'Upload klip pendek (mp3/wav, maks 500KB)'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {customLabel && (
                      <>
                        <button onClick={() => previewSound('_custom')} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-bold">Tes</button>
                        <button onClick={removeCustom} className="px-2 py-1 rounded-lg bg-white border border-red-300 text-red-500 text-[10px] font-bold">Hapus</button>
                      </>
                    )}
                    <button onClick={handleUploadClick} className="px-2 py-1 rounded-lg bg-[#EA580C] text-white text-[10px] font-bold">Pilih File</button>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="audio/*" onChange={handleSoundFile} className="hidden" />
              </div>
            </div>
          )}

          {/* Volume slider */}
          {soundOn && (
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-2"><Volume2 size={14} /> Volume Suara</p>
                <span className="text-sm font-bold text-amber-700 tabular-nums">{volume}%</span>
              </div>
              <input
                data-testid="alert-volume-slider"
                type="range" min="0" max="100" step="5"
                value={volume}
                onChange={handleVolumeChange}
                onMouseUp={handleVolumeCommit}
                onTouchEnd={handleVolumeCommit}
                className="w-full accent-amber-600"
              />
              <p className="text-[10px] text-[#9A3412] mt-1 italic">Geser slider, lepas → otomatis tes suara di volume baru.</p>
            </div>
          )}

          {/* Vibrate */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Vibrate size={18} className={vibrateOn ? 'text-green-600' : 'text-gray-400'} />
              <div>
                <p className="font-bold text-sm text-[#7C2D12]">Getarkan HP</p>
                <p className="text-[10px] text-[#9A3412]">
                  {caps.isIOS ? 'iPhone TIDAK bisa getar dari web — atur getar lewat Settings iPhone → Notifikasi.' : 'Pattern getar saat notif (Android).'}
                </p>
              </div>
            </div>
            <input data-testid="alert-vibrate-toggle" type="checkbox" checked={vibrateOn} onChange={toggleVibrate} className="w-12 h-6 accent-amber-600" disabled={caps.isIOS} />
          </label>

          {vibrateOn && !caps.isIOS && (
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-2 mb-2"><Vibrate size={14} /> Intensitas Getaran</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'light', label: 'Lembut', desc: 'Singkat' },
                  { id: 'normal', label: 'Normal', desc: 'Default' },
                  { id: 'strong', label: 'Kuat', desc: 'Hard-to-miss' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    data-testid={`alert-vib-intensity-${opt.id}`}
                    onClick={() => handleIntensityChange(opt.id)}
                    className={`p-2 rounded-lg border-2 transition-all text-xs font-bold ${
                      vibIntensity === opt.id ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-400'
                    }`}
                  >
                    {opt.label}
                    <span className="block text-[9px] font-normal text-gray-500 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audio suspended banner */}
        {soundOn && audioState !== 'running' && audioState !== 'not_initialized' && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-300">
            <p className="text-xs font-bold text-amber-800 mb-2">🔇 Suara di-pause sementara</p>
            <p className="text-[11px] text-amber-700 mb-2 leading-relaxed">
              Browser otomatis "matiin" mesin suara kalau halaman ga dipake lama. Wajar. Klik tombol di bawah untuk nyalain lagi.
            </p>
            <button data-testid="alert-unlock-audio-btn" onClick={handleUnlockAudio} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              🔓 Aktifkan Suara Lagi
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button data-testid="alert-test-order-btn" onClick={testSoundOnly} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-full">
            <Bell size={14} /> Tes Suara Order
          </button>
          <button data-testid="alert-test-payment-btn" onClick={testPaymentSoundOnly} className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-full">
            <Bell size={14} /> Tes Suara Bukti Bayar
          </button>
        </div>
        <p className="text-[10px] text-[#9A3412] mt-3 italic">💡 Tap dulu salah satu tombol tes. iOS perlu user gesture pertama untuk unlock audio.</p>
      </div>

      {/* Subscriptions List */}
      <div className="rounded-2xl bg-white border border-[#FED7AA] p-5">
        <h3 className="font-heading font-bold text-[#7C2D12] text-base mb-3 flex items-center gap-2">
          <Smartphone size={18} /> Device yang Aktif ({subscriptions.length})
        </h3>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-[#9A3412]">Belum ada device. Aktifkan di device ini, atau buka link seller di HP/tablet lain & subscribe.</p>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id || s.endpoint} data-testid={`push-sub-${s.id}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#7C2D12] text-sm">{s.label || 'Device'}</p>
                  <p className="text-[10px] text-[#9A3412] truncate font-mono">{s.user_agent?.slice(0, 80) || '-'}</p>
                  <p className="text-[10px] text-[#9A3412]">Subscribed: {s.created_at ? new Date(s.created_at).toLocaleString('id-ID') : '-'}</p>
                </div>
                <button onClick={() => handleDeleteSub(s.endpoint)} className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100" title="Hapus subscription">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900">
        <p className="font-bold mb-2 flex items-center gap-2"><CheckCircle2 size={14} /> Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-[11px]">
          <li>Subscribe di SETIAP device yang ingin terima notif (HP utama, HP cadangan, tablet kasir, laptop).</li>
          <li>Push tetap masuk meski app tertutup — selama device online.</li>
          <li>iPhone: buka app dari ikon home screen (iOS 16.4+) baru push bisa aktif.</li>
          <li>Suara custom & getar di atas berlaku saat app sedang dibuka. Push background pakai bunyi sistem.</li>
        </ul>
      </div>
    </div>
  );
}
