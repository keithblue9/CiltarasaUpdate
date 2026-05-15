import React, { useState, useEffect } from 'react';
import { Eye, MessageCircle, Search, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

const STATUS_STEPS = [
  { key: 'menunggu', label: 'Menunggu Konfirmasi', color: 'status-menunggu', next: 'diproses', nextLabel: 'Proses Sekarang' },
  { key: 'diproses', label: 'Diproses', color: 'status-diproses', next: 'siap', nextLabel: 'Tandai Siap' },
  { key: 'siap', label: 'Siap Diambil/Dikirim', color: 'status-siap', next: 'selesai', nextLabel: 'Selesaikan' },
  { key: 'selesai', label: 'Selesai', color: 'status-selesai', next: null },
  { key: 'dibatalkan', label: 'Dibatalkan', color: 'status-dibatalkan', next: null },
];
const STATUS_MAP = Object.fromEntries(STATUS_STEPS.map(s => [s.key, s]));

const PAYMENT_LABELS = { transfer: 'Transfer Bank', cod: 'COD', qris: 'QRIS' };

function OrderDetailModal({ order, onClose, onStatusChange, onWhatsApp }) {
  const st = STATUS_MAP[order.status];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA]">
          <div>
            <h3 className="font-heading font-bold text-[#78350F] text-xl">{order.order_number}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${st?.color}`}>{st?.label}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#FED7AA]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[#92400E] text-xs">Nama</p><p className="font-semibold text-[#451A03]">{order.customer_name}</p></div>
            <div><p className="text-[#92400E] text-xs">No. HP</p><p className="font-semibold text-[#451A03]">{order.customer_phone}</p></div>
            <div><p className="text-[#92400E] text-xs">Metode</p><p className="font-semibold text-[#451A03]">{order.delivery_method === 'delivery' ? 'Pengiriman' : 'Ambil Sendiri'}</p></div>
            <div><p className="text-[#92400E] text-xs">Pembayaran</p><p className="font-semibold text-[#451A03]">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</p></div>
            {order.customer_address && <div className="col-span-2"><p className="text-[#92400E] text-xs">Alamat</p><p className="font-semibold text-[#451A03]">{order.customer_address}</p></div>}
            {order.notes && <div className="col-span-2"><p className="text-[#92400E] text-xs">Catatan</p><p className="font-semibold text-[#451A03]">{order.notes}</p></div>}
          </div>
          <div className="border-t border-[#FED7AA] pt-3">
            <p className="text-xs font-semibold text-[#78350F] mb-2">Pesanan:</p>
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1">
                <span className="text-[#451A03]">{item.product_name} × {item.quantity}</span>
                <span className="font-semibold text-[#78350F]">{formatRp(item.subtotal)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-[#FED7AA] mt-1">
              <span className="text-[#78350F]">Total</span>
              <span className="text-[#D97706] text-lg">{formatRp(order.total)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            {st?.next && (
              <button onClick={() => onStatusChange(order.id, st.next)}
                className="w-full bg-[#D97706] text-white font-bold py-3 rounded-xl hover:bg-[#B45309] transition-all">
                {st.nextLabel}
              </button>
            )}
            {order.status !== 'dibatalkan' && order.status !== 'selesai' && (
              <button onClick={() => onStatusChange(order.id, 'dibatalkan')}
                className="w-full bg-red-50 text-red-500 font-bold py-2.5 rounded-xl hover:bg-red-100 transition-all text-sm">
                Batalkan Pesanan
              </button>
            )}
            <button onClick={() => onWhatsApp(order)}
              className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-all">
              <MessageCircle size={16} /> Kirim Notif WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncomingOrders() {
  const { wsEvent, settings } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/orders`);
      setOrders(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (wsEvent?.type === 'order_created') {
      toast.success(`Pesanan baru: ${wsEvent.data?.order_number} dari ${wsEvent.data?.customer_name}!`);
      setOrders(prev => [wsEvent.data, ...prev]);
    }
    if (wsEvent?.type === 'order_updated') {
      setOrders(prev => prev.map(o => o.id === wsEvent.data?.id ? wsEvent.data : o));
      if (selectedOrder?.id === wsEvent.data?.id) setSelectedOrder(wsEvent.data);
    }
  }, [wsEvent]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await axios.put(`${API}/api/orders/${orderId}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
      toast.success(`Status diupdate: ${STATUS_MAP[newStatus]?.label}`);
      if (res.data?._wa_buyer_sent) {
        toast.success('✅ Notif WA terkirim ke buyer!', { duration: 2500 });
      }
      setSelectedOrder(null);
    } catch { toast.error('Gagal update status.'); }
  };

  const handleWhatsApp = (order) => {
    if (!settings?.seller_whatsapp) { toast.error('Nomor WhatsApp seller belum diset!'); return; }
    const itemsDetail = order.items?.map(i => `- ${i.product_name} x${i.quantity} = ${formatRp(i.subtotal)}`).join('\n') || '';
    const msg = (settings.message_template || '')
      .replace('{order_id}', order.order_number)
      .replace('{customer_name}', order.customer_name)
      .replace('{customer_phone}', order.customer_phone)
      .replace('{customer_address}', order.customer_address || 'Ambil Sendiri')
      .replace('{items_detail}', itemsDetail)
      .replace('{total}', formatRp(order.total).replace('Rp ', ''))
      .replace('{notes}', order.notes || '-');
    window.open(`https://wa.me/${settings.seller_whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filtered = orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .filter(o => !searchQ || o.order_number.toLowerCase().includes(searchQ.toLowerCase()) || o.customer_name.toLowerCase().includes(searchQ.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Pesanan Masuk</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#92400E]">{orders.filter(o=>o.status==='menunggu').length} menunggu</span>
          <button onClick={load} className="p-2 text-[#D97706] hover:text-[#B45309]"><RefreshCw size={18} /></button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400E]" />
          <input type="text" placeholder="Cari order ID atau nama..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] text-sm font-body" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{k:'all',l:'Semua'},{k:'menunggu',l:'Menunggu'},{k:'diproses',l:'Diproses'},{k:'siap',l:'Siap'},{k:'selesai',l:'Selesai'},{k:'dibatalkan',l:'Batal'}].map(s => (
            <button key={s.k} onClick={() => setStatusFilter(s.k)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${statusFilter===s.k?'bg-[#D97706] text-white':'bg-white border border-[#FED7AA] text-[#78350F] hover:bg-[#FED7AA]'}`}>
              {s.l} {s.k!=='all' && <span className="ml-1 opacity-70">{orders.filter(o=>o.status===s.k).length}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw size={28} className="text-[#D97706] animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">📭</div><p className="text-[#92400E] font-body">Tidak ada pesanan</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const st = STATUS_MAP[order.status];
            return (
              <div key={order.id} data-testid={`order-row-${order.id}`} className="bg-white rounded-2xl border border-[#FED7AA] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#78350F]">{order.order_number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st?.color}`}>{st?.label}</span>
                    </div>
                    <p className="text-sm text-[#451A03] mt-1 font-semibold">{order.customer_name}</p>
                    <p className="text-xs text-[#92400E] mt-0.5">{order.customer_phone} · {order.delivery_method === 'delivery' ? 'Pengiriman' : 'Ambil Sendiri'}</p>
                    <p className="text-xs text-[#92400E] mt-0.5">{order.items?.length} item · {new Date(order.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-bold text-[#D97706] text-lg">{formatRp(order.total)}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedOrder(order)} data-testid={`view-order-${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-[#FED7AA] text-xs font-semibold transition-all">
                        <Eye size={13} /> Detail
                      </button>
                      {st?.next && (
                        <button onClick={() => handleStatusChange(order.id, st.next)} data-testid={`advance-order-${order.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#D97706] text-white hover:bg-[#B45309] text-xs font-semibold transition-all">
                          <ChevronDown size={13} /> {st.nextLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onWhatsApp={handleWhatsApp}
        />
      )}
    </div>
  );
}
