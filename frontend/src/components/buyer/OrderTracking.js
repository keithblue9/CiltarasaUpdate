import React, { useState, useEffect, useCallback } from 'react';
import { Search, MessageCircle, RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, Star, FileDown } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ReviewModal from './ReviewModal';
import { generateInvoicePdf } from '../../lib/invoiceGenerator';

const API = process.env.REACT_APP_BACKEND_URL;

const STATUS_STEPS = [
  { key: 'menunggu', label: 'Pesanan Diterima', icon: '📋', desc: 'Pesananmu sudah kami terima' },
  { key: 'diproses', label: 'Diproses Penjual', icon: '👨‍🍳', desc: 'Sedang dipersiapkan oleh seller' },
  { key: 'siap', label: 'Siap Diambil/Dikirim', icon: '📦', desc: 'Pesananmu siap!' },
  { key: 'selesai', label: 'Pesanan Selesai', icon: '🎉', desc: 'Sudah sampai di tangan kamu' },
  { key: 'diterima', label: 'Konfirmasi Penerimaan', icon: '✅', desc: 'Kamu sudah konfirmasi terima pesanan' },
];

const STATUS_PIPELINE = ['menunggu', 'diproses', 'siap', 'selesai'];

function formatTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatRp(n) { return `Rp ${Number(n).toLocaleString('id-ID')}`; }

