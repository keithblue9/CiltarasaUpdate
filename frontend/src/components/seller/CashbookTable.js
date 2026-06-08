import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, RefreshCw, Download, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => Number(n || 0).toLocaleString('id-ID');

const STATUS_BADGE = {
  selesai: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
  siap: { label: 'Siap', cls: 'bg-blue-100 text-blue-700' },
  diproses: { label: 'Diproses', cls: 'bg-amber-100 text-amber-700' },
  menunggu: { label: 'Menunggu', cls: 'bg-gray-100 text-gray-700' },
};

const FILTER_PRESETS = [
  { id: 'today',  label: 'Hari Ini' },
  { id: '7d',     label: '7 Hari' },
  { id: '30d',    label: '30 Hari' },
  { id: 'month',  label: 'Bulan Ini' },
  { id: 'all',    label: 'Semua' },
  { id: 'custom', label: 'Custom' },
];

const presetToRange = (preset) => {
  const now = new Date();
  const fmtDate = (d) => d.toISOString().split('T')[0];
  switch (preset) {
    case 'today': {
      const t = fmtDate(now);
      return { start: t, end: t };
    }
    case '7d': {
      const s = new Date(now); s.setDate(s.getDate() - 6);
      return { start: fmtDate(s), end: fmtDate(now) };
    }
    case '30d': {
      const s = new Date(now); s.setDate(s.getDate() - 29);
      return { start: fmtDate(s), end: fmtDate(now) };
    }
    case 'month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmtDate(s), end: fmtDate(now) };
    }
    default:
      return { start: '', end: '' };
  }
};

