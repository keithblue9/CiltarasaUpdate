import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SellerLogin from './SellerLogin';
import SellerSidebar from './SellerSidebar';
import DashboardOverview from './DashboardOverview';
import ProductManagement from './ProductManagement';
import IncomingOrders from './IncomingOrders';
import SalesReport from './SalesReport';
import FinancialReport from './FinancialReport';
import { StoreProfile, StoreCerita, CategoriesConfig, DeliveryConfig, PaymentsConfig, HomepageTextsConfig, HeroSlideshowConfig, FunFactsConfig, OnboardingTextsConfig } from './StoreConfigPages';
import DiscountManagement from './DiscountManagement';
import PurchaseManagement from './PurchaseManagement';
import { FonnteConfig, HowToOrderConfig, ResetCustomersConfig } from './AdminPages';
import { Smartphone } from 'lucide-react';
import { detectEnv } from '../pwa/detectEnv';

const PIN = 'ciltarasa';
let _sellerInterceptorId = null;

function attachSellerInterceptor(pin) {
  if (_sellerInterceptorId !== null) return;
  _sellerInterceptorId = axios.interceptors.request.use(cfg => {
    const url = cfg.url || '';
    // Attach PIN only for seller-mutating endpoints (POST/PUT/DELETE to backend)
    const method = (cfg.method || 'get').toLowerCase();
    if (method !== 'get' && (url.includes('/api/products') || url.includes('/api/purchases') || url.includes('/api/discounts') || url.includes('/api/settings') || url.includes('/api/store-config') || url.includes('/api/financial-entries') || url.includes('/api/admin/') || url.includes('/api/media/upload') || /\/api\/orders\/[^/]+\/status/.test(url))) {
      cfg.headers = cfg.headers || {};
      cfg.headers['X-Seller-PIN'] = pin;
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
  const [authed, setAuthed] = useState(() => localStorage.getItem('seller_auth') === 'true');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (authed) attachSellerInterceptor(PIN);
    else detachSellerInterceptor();
    return () => detachSellerInterceptor();
  }, [authed]);

  const handleLogin = (pin) => {
    if (pin === PIN) {
      localStorage.setItem('seller_auth', 'true');
      setAuthed(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('seller_auth');
    setAuthed(false);
  };

  if (!authed) {
    return <SellerLogin onLogin={handleLogin} />;
  }

  const tabContent = {
    dashboard: <DashboardOverview onTabChange={setActiveTab} />,
    products: <ProductManagement />,
    purchases: <PurchaseManagement />,
    orders: <IncomingOrders />,
    sales: <SalesReport />,
    financial: <FinancialReport />,
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
    discounts: <DiscountManagement />,
    whatsapp: <FonnteConfig />,
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
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#FED7AA]">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-[#78350F]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-heading font-bold text-[#78350F]">Ciltarasa Seller</span>
          {detectEnv().isStandalone ? (
            <span data-testid="seller-installed-badge" className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">
              <Smartphone size={11} /> Installed
            </span>
          ) : <div className="w-10" />}
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {tabContent[activeTab] || tabContent.dashboard}
        </main>
      </div>
    </div>
  );
}
