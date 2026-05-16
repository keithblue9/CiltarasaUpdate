import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import PwaInstallBanner from './PwaInstallBanner';
import InstallHelpModal from './InstallHelpModal';
import { detectEnv } from './detectEnv';

/**
 * Wraps the install banner + floating help button + help modal.
 * Hides everything when running in standalone mode.
 */
export default function PwaInstallHub() {
  const [open, setOpen] = useState(false);
  const env = detectEnv();
  if (env.isStandalone) return null;

  return (
    <>
      <PwaInstallBanner onOpenHelp={() => setOpen(true)} />
      <button
        data-testid="pwa-help-fab"
        onClick={() => setOpen(true)}
        aria-label="Bantuan install aplikasi"
        className="fixed bottom-3 left-3 z-[180] w-11 h-11 rounded-full bg-white/95 backdrop-blur border border-[#FED7AA] text-[#7C2D12] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center"
      >
        <HelpCircle size={20} />
      </button>
      <InstallHelpModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
