import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Bell, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

const SESSION_KEY = 'ciltarasa_seller_pwa_dismissed';

function swapToSellerManifest() {
  try {
    // Remove ALL existing manifest links and write a fresh one with cache buster
    document.querySelectorAll('link[rel="manifest"]').forEach(l => l.remove());
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/seller-manifest.json?v=' + Date.now();
    document.head.appendChild(link);
    document.title = 'Ciltarasa Seller';
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', '#7C2D12');
    let at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!at) {
      at = document.createElement('meta');
      at.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(at);
    }
    at.setAttribute('content', 'Ciltarasa Seller');
  } catch (e) {}
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isPageOpenedAsSeller() {
  // True if the page was opened with the seller marker in URL — meaning the inline
  // script in index.html had a chance to set seller manifest from the very start of parsing.
  const qs = window.location.search || '';
  return qs.indexOf('app=seller') !== -1;
}

export default function SellerPwaInstallBanner() {
  const { storeConfig } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isStandalone] = useState(() =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );

  // Configurable popup delay (default 10s)
  const delaySec = Number(storeConfig?.pwa_install?.seller_delay_seconds ?? 10);
  const enabled = storeConfig?.pwa_install?.seller_enabled !== false;

  // Swap manifest immediately when seller app mounts (best-effort runtime swap)
  useEffect(() => {
    swapToSellerManifest();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (isStandalone) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    const t = setTimeout(() => setShow(true), Math.max(0, delaySec) * 1000);
    return () => clearTimeout(t);
  }, [isStandalone, enabled, delaySec]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(false);
  };

  // ─── iOS: Open a fresh tab with ?app=seller so inline script bakes seller manifest
  //     into HTML from the start. This bypasses iOS Safari's aggressive manifest cache.
  const openFreshSellerTab = () => {
    const url = window.location.origin + '/?app=seller#/seller';
    window.open(url, '_blank');
    toast.info('Di tab baru: tap menu Share (📤) → "Add to Home Screen". Pastikan judul "Ciltarasa Seller".', { duration: 12000 });
    dismiss();
  };

  const install = async () => {
    // Always re-swap manifest before any install attempt
    swapToSellerManifest();

    if (isIOS()) {
      // If we're NOT already on a ?app=seller URL, force fresh tab — only way to defeat
      // iOS Safari's manifest cache from a previous /buyer visit.
      if (!isPageOpenedAsSeller()) {
        openFreshSellerTab();
        return;
      }
      // Already on a clean seller URL — instructions only
      toast.info('Buka menu Share (📤) → "Add to Home Screen". Judul harus "Ciltarasa Seller".', { duration: 9000 });
      dismiss();
      return;
    }

    if (!deferredPrompt) {
      toast.info('Belum bisa install langsung. Buka menu browser → "Install App" / "Add to Home Screen".', { duration: 7000 });
      dismiss();
      return;
    }

    // Verify the prompt was captured for SELLER manifest. If not, force reload to seller URL.
    const currentManifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '';
    if (!currentManifest.includes('seller-manifest')) {
      toast.info('Memuat ulang halaman supaya install Seller App benar...');
      setTimeout(() => { window.location.href = '/?app=seller#/seller'; }, 800);
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('🎉 Ciltarasa Seller terinstall! Akses dari home screen.');
        sessionStorage.setItem(SESSION_KEY, '1');
      }
    } catch (e) {
      console.warn('[Seller PWA] prompt error:', e);
      toast.info('Gunakan menu browser → "Install App" untuk pasang manual.', { duration: 6000 });
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!enabled || !show || isStandalone) return null;

  const iosNeedsFreshTab = isIOS() && !isPageOpenedAsSeller();

  return (
    <div data-testid="seller-pwa-install-banner" className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm z-50 animate-slide-up">
      <div className="rounded-2xl bg-gradient-to-br from-[#7C2D12] to-[#451A03] shadow-2xl p-4 text-white border border-amber-700">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <Smartphone size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-base mb-1">Install Seller App</p>
            <p className="text-xs text-amber-100 mb-3 leading-relaxed">
              {iosNeedsFreshTab ? (
                <>iOS perlu langkah ekstra agar icon-nya jadi <strong>"Ciltarasa Seller"</strong>. Tap tombol di bawah untuk buka tab baru yang bersih.</>
              ) : (
                <>Pasang Ciltarasa Seller di home screen. Akses 1-klik, terima <span className="inline-flex items-center gap-0.5"><Bell size={10} /> notif push</span> real-time.</>
              )}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                data-testid="seller-pwa-install-btn"
                onClick={install}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-[#451A03] font-bold text-xs px-3 py-1.5 rounded-full transition-all"
              >
                {iosNeedsFreshTab ? <><ExternalLink size={14} /> Buka Tab Baru</> : <><Download size={14} /> Install Sekarang</>}
              </button>
              <button
                data-testid="seller-pwa-dismiss-btn"
                onClick={dismiss}
                className="text-xs text-amber-200 hover:text-white px-2"
              >
                Nanti
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-amber-200 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
