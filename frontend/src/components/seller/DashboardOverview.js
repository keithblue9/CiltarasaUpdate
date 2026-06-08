import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Clock, AlertTriangle, RefreshCw, Flame, Lightbulb, Package, Zap, Settings, Check, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import SmartImage from '../shared/SmartImage';
import { toast } from 'sonner';
import { triggerOrderAlert, triggerPaymentAlert } from '../../lib/notificationAlert';

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

function StockThresholdEditor({ threshold, safetyDays, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(threshold);
  const [s, setS] = useState(safetyDays);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setT(threshold); setS(safetyDays); }, [threshold, safetyDays]);

  const save = async () => {
    const tn = Number(t), sn = Number(s);
    if (!Number.isInteger(tn) || tn < 1 || tn > 9999) { toast.error('Threshold harus 1-9999'); return; }
    if (!Number.isInteger(sn) || sn < 0 || sn > 30) { toast.error('Safety days harus 0-30'); return; }
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { low_stock_threshold: tn, restock_safety_days: sn });
      toast.success(`✅ Threshold disimpan: < ${tn} unit (safety ${sn} hari)`);
      setEditing(false);
      onSaved?.();
    } catch {
      toast.error('Gagal menyimpan threshold');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        data-testid="open-stock-threshold-editor"
        onClick={() => setEditing(true)}
        className="ml-auto flex items-center gap-1.5 bg-white/25 hover:bg-white/40 text-white text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
        title="Atur ambang batas stok rendah"
      >
        <Settings size={11} /> &lt;{threshold} unit · {safetyDays}d safety
      </button>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-1.5 bg-white/95 rounded-full px-2 py-1 text-[10px]">
      <span className="text-[#7C2D12] font-bold">Alert &lt;</span>
      <input
        data-testid="stock-threshold-input"
        type="number"
        min={1} max={9999}
        value={t}
        onChange={(e) => setT(e.target.value)}
        className="w-12 px-1.5 py-0.5 rounded border border-[#FED7AA] text-[#451A03] font-bold text-center focus:outline-none focus:border-[#F97316]"
      />
      <span className="text-[#7C2D12]">unit ·</span>
      <input
        data-testid="safety-days-input"
        type="number"
        min={0} max={30}
        value={s}
        onChange={(e) => setS(e.target.value)}
        className="w-9 px-1.5 py-0.5 rounded border border-[#FED7AA] text-[#451A03] font-bold text-center focus:outline-none focus:border-[#F97316]"
      />
      <span className="text-[#7C2D12]">d safety</span>
      <button
        data-testid="save-stock-threshold"
        onClick={save}
        disabled={saving}
        className="ml-1 p-1 rounded-full bg-green-500 text-white hover:bg-green-600 disabled:opacity-60"
        title="Simpan"
      ><Check size={11} /></button>
      <button
        onClick={() => { setEditing(false); setT(threshold); setS(safetyDays); }}
        className="p-1 rounded-full bg-gray-400 text-white hover:bg-gray-500"
        title="Batal"
      ><X size={11} /></button>
    </div>
  );
}

export default function DashboardOverview({ onTabChange }) {
  const { products, wsEvent, fetchInsights, insights } = useApp();
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
      fetchInsights();
    } catch (err) { console.warn('[DashboardOverview] load failed:', err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (wsEvent?.type === 'order_created') {
      triggerOrderAlert();
      toast.success(`🔔 Pesanan baru masuk: ${wsEvent.data?.order_number}`);
      load();
    } else if (wsEvent?.type === 'payment_proof_submitted') {
      triggerPaymentAlert();
      toast.success(`💰 Bukti transfer masuk dari ${wsEvent.data?.customer_name}`);
      load();
    } else if (wsEvent?.type === 'order_updated' || wsEvent?.type === 'purchase_updated') {
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

      {/* Smart Insights */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Restock Alerts */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white flex items-center gap-2 flex-wrap">
              <Lightbulb size={16} />
              <h3 className="font-bold text-sm">Saran Restock Pintar</h3>
              {insights.restock_alerts.filter(a => a.urgency === 'high').length > 0 && (
                <span className="text-[10px] font-extrabold bg-white/30 px-2 py-0.5 rounded-full animate-pulse">🚨 URGENT</span>
              )}
              <StockThresholdEditor
                threshold={insights.low_stock_threshold ?? 10}
                safetyDays={insights.restock_safety_days ?? 2}
                onSaved={fetchInsights}
              />
            </div>
            <div className="p-4">
              {insights.restock_alerts.length === 0 ? (
                <p className="text-sm text-center text-[#9A3412] py-6">✅ Semua stok aman!</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {insights.restock_alerts.slice(0, 5).map(a => (
                    <div key={a.id} data-testid={`restock-alert-${a.id}`} className={`flex items-center gap-3 p-2.5 rounded-xl border ${a.urgency === 'high' ? 'border-red-300 bg-red-50' : a.urgency === 'medium' ? 'border-amber-300 bg-amber-50' : 'border-[#FED7AA] bg-[#FFFBF5]'}`}>
                      <SmartImage src={a.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#7C2D12] truncate">{a.name}</p>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5">
                          <span className="text-[#9A3412]">Stok: <strong>{a.stock}</strong></span>
                          {a.velocity > 0 && <span className="text-[#9A3412]">Velocity: <strong>{a.velocity}/hari</strong></span>}
                          {a.days_left < 999 && <span className={a.urgency === 'high' ? 'text-red-700 font-extrabold' : 'text-amber-700 font-bold'}>~{a.days_left} hari lagi</span>}
                        </div>
                        <p className="text-[10px] text-[#9A3412] mt-0.5">Lead time rata-rata: {a.avg_lead_days} hari</p>
                      </div>
                      <button
                        data-testid={`quick-restock-${a.id}`}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('openRestockForm', { detail: a }));
                          onTabChange('purchases');
                        }}
                        className="flex-shrink-0 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow hover:shadow-lg"
                      >
                        Beli +{a.suggested_qty}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Sellers */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-2">
              <Flame size={16} />
              <h3 className="font-bold text-sm">Produk Terlaris (30 hari)</h3>
            </div>
            <div className="p-4 space-y-2">
              {insights.top_sellers.length === 0 ? (
                <p className="text-sm text-center text-[#9A3412] py-6">Belum ada data penjualan</p>
              ) : insights.top_sellers.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#FFFBF5]">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs ${i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-[#FEF3C7] text-[#7C2D12]'}`}>
                    #{i + 1}
                  </div>
                  <SmartImage src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#7C2D12] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#9A3412]">{p.sold_count} terjual · {p.velocity}/hari · stok {p.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
