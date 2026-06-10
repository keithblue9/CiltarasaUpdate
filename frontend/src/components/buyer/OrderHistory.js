import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Package, Clock, CheckCircle2, XCircle, ShoppingBag,
  ChevronDown, ChevronUp, FileDown, Eye, RefreshCw, MapPin, CreditCard, Truck,
} from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';
import { generateReceiptPdf } from '../../lib/receiptGenerator';
import { generateInvoicePdf } from '../../lib/invoiceGenerator';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '-';
const fmtDateShort = (iso) => iso
  ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-';

// ─── Tab definitions ───
const TABS = [
  { id: 'ongoing',    label: 'Berlangsung', icon: Clock,        statuses: ['menunggu', 'diproses', 'siap'] },
  { id: 'selesai',    label: 'Selesai',     icon: CheckCircle2, statuses: ['selesai'] },
  { id: 'dibatalkan', label: 'Dibatalkan',  icon: XCircle,      statuses: ['dibatalkan'] },
];

// ─── Status badge ───
const STATUS_META = {
  menunggu:   { label: 'Menunggu Konfirmasi', cls: 'bg-yellow-100 text-yellow-800', emoji: '⏳' },
  diproses:   { label: 'Diproses',            cls: 'bg-blue-100 text-blue-800',     emoji: '👨‍🍳' },
  siap:       { label: 'Siap Diambil/Dikirim',cls: 'bg-emerald-100 text-emerald-800', emoji: '📦' },
  selesai:    { label: 'Selesai',             cls: 'bg-green-100 text-green-800',   emoji: '🎉' },
  dibatalkan: { label: 'Dibatalkan',          cls: 'bg-red-100 text-red-700',       emoji: '❌' },
};
function StatusBadge({ status, received }) {
  const meta = STATUS_META[status] || STATUS_META.menunggu;
  const label = status === 'selesai' && received ? 'Diterima ✓' : meta.label;
  const cls = status === 'selesai' && received ? 'bg-emerald-100 text-emerald-800' : meta.cls;
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{meta.emoji} {label}</span>;
}

