import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Package, Clock, CheckCircle2, XCircle, ShoppingBag } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const TABS = [
  { id: 'ongoing', label: 'Ongoing', icon: Clock, statuses: ['menunggu', 'diproses', 'siap'] },
  { id: 'selesai', label: 'Selesai', icon: CheckCircle2, statuses: ['selesai'] },
  { id: 'dibatalkan', label: 'Dibatalkan', icon: XCircle, statuses: ['dibatalkan'] },
];

function StatusBadge({ status, received }) {
  const label = status === 'menunggu' ? 'Menunggu Konfirmasi' : status === 'diproses' ? 'Diproses' : status === 'siap' ? 'Siap' : status === 'selesai' ? (received ? 'Diterima ✓' : 'Selesai') : 'Dibatalkan';
  const cls = status === 'dibatalkan' ? 'bg-red-100 text-red-700' : status === 'selesai' ? 'bg-green-100 text-green-700' : `status-${status}`;
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

function OrderItem({ order, onClick }) {
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;
  return (
    <button
      data-testid={`history-order-${order.id}`}
      onClick={() => onClick(order)}
      className="w-full bg-white rounded-2xl border border-[#FED7AA] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all text-left"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#9A3412] font-bold">Order ID</p>
          <p className="font-heading font-bold text-[#EA580C]">{order.order_number}</p>
        </div>
        <StatusBadge status={order.status} received={order.received} />
      </div>
      <div className="flex items-center gap-3">
        {order.items?.slice(0, 3).map((item, i) => (
          <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#FFFBF5] border border-[#FED7AA] flex-shrink-0">
            {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
          </div>
        ))}
        {order.items?.length > 3 && (
          <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-xs font-bold text-[#7C2D12]">
            +{order.items.length - 3}
          </div>
        )}
        <div className="flex-1 min-w-0 ml-1">
          <p className="text-sm font-semibold text-[#7C2D12] truncate">{order.items?.[0]?.product_name}</p>
          <p className="text-xs text-[#9A3412]">{itemCount} item • {fmtDate(order.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold text-[#EA580C]">{fmtRp(order.total)}</p>
        </div>
      </div>
    </button>
  );
}

export default function OrderHistory() {
  const { authUser, wsEvent } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ongoing');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      // Use phone to find all orders (more inclusive than user_id since guest orders may have phone match)
      const phone = authUser.phone.replace(/^62/, '0');
      const r = await axios.get(`${API}/api/orders/track?phone=${phone}`);
      setOrders(r.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    if (wsEvent?.type === 'order_updated' || wsEvent?.type === 'order_created') {
      fetchOrders();
    }
  }, [wsEvent, fetchOrders]);

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package size={48} className="mx-auto text-[#FED7AA] mb-3" />
        <h2 className="font-heading text-xl font-bold text-[#7C2D12]">Login Dulu Yuk</h2>
        <p className="text-sm text-[#9A3412] mt-1 mb-4">Login dulu biar kamu bisa lihat history pesananmu</p>
        <button onClick={() => navigate('/buyer')} className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-6 py-3 rounded-full shadow">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const activeStatuses = TABS.find(t => t.id === tab)?.statuses || [];
  const filtered = orders.filter(o => {
    if (tab === 'selesai') return o.status === 'selesai';
    return activeStatuses.includes(o.status);
  });
  const countByTab = TABS.reduce((acc, t) => {
    acc[t.id] = orders.filter(o => t.statuses.includes(o.status)).length;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/buyer')} className="flex items-center gap-2 text-[#78350F] hover:text-[#D97706] mb-5 font-semibold transition-colors text-sm">
        <ArrowLeft size={16} /> Kembali
      </button>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#7C2D12] mb-1">Pesananku</h1>
      <p className="text-sm text-[#9A3412] mb-6">Halo {authUser.name || 'Bunda'}, ini riwayat pesananmu</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#FED7AA]">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              data-testid={`history-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 font-bold text-xs sm:text-sm transition-all relative ${active ? 'text-[#EA580C]' : 'text-[#9A3412] hover:text-[#EA580C]'}`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
              {countByTab[t.id] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${active ? 'bg-[#EA580C] text-white' : 'bg-[#FED7AA] text-[#7C2D12]'}`}>{countByTab[t.id]}</span>
              )}
              {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-t-full" />}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-[#9A3412]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-12 text-center">
          <ShoppingBag size={40} className="mx-auto text-[#FED7AA] mb-3" />
          <p className="font-bold text-[#7C2D12]">Belum ada pesanan {tab !== 'ongoing' && tab}</p>
          <p className="text-xs text-[#9A3412] mt-1">{tab === 'ongoing' ? 'Yuk mulai belanja!' : '—'}</p>
          {tab === 'ongoing' && (
            <button onClick={() => navigate('/buyer')} className="mt-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2 rounded-full text-sm">
              Belanja Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <OrderItem key={o.id} order={o} onClick={() => navigate(`/buyer/track?id=${o.order_number}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
