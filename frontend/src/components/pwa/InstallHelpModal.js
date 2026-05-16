import React, { useEffect, useState } from 'react';
import { X, HelpCircle, Smartphone, Monitor, Apple } from 'lucide-react';
import { detectEnv } from './detectEnv';

const ANDROID = {
  chrome: [
    'Tap menu ⋮ di pojok kanan atas',
    'Pilih "Tambahkan ke layar utama" atau "Install App"',
    'Tap "Install" → selesai!',
  ],
  firefox: [
    'Tap menu ⋮ di pojok kanan atas',
    'Pilih "Install" atau "Add to Home Screen"',
    'Tap "Add" → selesai!',
  ],
  edge: [
    'Tap menu ··· di pojok bawah',
    'Pilih "Tambahkan ke Layar Utama" atau "Install App"',
    'Tap "Install" → selesai!',
  ],
  samsung: [
    'Tap ikon menu (≡) di pojok kanan bawah',
    'Pilih "Tambahkan halaman ke" → "Layar Utama"',
    'Tap "Tambahkan" → selesai!',
  ],
};
const IOS = {
  safari: [
    'Tap ikon Share 􀈂 di bagian bawah browser',
    'Scroll ke bawah → pilih "Add to Home Screen"',
    'Tap "Add" di pojok kanan atas → selesai!',
  ],
  chrome: [
    'Tap ikon Share di pojok kanan atas (kotak + panah)',
    'Pilih "Add to Home Screen"',
    'Tap "Add" → selesai!',
  ],
  firefox: [
    'Tap ikon menu ··· di pojok kanan bawah',
    'Pilih "Add to Home Screen"',
    'Tap "Add" → selesai!',
  ],
  edge: [
    'Tap ikon menu ··· di pojok bawah',
    'Pilih "Add to Phone" atau "Add to Home Screen"',
    'Tap "Add" → selesai!',
  ],
};
const DESKTOP = {
  chrome: [
    'Lihat ikon install (⊕) di address bar kanan',
    'Klik → pilih "Install Ciltarasa"',
    'Selesai! App muncul di desktop/taskbar',
  ],
  edge: [
    'Klik ikon ··· di pojok kanan atas',
    'Pilih "Apps" → "Install this site as an app"',
    'Klik "Install" → selesai!',
  ],
  firefox: ['Firefox desktop belum mendukung PWA install.', 'Gunakan Chrome atau Edge untuk install di desktop.'],
  safari: [
    'Klik menu "File" di menu bar atas',
    'Pilih "Add to Dock"',
    'Klik "Add" → selesai!',
  ],
};

const BROWSER_LABELS = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  edge: 'Microsoft Edge',
  safari: 'Safari',
  samsung: 'Samsung Internet',
};

function BrowserPanel({ os, browser }) {
  const map = os === 'ios' ? IOS : os === 'desktop' ? DESKTOP : ANDROID;
  const browsers = Object.keys(map);
  const initial = browsers.includes(browser) ? browser : browsers[0];
  const [active, setActive] = useState(initial);
  useEffect(() => { setActive(initial); }, [initial]);

  const steps = map[active] || [];

  return (
    <div>
      {/* Browser tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {browsers.map((b) => (
          <button
            key={b}
            data-testid={`pwa-help-browser-${b}`}
            onClick={() => setActive(b)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
              active === b
                ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white border-transparent shadow'
                : 'bg-white text-[#7C2D12] border-[#FED7AA] hover:bg-[#FEF3C7]'
            }`}
          >
            {BROWSER_LABELS[b]}
          </button>
        ))}
      </div>

      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[13px] text-[#451A03]">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white font-bold text-xs flex items-center justify-center shadow">
              {i + 1}
            </span>
            <span className="pt-1 leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InstallHelpModal({ open, onClose, defaultOs }) {
  const [env] = useState(() => detectEnv());
  const [os, setOs] = useState(defaultOs || env.os);

  useEffect(() => { if (open) setOs(defaultOs || env.os); }, [open, defaultOs, env.os]);

  if (!open) return null;

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      data-testid={`pwa-help-os-${id}`}
      onClick={() => setOs(id)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
        os === id ? 'bg-[#7C2D12] text-white shadow' : 'bg-[#FFF7ED] text-[#7C2D12] hover:bg-[#FEF3C7]'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div
      data-testid="pwa-help-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="px-5 py-4 bg-gradient-to-r from-[#6B0F1A] via-[#9A1B2A] to-[#EA580C] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <HelpCircle size={18} />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base leading-tight">Cara Install Ciltarasa</h2>
              <p className="text-[11px] text-orange-100">Akses cepat seperti aplikasi asli!</p>
            </div>
          </div>
          <button data-testid="pwa-help-close" onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 flex flex-wrap gap-2">
          <TabBtn id="android" label="Android" icon={Smartphone} />
          <TabBtn id="ios" label="iPhone / iPad" icon={Apple} />
          <TabBtn id="desktop" label="Desktop" icon={Monitor} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <BrowserPanel os={os} browser={env.browser} />
          <div className="mt-5 p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] text-[11px] text-[#9A3412]">
            💡 <strong>Tips:</strong> Setelah install, ikon Ciltarasa akan muncul di home screen kamu. Buka tinggal tap, tanpa perlu buka browser lagi.
          </div>
        </div>
      </div>
    </div>
  );
}
