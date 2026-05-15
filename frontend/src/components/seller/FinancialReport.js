import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

export default function FinancialReport() {
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ type: 'expense', description: '', amount: '', category: 'packaging', date: new Date().toISOString().split('T')[0] });

  const load = async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        axios.get(`${API}/api/reports/financial`),
        axios.get(`${API}/api/financial-entries`),
      ]);
      setReport(r.data);
      setEntries(e.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddEntry = async () => {
    if (!entryForm.description || !entryForm.amount) { toast.error('Isi semua field!'); return; }
    try {
      await axios.post(`${API}/api/financial-entries`, { ...entryForm, amount: Number(entryForm.amount) });
      toast.success('Entri berhasil ditambahkan!');
      setShowAddEntry(false);
      setEntryForm({ type: 'expense', description: '', amount: '', category: 'packaging', date: new Date().toISOString().split('T')[0] });
      await load();
    } catch { toast.error('Gagal menambahkan.'); }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Hapus entri ini?')) return;
    try {
      await axios.delete(`${API}/api/financial-entries/${id}`);
      await load();
    } catch {}
  };

  const monthlyChartData = report?.monthly
    ? Object.entries(report.monthly).sort((a,b) => a[0].localeCompare(b[0])).map(([m, d]) => ({
        name: new Date(m + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        pendapatan: d.income, hppp: d.cogs, profit: d.profit
      }))
    : [];

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={32} className="text-[#D97706] animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Laporan Keuangan</h1>
        <button onClick={load} className="p-2 text-[#D97706]"><RefreshCw size={18} /></button>
      </div>

      {/* Income Statement */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Laporan Laba Rugi</h2>
        <div className="space-y-3">
          {[
            { label: 'Total Pendapatan Bruto', value: report?.total_income || 0, color: 'text-green-600', bold: true },
            { label: 'Harga Pokok Penjualan (HPP)', value: -(report?.total_cogs || 0), color: 'text-red-500' },
            { label: 'Laba Kotor', value: report?.gross_profit || 0, color: report?.gross_profit >= 0 ? 'text-green-600' : 'text-red-500', bold: true, separator: true },
            { label: 'Total Biaya Operasional', value: -(report?.total_expenses || 0), color: 'text-red-500' },
            { label: 'LABA BERSIH', value: report?.net_profit || 0, color: report?.net_profit >= 0 ? 'text-green-600' : 'text-red-500', bold: true, big: true, separator: true },
          ].map((row, i) => (
            <div key={i}>
              {row.separator && <div className="border-t border-[#FED7AA] my-2" />}
              <div className={`flex justify-between items-center ${row.big ? 'py-1' : ''}`}>
                <span className={`font-body ${row.bold ? 'font-bold text-[#78350F]' : 'text-[#451A03]'} ${row.big ? 'text-base font-heading' : 'text-sm'}`}>{row.label}</span>
                <span className={`font-bold ${row.color} ${row.big ? 'text-xl font-heading' : 'text-sm'}`}>
                  {row.value < 0 ? `-${formatRp(Math.abs(row.value))}` : formatRp(Math.abs(row.value))}
                </span>
              </div>
            </div>
          ))}
          <div className="bg-[#FDF8F0] rounded-xl p-3 mt-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#92400E] font-semibold">Margin Keuntungan</span>
              <span className={`font-bold ${(report?.margin || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>{(report?.margin || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      {monthlyChartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
          <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Tren Bulanan</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#92400E' }} />
              <YAxis tick={{ fontSize: 11, fill: '#92400E' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => [formatRp(v), name === 'pendapatan' ? 'Pendapatan' : name === 'hppp' ? 'HPP' : 'Profit']} contentStyle={{ fontFamily: 'Nunito', fontSize: 12, borderColor: '#FED7AA' }} />
              <Legend formatter={v => v === 'pendapatan' ? 'Pendapatan' : v === 'hppp' ? 'HPP' : 'Profit'} />
              <Bar dataKey="pendapatan" fill="#D97706" radius={[4,4,0,0]} />
              <Bar dataKey="hppp" fill="#FED7AA" radius={[4,4,0,0]} />
              <Bar dataKey="profit" fill="#78350F" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expenses */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-[#78350F] text-lg">Catatan Pengeluaran</h2>
          <button onClick={() => setShowAddEntry(!showAddEntry)} className="flex items-center gap-1 bg-[#D97706] text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-[#B45309] transition-all">
            <Plus size={14} /> Tambah
          </button>
        </div>

        {showAddEntry && (
          <div className="bg-[#FDF8F0] border border-[#FED7AA] rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#78350F] mb-1 block">Deskripsi</label>
                <input value={entryForm.description} onChange={e => setEntryForm(f => ({...f, description: e.target.value}))} placeholder="Contoh: Beli kemasan"
                  className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78350F] mb-1 block">Jumlah (Rp)</label>
                <input type="number" value={entryForm.amount} onChange={e => setEntryForm(f => ({...f, amount: e.target.value}))} placeholder="50000"
                  className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78350F] mb-1 block">Kategori</label>
                <select value={entryForm.category} onChange={e => setEntryForm(f => ({...f, category: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]">
                  <option value="packaging">Kemasan</option>
                  <option value="delivery">Ongkir/Pengiriman</option>
                  <option value="ingredient">Bahan Baku</option>
                  <option value="operasional">Operasional</option>
                  <option value="lain">Lain-lain</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#78350F] mb-1 block">Tanggal</label>
                <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({...f, date: e.target.value}))}
                  className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddEntry} className="flex-1 bg-[#D97706] text-white font-bold py-2 rounded-xl hover:bg-[#B45309] text-sm transition-all">Simpan</button>
              <button onClick={() => setShowAddEntry(false)} className="flex-1 border border-[#FED7AA] text-[#78350F] font-bold py-2 rounded-xl hover:bg-[#FED7AA] text-sm transition-all">Batal</button>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-center text-[#92400E] py-6 font-body text-sm">Belum ada catatan pengeluaran</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-[#FDF8F0] rounded-xl">
                <div>
                  <p className="font-semibold text-[#451A03] text-sm">{e.description}</p>
                  <p className="text-xs text-[#92400E]">{e.category} · {e.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-500 text-sm">{formatRp(e.amount)}</span>
                  <button onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Riwayat Transaksi (Selesai)</h2>
        {report?.transactions?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#FED7AA]">
                {['Order ID', 'Pelanggan', 'Total', 'Tanggal'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-[#92400E] font-semibold text-xs">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {report.transactions.map(t => (
                  <tr key={t.id} className="border-b border-[#FED7AA]/50 hover:bg-[#FDF8F0]">
                    <td className="py-2 px-3 font-semibold text-[#D97706]">{t.order_number}</td>
                    <td className="py-2 px-3 text-[#451A03]">{t.customer_name}</td>
                    <td className="py-2 px-3 font-bold text-green-600">{formatRp(t.total)}</td>
                    <td className="py-2 px-3 text-[#92400E] text-xs">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center text-[#92400E] py-8 font-body text-sm">Belum ada transaksi selesai</p>}
      </div>
    </div>
  );
}
