import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Save, Smartphone, AlertCircle, CheckCircle2, Send, Trash2, Volume2, Vibrate } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  isPushSupported, getCurrentPermission, getExistingSubscription,
  requestSubscribe, unsubscribe, sendTestPush,
} from '../pwa/sellerPush';
import {
  isSoundEnabled, setSoundEnabled,
  isVibrateEnabled, setVibrateEnabled,
  getVolume, setVolume,
  getVibrateIntensity, setVibrateIntensity,
  triggerOrderAlert, triggerPaymentAlert, unlockAudio, audioStatus,
} from '../../lib/notificationAlert';

const API = process.env.REACT_APP_BACKEND_URL;
const PIN_KEY = 'seller_pin';

export default function SellerPushSettings() {
  const pin = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null;
  const [supported, setSupported] = useState(true);
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
    // Play test sound at the new volume after user releases slider
    unlockAudio();
    triggerOrderAlert();
  };

  const handleIntensityChange = (intensity) => {
    setVibIntensityState(intensity);
    setVibrateIntensity(intensity);
    // Trigger vibrate so user feels new pattern
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const patterns = { light: [120, 80, 120], normal: [200, 100, 200, 100, 400], strong: [400, 100, 400, 100, 400, 100, 600] };
      try { navigator.vibrate(patterns[intensity] || patterns.normal); } catch {}
    }
    toast.success(`Getaran: ${intensity === 'light' ? 'Lembut' : intensity === 'strong' ? 'Kuat' : 'Normal'}`);
  };

  const handleUnlockAudio = () => {
    unlockAudio();
    setTimeout(() => {
      setAudioState(audioStatus());
      triggerOrderAlert();
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
    setSupported(await isPushSupported());
    setPermission(await getCurrentPermission());
    const sub = await getExistingSubscription();
    setSubscribed(!!sub);
    try {
      const r = await axios.get(`${API}/api/push/subscriptions`);
      setSubscriptions(r.data.subscriptions || []);
    } catch (e) {
      console.warn('Push subscriptions fetch failed (likely PIN not yet set):', e?.message);
    }
  }, []);

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
      if (res.sent > 0) toast.success(`✅ Test push terkirim ke ${res.sent} device!`);
      else toast.error(`Gagal: ${res.reason || 'tidak ada subscriber'}`);
      await refresh();
    } catch {
      toast.error('Error koneksi');
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

  if (!supported) {
    return (
      <div className="space-y-5">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Push Notification</h1>
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-900">Browser tidak support Web Push</p>
            <p className="text-xs text-red-700 mt-1">Gunakan Chrome/Edge/Firefox/Safari versi terbaru. Untuk iPhone, install PWA dulu ke home screen (iOS 16.4+) baru bisa terima push.</p>
          </div>
        </div>
      </div>
    );
  }

  const permLabel = {
    default: { color: 'bg-gray-100 text-gray-700', label: 'Belum diminta' },
    granted: { color: 'bg-green-100 text-green-700', label: 'Diizinkan ✓' },
    denied: { color: 'bg-red-100 text-red-700', label: 'Ditolak — buka settings browser' },
  }[permission] || { color: 'bg-gray-100', label: permission };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Push Notification</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Setup notifikasi push real-time ke device kamu untuk pesanan baru — bahkan saat browser/app tertutup.</p>
        </div>
      </div>

      {/* Status Card */}
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
                ? 'Device ini akan menerima notif push setiap ada pesanan baru.'
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
                  placeholder="Mis: HP Bunda, Laptop Toko, Tablet Kasir"
                  className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm"
                />
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

      {/* Sound & Vibrate (foreground audio fix) */}
      <div data-testid="alert-settings-card" className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-amber-300 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Volume2 size={20} className="text-amber-700" />
          <h3 className="font-heading font-bold text-[#7C2D12] text-base">Suara & Getar Notif</h3>
        </div>
        <p className="text-xs text-[#9A3412] mb-4">
          Kalau push notif silent saat app dibuka, ini yang bunyiin in-app. Sound di-generate via Web Audio (no file download). Toggle on dan tes.
        </p>

        <div className="space-y-3 mb-4">
          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className={soundOn ? 'text-green-600' : 'text-gray-400'} />
              <div>
                <p className="font-bold text-sm text-[#7C2D12]">Bunyikan Chime</p>
                <p className="text-[10px] text-[#9A3412]">2-tone "ding-dong" saat order baru / bukti bayar masuk</p>
              </div>
            </div>
            <input
              data-testid="alert-sound-toggle"
              type="checkbox"
              checked={soundOn}
              onChange={toggleSound}
              className="w-12 h-6 accent-amber-600"
            />
          </label>

          {/* Volume slider — fixes "suara kecil banget" */}
          {soundOn && (
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-2">
                  <Volume2 size={14} /> Volume Suara
                </p>
                <span className="text-sm font-bold text-amber-700 tabular-nums">{volume}%</span>
              </div>
              <input
                data-testid="alert-volume-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={volume}
                onChange={handleVolumeChange}
                onMouseUp={handleVolumeCommit}
                onTouchEnd={handleVolumeCommit}
                className="w-full accent-amber-600"
              />
              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>Pelan</span>
                <span>Sedang</span>
                <span>🔊 Keras</span>
              </div>
              <p className="text-[10px] text-[#9A3412] mt-1 italic">
                Geser slider, lepas → otomatis tes suara di volume baru.
              </p>
            </div>
          )}

          <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-200 cursor-pointer">
            <div className="flex items-center gap-3">
              <Vibrate size={18} className={vibrateOn ? 'text-green-600' : 'text-gray-400'} />
              <div>
                <p className="font-bold text-sm text-[#7C2D12]">Getarkan HP</p>
                <p className="text-[10px] text-[#9A3412]">Pattern getar saat notif. Android only (iOS limited).</p>
              </div>
            </div>
            <input
              data-testid="alert-vibrate-toggle"
              type="checkbox"
              checked={vibrateOn}
              onChange={toggleVibrate}
              className="w-12 h-6 accent-amber-600"
            />
          </label>

          {/* Vibration intensity selector */}
          {vibrateOn && (
            <div className="p-3 rounded-xl bg-white border border-amber-200">
              <p className="text-xs font-bold text-[#7C2D12] flex items-center gap-2 mb-2">
                <Vibrate size={14} /> Intensitas Getaran
              </p>
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
                      vibIntensity === opt.id
                        ? 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-amber-400'
                    }`}
                  >
                    {opt.label}
                    <span className="block text-[9px] font-normal text-gray-500 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#9A3412] mt-1 italic">
                Tap untuk pilih → otomatis tes getaran di intensitas baru.
              </p>
            </div>
          )}
        </div>

        {/* Audio context status — banner if suspended */}
        {soundOn && audioState !== 'running' && audioState !== 'not_initialized' && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-300">
            <p className="text-xs font-bold text-amber-800 mb-2">
              🔇 Suara di-pause sementara
            </p>
            <p className="text-[11px] text-amber-700 mb-2 leading-relaxed">
              <strong>Apa ini?</strong> Browser otomatis "matiin" mesin suara kalau halaman ga dipake lama. Ini wajar, ga ada masalah. Cuma kalau order masuk pas state ini, suara mungkin pelan/ga bunyi. Klik tombol di bawah untuk "nyalain" lagi mesin suaranya.
            </p>
            <button
              data-testid="alert-unlock-audio-btn"
              onClick={handleUnlockAudio}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-full"
            >
              🔓 Aktifkan Suara Lagi
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            data-testid="alert-test-order-btn"
            onClick={testSoundOnly}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-full"
          >
            <Bell size={14} /> Tes Suara Order
          </button>
          <button
            data-testid="alert-test-payment-btn"
            onClick={testPaymentSoundOnly}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-full"
          >
            <Bell size={14} /> Tes Suara Bukti Bayar
          </button>
        </div>
        <p className="text-[10px] text-[#9A3412] mt-3 italic">
          💡 Tap dulu salah satu tombol tes di atas. iOS perlu user gesture pertama untuk unlock audio.
        </p>
      </div>

      {/* Subscriptions List */}
      <div className="rounded-2xl bg-white border border-[#FED7AA] p-5">
        <h3 className="font-heading font-bold text-[#7C2D12] text-base mb-3 flex items-center gap-2">
          <Smartphone size={18} /> Device yang Aktif ({subscriptions.length})
        </h3>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-[#9A3412]">Belum ada device. Aktifkan di device ini atau buka link seller di HP/tablet lain & subscribe.</p>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id || s.endpoint} data-testid={`push-sub-${s.id}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#7C2D12] text-sm">{s.label || 'Device'}</p>
                  <p className="text-[10px] text-[#9A3412] truncate font-mono">{s.user_agent?.slice(0, 80) || '-'}</p>
                  <p className="text-[10px] text-[#9A3412]">Subscribed: {s.created_at ? new Date(s.created_at).toLocaleString('id-ID') : '-'}</p>
                </div>
                <button
                  onClick={() => handleDeleteSub(s.endpoint)}
                  className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
                  title="Hapus subscription"
                >
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
          <li>Push tetap masuk meski browser tertutup — selama device online & service worker aktif.</li>
          <li>Install Seller App dulu (klik banner "Install App") agar push lebih reliable di iOS 16.4+ & Android.</li>
          <li>Push notification berjalan paralel dengan WA Fonnte — jangan khawatir notif jadi duplikat, WA tetap dikirim untuk catatan lengkap.</li>
        </ul>
      </div>
    </div>
  );
}
