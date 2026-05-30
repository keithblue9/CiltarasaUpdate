import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, ShoppingBag, Target } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const COLORS = ['#D97706', '#B45309', '#78350F', '#92400E', '#FED7AA', '#F59E0B', '#FEF3C7', '#451A03'];

export default function SalesReport() {
  const [period, setPeriod] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async (p = period) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/reports/sales?period=${p}`);
      setReport(res.data);
    } catch (err) { console.warn('[SalesReport] load failed:', err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handlePeriod = (p) => { setPeriod(p); load(p); };

  const dailyChartData = report?.daily_revenue
    ? Object.entries(report.daily_revenue).sort((a,b) => a[0].localeCompare(b[0])).map(([date, rev]) => ({
        name: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
        pendapatan: rev
      }))
    : [];

  const categoryData = report?.category_sales
    ? [
        { name: 'Frozen Snack', value: report.category_sales.snack || 0 },
        { name: 'Bebek Pawon Ayu', value: report.category_sales.bebek || 0 },
      ]
    : [];

  const statusData = report?.status_counts
    ? Object.entries(report.status_counts).map(([k, v]) => ({
        name: { menunggu: 'Menunggu', diproses: 'Diproses', siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }[k] || k,
        value: v
      }))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Laporan Penjualan</h1>
        <button onClick={() => load()} className="p-2 text-[#D97706]"><RefreshCw size={18} /></button>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 bg-white rounded-2xl border border-[#FED7AA] p-2 w-fit">
        {[{k:'today',l:'Hari Ini'},{k:'week',l:'7 Hari'},{k:'month',l:'30 Hari'},{k:'year',l:'Setahun'}].map(p => (
          <button key={p.k} onClick={() => handlePeriod(p.k)} data-testid={`period-${p.k}`}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${period===p.k?'bg-[#D97706] text-white':'text-[#78350F] hover:bg-[#FEF3C7]'}`}>
            {p.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw size={32} className="text-[#D97706] animate-spin" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Pendapatan', value: formatRp(report?.total_revenue || 0), icon: <TrendingUp size={20} className="text-amber-600" />, bg: 'bg-amber-50' },
              { label: 'Total Pesanan', value: report?.total_orders || 0, icon: <ShoppingBag size={20} className="text-blue-600" />, bg: 'bg-blue-50' },
              { label: 'Rata-rata Pesanan', value: formatRp(report?.avg_order || 0), icon: <Target size={20} className="text-green-600" />, bg: 'bg-green-50' },
              { label: 'Produk Terlaris', value: report?.best_seller || '-', icon: <span className="text-lg">🏆</span>, bg: 'bg-yellow-50', small: true },
            ].map((card, i) => (
              <div key={card.label} className="bg-white rounded-2xl border border-[#FED7AA] p-4 flex gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>{card.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#92400E] uppercase tracking-wide">{card.label}</p>
                  <p className={`font-bold text-[#78350F] mt-0.5 font-heading ${card.small ? 'text-sm truncate' : 'text-xl'}`}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Daily bar chart */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
            <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Pendapatan Harian</h2>
            {dailyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyChartData} barSize={dailyChartData.length > 10 ? 12 : 20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#92400E' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#92400E' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [formatRp(v), 'Pendapatan']} contentStyle={{ fontFamily: 'Nunito', fontSize: 12, borderColor: '#FED7AA' }} />
                  <Bar dataKey="pendapatan" fill="#D97706" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-[#92400E] py-10 font-body">Tidak ada data di periode ini</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Category donut */}
            <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
              <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Pendapatan per Kategori</h2>
              {categoryData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({name, pct}) => `${name}`}>
                      {categoryData.map((entry, i) => <Cell key={`cat-cell-${entry.name || i}`} fill={i === 0 ? '#D97706' : '#78350F'} />)}
                    </Pie>
                    <Tooltip formatter={v => [formatRp(v)]} contentStyle={{ fontFamily: 'Nunito', fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-[#92400E] py-10 font-body">Tidak ada data</p>}
            </div>

            {/* Status pie */}
            <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
              <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Distribusi Status Pesanan</h2>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name}) => name}>
                      {statusData.map((entry, i) => <Cell key={`status-cell-${entry.name || i}`} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontFamily: 'Nunito', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-[#92400E] py-10 font-body">Tidak ada data</p>}
            </div>
          </div>

          {/* Product performance table */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
            <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Performa Produk</h2>
            {report?.product_performance?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#FED7AA]">
                      {['Produk', 'Terjual', 'Pendapatan', '% Total', 'Sisa Stok'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[#92400E] font-semibold text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.product_performance.map((p, i) => (
                      <tr key={p.id || p.name || `row-${i}`} className="border-b border-[#FED7AA]/50 hover:bg-[#FDF8F0]">
                        <td className="py-3 px-3 font-semibold text-[#451A03]">{p.name}</td>
                        <td className="py-3 px-3 text-[#451A03]">{p.units} pcs</td>
                        <td className="py-3 px-3 font-semibold text-[#D97706]">{formatRp(p.revenue)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[#FED7AA] rounded-full overflow-hidden">
                              <div className="h-full bg-[#D97706] rounded-full" style={{ width: `${p.pct}%` }} />
                            </div>
                            <span className="text-xs text-[#92400E]">{p.pct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-semibold ${p.stock < 10 ? 'text-red-500' : 'text-green-600'}`}>{p.stock}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-center text-[#92400E] py-8 font-body">Tidak ada data penjualan</p>}
          </div>
        </>
      )}
    </div>
  );
}
