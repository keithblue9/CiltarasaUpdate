import React, { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, X, Wallet, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { toast } from 'sonner';
import CashbookTable from './CashbookTable';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const CATEGORY_LABEL = {
  packaging: 'Kemasan',
  delivery: 'Ongkir/Pengiriman',
  ingredient: 'Bahan Baku',
  operasional: 'Operasional',
  lain: 'Lain-lain',
};

const EXPENSE_PRESETS = [
  { label: 'Top up saldo ongkir', category: 'delivery' },
  { label: 'Beli kemasan / packaging', category: 'packaging' },
  { label: 'Bahan baku tambahan', category: 'ingredient' },
  { label: 'Gaji / upah', category: 'operasional' },
  { label: 'Sewa tempat', category: 'operasional' },
  { label: 'Listrik & air', category: 'operasional' },
  { label: 'Bensin / transport', category: 'delivery' },
  { label: 'Iklan / promosi', category: 'operasional' },
];

const emptyEntry = () => ({ type: 'expense', description: '', amount: '', category: 'operasional', date: new Date().toISOString().split('T')[0], note: '' });

export default function FinancialReport() {
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntry());
  const [saving, setSaving] = useState(false);
  const [hppModal, setHppModal] = useState(false);
  const [kasAwalInput, setKasAwalInput] = useState('');
  const [savingKas, setSavingKas] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([
        axios.get(`${API}/api/reports/financial`),
        axios.get(`${API}/api/financial-entries`),
      ]);
      setReport(r.data);
      setEntries(e.data);
      setKasAwalInput(String(r.data?.kas_awal ?? 0));
    } catch (err) { console.warn('[FinancialReport] load failed:', err); toast.error('Gagal memuat laporan. Coba refresh.'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddEntry = async () => {
    if (!entryForm.description || !entryForm.amount) { toast.error('Isi nama biaya & jumlahnya ya'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/api/financial-entries`, { ...entryForm, amount: Number(entryForm.amount) });
      toast.success('Biaya ditambahkan! ✅');
      setShowExpenseModal(false);
      setEntryForm(emptyEntry());
      await load();
    } catch { toast.error('Gagal menambahkan biaya.'); }
    finally { setSaving(false); }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Hapus biaya ini?')) return;
    try {
      await axios.delete(`${API}/api/financial-entries/${id}`);
      await load();
    } catch (err) { console.warn('[FinancialReport] delete failed:', err); toast.error('Gagal menghapus.'); }
  };

  const saveKasAwal = async () => {
    setSavingKas(true);
    try {
      await axios.put(`${API}/api/store-config`, { kas_awal: Number(kasAwalInput) || 0 });
      toast.success('Kas awal disimpan! 💰');
      await load();
    } catch { toast.error('Gagal simpan kas awal'); }
    finally { setSavingKas(false); }
  };

  const monthlyChartData = report?.monthly
    ? Object.entries(report.monthly).sort((a, b) => a[0].localeCompare(b[0])).map(([m, d]) => ({
        name: new Date(m + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
        pendapatan: d.income, hppp: d.cogs, profit: d.profit,
      }))
    : [];

  const totalExpenses = entries.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={32} className="text-[#D97706] animate-spin" /></div>;

  const netProfit = report?.net_profit || 0;
  const kasAwal = Number(kasAwalInput) || 0;
  const kasAkhir = kasAwal + netProfit;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Laporan Keuangan</h1>
        <button onClick={load} className="p-2 text-[#D97706]"><RefreshCw size={18} /></button>
      </div>

      {/* Income Statement */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Laporan Laba Rugi</h2>

        {/* Kas Awal */}
        <div className="bg-[#FDF8F0] border border-[#FED7AA] rounded-xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet size={18} className="text-[#B45309] flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#78350F] leading-tight">Kas Awal (modal awal)</p>
              <p className="text-[10px] text-[#92400E]">Saldo kas di awal periode. Kas Akhir = Kas Awal + Laba Bersih.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center px-2.5 py-1.5 rounded-xl border border-[#FED7AA] bg-white">
              <span className="text-xs text-[#92400E] font-semibold mr-1">Rp</span>
              <input
                type="number"
                value={kasAwalInput}
                onChange={(e) => setKasAwalInput(e.target.value)}
                placeholder="0"
                className="w-28 outline-none text-sm font-bold text-[#451A03] bg-transparent text-right"
              />
            </div>
            <button onClick={saveKasAwal} disabled={savingKas} className="bg-[#D97706] text-white font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-[#B45309] disabled:opacity-60">
              {savingKas ? '...' : 'Simpan'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <Row label="Total Pendapatan Bruto" value={report?.total_income || 0} color="text-green-600" bold />

          {/* HPP — clickable */}
          <button onClick={() => setHppModal(true)} className="w-full flex justify-between items-center group text-left">
            <span className="font-body text-sm text-[#451A03] flex items-center gap-1.5">
              Harga Pokok Penjualan (HPP)
              <span className="text-[10px] font-bold text-[#D97706] bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 group-hover:bg-[#FED7AA]">
                Rincian <ChevronRight size={11} />
              </span>
            </span>
            <span className="font-bold text-red-500 text-sm">-{formatRp(report?.total_cogs || 0)}</span>
          </button>

          <div className="border-t border-[#FED7AA] my-2" />
          <Row label="Laba Kotor" value={report?.gross_profit || 0} color={(report?.gross_profit || 0) >= 0 ? 'text-green-600' : 'text-red-500'} bold />
          <Row label="Total Biaya Operasional" value={-(report?.total_expenses || 0)} color="text-red-500" />
          <div className="border-t border-[#FED7AA] my-2" />
          <Row label="LABA BERSIH" value={netProfit} color={netProfit >= 0 ? 'text-green-600' : 'text-red-500'} bold big />

          {/* Kas Akhir */}
          <div className="border-t-2 border-dashed border-[#FED7AA] my-2" />
          <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] rounded-xl p-3 flex justify-between items-center">
            <div>
              <span className="font-heading font-bold text-[#78350F] text-base">KAS AKHIR</span>
              <p className="text-[10px] text-[#92400E]">Kas Awal ({formatRp(kasAwal)}) + Laba Bersih</p>
            </div>
            <span className={`font-heading font-bold text-xl ${kasAkhir >= 0 ? 'text-green-700' : 'text-red-500'}`}>
              {kasAkhir < 0 ? `-${formatRp(Math.abs(kasAkhir))}` : formatRp(kasAkhir)}
            </span>
          </div>

          <div className="bg-[#FDF8F0] rounded-xl p-3 mt-1">
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
              <YAxis tick={{ fontSize: 11, fill: '#92400E' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => [formatRp(v), name === 'pendapatan' ? 'Pendapatan' : name === 'hppp' ? 'HPP' : 'Profit']} contentStyle={{ fontFamily: 'Nunito', fontSize: 12, borderColor: '#FED7AA' }} />
              <Legend formatter={v => v === 'pendapatan' ? 'Pendapatan' : v === 'hppp' ? 'HPP' : 'Profit'} />
              <Bar dataKey="pendapatan" fill="#D97706" radius={[4, 4, 0, 0]} />
              <Bar dataKey="hppp" fill="#FED7AA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#78350F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expenses (Biaya Operasional) */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h2 className="font-heading font-bold text-[#78350F] text-lg">Biaya Operasional</h2>
          <button onClick={() => { setEntryForm(emptyEntry()); setShowExpenseModal(true); }} className="flex items-center gap-1 bg-[#D97706] text-white font-bold px-4 py-2 rounded-full text-sm hover:bg-[#B45309] transition-all">
            <Plus size={14} /> Biaya
          </button>
        </div>
        <p className="text-xs text-[#92400E] mb-4">Catat biaya di luar HPP — mis. top up saldo ongkir, gaji, sewa, listrik, iklan, dll. Ini mengurangi laba bersih.</p>

        {entries.length === 0 ? (
          <p className="text-center text-[#92400E] py-6 font-body text-sm">Belum ada biaya. Klik "+ Biaya" untuk menambah.</p>
        ) : (
          <>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {entries.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-[#FDF8F0] rounded-xl">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#451A03] text-sm truncate">{e.description}</p>
                    <p className="text-xs text-[#92400E]">{CATEGORY_LABEL[e.category] || e.category} · {e.date}{e.note ? ` · ${e.note}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-red-500 text-sm">{formatRp(e.amount)}</span>
                    <button onClick={() => handleDeleteEntry(e.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#FED7AA]">
              <span className="font-bold text-[#78350F] text-sm">Total Biaya ({entries.length})</span>
              <span className="font-heading font-bold text-red-500">{formatRp(totalExpenses)}</span>
            </div>
          </>
        )}
      </div>

      {/* Cashbook */}
      <CashbookTable />

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

      {/* ─── HPP Breakdown Modal ─── */}
      {hppModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHppModal(false)} />
          <div className="relative w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
            <div className="px-5 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-lg">Rincian HPP</h3>
                <p className="text-xs text-orange-100">Biaya pokok dari barang yang sudah TERJUAL (order selesai)</p>
              </div>
              <button onClick={() => setHppModal(false)} className="p-1.5 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3 mb-3 flex gap-2 text-xs text-[#78350F]">
                <Info size={16} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                <span>HPP = Σ (harga modal produk × jumlah terjual). Harga modal otomatis ikut <strong>unit cost</strong> pembelian terakhir yang diterima.</span>
              </div>
              {(report?.hpp_breakdown || []).length === 0 ? (
                <p className="text-center text-[#92400E] py-8 text-sm">Belum ada barang terjual.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#FED7AA] text-[#92400E] text-xs">
                      <th className="text-left py-2 px-2 font-semibold">Produk</th>
                      <th className="text-right py-2 px-2 font-semibold">Terjual</th>
                      <th className="text-right py-2 px-2 font-semibold">Modal/unit</th>
                      <th className="text-right py-2 px-2 font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report?.hpp_breakdown || []).map((h, i) => (
                      <tr key={i} className="border-b border-[#FED7AA]/50">
                        <td className="py-2 px-2 text-[#451A03]">
                          {h.name}
                          {h.missing_cost && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-600" title="Harga modal belum diisi — HPP produk ini dihitung 0">
                              <AlertTriangle size={11} /> modal 0
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right text-[#451A03]">{Number(h.qty).toLocaleString('id-ID')}</td>
                        <td className="py-2 px-2 text-right text-[#92400E]">{formatRp(h.cost_unit)}</td>
                        <td className="py-2 px-2 text-right font-bold text-red-500">{formatRp(h.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#FED7AA]">
                      <td colSpan={3} className="py-2.5 px-2 font-bold text-[#78350F]">TOTAL HPP</td>
                      <td className="py-2.5 px-2 text-right font-heading font-bold text-red-500">{formatRp(report?.total_cogs || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
              {(report?.hpp_breakdown || []).some(h => h.missing_cost) && (
                <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  ⚠️ Ada produk dengan harga modal (cost) belum diisi → HPP-nya dihitung 0, jadi laba terlihat lebih besar dari aslinya. Isi harga modal di menu Produk / Pembelian biar akurat.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Expense Modal ─── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)} />
          <div className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg">Tambah Biaya</h3>
              <button onClick={() => setShowExpenseModal(false)} className="p-1.5 hover:bg-white/20 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Quick picks */}
              <div>
                <label className="text-xs font-bold text-[#78350F] mb-1.5 block">Pilih cepat</label>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_PRESETS.map(p => (
                    <button key={p.label} type="button"
                      onClick={() => setEntryForm(f => ({ ...f, description: p.label, category: p.category }))}
                      className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-all ${entryForm.description === p.label ? 'bg-[#EA580C] text-white border-[#EA580C]' : 'bg-[#FFF7ED] border-[#FED7AA] text-[#7C2D12] hover:border-[#EA580C]'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#78350F] mb-1 block">Nama Biaya</label>
                <input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Contoh: Top up saldo ongkir"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#78350F] mb-1 block">Jumlah (Rp)</label>
                  <input type="number" inputMode="numeric" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} placeholder="50000"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#78350F] mb-1 block">Tanggal</label>
                  <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#78350F] mb-1 block">Kategori</label>
                <select value={entryForm.category} onChange={e => setEntryForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]">
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#78350F] mb-1 block">Catatan (opsional)</label>
                <input value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} placeholder="mis. via aplikasi X / untuk 100 order"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#FED7AA] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]" />
              </div>

              {entryForm.amount && (
                <div className="bg-[#FDF8F0] rounded-xl p-3 text-sm flex justify-between">
                  <span className="text-[#92400E] font-semibold">Akan dicatat</span>
                  <span className="font-bold text-red-500">{formatRp(entryForm.amount)}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#FED7AA] flex gap-2 bg-white">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 border border-[#FED7AA] text-[#78350F] font-bold py-2.5 rounded-xl hover:bg-[#FED7AA] text-sm">Batal</button>
              <button onClick={handleAddEntry} disabled={saving} className="flex-[2] bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-2.5 rounded-xl hover:shadow-md text-sm disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Biaya'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color, bold, big }) {
  return (
    <div className={`flex justify-between items-center ${big ? 'py-1' : ''}`}>
      <span className={`font-body ${bold ? 'font-bold text-[#78350F]' : 'text-[#451A03]'} ${big ? 'text-base font-heading' : 'text-sm'}`}>{label}</span>
      <span className={`font-bold ${color} ${big ? 'text-xl font-heading' : 'text-sm'}`}>
        {value < 0 ? `-${formatRp(Math.abs(value))}` : formatRp(Math.abs(value))}
      </span>
    </div>
  );
}
