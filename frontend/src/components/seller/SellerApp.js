import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SellerLogin from './SellerLogin';
import SellerSidebar from './SellerSidebar';
import DashboardOverview from './DashboardOverview';
import Dashboard from './Dashboard';
import ProductManagement from './ProductManagement';
import IncomingOrders from './IncomingOrders';
import SalesReport from './SalesReport';
import FinancialReport from './FinancialReport';
import { StoreProfile, StoreCerita, CategoriesConfig, DeliveryConfig, PaymentsConfig, HomepageTextsConfig, HeroSlideshowConfig, FunFactsConfig, OnboardingTextsConfig } from './StoreConfigPages';
import DiscountManagement from './DiscountManagement';
import PurchaseManagement from './PurchaseManagement';
import { FonnteConfig, HowToOrderConfig, ResetCustomersConfig, ChangePinConfig, TrafficStats, AutoChatConfig, InvoiceConfig, DashboardWidgetsConfig, MaintenanceConfig, PwaInstallConfig } from './AdminPages';
import SellerPushSettings from './SellerPushSettings';
import SellerPwaInstallBanner from './SellerPwaInstallBanner';
import { setSellerManifest, restoreBuyerManifest } from '../pwa/sellerPush';
import { Smartphone } from 'lucide-react';
import { detectEnv } from '../pwa/detectEnv';

const API = process.env.REACT_APP_BACKEND_URL;
const PIN_KEY = 'seller_pin';
let _sellerInterceptorId = null;

function attachSellerInterceptor(getPin) {
  if (_sellerInterceptorId !== null) return;
  _sellerInterceptorId = axios.interceptors.request.use(cfg => {
    const url = cfg.url || '';
    const method = (cfg.method || 'get').toLowerCase();
    if (method !== 'get' && (url.includes('/api/products') || url.includes('/api/purchases') || url.includes('/api/discounts') || url.includes('/api/settings') || url.includes('/api/store-config') || url.includes('/api/financial-entries') || url.includes('/api/admin/test-wa') || url.includes('/api/admin/reset-customers') || url.includes('/api/admin/change-pin') || url.includes('/api/media/upload') || url.includes('/api/push/') || url.includes('/api/maintenance') || url.includes('/api/ai/') || /\/api\/orders\/[^/]+\/status/.test(url))) {
      cfg.headers = cfg.headers || {};
      cfg.headers['X-Seller-PIN'] = getPin();
    }
    // Analytics GET (PIN-guarded)
    if (method === 'get' && (url.includes('/api/analytics/stats') || url.includes('/api/dashboard/') || url.includes('/api/admin/fonnte-status') || url.includes('/api/push/subscriptions') || url.includes('/api/ai/'))) {
      cfg.headers = cfg.headers || {};
      cfg.headers['X-Seller-PIN'] = getPin();
    }
    return cfg;
  });
}

function detachSellerInterceptor() {
  if (_sellerInterceptorId !== null) {
    axios.interceptors.request.eject(_sellerInterceptorId);
    _sellerInterceptorId = null;
  }
}

export default function SellerApp() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(PIN_KEY));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authed) attachSellerInterceptor(() => localStorage.getItem(PIN_KEY) || '');
    else detachSellerInterceptor();
    return () => detachSellerInterceptor();
    // PIN_KEY, attach/detach are module-scoped constants — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // FASE 5: Swap manifest to seller-manifest while in seller scope
  useEffect(() => {
    setSellerManifest();
    return () => restoreBuyerManifest();
  }, []);

  const handleLogin = async (pin) => {
    try {
      const r = await axios.post(`${API}/api/admin/verify-pin`, { pin });
      if (r.data?.success) {
        localStorage.setItem(PIN_KEY, pin);
        setAuthed(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(PIN_KEY);
    setAuthed(false);
  };

  if (!authed) {
    return <SellerLogin onLogin={handleLogin} />;
  }

  const tabContent = {
    dashboard: <Dashboard />,
    'dashboard-legacy': <DashboardOverview onTabChange={setActiveTab} />,
    products: <ProductManagement />,
    purchases: <PurchaseManagement />,
    orders: <IncomingOrders />,
    sales: <SalesReport />,
    financial: <FinancialReport />,
    traffic: <TrafficStats />,
    'store-profile': <StoreProfile />,
    'store-cerita': <StoreCerita />,
    'homepage-texts': <HomepageTextsConfig />,
    'onboarding-texts': <OnboardingTextsConfig />,
    'how-to-order': <HowToOrderConfig />,
    'hero-slideshow': <HeroSlideshowConfig />,
    'fun-facts': <FunFactsConfig />,
    categories: <CategoriesConfig />,
    delivery: <DeliveryConfig />,
    payments: <PaymentsConfig />,
    'auto-chat': <AutoChatConfig />,
    invoice: <InvoiceConfig />,
    'dashboard-widgets': <DashboardWidgetsConfig />,
    'push-notif': <SellerPushSettings />,
    maintenance: <MaintenanceConfig />,
    'pwa-install': <PwaInstallConfig />,
    discounts: <DiscountManagement />,
    whatsapp: <FonnteConfig />,
    'change-pin': <ChangePinConfig onPinChanged={() => handleLogout()} />,
    'reset-customers': <ResetCustomersConfig />,
  };

  return (
    <div className="flex h-screen bg-[#FDF8F0] overflow-hidden font-body">
      <SellerSidebar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* iOS safe-area top spacer — separate from header for reliable rendering on iPhone Dynamic Island.
            Fallback minHeight for iOS standalone in case env(safe-area-inset-top) returns 0 (Safari quirk). */}
        <div
          className="lg:hidden bg-white sticky top-0 z-30"
          style={{
            height: 'env(safe-area-inset-top, 0px)',
            minHeight: (detectEnv().os === 'ios' && detectEnv().isStandalone) ? 47 : 0,
          }}
          aria-hidden="true"
        />
        <div
          className="lg:hidden flex items-center justify-between bg-white border-b border-[#FED7AA] sticky z-30"
          style={{
            top: `calc(env(safe-area-inset-top, 0px) + ${(detectEnv().os === 'ios' && detectEnv().isStandalone) ? 0 : 0}px)`,
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
            paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)',
            paddingTop: '10px',
            paddingBottom: '10px',
            minHeight: 56,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-[#78350F] active:bg-[#FFEDD5] rounded-lg flex-shrink-0"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Buka menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-heading font-bold text-[#78350F] text-base flex-1 text-center px-2 truncate">Ciltarasa Seller</span>
          {detectEnv().isStandalone ? (
            <span data-testid="seller-installed-badge" className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex-shrink-0">
              <Smartphone size={11} /> Installed
            </span>
          ) : <div style={{ minWidth: 44 }} className="flex-shrink-0" />}
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {tabContent[activeTab] || tabContent.dashboard}
        </main>
      </div>
      <SellerPwaInstallBanner />
    </div>
  );
}
