import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, ShoppingBag, Users, Package, AlertTriangle, RefreshCw,
  DollarSign, ShoppingCart, BarChart3, Activity, UserPlus, UserCheck,
  Boxes, AlertOctagon, Trophy, Calendar, ChevronDown, Sparkles, Brain, Zap,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import SmartImage from '../shared/SmartImage';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtRpShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1)}M`;
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(1)}jt`;
  if (v >= 1e3) return `Rp ${(v / 1e3).toFixed(0)}rb`;
  return fmtRp(v);
};
const fmtNum = (n) => Number(n || 0).toLocaleString('id-ID');

const COLORS = ['#F97316', '#EA580C', '#D97706', '#B45309', '#92400E', '#FCA5A5', '#FCD34D', '#A78BFA'];

const PERIODS = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '14d', label: '14 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '1y', label: '1 Tahun' },
  { key: 'custom', label: '📅 Custom' },
];

const TABS = [
  { key: 'general', label: 'Umum', icon: BarChart3 },
  { key: 'inventory', label: 'Inventori', icon: Boxes },
  { key: 'sales', label: 'Penjualan', icon: TrendingUp },
  { key: 'customer', label: 'Pelanggan', icon: Users },
];

const STATUS_LABEL = { menunggu: 'Menunggu', diproses: 'Diproses', siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };
const STATUS_COLOR = { menunggu: '#FCD34D', diproses: '#F97316', siap: '#8B5CF6', selesai: '#10B981', dibatalkan: '#EF4444' };
const PAYMENT_LABEL = { transfer: 'Transfer', qris: 'QRIS', cod: 'COD', ewallet: 'E-Wallet', card: 'Kartu' };

