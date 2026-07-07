import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin, Phone, Clock, Instagram, Menu, X, User, LogOut, Package, ChevronDown, Settings } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { LogoWithText } from '../shared/Logo';
import Hero from './Hero';
import Catalog from './Catalog';
import CartDrawer from './CartDrawer';
import Checkout from './Checkout';
import OrderTracking from './OrderTracking';
import OnboardingModal from './OnboardingModal';
import BuyerProfileModal from './BuyerProfileModal';
import FlashSaleBanner from './FlashSaleBanner';
import FunFactsPopup from './FunFactsPopup';
import RecommendationsStrip from './RecommendationsStrip';
import BuyerThemeProvider from './BuyerThemeProvider';
import { detectEnv } from '../pwa/detectEnv';
import OrderHistory from './OrderHistory';
import PwaInstallHub from '../pwa/PwaInstallHub';
import useTrackVisit from './useTrackVisit';
import MaintenanceScreen from './MaintenanceScreen';
import BuyerChatWidget from './BuyerChatWidget';
import PushActivationPrompt from '../pwa/PushActivationPrompt';

function ProfileMenu() {
  const { authUser, logout, setAuthMode } = useApp();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  if (!authUser) {
    return (
      <button
        data-testid="header-login-btn"
        onClick={() => setAuthMode(null)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#7C2D12] border border-[#FED7AA] hover:bg-[#FED7AA] font-semibold text-xs transition-all"
      >
        <User size={14} /> Masuk
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        data-testid="profile-menu-btn"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-[#FED7AA]/60 transition-all"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
          {(authUser.name || 'U').charAt(0).toUpperCase()}
        </div>
        <span className="hidden sm:inline text-sm font-semibold text-[#7C2D12] max-w-[100px] truncate">{authUser.name || 'User'}</span>
        <ChevronDown size={14} className="hidden sm:inline text-[#9A3412]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div data-testid="profile-dropdown" className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-[#FED7AA] overflow-hidden z-40">
            <div className="p-4 bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7] border-b border-[#FED7AA]">
              <p className="text-xs uppercase tracking-wide text-[#9A3412] font-bold">Halo,</p>
              <p className="font-bold text-[#7C2D12] truncate">{authUser.name || 'Bunda'}</p>
              <p className="text-xs text-[#9A3412] mt-0.5">+{authUser.phone}</p>
            </div>
            <button
              onClick={() => { navigate('/buyer/orders'); setOpen(false); }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#FFF7ED] text-left transition-colors"
            >
              <Package size={16} className="text-[#EA580C]" />
              <span className="text-sm font-semibold text-[#7C2D12]">Pesananku</span>
            </button>
            <button
              data-testid="profile-settings-btn"
              onClick={() => { setShowSettings(true); setOpen(false); }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#FFF7ED] text-left transition-colors border-t border-[#FED7AA]"
            >
              <Settings size={16} className="text-[#EA580C]" />
              <span className="text-sm font-semibold text-[#7C2D12]">Pengaturan Akun</span>
            </button>
            <button
              data-testid="logout-btn"
              onClick={() => { logout(); setOpen(false); }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 text-left transition-colors border-t border-[#FED7AA]"
            >
              <LogOut size={16} className="text-red-500" />
              <span className="text-sm font-semibold text-red-600">Keluar</span>
            </button>
          </div>
        </>
      )}
      <BuyerProfileModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

function BuyerHeader({ onCartClick }) {
  const { cartCount, authUser } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [bounce, setBounce] = useState(false);

  // Smart routing — logged-in users go to history; guests go to track-by-id form
  const goToTrack = () => navigate(authUser ? '/buyer/orders' : '/buyer/track');
  const trackLabel = authUser ? 'Pesananku' : 'Lacak Pesanan';

  React.useEffect(() => {
    if (cartCount > prevCount) {
      setBounce(true);
      setTimeout(() => setBounce(false), 400);
    }
    setPrevCount(cartCount);
  }, [cartCount]);

  return (
    <>
      {/* iOS safe-area top spacer — separate spacer for reliable rendering on iPhone Dynamic Island.
          Fallback minHeight for iOS standalone in case env(safe-area-inset-top) returns 0. */}
      <div
        className="sticky top-0 z-40 bg-[#FDF8F0]"
        style={{
          height: 'env(safe-area-inset-top, 0px)',
          minHeight: (detectEnv().os === 'ios' && detectEnv().isStandalone) ? 47 : 0,
        }}
        aria-hidden="true"
      />
      <header
        className="sticky z-40 backdrop-blur-xl bg-[#FDF8F0]/90 border-b border-[#FED7AA]"
        style={{
          top: 'env(safe-area-inset-top, 0px)',
        }}
      >
      <div className="max-w-7xl mx-auto" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
        <div className="flex items-center justify-between h-14 sm:h-16">
          <button onClick={() => navigate('/buyer')} className="flex items-center">
            <LogoWithText size="sm" />
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/buyer')} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">Beranda</button>
            <button onClick={() => navigate('/buyer')} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">Menu</button>
            <button onClick={goToTrack} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">{trackLabel}</button>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <ProfileMenu />
            <button
              data-testid="cart-button"
              onClick={onCartClick}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white hover:shadow-lg transition-all shadow-md"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className={`absolute top-0 right-0 bg-[#78350F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${bounce ? 'badge-bounce' : ''}`}>
                  {cartCount}
                </span>
              )}
            </button>
            <button className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={24} className="text-[#78350F]" /> : <Menu size={24} className="text-[#78350F]" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-3 border-t border-[#FED7AA] pt-3">
            <button onClick={() => { navigate('/buyer'); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">Beranda</button>
            <button onClick={() => { navigate('/buyer'); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">Menu</button>
            <button onClick={() => { goToTrack(); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">{trackLabel}</button>
          </div>
        )}
      </div>
    </header>
    </>
  );
}

function BuyerFooter() {
  const { storeConfig } = useApp();
  const sc = storeConfig || {};
  const phone = (sc.whatsapp || '').replace(/^\+?/, '');
  return (
    <footer className="bg-[#78350F] text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-heading text-xl font-bold mb-3 text-[#FED7AA]">{sc.name || 'Ciltarasa'}</h3>
            {sc.tagline && (
              <p className="text-sm text-orange-200 font-body leading-relaxed">
                {sc.tagline}
              </p>
            )}
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3 text-[#FED7AA]">Kontak</h4>
            <div className="space-y-2 text-sm text-orange-200">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} />
                  <span>+{phone}</span>
                </div>
              )}
              {sc.address && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} />
                  <span>{sc.address}</span>
                </div>
              )}
              {sc.social_links?.instagram && (
                <div className="flex items-center gap-2">
                  <Instagram size={14} />
                  <span>{sc.social_links.instagram}</span>
                </div>
              )}
            </div>
          </div>
          {sc.operating_hours && (
            <div>
              <h4 className="font-heading font-semibold mb-3 text-[#FED7AA]">Jam Operasional</h4>
              <div className="space-y-1 text-sm text-orange-200">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{sc.operating_hours}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-amber-700 mt-8 pt-6 text-center text-xs text-orange-300">
          © {new Date().getFullYear()} {sc.name || 'Ciltarasa'}.{sc.tagline ? ' ' + sc.tagline : ''}
        </div>
      </div>
    </footer>
  );
}

function BuyerHome() {
  return (
    <>
      {/* Hero "home text" hanya tampil di desktop. Di mobile/PWA langsung ke katalog (search + produk). */}
      <div className="hidden sm:block">
        <Hero />
      </div>
      <FlashSaleBanner />
      <RecommendationsStrip />
      <Catalog />
    </>
  );
}

const API = process.env.REACT_APP_BACKEND_URL;

export default function BuyerApp() {
  const [cartOpen, setCartOpen] = useState(false);
  const { storeConfig, settings, authUser, authToken } = useApp();
  const [maintenance, setMaintenance] = useState(null);
  useTrackVisit();

  useEffect(() => {
    let cancelled = false;
    const fetchMaintenance = async () => {
      try {
        const r = await axios.get(`${API}/api/maintenance`);
        if (!cancelled) setMaintenance(r.data);
      } catch { /* keep null - assume open */ }
    };
    fetchMaintenance();
    // Refresh setiap 60 detik utk pickup perubahan dari seller (ringan, public endpoint)
    const id = setInterval(fetchMaintenance, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Saat enabled → tampilkan MaintenanceScreen menggantikan seluruh buyer UI
  if (maintenance?.enabled) {
    return <MaintenanceScreen config={maintenance} storeConfig={storeConfig} settings={settings} />;
  }

  return (
    <BuyerThemeProvider>
      <div className="min-h-screen bg-[#FDF8F0] font-body">
        <OnboardingModal />
        <FunFactsPopup />
        <BuyerHeader onCartClick={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <Routes>
          <Route index element={<BuyerHome />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="track" element={<OrderTracking />} />
          <Route path="orders" element={<OrderHistory />} />
        </Routes>
        <BuyerFooter />
        <PwaInstallHub />
        <BuyerChatWidget />
        {authUser && <PushActivationPrompt role="buyer" token={authToken} personName={authUser.name} />}
      </div>
    </BuyerThemeProvider>
  );
}