function ConfirmReceivedBanner({ order, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const handleReceived = async (received) => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/orders/${order.id}/received`, { received });
      if (received) {
        toast.success('Terima kasih sudah konfirmasi! Yuk kasih review 💝');
        setReviewOpen(true);
      } else {
        toast('Kami catat. Tim kami akan menghubungi kamu segera 📞', { icon: '📞' });
      }
      onRefresh?.();
    } catch {
      toast.error('Gagal update status');
    } finally {
      setLoading(false);
    }
  };

  if (order.received) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4 mt-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-green-900">Pesanan Sudah Diterima ✨</p>
            <p className="text-xs text-green-700">Terima kasih sudah konfirmasi penerimaan</p>
          </div>
        </div>
        <button
          data-testid="open-review-btn"
          onClick={() => setReviewOpen(true)}
          className="w-full mt-2 bg-white border-2 border-amber-300 text-amber-700 font-bold py-2.5 rounded-xl hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
        >
          <Star size={16} className="fill-amber-400 text-amber-400" /> Tulis / Edit Review
        </button>
        {reviewOpen && <ReviewModal order={order} onClose={() => setReviewOpen(false)} onSubmitted={onRefresh} />}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 mt-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-amber-900">Sudah Terima Pesanan?</p>
          <p className="text-xs text-amber-700 mt-0.5">Konfirmasi penerimaan biar kami tau pesananmu aman sampai 💛</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          data-testid="confirm-received-btn"
          onClick={() => handleReceived(true)}
          disabled={loading}
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-2.5 rounded-xl shadow hover:shadow-lg transition-all disabled:opacity-70 flex items-center justify-center gap-1.5 text-sm"
        >
          <CheckCircle2 size={14} /> Sudah Terima
        </button>
        <button
          data-testid="not-received-btn"
          onClick={() => handleReceived(false)}
          disabled={loading}
          className="bg-white border-2 border-red-300 text-red-700 font-bold py-2.5 rounded-xl hover:bg-red-50 transition-all disabled:opacity-70 text-sm"
        >
          Belum Terima
        </button>
      </div>
      {reviewOpen && <ReviewModal order={order} onClose={() => setReviewOpen(false)} onSubmitted={onRefresh} />}
    </div>
  );
}

function OrderCard({ order, settings, onRefresh }) {
  const { storeConfig } = useApp();
  const isCancelled = order.status === 'dibatalkan';
  const currentIdx = isCancelled ? -1 : STATUS_PIPELINE.indexOf(order.status);
  const isDone = order.status === 'selesai';
  // Invoice tersedia setelah order diterima (received=true) atau status selesai
  const canDownloadInvoice = order.received || isDone;

  const handleDownloadInvoice = () => {
    try {
      generateInvoicePdf(order, storeConfig);
      toast.success('Invoice didownload!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal generate invoice');
    }
  };

  // For display, append "diterima" only if order.received
  const displaySteps = order.received ? STATUS_STEPS : STATUS_STEPS.slice(0, 4);

  return (
    <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-xs text-[#92400E] font-body">Order ID</span>
          <h3 className="font-heading text-xl font-bold text-[#D97706]">{order.order_number}</h3>
        </div>
        {isCancelled ? (
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-700">Dibatalkan</span>
        ) : (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full status-${order.status}`}>
            {order.status === 'menunggu' ? 'Menunggu Konfirmasi' : order.status === 'diproses' ? 'Diproses' : order.status === 'siap' ? 'Siap' : order.received ? 'Diterima ✓' : 'Selesai'}
          </span>
        )}
      </div>

      {/* Timeline */}
      {!isCancelled && (
        <div className="relative">
          {displaySteps.map((step, idx) => {
            const isStepDone = order.received && step.key === 'diterima' ? true : currentIdx >= idx;
            const isActive = currentIdx === idx && !order.received;
            const ts = order.status_timestamps?.[step.key];
            return (
              <div key={step.key} className="flex gap-4 mb-4 last:mb-0">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    isStepDone ? 'bg-[#D97706] shadow-md' + (isActive ? ' step-active' : '') : 'bg-gray-100'
                  }`}>
                    {step.icon}
                  </div>
                  {idx < displaySteps.length - 1 && (
                    <div className={`w-0.5 h-8 mt-1 ${isStepDone && currentIdx > idx ? 'bg-[#D97706]' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className="pt-1.5 pb-4">
                  <p className={`font-semibold text-sm ${isStepDone ? 'text-[#78350F]' : 'text-gray-400'}`}>{step.label}</p>
                  {ts ? (
                    <p className="text-xs text-[#92400E] mt-0.5">{formatTs(ts)}</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">{isStepDone ? '' : 'Menunggu...'}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-red-600 font-semibold text-sm">Pesanan ini telah dibatalkan</p>
          <p className="text-xs text-red-400 mt-1">{formatTs(order.status_timestamps?.dibatalkan)}</p>
        </div>
      )}

      {/* Confirm Received Banner (only when status = selesai) */}
      {isDone && <ConfirmReceivedBanner order={order} onRefresh={onRefresh} />}

      {/* Order Items */}
      <div className="mt-4 pt-4 border-t border-[#FED7AA]">
        <p className="text-xs font-semibold text-[#78350F] mb-2">Detail Pesanan:</p>
        <div className="space-y-1">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-[#451A03]">{item.product_name} x{item.quantity}</span>
              <span className="font-semibold text-[#78350F]">{formatRp(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-bold mt-2 pt-2 border-t border-[#FED7AA]">
          <span className="text-[#78350F]">Total</span>
          <span className="text-[#D97706]">{formatRp(order.total)}</span>
        </div>
      </div>

      {/* Contact seller + Download Invoice */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        {settings?.seller_whatsapp && (
          <button
            data-testid="contact-seller-btn"
            onClick={() => window.open(`https://wa.me/${settings.seller_whatsapp}?text=${encodeURIComponent(`Halo, saya ingin menanyakan pesanan ${order.order_number}`)}`, '_blank')}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 rounded-full hover:bg-green-600 transition-all"
          >
            <MessageCircle size={16} /> Hubungi Seller
          </button>
        )}
        {canDownloadInvoice && (
          <button
            data-testid="download-invoice-btn"
            onClick={handleDownloadInvoice}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D97706] to-[#B45309] text-white font-bold py-3 rounded-full hover:shadow-lg transition-all"
          >
            <FileDown size={16} /> Download Invoice
          </button>
        )}
      </div>
    </div>
  );
}

export default function OrderTracking() {
  const { settings, wsEvent, authUser } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const isPhone = /^\d{9,}$/.test(q.trim().replace(/\D/g, ''));
      const param = isPhone ? `phone=${q.trim()}` : `order_id=${q.trim()}`;
      const res = await axios.get(`${API}/api/orders/track?${param}`);
      setOrders(res.data);
      setLastRefresh(new Date());
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load orders for logged-in user
  useEffect(() => {
    if (authUser && !searched) {
      const phone = authUser.phone.replace(/^62/, '0');
      setQuery(phone);
      search(phone);
    }
  }, [authUser, searched, search]);

  // Auto-refresh every 10s if we have results
  useEffect(() => {
    if (!searched || orders.length === 0) return;
    const interval = setInterval(() => search(query), 10000);
    return () => clearInterval(interval);
  }, [searched, orders.length, query, search]);

  // React to WS order updates
  useEffect(() => {
    if (wsEvent?.type === 'order_updated' && searched) {
      search(query);
    }
  }, [wsEvent]);

  const handleSearch = (e) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => navigate('/buyer')} className="flex items-center gap-2 text-[#78350F] hover:text-[#D97706] mb-6 font-semibold transition-colors">
        <ArrowLeft size={18} /> Kembali
      </button>
      <h1 className="font-heading text-3xl font-bold text-[#78350F] mb-2">Lacak Pesanan</h1>
      <p className="text-[#92400E] font-body mb-8">
        {authUser ? `Halo ${authUser.name}, ini pesananmu` : 'Masukkan Order ID atau Nomor HP untuk melacak pesananmu'}
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92400E]" />
          <input
            data-testid="tracking-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Contoh: ORD-0001 atau 081234567890"
            className="w-full pl-11 pr-4 py-3 rounded-full border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03] bg-white"
          />
        </div>
        <button data-testid="tracking-search-btn" type="submit"
          className="bg-[#D97706] text-white font-bold px-6 py-3 rounded-full hover:bg-[#B45309] transition-all">
          Lacak
        </button>
      </form>

      {loading && (
        <div className="text-center py-12">
          <RefreshCw size={32} className="text-[#D97706] mx-auto mb-3 animate-spin" />
          <p className="text-[#92400E] font-body">Mencari pesananmu...</p>
        </div>
      )}

      {!loading && searched && orders.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="font-heading text-xl text-[#78350F] mb-2">Pesanan Tidak Ditemukan</h3>
          <p className="text-[#92400E] font-body text-sm">Pastikan Order ID atau Nomor HP sudah benar</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[#92400E] font-body">{orders.length} pesanan ditemukan</span>
            {lastRefresh && (
              <span className="text-xs text-[#92400E] flex items-center gap-1">
                <RefreshCw size={12} /> Auto-refresh aktif
              </span>
            )}
          </div>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} settings={settings} onRefresh={() => search(query)} />
          ))}
        </div>
      )}

      {!searched && !authUser && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="font-heading text-xl text-[#78350F] mb-2">Cari Pesananmu</h3>
          <p className="text-[#92400E] font-body text-sm max-w-sm mx-auto">
            Masukkan Order ID (contoh: ORD-0001) atau Nomor HP yang digunakan saat checkout
          </p>
        </div>
      )}
    </div>
  );
}
