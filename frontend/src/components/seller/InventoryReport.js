import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, AlertTriangle, Boxes, PackageX, PackageMinus, Coins } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

export default function InventoryReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('value'); // value | stock | name

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/dashboard/inventory`);
      setData(r.data);
    } catch (e) { console.warn('[InventoryReport] load failed:', e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><RefreshCw size={32} className="text-[#D97706] animate-spin" /></div>;
  if (!data) return <p className="text-center text-[#92400E] py-10 text-sm">Gagal memuat. <button onClick={load} className="underline font-bold">Coba lagi</button></p>;

  const { kpi, all_products = [], category_breakdown = [], top_movers = [], slow_movers = [], missing_cost_items = [] } = data;
  const totalValue = kpi.stock_value_cost_only ?? kpi.stock_value ?? 0;

  const rows = all_products
    .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.category || '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sortBy === 'value' ? b.value - a.value : sortBy === 'stock' ? b.stock - a.stock : a.name.localeCompare(b.name));

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Coins} color="green" title="Nilai Stok (harga modal)" value={fmtRp(totalValue)} sub={`${kpi.total_stock_units || 0} unit di ${kpi.total_products} produk`} />
        <Kpi icon={Boxes} color="blue" title="Total Produk" value={kpi.total_products} sub="semua produk terhitung" />
        <Kpi icon={PackageMinus} color="amber" title="Stok Menipis" value={kpi.low_stock_count} sub={`≤ ${kpi.low_stock_threshold} unit`} />
        <Kpi icon={PackageX} color="red" title="Stok Habis" value={kpi.out_of_stock_count} sub="perlu restock" />
      </div>

      {kpi.missing_cost_count > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{kpi.missing_cost_count} produk belum punya harga modal</strong> ({missing_cost_items.map(p => p.name).slice(0, 4).join(', ')}{missing_cost_items.length > 4 ? ', …' : ''}).
            Nilainya dihitung Rp 0 di laporan ini — isi harga modal lewat Pembelian/Restock atau edit produk biar nilai stok & HPP akurat.
          </span>
        </div>
      )}

      {/* Full valuation table — SEMUA produk masuk sini */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="font-heading font-bold text-[#78350F] text-lg">Rincian Nilai Stok per Produk</h2>
            <p className="text-[11px] text-[#92400E]">Semua produk terhitung di sini (termasuk yang stoknya sehat). Nilai = harga modal × qty stok.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#FED7AA] bg-white">
              <Search size={14} className="text-[#9A3412]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari produk/kategori..." className="outline-none text-sm w-40" />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 rounded-xl border border-[#FED7AA] text-xs font-bold text-[#7C2D12]">
              <option value="value">Urut: Nilai ↓</option>
              <option value="stock">Urut: Stok ↓</option>
              <option value="name">Urut: Nama A-Z</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#FED7AA] text-[#92400E] text-xs">
                <th className="text-left py-2 px-2 font-semibold">Produk</th>
                <th className="text-left py-2 px-2 font-semibold">Kategori</th>
                <th className="text-right py-2 px-2 font-semibold">Stok</th>
                <th className="text-right py-2 px-2 font-semibold">Modal/unit</th>
                <th className="text-right py-2 px-2 font-semibold">Nilai</th>
                <th className="text-right py-2 px-2 font-semibold">% Nilai</th>
                <th className="text-right py-2 px-2 font-semibold">Laju 30 hari</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className={`border-b border-[#FED7AA]/50 hover:bg-[#FDF8F0] ${p.stock <= 0 ? 'opacity-60' : ''}`}>
                  <td className="py-2 px-2 text-[#451A03] font-semibold">
                    {p.name}
                    {p.value_source === 'missing' && p.stock > 0 && (
                      <span className="ml-1 text-[10px] text-amber-600 font-bold">⚠️ modal 0</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-[#92400E] text-xs">{p.category}</td>
                  <td className="py-2 px-2 text-right">{p.stock}</td>
                  <td className="py-2 px-2 text-right text-[#92400E]">{fmtRp(p.cost_price)}</td>
                  <td className="py-2 px-2 text-right font-bold text-[#7C2D12]">{fmtRp(p.value)}</td>
                  <td className="py-2 px-2 text-right text-xs text-[#92400E]">{totalValue > 0 ? ((p.value / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="py-2 px-2 text-right text-xs">{p.velocity_30d > 0 ? `${p.velocity_30d}/hari` : <span className="text-gray-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#FED7AA]">
                <td colSpan={4} className="py-2.5 px-2 font-bold text-[#78350F]">TOTAL NILAI STOK ({rows.length} produk{q ? ' tersaring' : ''})</td>
                <td className="py-2.5 px-2 text-right font-heading font-bold text-green-700">{fmtRp(rows.reduce((s, p) => s + p.value, 0))}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-5">
          <h3 className="font-heading font-bold text-[#78350F] mb-3">Nilai per Kategori</h3>
          {category_breakdown.length === 0 ? <p className="text-sm text-[#92400E]">Belum ada data.</p> : (
            <div className="space-y-2">
              {category_breakdown.map(c => (
                <div key={c.category} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#7C2D12] w-28 truncate">{c.category}</span>
                  <div className="flex-1 h-3 bg-[#FEF3C7] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#F97316] to-[#EA580C]" style={{ width: `${totalValue > 0 ? Math.min(100, (c.value / totalValue) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-bold text-[#7C2D12] w-24 text-right">{fmtRp(c.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#FED7AA] p-5">
          <h3 className="font-heading font-bold text-[#78350F] mb-3">Paling Laku vs Paling Lambat (30 hari)</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-bold text-green-700 mb-1.5">🔥 Top Movers</p>
              {top_movers.filter(p => p.velocity_30d > 0).slice(0, 5).map(p => (
                <p key={p.id} className="text-[#451A03] py-0.5 truncate">{p.name} <span className="text-[#92400E]">({p.velocity_30d}/hr)</span></p>
              ))}
              {top_movers.filter(p => p.velocity_30d > 0).length === 0 && <p className="text-gray-400">Belum ada penjualan 30 hari ini</p>}
            </div>
            <div>
              <p className="font-bold text-amber-700 mb-1.5">🐢 Slow Movers</p>
              {slow_movers.slice(0, 5).map(p => (
                <p key={p.id} className="text-[#451A03] py-0.5 truncate">{p.name} <span className="text-[#92400E]">(stok {p.stock})</span></p>
              ))}
              {slow_movers.length === 0 && <p className="text-gray-400">Semua produk bergerak 👍</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, color, title, value, sub }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <div className="bg-white rounded-2xl border border-[#FED7AA] p-4">
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-2 ${colors[color]}`}><Icon size={16} /></div>
      <p className="text-[11px] text-[#92400E] font-semibold">{title}</p>
      <p className="font-heading font-bold text-lg text-[#7C2D12] leading-tight">{value}</p>
      <p className="text-[10px] text-[#9A3412] mt-0.5">{sub}</p>
    </div>
  );
}
