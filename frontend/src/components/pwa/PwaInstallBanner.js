import React, { useEffect, useState, useCallback } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { detectEnv } from './detectEnv';

const SESSION_KEY = 'ciltarasa_pwa_dismissed';
const SHOWN_TOAST_KEY = 'ciltarasa_pwa_welcomed';

export default function PwaInstallBanner({ onOpenHelp }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [env] = useState(() => detectEnv());

  // Handle BIP (Chrome/Edge/Android)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Welcome toast on standalone launch (one-time)
  useEffect(() => {
    if (env.isStandalone && !sessionStorage.getItem(SHOWN_TOAST_KEY)) {
      sessionStorage.setItem(SHOWN_TOAST_KEY, '1');
      setTimeout(() => {
        toast.success('Selamat! Ciltarasa sudah terinstall di HP kamu 🎉', { duration: 4000 });
      }, 1000);
    }
  }, [env.isStandalone]);

  // Trigger: 30s timer OR after browse activity
  useEffect(() => {
    if (env.isStandalone) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    let timer = setTimeout(() => setShow(true), 30000); // 30s
    // Also trigger if user lingers on catalog
    const catalog = document.getElementById('catalog');
    let observer;
    if (catalog && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          clearTimeout(timer);
          timer = setTimeout(() => setShow(true), 5000);
        }
      });
      observer.observe(catalog);
    }
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [env.isStandalone]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          sessionStorage.setItem(SESSION_KEY, '1');
          setShow(false);
        }
      } catch (err) {
        console.warn('[PWA] Install prompt error:', err);
      }
      setDeferredPrompt(null);
    } else {
      // No native prompt → open help modal
      onOpenHelp?.();
      sessionStorage.setItem(SESSION_KEY, '1');
      setShow(false);
    }
  }, [deferredPrompt, onOpenHelp]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(false);
  };

  if (env.isStandalone || !show) return null;

  return (
    <div
      data-testid="pwa-install-banner"
      role="dialog"
      aria-label="Install Ciltarasa"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] z-[200] animate-pwa-slide-up"
    >
      <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_-10px_rgba(124,45,18,0.55)] border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] via-white to-[#FEF3C7]">
        <div className="flex items-center gap-3 p-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6B0F1A] to-[#9A1B2A] flex items-center justify-center flex-shrink-0 shadow-lg">
            <img src="/icons/icon-192.png" alt="Ciltarasa" className="w-10 h-10 rounded-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-extrabold text-[#7C2D12] text-sm leading-tight">Install Ciltarasa di HP kamu!</p>
            <p className="text-[11px] text-[#9A3412] mt-0.5">Akses lebih cepat, seperti aplikasi asli! 🚀</p>
          </div>
          <button
            data-testid="pwa-dismiss-btn"
            onClick={dismiss}
            aria-label="Tutup"
            className="p-1.5 rounded-full hover:bg-[#FED7AA]/60 text-[#9A3412]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <button
            data-testid="pwa-later-btn"
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-[#FED7AA] text-[#7C2D12] font-bold text-xs hover:bg-[#FFF7ED]"
          >
            ✕ Nanti saja
          </button>
          <button
            data-testid="pwa-install-btn"
            onClick={handleInstall}
            className="flex-[1.4] py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold text-xs shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5"
          >
            <Download size={13} /> Install Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
