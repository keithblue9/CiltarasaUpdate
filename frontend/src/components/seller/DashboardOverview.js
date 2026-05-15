import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useApp } from '../../context/AppContext';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

const STATUS_LABELS = { menunggu: 'Menunggu', diproses: 'Diproses', siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
const STATUS_COLORS = { menunggu: 'status-menunggu', diproses: 'status-diproses', siap: 'status-siap', selesai: 'status-selesai', dibatalkan: 'status-dibatalkan' };

function KpiCard({ title, value, icon, color, sub }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#FED7AA] p-5 flex items-start gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-[#92400E] uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-[#78350F] font-heading mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#92400E] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardOverview({ onTabChange }) {
  const { products, wsEvent } = useApp();
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, o] = await Promise.all([
        axios.get(`${API}/api/reports/sales?period=week`),
        axios.get(`${API}/api/orders`),
      ]);
      setReport(r.data);
      setOrders(o.data.slice(0, 5));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (wsEvent?.type === 'order_created' || wsEvent?.type === 'order_updated') {
      load();
    }
  }, [wsEvent]);

  const todayOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const pendingOrders = orders.filter(o => o.status === 'menunggu').length;
  const lowStock = products.filter(p => p.stock < 10 && p.active).length;
  const todayRevenue = todayOrders.filter(o => o.status !== 'dibatalkan').reduce((s, o) => s + o.total, 0);

  // Build chart data from daily_revenue
  const chartData = React.useMemo(() => {
    if (!report?.daily_revenue) return [];
    const entries = Object.entries(report.daily_revenue).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.slice(-7).map(([date, rev]) => ({
      name: new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      revenue: rev
    }));
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={32} className="text-[#D97706] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Dashboard</h1>
        <button onClick={load} className="flex items-center gap-2 text-sm text-[#D97706] hover:text-[#B45309] font-semibold">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Pendapatan Hari Ini" value={formatRp(todayRevenue)} icon={<TrendingUp size={24} className="text-amber-600" />} color="bg-amber-50" />
        <KpiCard title="Pesanan Hari Ini" value={todayOrders.length} icon={<ShoppingBag size={24} className="text-blue-600" />} color="bg-blue-50" sub={`${todayOrders.filter(o=>o.status!=='dibatalkan').length} aktif`} />
        <KpiCard title="Menunggu Konfirmasi" value={pendingOrders} icon={<Clock size={24} className="text-orange-600" />} color="bg-orange-50" />
        <KpiCard title="Stok Hampir Habis" value={lowStock} icon={<AlertTriangle size={24} className="text-red-500" />} color="bg-red-50" sub="produk < 10 unit" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <h2 className="font-heading font-bold text-[#78350F] text-lg mb-4">Tren Pendapatan 7 Hari</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#92400E' }} />
              <YAxis tick={{ fontSize: 11, fill: '#92400E' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatRp(v), 'Pendapatan']} contentStyle={{ fontFamily: 'Nunito', fontSize: 12, borderColor: '#FED7AA' }} />
              <Line type="monotone" dataKey="revenue" stroke="#D97706" strokeWidth={3} dot={{ fill: '#D97706', r: 5 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-[#92400E] font-body">Belum ada data penjualan</div>
        )}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-[#78350F] text-lg">Pesanan Terbaru</h2>
          <button onClick={() => onTabChange('orders')} className="text-sm text-[#D97706] font-semibold hover:text-[#B45309]">Lihat Semua</button>
        </div>
        {orders.length === 0 ? (
          <p className="text-center text-[#92400E] py-8 font-body">Belum ada pesanan</p>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} data-testid={`dashboard-order-${order.id}`} className="flex items-center justify-between p-3 rounded-xl bg-[#FDF8F0] border border-[#FED7AA]">
                <div>
                  <p className="font-semibold text-[#78350F] text-sm">{order.order_number} — {order.customer_name}</p>
                  <p className="text-xs text-[#92400E] mt-0.5">{order.items?.length} item · {new Date(order.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-[#D97706]">{formatRp(order.total)}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => onTabChange('orders')} className="bg-[#D97706] text-white font-bold py-4 rounded-xl hover:bg-[#B45309] transition-all">
          Lihat Semua Pesanan
        </button>
        <button onClick={() => onTabChange('products')} className="bg-white border-2 border-[#D97706] text-[#D97706] font-bold py-4 rounded-xl hover:bg-[#FEF3C7] transition-all">
          Kelola Produk
        </button>
      </div>
    </div>
  );
}