export default function CashbookTable() {
  const [preset, setPreset] = useState('30d');
  const [range, setRange] = useState(() => presetToRange('30d'));
  const [statusFilter, setStatusFilter] = useState('paid'); // 'paid' | 'all'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (range.start) params.set('start', range.start);
      if (range.end) params.set('end', range.end);
      params.set('status_filter', statusFilter);
      const r = await axios.get(`${API}/api/reports/cashbook?${params.toString()}`);
      setData(r.data);
    } catch (e) {
      toast.error('Gagal load cashbook');
      console.warn(e);
    } finally { setLoading(false); }
  }, [range, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePreset = (p) => {
    setPreset(p);
    if (p !== 'custom' && p !== 'all') setRange(presetToRange(p));
    if (p === 'all') setRange({ start: '', end: '' });
  };

  const exportCsv = () => {
    if (!data?.rows?.length) { toast.error('Tidak ada data untuk export'); return; }
    const cols = data.columns;
    const headers = ['Tanggal', 'Order', 'Pelanggan', 'No HP', ...cols.map(c => c.label.replace(/[💵🏦📱🕒❓]/g, '').trim())];
    const lines = [headers.join(',')];
    for (const row of data.rows) {
      const cells = [row.date, row.order_number, `"${row.customer_name}"`, `'${row.customer_phone}`];
      for (const c of cols) {
        cells.push(row.column_key === c.key ? row.amount : '');
      }
      lines.push(cells.join(','));
    }
    const totalRow = ['TOTAL', '', '', ''];
    for (const c of cols) totalRow.push(data.totals[c.key] || 0);
    lines.push(totalRow.join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashbook_${range.start || 'all'}_${range.end || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV terdownload!');
  };

  const cols = data?.columns || [];
  const rows = data?.rows || [];
  const totals = data?.totals || {};

  return (
    <div data-testid="cashbook-card" className="bg-white rounded-2xl border border-[#FED7AA] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-[#D97706]" />
          <h2 className="font-heading font-bold text-[#78350F] text-lg">Catatan Pemasukan (Cashbook)</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="cashbook-refresh-btn"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-[#EA580C] px-3 py-2 rounded-full border border-[#FED7AA] hover:bg-orange-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            data-testid="cashbook-export-btn"
            onClick={exportCsv}
            disabled={loading || !rows.length}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-full disabled:opacity-50"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      <p className="text-xs text-[#92400E] mb-4 leading-relaxed">
        💰 List uang masuk per metode bayar. Tiap order masuk ke kolom yg sesuai (Tunai/Bank/QRIS). Total per kolom di paling bawah.
      </p>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <Calendar size={14} className="text-[#92400E]" />
        {FILTER_PRESETS.map(p => (
          <button
            key={p.id}
            data-testid={`cashbook-preset-${p.id}`}
            onClick={() => handlePreset(p.id)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-all ${
              preset === p.id ? 'bg-[#EA580C] text-white' : 'bg-orange-50 text-[#7C2D12] hover:bg-orange-100'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={range.start}
              onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
              className="text-xs px-2 py-1 rounded-md border border-[#FED7AA]"
            />
            <span className="text-xs text-[#92400E]">s/d</span>
            <input
              type="date"
              value={range.end}
              onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
              className="text-xs px-2 py-1 rounded-md border border-[#FED7AA]"
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[11px] text-[#92400E] font-semibold">Filter:</span>
          <select
            data-testid="cashbook-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-[11px] px-2 py-1 rounded-md border border-[#FED7AA] bg-white font-semibold text-[#7C2D12]"
          >
            <option value="paid">💰 Sudah Bayar (default)</option>
            <option value="all">📋 Semua (termasuk belum bayar)</option>
          </select>
        </div>
      </div>

      {/* Stats summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
            <p className="text-[10px] text-emerald-700 font-semibold">Total Pemasukan</p>
            <p className="text-base font-bold text-emerald-800">Rp {fmt(data.grand_total)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
            <p className="text-[10px] text-blue-700 font-semibold">Jumlah Order</p>
            <p className="text-base font-bold text-blue-800">{data.row_count}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <p className="text-[10px] text-amber-700 font-semibold">Avg Order</p>
            <p className="text-base font-bold text-amber-800">
              Rp {fmt(data.row_count > 0 ? Math.round(data.grand_total / data.row_count) : 0)}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
            <p className="text-[10px] text-purple-700 font-semibold">Metode Bayar Aktif</p>
            <p className="text-base font-bold text-purple-800">{cols.filter(c => (totals[c.key] || 0) > 0).length}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-center text-[#92400E] py-8 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-[#92400E]">
          <AlertCircle size={28} className="text-orange-400" />
          <p className="text-sm font-semibold">Tidak ada transaksi di periode ini</p>
          <p className="text-xs text-gray-500">Coba ganti rentang tanggal atau filter status</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#FED7AA]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#FEF3C7]">
                <th className="text-left p-2 font-bold text-[#7C2D12] sticky left-0 bg-[#FEF3C7] min-w-[90px]">Tanggal</th>
                <th className="text-left p-2 font-bold text-[#7C2D12] min-w-[100px]">Order</th>
                <th className="text-left p-2 font-bold text-[#7C2D12] min-w-[120px]">Pelanggan</th>
                <th className="text-left p-2 font-bold text-[#7C2D12] min-w-[110px]">No HP</th>
                {cols.map(c => (
                  <th key={c.key} className="text-right p-2 font-bold text-[#7C2D12] min-w-[110px] whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const status = STATUS_BADGE[row.status] || { label: row.status, cls: 'bg-gray-100 text-gray-700' };
                return (
                  <tr key={`${row.order_id}-${idx}`} className="border-t border-[#FED7AA]/60 hover:bg-orange-50/40">
                    <td className="p-2 text-[#451A03] whitespace-nowrap sticky left-0 bg-white">
                      {row.date}
                    </td>
                    <td className="p-2 font-bold text-[#D97706]">
                      {row.order_number || row.order_id?.slice(0, 8)}
                      <span className={`ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="p-2 text-[#451A03] font-semibold">{row.customer_name}</td>
                    <td className="p-2 text-[#92400E] font-mono text-[10px]">{row.customer_phone}</td>
                    {cols.map(c => (
                      <td key={c.key} className={`p-2 text-right font-bold whitespace-nowrap ${row.column_key === c.key ? 'text-emerald-700 bg-emerald-50/40' : 'text-gray-300'}`}>
                        {row.column_key === c.key ? `Rp ${fmt(row.amount)}` : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA] border-t-2 border-[#D97706]">
                <td colSpan={4} className="p-2 font-extrabold text-[#7C2D12] text-right sticky left-0 bg-gradient-to-r from-[#FEF3C7] to-[#FED7AA]">
                  TOTAL ↓
                </td>
                {cols.map(c => (
                  <td key={c.key} className="p-2 text-right font-extrabold text-[#7C2D12] whitespace-nowrap">
                    {totals[c.key] > 0 ? `Rp ${fmt(totals[c.key])}` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="bg-emerald-100">
                <td colSpan={4 + cols.length - 1} className="p-2 font-extrabold text-emerald-800 text-right">
                  GRAND TOTAL
                </td>
                <td className="p-2 text-right font-extrabold text-emerald-800 text-base whitespace-nowrap">
                  Rp {fmt(data.grand_total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-[10px] text-[#9A3412] italic mt-3 leading-relaxed">
        💡 Kolom dinamis sesuai bank yg kamu konfigurasi di <strong>Metode Pembayaran</strong>. Default filter "Sudah Bayar" = order selesai + order yg udah upload bukti transfer. Pilih "Semua" untuk lihat termasuk belum bayar (Bayar Nanti).
      </p>
    </div>
  );
}
