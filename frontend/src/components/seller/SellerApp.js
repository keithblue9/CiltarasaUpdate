import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import SellerLogin from './SellerLogin';
import SellerSidebar from './SellerSidebar';
import DashboardOverview from './DashboardOverview';
import ProductManagement from './ProductManagement';
import IncomingOrders from './IncomingOrders';
import SalesReport from './SalesReport';
import FinancialReport from './FinancialReport';
import WhatsAppSettings from './WhatsAppSettings';

const PIN = 'ciltarasa';

export default function SellerApp() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('seller_auth') === 'true');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    orders: <IncomingOrders />,
    sales: <SalesReport />,
    financial: <FinancialReport />,
    whatsapp: <WhatsAppSettings />,
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
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-[#FED7AA]">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-[#78350F]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-heading font-bold text-[#78350F]">Ciltarasa Seller</span>
          <div className="w-10" />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {tabContent[activeTab] || tabContent.dashboard}
        </main>
      </div>
    </div>
  );
}