// ─── Status timeline mini ───
const PIPELINE = ['menunggu', 'diproses', 'siap', 'selesai'];
function StatusTimelineMini({ status }) {
  if (status === 'dibatalkan') return null;
  const currentIdx = PIPELINE.indexOf(status);
  return (
    <div className="flex items-center gap-1 mt-2">
      {PIPELINE.map((s, idx) => {
        const reached = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={s}>
            <div className={`h-1.5 flex-1 rounded-full ${reached ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C]' : 'bg-gray-200'} ${isCurrent ? 'ring-2 ring-[#FED7AA]' : ''}`} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Single order card with expand/collapse ───
function OrderCard({ order, storeConfig, onTrack, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const itemCount = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const isCompleted = order.status === 'selesai';
  const isCancelled = order.status === 'dibatalkan';
  const isOngoing = !isCompleted && !isCancelled;

  const downloadReceipt = async () => {
    setDownloading(true);
    try {
      // generateReceiptPdf is synchronous but wrap in setTimeout to keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 30));
      generateReceiptPdf(order, storeConfig);
      toast.success('📄 Resi terdownload!');
    } catch (e) {
      console.warn('Receipt gen failed:', e);
      toast.error('Gagal generate resi. Coba klik Detail.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadInvoice = async () => {
    setDownloading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      generateInvoicePdf(order, storeConfig);
      toast.success('📑 Invoice terdownload!');
    } catch (e) {
      toast.error('Gagal generate invoice.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      data-testid={`history-order-${order.id}`}
      className={`bg-white rounded-2xl border-2 ${isCompleted ? 'border-emerald-200' : isCancelled ? 'border-red-200' : 'border-[#FED7AA]'} overflow-hidden transition-all`}
    >
      {/* Compact summary row — always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-wide text-[#9A3412] font-bold">Order ID</p>
            <p className="font-heading font-bold text-[#EA580C] text-base">{order.order_number}</p>
            <p className="text-[10px] text-[#9A3412]">{fmtDateShort(order.created_at)}</p>
          </div>
          <StatusBadge status={order.status} received={order.received} />
        </div>

        {/* Items thumbnail strip */}
        <div className="flex items-center gap-2 mb-2">
          {order.items?.slice(0, 4).map((item, i) => (
            <div key={i} className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#FFFBF5] border border-[#FED7AA] flex-shrink-0">
              {item.image_url && <SmartImage src={item.image_url} alt="" className="w-full h-full object-cover" />}
            </div>
          ))}
          {order.items?.length > 4 && (
            <div className="w-12 h-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-xs font-bold text-[#7C2D12] flex-shrink-0">
              +{order.items.length - 4}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#7C2D12] truncate">{order.items?.[0]?.product_name || '-'}</p>
            <p className="text-[11px] text-[#9A3412]">{itemCount} item</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-[#EA580C]">{fmtRp(order.total)}</p>
          </div>
        </div>

        {/* Mini timeline (only for ongoing) */}
        {isOngoing && <StatusTimelineMini status={order.status} />}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] font-bold text-[#92400E] hover:text-[#EA580C] py-1.5 rounded-lg hover:bg-orange-50"
        >
          {expanded ? <>Sembunyikan Detail <ChevronUp size={14} /></> : <>Lihat Detail <ChevronDown size={14} /></>}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-[#FED7AA]/60 p-4 bg-[#FFFBF5] space-y-3 text-xs">
          {/* All items */}
          <div>
            <p className="font-bold text-[#7C2D12] mb-1.5">📦 Detail Pesanan</p>
            <div className="space-y-1.5">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.image_url && (
                    <div className="w-9 h-9 rounded-md overflow-hidden bg-[#FFFBF5] border border-[#FED7AA] flex-shrink-0">
                      <SmartImage src={item.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#451A03] truncate">{item.product_name}</p>
                    <p className="text-[10px] text-[#9A3412]">{item.quantity} x {fmtRp(item.price)}</p>
                  </div>
                  <p className="font-bold text-[#7C2D12] whitespace-nowrap">{fmtRp(item.subtotal)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Order info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#FED7AA]/60">
            <div className="flex items-start gap-1.5">
              <Truck size={13} className="text-[#92400E] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#9A3412]">Pengiriman</p>
                <p className="font-semibold text-[#451A03] truncate">{order.delivery_method === 'pickup' ? 'Ambil Sendiri' : 'Pengiriman'}</p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <CreditCard size={13} className="text-[#92400E] mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-[#9A3412]">Pembayaran</p>
                <p className="font-semibold text-[#451A03] truncate">{order.payment_method === 'transfer' ? 'Transfer Bank' : order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'cod' ? 'COD/Tunai' : order.payment_method === 'pay_later' ? 'Bayar Nanti' : order.payment_method || '-'}</p>
              </div>
            </div>
            {order.customer_address && order.delivery_method !== 'pickup' && (
              <div className="sm:col-span-2 flex items-start gap-1.5">
                <MapPin size={13} className="text-[#92400E] mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-[#9A3412]">Alamat</p>
                  <p className="font-semibold text-[#451A03]">{order.customer_address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="pt-2 border-t border-[#FED7AA]/60 space-y-0.5">
            <div className="flex justify-between"><span className="text-[#92400E]">Subtotal</span><span className="font-semibold text-[#451A03]">{fmtRp(order.subtotal)}</span></div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between"><span className="text-[#92400E]">Ongkir</span><span className="font-semibold text-[#451A03]">{fmtRp(order.delivery_fee)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t border-[#FED7AA]/40">
              <span className="font-bold text-[#7C2D12]">Total</span>
              <span className="font-extrabold text-[#EA580C] text-sm">{fmtRp(order.total)}</span>
            </div>
          </div>

          {/* Cancellation reason */}
          {isCancelled && order.cancel_reason && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold text-red-700 uppercase">Alasan Pembatalan</p>
              <p className="text-red-700">{order.cancel_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="border-t border-[#FED7AA]/60 px-4 py-3 bg-gradient-to-r from-[#FFFBF5] to-white flex flex-wrap items-center gap-2">
        <button
          onClick={onTrack}
          data-testid={`history-track-${order.id}`}
          className="flex items-center gap-1.5 text-xs font-bold text-[#EA580C] px-3 py-1.5 rounded-full border border-[#FED7AA] hover:bg-orange-50"
        >
          <Eye size={13} /> {isOngoing ? 'Lacak Status' : 'Lihat'}
        </button>
        {isCompleted && (
          <button
            onClick={downloadReceipt}
            disabled={downloading}
            data-testid={`history-resi-${order.id}`}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            <FileDown size={13} /> {downloading ? 'Loading...' : 'Download Resi'}
          </button>
        )}
        {(isCompleted || order.status === 'siap') && (
          <button
            onClick={downloadInvoice}
            disabled={downloading}
            data-testid={`history-invoice-${order.id}`}
            className="flex items-center gap-1.5 text-xs font-bold text-[#7C2D12] bg-[#FED7AA] hover:bg-[#FDBA74] px-3 py-1.5 rounded-full disabled:opacity-50"
          >
            <FileDown size={13} /> Invoice
          </button>
        )}
        {!isOngoing && !isCompleted && (
          <span className="text-[10px] text-gray-500 italic ml-auto">— pesanan ini ditutup</span>
        )}
      </div>
    </div>
  );
}

export default function OrderHistory() {
  const { authUser, wsEvent, storeConfig } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('ongoing');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!authUser?.phone) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const phone = authUser.phone.replace(/^62/, '0');
      const r = await axios.get(`${API}/api/orders/track?phone=${encodeURIComponent(phone)}`);
      const list = Array.isArray(r.data) ? r.data : [];
      // Sort newest first
      list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, [authUser]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    if (wsEvent?.type === 'order_updated' || wsEvent?.type === 'order_created') {
      fetchOrders(true);
    }
  }, [wsEvent, fetchOrders]);

  const { filtered, countByTab } = useMemo(() => {
    const counts = TABS.reduce((acc, t) => {
      acc[t.id] = orders.filter(o => t.statuses.includes(o.status)).length;
      return acc;
    }, {});
    const activeStatuses = TABS.find(t => t.id === tab)?.statuses || [];
    return {
      filtered: orders.filter(o => activeStatuses.includes(o.status)),
      countByTab: counts,
    };
  }, [orders, tab]);

  if (!authUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package size={48} className="mx-auto text-[#FED7AA] mb-3" />
        <h2 className="font-heading text-xl font-bold text-[#7C2D12]">Login Dulu Yuk</h2>
        <p className="text-sm text-[#9A3412] mt-1 mb-4">
          Login dulu biar kamu bisa lihat history pesananmu. Atau{' '}
          <button onClick={() => navigate('/buyer/track')} className="text-[#EA580C] font-bold underline">lacak tanpa login</button>
        </p>
        <button onClick={() => navigate('/buyer')} className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-6 py-3 rounded-full shadow">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <button onClick={() => navigate('/buyer')} className="flex items-center gap-2 text-[#78350F] hover:text-[#D97706] font-semibold transition-colors text-sm">
          <ArrowLeft size={16} /> Kembali
        </button>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing || loading}
          data-testid="history-refresh-btn"
          className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] px-3 py-1.5 rounded-full border border-[#FED7AA] hover:bg-orange-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refresh...' : 'Refresh'}
        </button>
      </div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#7C2D12]">Pesananku</h1>
      <p className="text-sm text-[#9A3412] mb-5">
        Halo {authUser.name || 'Bunda'}! Total {orders.length} pesanan kamu sepanjang masa
      </p>

      {/* Quick summary cards */}
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                data-testid={`history-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`p-3 rounded-xl border-2 transition-all text-center ${
                  active ? 'border-[#EA580C] bg-[#FEF3C7]' : 'border-[#FED7AA] bg-white hover:border-[#EA580C]'
                }`}
              >
                <Icon size={18} className={`mx-auto mb-1 ${active ? 'text-[#EA580C]' : 'text-[#92400E]'}`} />
                <p className={`text-[10px] font-bold uppercase ${active ? 'text-[#EA580C]' : 'text-[#92400E]'}`}>{t.label}</p>
                <p className={`text-xl font-extrabold mt-0.5 ${active ? 'text-[#EA580C]' : 'text-[#7C2D12]'}`}>{countByTab[t.id]}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty / List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#9A3412]">
          <RefreshCw size={20} className="mx-auto animate-spin mb-2" />
          Loading pesananmu...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-12 text-center">
          <ShoppingBag size={40} className="mx-auto text-[#FED7AA] mb-3" />
          <p className="font-bold text-[#7C2D12]">
            {tab === 'ongoing' ? 'Belum ada pesanan berlangsung' : tab === 'selesai' ? 'Belum ada pesanan selesai' : 'Tidak ada pesanan dibatalkan'}
          </p>
          <p className="text-xs text-[#9A3412] mt-1 mb-4">
            {tab === 'ongoing' ? 'Yuk mulai belanja, tunggu apa lagi! 🛍️' : tab === 'selesai' ? 'Sabar ya, pesanan kamu masih diproses' : '—'}
          </p>
          {tab !== 'dibatalkan' && (
            <button onClick={() => navigate('/buyer')} className="mt-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2 rounded-full text-sm">
              Belanja Sekarang
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              storeConfig={storeConfig}
              onTrack={() => navigate(`/buyer/track?id=${encodeURIComponent(o.order_number)}`)}
              onRefresh={fetchOrders}
            />
          ))}
        </div>
      )}

      {/* Footer hint */}
      {orders.length > 0 && (
        <p className="text-center text-[10px] text-[#9A3412] italic mt-6">
          💡 Daftar update otomatis pas seller ubah status. Klik <strong>Lihat Detail</strong> untuk timeline lengkap.
        </p>
      )}
    </div>
  );
}
