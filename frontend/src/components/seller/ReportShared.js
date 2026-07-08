import React from 'react';
import { X } from 'lucide-react';

export const PERIOD_OPTIONS = [
  { k: 'today', l: 'Hari Ini' },
  { k: 'week', l: '7 Hari' },
  { k: 'month', l: '30 Hari' },
  { k: 'year', l: 'Setahun' },
  { k: 'all', l: 'Semua' },
];

// Shared period tab bar. Same look-and-feel di semua sub-laporan.
export function PeriodTabs({ value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PERIOD_OPTIONS.map((p) => (
        <button
          key={p.k}
          onClick={() => onChange(p.k)}
          data-testid={`period-${p.k}`}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${value === p.k ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow' : 'bg-white border border-[#FED7AA] text-[#7C2D12] hover:border-[#F97316]'}`}
        >
          {p.l}
        </button>
      ))}
    </div>
  );
}

// Generic detail modal (bottom-sheet on mobile, centered on desktop).
export function DetailModal({ open, onClose, title, subtitle, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-xl bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
        <div className="px-5 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-lg leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-orange-100 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full flex-shrink-0"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// Clickable KPI card — pattern konsisten di semua laporan.
export function KpiCard({ icon: Icon, color = 'orange', title, value, sub, onClick }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    orange: 'bg-orange-50 text-[#B45309] border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-[#FED7AA] p-4 hover:shadow-md hover:border-[#F97316] transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${colors[color]}`}><Icon size={16} /></div>
        {onClick && <span className="text-[10px] text-[#9A3412] group-hover:text-[#EA580C] font-bold">Detail →</span>}
      </div>
      <p className="text-[11px] text-[#92400E] font-semibold">{title}</p>
      <p className="font-heading font-bold text-lg text-[#7C2D12] leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[#9A3412] mt-0.5">{sub}</p>}
    </button>
  );
}
