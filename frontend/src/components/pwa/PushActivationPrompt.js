import React, { useEffect, useState } from 'react';
import { Bell, BellRing, X, Loader2, Share, PlusSquare } from 'lucide-react';
import { toast } from 'sonner';
import { detectEnv } from './detectEnv';
import { isPushSupported, getCurrentPermission, getExistingSubscription, requestSubscribe as sellerSubscribe } from './sellerPush';
import { subscribeBuyer } from './buyerPush';

const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari
const SHOW_DELAY_MS = 3500;

/**
 * Popup ajakan aktifkan Web Push. Dipakai buyer & seller.
 * - role='buyer'  → butuh `token` (user id)
 * - role='seller' → butuh `pin`
 * Muncul otomatis (sekali, setelah delay) kalau belum aktif & belum di-snooze.
 * Kalau sudah aktif (granted + subscribed) → tidak pernah muncul lagi.
 * Di iOS non-installed → tampilkan panduan install ke Home Screen (syarat push iOS).
 */
export default function PushActivationPrompt({ role, token, pin, personName }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('activate'); // 'activate' | 'ios-install'
  const snoozeKey = `ciltarasa_push_prompt_snooze_${role}`;

  useEffect(() => {
    let cancelled = false;
    let timer;
    (async () => {
      // Butuh kredensial yang sesuai
      if (role === 'buyer' && !token) return;
      if (role === 'seller' && !pin) return;

      // Sudah di-snooze?
      try {
        const s = Number(localStorage.getItem(snoozeKey) || 0);
        if (s && Date.now() < s) return;
      } catch (e) { /* ignore */ }

      const env = detectEnv();
      let nextMode = 'activate';
      try {
        if (env.os === 'ios' && !env.isStandalone) {
          // iOS di tab browser → push tidak mungkin sebelum di-install
          nextMode = 'ios-install';
        } else {
          const supported = await isPushSupported();
          if (!supported) return; // desktop safari lama dll → diam saja
          const perm = await getCurrentPermission();
          if (perm === 'denied') return; // diblokir di OS → jangan nagih
          // getExistingSubscription bisa "hang" kalau service worker telat aktif.
          // Kasih timeout 2.5s → kalau lewat, anggap belum subscribe (tetap tampilkan ajakan).
          const sub = await Promise.race([
            getExistingSubscription(),
            new Promise((res) => setTimeout(() => res(null), 2500)),
          ]);
          if (perm === 'granted' && sub) return; // sudah aktif → jangan muncul lagi
          nextMode = 'activate';
        }
      } catch (e) {
        // fail-open: kalau ada error tak terduga, tetap tampilkan ajakan aktifkan
        nextMode = 'activate';
      }

      if (cancelled || !nextMode) return;
      setMode(nextMode);
      timer = setTimeout(() => { if (!cancelled) setShow(true); }, SHOW_DELAY_MS);
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, token, pin]);

  const snooze = () => {
    try { localStorage.setItem(snoozeKey, String(Date.now() + SNOOZE_MS)); } catch (e) { /* ignore */ }
    setShow(false);
  };

  const activate = async () => {
    setBusy(true);
    try {
      const label = personName ? ('HP ' + personName) : undefined;
      if (role === 'buyer') await subscribeBuyer(token, label);
      else await sellerSubscribe(pin, label);
      toast.success('Notifikasi aktif! 🔔');
      setShow(false);
    } catch (e) {
      const msg = e?.message || 'Gagal mengaktifkan notifikasi';
      toast.error(msg);
      // Kalau user menolak izin di OS, jangan nagih terus
      if (/ditolak/i.test(msg)) snooze();
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  const isSeller = role === 'seller';
  const accent = isSeller ? '#7C2D12' : '#EA580C';
  const accentGrad = isSeller ? 'from-[#9A3412] to-[#7C2D12]' : 'from-[#F97316] to-[#EA580C]';

  const title = 'Aktifkan Notifikasi 🔔';
  const desc = isSeller
    ? 'Biar kamu langsung dapat notif tiap ada pesanan baru & bukti bayar masuk — nggak ada order yang kelewat.'
    : 'Biar kamu langsung dapat kabar tiap status pesananmu berubah — diproses, siap, sampai sampai di tujuan.';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[95] flex justify-center px-3 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#FED7AA] overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className={`px-4 py-3 bg-gradient-to-r ${accentGrad} text-white flex items-center gap-2`}>
          <BellRing size={18} />
          <span className="font-heading font-bold text-sm flex-1">{title}</span>
          <button onClick={snooze} aria-label="Tutup" className="p-1 hover:bg-white/20 rounded-full">
            <X size={16} />
          </button>
        </div>

        {mode === 'activate' ? (
          <div className="p-4">
            <p className="text-sm text-[#78350F] mb-4">{desc}</p>
            <div className="flex gap-2">
              <button
                onClick={snooze}
                className="flex-1 py-2.5 rounded-xl border border-[#FED7AA] text-[#78350F] font-bold text-sm hover:bg-[#FEF3C7] transition-all"
              >
                Nanti aja
              </button>
              <button
                onClick={activate}
                disabled={busy}
                className={`flex-[2] py-2.5 rounded-xl bg-gradient-to-r ${accentGrad} text-white font-bold text-sm shadow hover:shadow-md transition-all disabled:opacity-70 flex items-center justify-center gap-2`}
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> Mengaktifkan...</> : <><Bell size={16} /> Aktifkan Sekarang</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm text-[#78350F] mb-3">
              Di iPhone, notifikasi hanya jalan kalau Ciltarasa di-install ke <strong>Home Screen</strong> dulu. Caranya cepat kok:
            </p>
            <ol className="text-xs text-[#92400E] space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FED7AA] text-[#78350F] font-bold flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                <span className="flex items-center gap-1">Tap tombol <Share size={14} className="inline" style={{ color: accent }} /> <strong>Bagikan / Share</strong> di browser</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FED7AA] text-[#78350F] font-bold flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                <span className="flex items-center gap-1">Pilih <PlusSquare size={14} className="inline" style={{ color: accent }} /> <strong>Add to Home Screen</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#FED7AA] text-[#78350F] font-bold flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                <span>Buka Ciltarasa dari ikon barunya, lalu aktifkan notifikasi di sana</span>
              </li>
            </ol>
            <button
              onClick={snooze}
              className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${accentGrad} text-white font-bold text-sm shadow hover:shadow-md transition-all`}
            >
              Oke, ngerti 👍
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