// ─── KPI Card ────────────────────────────────────────────────────
function KpiCard({ title, value, sub, icon: Icon, color = 'orange', trend }) {
  const colors = {
    orange: 'bg-orange-100 text-orange-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
  };
  return (
    <div data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`} className="bg-white rounded-2xl border border-[#FED7AA] p-5 flex items-start gap-4 hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#92400E]">{title}</p>
        <p className="text-2xl font-bold text-[#78350F] font-heading mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-[#92400E] mt-0.5 truncate">{sub}</p>}
        {trend !== undefined && (
          <span className={`inline-flex items-center text-[10px] font-bold mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            <TrendingUp size={10} className={trend < 0 ? 'rotate-180' : ''} />&nbsp;{trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children, action, testId }) {
  return (
    <div data-testid={testId} className="bg-white rounded-2xl border border-[#FED7AA] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-[#78350F] text-base">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── GENERAL TAB ─────────────────────────────────────────────────
function GeneralTab({ data, widgets }) {
  if (!data) return <SkeletonGrid />;
  const { kpi, trend, top_products, recent_orders, status_breakdown } = data;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.show_revenue_kpi !== false && <KpiCard title="Pendapatan" value={fmtRpShort(kpi.revenue)} sub={`${fmtRp(kpi.revenue)}`} icon={DollarSign} color="green" />}
        {widgets.show_orders_kpi !== false && <KpiCard title="Total Pesanan" value={fmtNum(kpi.orders)} sub="pesanan valid" icon={ShoppingCart} color="orange" />}
        {widgets.show_aov_kpi !== false && <KpiCard title="Rata-rata Order" value={fmtRpShort(kpi.aov)} sub="per pesanan" icon={Activity} color="blue" />}
        {widgets.show_customers_kpi !== false && <KpiCard title="Pelanggan" value={fmtNum(kpi.unique_customers)} sub="unik (HP)" icon={Users} color="purple" />}
      </div>

      {/* AI Insights */}
      {widgets.show_ai_insights !== false && <AiInsightsCard />}

      {/* Revenue Trend Chart */}
      {widgets.show_revenue_chart !== false && (
        <ChartCard testId="general-trend-chart" title="Tren Pendapatan & Pesanan">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtRpShort} />
              <Tooltip
                formatter={(v, n) => n === 'revenue' ? [fmtRp(v), 'Pendapatan'] : [v, 'Order']}
                labelFormatter={(d) => `Tanggal: ${d}`}
                contentStyle={{ borderRadius: 12, border: '1px solid #FED7AA' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={2} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Top Products + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {widgets.show_top_products !== false && (
          <ChartCard testId="general-top-products" title="🏆 Top Produk Periode Ini">
            {top_products.length === 0 ? (
              <p className="text-sm text-[#92400E]">Belum ada penjualan di periode ini.</p>
            ) : (
              <div className="space-y-3">
                {top_products.map((p, i) => (
                  <div key={p.product_id || i} className="flex items-center gap-3">
                    <div className="text-base font-bold text-[#D97706] w-6">#{i + 1}</div>
                    <SmartImage src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#78350F] text-sm truncate">{p.name}</p>
                      <p className="text-xs text-[#92400E]">{p.qty} unit · {fmtRp(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}

        {widgets.show_status_breakdown !== false && (
          <ChartCard testId="general-status-breakdown" title="Status Pesanan">
            {status_breakdown.length === 0 ? (
              <p className="text-sm text-[#92400E]">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={status_breakdown} dataKey="count" nameKey="status" outerRadius={80} label={(e) => `${STATUS_LABEL[e.status] || e.status}: ${e.count}`}>
                    {status_breakdown.map((entry) => <Cell key={entry.status} fill={STATUS_COLOR[entry.status] || '#999'} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v} order`, STATUS_LABEL[p.payload.status] || p.payload.status]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </div>

      {/* Recent Orders */}
      {widgets.show_recent_orders !== false && (
        <ChartCard testId="general-recent-orders" title="🕒 Pesanan Terbaru">
          {recent_orders.length === 0 ? (
            <p className="text-sm text-[#92400E]">Belum ada pesanan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[#92400E] text-[10px] uppercase tracking-wider">
                  <tr className="border-b border-[#FED7AA]">
                    <th className="text-left py-2 px-2">No</th>
                    <th className="text-left py-2 px-2">Pelanggan</th>
                    <th className="text-right py-2 px-2">Total</th>
                    <th className="text-center py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_orders.map(o => (
                    <tr key={o.id} className="border-b border-amber-100 hover:bg-amber-50">
                      <td className="py-2 px-2 font-mono font-bold text-[#7C2D12]">#{o.order_number}</td>
                      <td className="py-2 px-2 text-[#451A03]">{o.customer_name}</td>
                      <td className="py-2 px-2 text-right font-bold text-[#D97706]">{fmtRp(o.total)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: STATUS_COLOR[o.status] + '33', color: STATUS_COLOR[o.status] }}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-[#92400E] whitespace-nowrap">{o.created_at ? new Date(o.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}

// ─── INVENTORY TAB ───────────────────────────────────────────────
function InventoryTab({ data, widgets }) {
  if (!data) return <SkeletonGrid />;
  const { kpi, low_stock_items, out_of_stock_items, top_movers, slow_movers, category_breakdown } = data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.show_total_products_kpi !== false && <KpiCard title="Total Produk" value={fmtNum(kpi.total_products)} sub="varian aktif" icon={Package} color="blue" />}
        {widgets.show_low_stock_kpi !== false && <KpiCard title="Stok Menipis" value={fmtNum(kpi.low_stock_count)} sub={`< ${kpi.low_stock_threshold} unit`} icon={AlertTriangle} color="amber" />}
        {widgets.show_out_of_stock_kpi !== false && <KpiCard title="Habis Stok" value={fmtNum(kpi.out_of_stock_count)} sub="perlu restock" icon={AlertOctagon} color="red" />}
        {widgets.show_stock_value_kpi !== false && <KpiCard title="Nilai Stok" value={fmtRpShort(kpi.stock_value)} sub="harga modal × qty" icon={DollarSign} color="green" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {widgets.show_low_stock_table !== false && (
          <ChartCard testId="inventory-low-stock" title="⚠️ Stok Menipis & Habis">
            {low_stock_items.length === 0 && out_of_stock_items.length === 0 ? (
              <p className="text-sm text-[#92400E]">✅ Semua stok aman!</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...out_of_stock_items, ...low_stock_items].slice(0, 10).map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 transition-all">
                    <SmartImage src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#78350F] text-sm truncate">{p.name}</p>
                      <p className="text-xs text-[#92400E]">{p.category || '-'} · Velocity: {p.velocity_30d}/hari</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {p.stock <= 0 ? 'HABIS' : `${p.stock} unit`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}

        {widgets.show_top_movers !== false && (
          <ChartCard testId="inventory-top-movers" title="🚀 Top Movers (30 hari)">
            {top_movers.length === 0 ? (
              <p className="text-sm text-[#92400E]">Belum ada data.</p>
            ) : (
              <div className="space-y-2">
                {top_movers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="text-sm font-bold text-[#D97706] w-6">#{i + 1}</div>
                    <SmartImage src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#78350F] text-sm truncate">{p.name}</p>
                      <p className="text-xs text-[#92400E]">{p.velocity_30d}/hari · Stok: {p.stock}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {widgets.show_slow_movers !== false && (
          <ChartCard testId="inventory-slow-movers" title="🐌 Slow Movers (30 hari tanpa penjualan)">
            {slow_movers.length === 0 ? (
              <p className="text-sm text-[#92400E]">✅ Semua produk laku!</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {slow_movers.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-gray-50">
                    <SmartImage src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#78350F] text-sm truncate">{p.name}</p>
                      <p className="text-xs text-[#92400E]">Stok: {p.stock} · Pertimbangkan diskon</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}

        {widgets.show_category_breakdown !== false && (
          <ChartCard testId="inventory-category-breakdown" title="📂 Distribusi per Kategori">
            {category_breakdown.length === 0 ? (
              <p className="text-sm text-[#92400E]">-</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={category_breakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtRpShort} />
                  <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v) => fmtRp(v)} contentStyle={{ borderRadius: 12, border: '1px solid #FED7AA' }} />
                  <Bar dataKey="value" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </div>
    </div>
  );
}

// ─── SALES TAB ───────────────────────────────────────────────────
function SalesTab({ data, widgets }) {
  if (!data) return <SkeletonGrid />;
  const { trend, payment_breakdown, category_sales, best_sellers, status_funnel, hour_heatmap } = data;

  const maxHourOrders = Math.max(...hour_heatmap.map(h => h.orders), 1);

  return (
    <div className="space-y-5">
      {widgets.show_revenue_trend !== false && (
        <ChartCard testId="sales-trend-chart" title="📈 Tren Penjualan Harian">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={fmtRpShort} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v, n) => n === 'revenue' ? [fmtRp(v), 'Revenue'] : [v, 'Orders']} contentStyle={{ borderRadius: 12, border: '1px solid #FED7AA' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {widgets.show_payment_pie !== false && (
          <ChartCard testId="sales-payment-pie" title="💳 Metode Pembayaran">
            {payment_breakdown.length === 0 ? (
              <p className="text-sm text-[#92400E]">-</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={payment_breakdown} dataKey="revenue" nameKey="method" outerRadius={80} label={(e) => `${PAYMENT_LABEL[e.method] || e.method}: ${e.count}`}>
                    {payment_breakdown.map((entry, i) => <Cell key={entry.method} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [fmtRp(v), PAYMENT_LABEL[p.payload.method] || p.payload.method]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}

        {widgets.show_category_bar !== false && (
          <ChartCard testId="sales-category-bar" title="📂 Penjualan per Kategori">
            {category_sales.length === 0 ? (
              <p className="text-sm text-[#92400E]">-</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={category_sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtRpShort} />
                  <Tooltip formatter={(v) => fmtRp(v)} />
                  <Bar dataKey="revenue" fill="#EA580C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {widgets.show_status_funnel !== false && (
          <ChartCard testId="sales-status-funnel" title="📊 Funnel Status">
            {status_funnel.length === 0 ? (
              <p className="text-sm text-[#92400E]">-</p>
            ) : (
              <div className="space-y-2">
                {status_funnel.map(s => (
                  <div key={s.status}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold" style={{ color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status] || s.status}</span>
                      <span className="text-[#92400E]">{s.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.count / Math.max(...status_funnel.map(f => f.count))) * 100}%`, backgroundColor: STATUS_COLOR[s.status] || '#999' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}

        {widgets.show_hour_heatmap !== false && (
          <ChartCard testId="sales-hour-heatmap" title="🕐 Pesanan per Jam (WIB)">
            <div className="grid grid-cols-12 gap-1">
              {hour_heatmap.map(h => {
                const intensity = h.orders / maxHourOrders;
                return (
                  <div key={h.hour} title={`${h.hour}:00 — ${h.orders} order, ${fmtRp(h.revenue)}`}
                    className="aspect-square rounded text-[8px] flex items-center justify-center font-bold"
                    style={{ backgroundColor: `rgba(249, 115, 22, ${0.1 + intensity * 0.85})`, color: intensity > 0.5 ? '#fff' : '#7C2D12' }}>
                    {h.hour}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#92400E] mt-3 text-center">Hover untuk detail. Semakin gelap = semakin ramai.</p>
          </ChartCard>
        )}

        {widgets.show_best_sellers_table !== false && (
          <ChartCard testId="sales-best-sellers" title="🏆 Best Sellers">
            {best_sellers.length === 0 ? (
              <p className="text-sm text-[#92400E]">-</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {best_sellers.slice(0, 8).map((p, i) => (
                  <div key={p.product_id || i} className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#D97706] w-5">#{i + 1}</span>
                    <SmartImage src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#78350F] text-xs truncate">{p.name}</p>
                      <p className="text-[10px] text-[#92400E]">{p.qty} unit · {fmtRpShort(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        )}
      </div>
    </div>
  );
}

// ─── CUSTOMER TAB ────────────────────────────────────────────────
function CustomerTab({ data, widgets }) {
  if (!data) return <SkeletonGrid />;
  const { kpi, top_customers, acquisition_trend } = data;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.show_total_customers_kpi !== false && <KpiCard title="Total Pelanggan" value={fmtNum(kpi.total_customers)} sub="dalam periode" icon={Users} color="purple" />}
        {widgets.show_new_customers_kpi !== false && <KpiCard title="Pelanggan Baru" value={fmtNum(kpi.new_customers)} sub="first-time buyer" icon={UserPlus} color="green" />}
        {widgets.show_returning_kpi !== false && <KpiCard title="Returning" value={fmtNum(kpi.returning_customers)} sub={`${kpi.retention_rate}% retensi`} icon={UserCheck} color="blue" />}
        {widgets.show_avg_orders_kpi !== false && <KpiCard title="Avg Order/Pelanggan" value={kpi.avg_orders_per_customer} sub="dalam periode" icon={ShoppingBag} color="amber" />}
      </div>

      {widgets.show_acquisition_chart !== false && (
        <ChartCard testId="customer-acquisition-chart" title="📈 Akuisisi Pelanggan Harian (Baru vs Returning)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={acquisition_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #FED7AA' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="new" stackId="a" fill="#10B981" name="Pelanggan Baru" />
              <Bar dataKey="returning" stackId="a" fill="#8B5CF6" name="Returning" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {widgets.show_top_customers !== false && (
        <ChartCard testId="customer-top-list" title="🏆 Top Pelanggan (Lifetime)">
          {top_customers.length === 0 ? (
            <p className="text-sm text-[#92400E]">Belum ada pelanggan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[#92400E] text-[10px] uppercase tracking-wider">
                  <tr className="border-b border-[#FED7AA]">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Nama</th>
                    <th className="text-left py-2 px-2">HP</th>
                    <th className="text-right py-2 px-2">Order</th>
                    <th className="text-right py-2 px-2">Total Belanja</th>
                    <th className="text-left py-2 px-2">Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {top_customers.map((c, i) => (
                    <tr key={c.phone} className="border-b border-amber-100 hover:bg-amber-50">
                      <td className="py-2 px-2 font-bold text-[#D97706]">#{i + 1}</td>
                      <td className="py-2 px-2 text-[#451A03] font-bold">{c.name}</td>
                      <td className="py-2 px-2 text-[#92400E] font-mono text-[10px]">+{c.phone}</td>
                      <td className="py-2 px-2 text-right text-[#78350F] font-bold">{c.orders_count}</td>
                      <td className="py-2 px-2 text-right font-bold text-[#D97706]">{fmtRp(c.total_spent)}</td>
                      <td className="py-2 px-2 text-[#92400E] whitespace-nowrap">{c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl border border-[#FED7AA] p-5 h-24 animate-pulse" />)}
      </div>
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-5 h-72 animate-pulse" />
    </div>
  );
}

// ─── AI INSIGHTS (FASE 6) ────────────────────────────────────────
function AiInsightsCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetch = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/ai/insights${force ? '?force=true' : ''}`);
      setData(r.data);
      if (force) toast.success('🤖 AI Insights di-refresh!');
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Gagal load AI insights';
      toast.error(msg);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(false); }, [fetch]);

  const urgencyColor = { tinggi: 'bg-red-100 text-red-700', sedang: 'bg-amber-100 text-amber-700', rendah: 'bg-blue-100 text-blue-700' };
  const trendColor = { naik: 'text-green-600', stabil: 'text-blue-600', turun: 'text-red-500' };
  const trendIcon = { naik: '📈', stabil: '➡️', turun: '📉' };

  return (
    <div data-testid="ai-insights-card" className="bg-gradient-to-br from-purple-50 via-white to-orange-50 rounded-2xl border-2 border-purple-200 p-5 relative overflow-hidden">
      <div className="absolute -top-4 -right-4 opacity-10 text-9xl">🤖</div>

      <div className="relative flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
            <Brain size={22} />
          </div>
          <div>
            <h3 className="font-heading font-bold text-[#451A03] text-lg flex items-center gap-1.5">
              AI Insights <Sparkles size={14} className="text-purple-500" />
            </h3>
            <p className="text-[10px] text-[#7C2D12]">
              {loading ? 'AI sedang berpikir...' :
                data?._cached ? `Cache (${data._cache_age_minutes} menit lalu) · ${data._products_analyzed || data._orders_analyzed ? '' : ''}` :
                data ? `Baru di-generate` :
                'Klik refresh untuk generate insights'}
            </p>
          </div>
        </div>
        <button
          data-testid="ai-insights-refresh-btn"
          onClick={() => fetch(true)}
          disabled={loading}
          className="flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow disabled:opacity-50 transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {loading ? 'Generating...' : 'Refresh'}
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/50 rounded-xl animate-pulse" />)}
        </div>
      ) : !data ? (
        <p className="text-sm text-[#7C2D12]">Belum ada insights. Klik refresh.</p>
      ) : (
        <div className="space-y-4 relative">
          {/* Forecast */}
          {data.demand_forecast && (
            <div data-testid="ai-forecast" className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-2">📊 Prediksi 7 Hari Ke Depan</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-[#7C2D12]">Estimasi Order</p>
                  <p className="text-xl font-bold text-[#451A03]">{data.demand_forecast.next_7d_estimated_orders ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#7C2D12]">Est. Revenue</p>
                  <p className="text-xl font-bold text-[#451A03]">{fmtRpShort(data.demand_forecast.next_7d_estimated_revenue || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#7C2D12]">Tren</p>
                  <p className={`text-lg font-bold ${trendColor[data.demand_forecast.trend] || ''}`}>
                    {trendIcon[data.demand_forecast.trend] || '➡️'} {data.demand_forecast.trend || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#7C2D12]">Confidence</p>
                  <p className="text-lg font-bold text-[#451A03] capitalize">{data.demand_forecast.confidence || '-'}</p>
                </div>
              </div>
              {data.demand_forecast.top_3_predicted_sellers?.length > 0 && (
                <p className="text-xs text-[#7C2D12] mt-2">🏆 Best predicted sellers: <strong>{data.demand_forecast.top_3_predicted_sellers.join(' · ')}</strong></p>
              )}
            </div>
          )}

          {/* Restock Suggestions */}
          {data.restock_suggestions?.length > 0 && (
            <div data-testid="ai-restock" className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-2">🔄 Saran Restock</p>
              <div className="space-y-2">
                {data.restock_suggestions.slice(0, open ? 99 : 3).map((s, i) => (
                  <div key={`restock-${s.product_name || i}`} className="flex items-start gap-2 p-2 rounded-lg hover:bg-purple-50">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${urgencyColor[s.urgency] || 'bg-gray-100'}`}>
                      {(s.urgency || '').toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#451A03]">{s.product_name}</p>
                      <p className="text-xs text-[#7C2D12]">{s.reason}</p>
                      <p className="text-[10px] text-purple-700 mt-0.5">
                        💡 Restock <strong>{s.suggested_qty}</strong> unit · Stok cukup <strong>{s.days_until_stockout}</strong> hari lagi
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {data.restock_suggestions.length > 3 && (
                <button onClick={() => setOpen(!open)} className="text-xs text-purple-600 font-bold mt-2 hover:underline">
                  {open ? '↑ Tutup' : `↓ Lihat ${data.restock_suggestions.length - 3} saran lainnya`}
                </button>
              )}
            </div>
          )}

          {/* Key Insights & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.key_insights?.length > 0 && (
              <div data-testid="ai-key-insights" className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-2">💎 Insights Bisnis</p>
                <ul className="space-y-1.5">
                  {data.key_insights.map((insight, i) => (
                    <li key={`insight-${i}-${insight.slice(0, 20)}`} className="text-xs text-[#451A03] flex gap-2"><span className="text-purple-500 flex-shrink-0">•</span>{insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.action_items?.length > 0 && (
              <div data-testid="ai-actions" className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-2 flex items-center gap-1"><Zap size={10} /> Action Items</p>
                <ul className="space-y-1.5">
                  {data.action_items.map((a, i) => (
                    <li key={`action-${i}-${a.slice(0, 20)}`} className="text-xs text-[#451A03] flex gap-2"><span className="text-orange-500 flex-shrink-0">→</span>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard with Tabs ────────────────────────────────────
export default function Dashboard() {
  const { storeConfig } = useApp();
  const dashboardConfig = storeConfig?.dashboard_config || {};
  const defaultPeriod = dashboardConfig.default_period || '30d';

  const [activeTab, setActiveTab] = useState('general');
  const [period, setPeriod] = useState(defaultPeriod);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState({ general: null, inventory: null, sales: null, customer: null });
  const [loading, setLoading] = useState(false);

  const widgets = useMemo(() => dashboardConfig[activeTab] || {}, [dashboardConfig, activeTab]);

  const fetchTab = useCallback(async (tab, p, cs, ce) => {
    setLoading(true);
    try {
      let qs = '';
      if (tab !== 'inventory') {
        if (p === 'custom' && cs && ce) {
          qs = `?period=custom&start=${cs}&end=${ce}`;
        } else if (p !== 'custom') {
          qs = `?period=${p}`;
        } else {
          setLoading(false);
          return; // tunggu user pilih custom range
        }
      }
      const url = `${API}/api/dashboard/${tab}${qs}`;
      const r = await axios.get(url);
      setData(d => ({ ...d, [tab]: r.data }));
    } catch (e) {
      if (e?.response?.status === 401) {
        setTimeout(async () => {
          try {
            let qs = '';
            if (tab !== 'inventory') {
              if (p === 'custom' && cs && ce) qs = `?period=custom&start=${cs}&end=${ce}`;
              else if (p !== 'custom') qs = `?period=${p}`;
              else return;
            }
            const url = `${API}/api/dashboard/${tab}${qs}`;
            const r = await axios.get(url);
            setData(d => ({ ...d, [tab]: r.data }));
          } catch { toast.error(`Gagal load tab ${tab}`); }
        }, 800);
      } else {
        toast.error(`Gagal load tab ${tab}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTab(activeTab, period, customStart, customEnd);
  }, [activeTab, period, customStart, customEnd, fetchTab]);

  const refresh = () => fetchTab(activeTab, period, customStart, customEnd);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Dashboard</h1>
          <p className="text-xs text-[#9A3412]">Analitik real-time toko kamu — data 100% aktual dari database.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab !== 'inventory' && (
            <>
              <div className="flex items-center gap-1 bg-white rounded-full border border-[#FED7AA] p-1 flex-wrap">
                {PERIODS.map(p => (
                  <button key={p.key} data-testid={`period-${p.key}`} onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${period === p.key ? 'bg-[#D97706] text-white' : 'text-[#7C2D12] hover:bg-amber-50'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex items-center gap-1 bg-white rounded-full border border-[#FED7AA] px-2 py-1">
                  <input
                    type="date"
                    data-testid="period-custom-start"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="text-xs px-1 py-0.5 outline-none"
                  />
                  <span className="text-xs text-[#92400E]">s/d</span>
                  <input
                    type="date"
                    data-testid="period-custom-end"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="text-xs px-1 py-0.5 outline-none"
                  />
                </div>
              )}
            </>
          )}
          <button data-testid="dashboard-refresh-btn" onClick={refresh} disabled={loading}
            className="p-2 bg-white border border-[#FED7AA] rounded-full hover:bg-amber-50 transition-all">
            <RefreshCw size={14} className={`text-[#7C2D12] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#FED7AA] overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              data-testid={`dashboard-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-[#D97706] text-[#D97706]'
                  : 'border-transparent text-[#92400E] hover:text-[#D97706]'}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general' && <GeneralTab data={data.general} widgets={widgets} />}
        {activeTab === 'inventory' && <InventoryTab data={data.inventory} widgets={widgets} />}
        {activeTab === 'sales' && <SalesTab data={data.sales} widgets={widgets} />}
        {activeTab === 'customer' && <CustomerTab data={data.customer} widgets={widgets} />}
      </div>
    </div>
  );
}
