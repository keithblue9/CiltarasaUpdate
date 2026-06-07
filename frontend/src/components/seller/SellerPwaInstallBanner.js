import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

const SESSION_KEY = 'ciltarasa_seller_pwa_dismissed';

function swapToSellerManifest() {
  try {
    const link = document.querySelector('link[rel="manifest"]');
    if (link && !link.getAttribute('href').includes('seller-manifest')) {
      link.setAttribute('href', '/seller-manifest.json');
    }
    document.title = 'Ciltarasa Seller';
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', '#7C2D12');
    const at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (at) at.setAttribute('content', 'Ciltarasa Seller');
  } catch (e) {}
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
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

  // Swap manifest immediately when seller app mounts
  useEffect(() => {
    swapToSellerManifest();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      // Always keep the latest prompt; install() will verify manifest is seller
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

  const install = async () => {
    // Ensure manifest is seller before prompting
    swapToSellerManifest();

    if (isIOS()) {
      // iOS Safari: must use "Share → Add to Home Screen". The dynamic <title>
      // and apple-mobile-web-app-title (set above) ensure the icon labels "Ciltarasa Seller".
      toast.info('Buka menu Share (📤) → "Add to Home Screen" untuk install Seller App. Pastikan judul "Ciltarasa Seller".', { duration: 9000 });
      dismiss();
      return;
    }

    if (!deferredPrompt) {
      toast.info('Belum bisa install langsung. Buka menu browser → "Install App" / "Add to Home Screen".', { duration: 7000 });
      dismiss();
      return;
    }

    // Verify the prompt was captured for SELLER manifest. If not, force reload so it re-fires
    // with the correct manifest already in place.
    const currentManifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '';
    if (!currentManifest.includes('seller-manifest')) {
      toast.info('Memuat ulang halaman supaya install Seller App benar...');
      setTimeout(() => window.location.reload(), 800);
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
              Pasang Ciltarasa Seller di home screen. Akses 1-klik, terima <span className="inline-flex items-center gap-0.5"><Bell size={10} /> notif push</span> real-time, tetap jalan saat offline.
            </p>
            <div className="flex gap-2">
              <button
                data-testid="seller-pwa-install-btn"
                onClick={install}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-[#451A03] font-bold text-xs px-3 py-1.5 rounded-full transition-all"
              >
                <Download size={14} /> Install Sekarang
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
