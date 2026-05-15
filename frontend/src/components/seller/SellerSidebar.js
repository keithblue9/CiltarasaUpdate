import React from 'react';
import { LayoutDashboard, Package, ShoppingBag, BarChart2, DollarSign, MessageCircle, LogOut, X, Wifi, WifiOff } from 'lucide-react';
import { LogoWithText } from '../shared/Logo';
import { useApp } from '../../context/AppContext';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Produk', icon: Package },
  { id: 'orders', label: 'Pesanan Masuk', icon: ShoppingBag },
  { id: 'sales', label: 'Lap. Penjualan', icon: BarChart2 },
  { id: 'financial', label: 'Lap. Keuangan', icon: DollarSign },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
];

export default function SellerSidebar({ activeTab, onTabChange, onLogout, isOpen, onClose }) {
  const { wsConnected } = useApp();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#78350F] text-white w-64 flex-shrink-0">
      <div className="p-5 border-b border-amber-700 flex items-center justify-between">
        <LogoWithText size="sm" className="[&>div>div]:text-white [&>div>div:last-child]:text-orange-200" />
        <button onClick={onClose} className="lg:hidden text-orange-200 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-testid={`sidebar-tab-${id}`}
            onClick={() => onTabChange(id)}
            className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-[#D97706] text-white shadow-md' : 'text-orange-100 hover:bg-amber-800'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-amber-700 space-y-3">
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${wsConnected ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {wsConnected ? 'Real-time: Terhubung' : 'Menghubungkan...'}
        </div>
        <button
          data-testid="seller-logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-orange-200 hover:bg-red-900/40 hover:text-red-300 transition-all text-sm font-semibold"
        >
          <LogOut size={18} /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <SidebarContent />
      </div>
      {/* Mobile drawer */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden flex">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  );
}
