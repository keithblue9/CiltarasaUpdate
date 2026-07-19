import React from 'react';
import { LayoutDashboard, Package, ShoppingBag, BarChart2, LogOut, X, Wifi, WifiOff, Store, BookOpen, FolderTree, Truck, CreditCard, Tag, Settings, Type, ImagePlus, Sparkles, ListOrdered, ShieldAlert, LogIn, KeyRound, TrendingUp, FileText, BarChart3, Bell, Power, Smartphone, Palette, Users, Award } from 'lucide-react';
import { LogoWithText } from '../shared/Logo';
import { useApp } from '../../context/AppContext';

const operationalTabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Pesanan Masuk', icon: ShoppingBag },
  { id: 'juragan', label: 'Tanya Juragan', icon: Sparkles },
  { id: 'products', label: 'Produk', icon: Package },
  { id: 'reports', label: 'Laporan', icon: BarChart2 },
  { id: 'traffic', label: 'Statistik Pengunjung', icon: TrendingUp },
];

const configTabs = [
  { id: 'store-profile', label: 'Profil Toko', icon: Store },
  { id: 'seo-theme', label: 'Tampilan & SEO', icon: Palette },
  { id: 'store-cerita', label: 'Cerita Perjalanan', icon: BookOpen },
  { id: 'homepage-texts', label: 'Teks Homepage', icon: Type },
  { id: 'onboarding-texts', label: 'Teks Onboarding/Login', icon: LogIn },
  { id: 'how-to-order', label: 'Cara Pesan (Steps)', icon: ListOrdered },
  { id: 'hero-slideshow', label: 'Slideshow Hero', icon: ImagePlus },
  { id: 'fun-facts', label: 'Fun Facts Popup', icon: Sparkles },
  { id: 'categories', label: 'Kategori Produk', icon: FolderTree },
  { id: 'delivery', label: 'Layanan Pengiriman', icon: Truck },
  { id: 'payments', label: 'Metode Pembayaran', icon: CreditCard },
  { id: 'checkout-mode', label: 'Mode Checkout', icon: ListOrdered },
  { id: 'push-notif', label: 'Push Notification', icon: Bell },
  { id: 'maintenance', label: 'Mode Libur / Tutup', icon: Power },
  { id: 'pwa-install', label: 'Popup Install App', icon: Smartphone },
  { id: 'invoice', label: 'Wording Invoice & Resi', icon: FileText },
  { id: 'dashboard-widgets', label: 'Widget Dashboard', icon: BarChart3 },
  { id: 'discounts', label: 'Diskon Produk', icon: Tag },
  { id: 'member-tiers', label: 'Tingkatan Member', icon: Award },
  { id: 'customers', label: 'Customer & Passcode', icon: Users },
  { id: 'change-pin', label: 'Ubah PIN Akses', icon: KeyRound },
  { id: 'reset-customers', label: 'Reset Pelanggan', icon: ShieldAlert },
];

export default function SellerSidebar({ activeTab, onTabChange, onLogout, isOpen, onClose }) {
  const { wsConnected } = useApp();

  const TabButton = ({ tab }) => {
    const { id, label, icon: Icon } = tab;
    const active = activeTab === id;
    return (
      <button
        data-testid={`sidebar-tab-${id}`}
        onClick={() => onTabChange(id)}
        className={`sidebar-item w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          active ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-md' : 'text-orange-100 hover:bg-amber-800/60'
        }`}
      >
        <Icon size={17} />
        {label}
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#7C2D12] to-[#451A03] text-white w-64 flex-shrink-0">
      <div className="p-5 border-b border-amber-700/40 flex items-center justify-between">
        <LogoWithText size="sm" className="[&>div>div]:text-white [&>div>div:last-child]:text-orange-200" />
        <button onClick={onClose} className="lg:hidden text-orange-200 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        <div>
          <p className="px-4 text-[10px] uppercase tracking-widest text-amber-300/70 font-bold mb-2">Operasional</p>
          <div className="space-y-1">
            {operationalTabs.map(t => <TabButton key={t.id} tab={t} />)}
          </div>
        </div>

        <div>
          <div className="px-4 text-[10px] uppercase tracking-widest text-amber-300/70 font-bold mb-2 flex items-center gap-1.5">
            <Settings size={11} /> Konfigurasi Toko
          </div>
          <div className="space-y-1">
            {configTabs.map(t => <TabButton key={t.id} tab={t} />)}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-amber-700/40 space-y-3">
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${wsConnected ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {wsConnected ? 'Real-time: Terhubung' : 'Menghubungkan...'}
        </div>
        <button
          data-testid="seller-logout-btn"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-orange-200 hover:bg-red-900/40 hover:text-red-300 transition-all text-sm font-semibold"
        >
          <LogOut size={18} /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex h-full">
        <SidebarContent />
      </div>
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
