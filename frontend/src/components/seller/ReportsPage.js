import React, { useState } from 'react';
import { BarChart2, ShoppingCart, Boxes, DollarSign } from 'lucide-react';
import SalesReport from './SalesReport';
import PurchaseManagement from './PurchaseManagement';
import InventoryReport from './InventoryReport';
import FinancialReport from './FinancialReport';

const TABS = [
  { id: 'sales', label: 'Laporan Penjualan', icon: BarChart2 },
  { id: 'purchases', label: 'Laporan Pembelian (Restock)', icon: ShoppingCart },
  { id: 'inventory', label: 'Laporan Inventory (Stock)', icon: Boxes },
  { id: 'financial', label: 'Laporan Keuangan', icon: DollarSign },
];

export default function ReportsPage({ initialTab = 'sales' }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Laporan</h1>
        <p className="text-xs text-[#9A3412] mt-0.5">Penjualan, pembelian/restock, inventory, dan keuangan — semua dalam satu tempat, angkanya saling nyambung.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${tab === t.id ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow' : 'bg-white border border-[#FED7AA] text-[#7C2D12] hover:border-[#F97316]'}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === 'sales' && <SalesReport />}
        {tab === 'purchases' && <PurchaseManagement />}
        {tab === 'inventory' && <InventoryReport />}
        {tab === 'financial' && <FinancialReport />}
      </div>
    </div>
  );
}
