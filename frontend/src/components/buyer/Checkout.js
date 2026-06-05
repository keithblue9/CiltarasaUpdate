import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const API = process.env.REACT_APP_BACKEND_URL;

// Default payment methods (fallback jika store_config kosong)
const DEFAULT_PAYMENTS = [
  { id: 'transfer', name: 'Transfer Bank', type: 'transfer', emoji: '🏦', active: true },
  { id: 'cod', name: 'COD (Tunai)', type: 'cod', emoji: '💵', active: true },
  { id: 'qris', name: 'QRIS', type: 'qris', emoji: '📱', active: true },
];
const PAYMENT_EMOJI = { transfer: '🏦', cod: '💵', qris: '📱', ewallet: '👛', card: '💳' };

export default function Checkout() {
  const { cart, cartTotal, clearCart, settings, storeConfig, authUser, authToken } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: authUser?.name || '',
    customer_phone: authUser?.phone ? authUser.phone.replace(/^62/, '0') : '',
    customer_address: '',
    delivery_method: 'delivery', notes: '', payment_method: 'transfer'
  });

  // ─── BUG FIX #4: filter active payment methods dari store_config ───
  const activePayments = useMemo(() => {
    const list = (storeConfig?.payment_methods || []).filter(p => p.active !== false);
    if (list.length === 0) return DEFAULT_PAYMENTS;
    return list.map(p => ({
      ...p,
      emoji: p.emoji || PAYMENT_EMOJI[p.type] || PAYMENT_EMOJI[p.id] || '💳',
    }));
  }, [storeConfig]);

  // Auto-pilih payment method pertama yang aktif jika current tidak tersedia
  React.useEffect(() => {
    if (activePayments.length > 0 && !activePayments.find(p => p.id === form.payment_method)) {
      setForm(f => ({ ...f, payment_method: activePayments[0].id }));
    }
  }, [activePayments, form.payment_method]);

  React.useEffect(() => {
    if (authUser) {
      setForm(f => ({
        ...f,
        customer_name: f.customer_name || authUser.name || '',
        customer_phone: f.customer_phone || (authUser.phone ? authUser.phone.replace(/^62/, '0') : ''),
      }));
    }
  }, [authUser]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) { toast.error('Keranjang kosong!'); return; }
    if (!form.customer_name || !form.customer_phone) { toast.error('Nama dan nomor HP wajib diisi!'); return; }
    if (form.delivery_method === 'delivery' && !form.customer_address) { toast.error('Alamat wajib diisi untuk pengiriman!'); return; }

    setLoading(true);
    try {
      const items = cart.map(({ product, qty }) => {
        const price = product.final_price || product.price;
        return {
          product_id: product.id, product_name: product.name,
          price, quantity: qty, subtotal: price * qty,
          image_url: product.image_url || ''
        };
      });
      const res = await axios.post(`${API}/api/orders`, {
        ...form, items, subtotal: cartTotal, total: cartTotal,
        user_id: authToken || null
      });
      const newOrder = res.data;
      clearCart();

      // ─── FIX #2: Langsung ke WhatsApp seller TANPA popup ───
      const sellerWA = settings?.seller_whatsapp || storeConfig?.seller_notify_phone || storeConfig?.whatsapp;
      if (sellerWA) {
        const itemsDetail = items.map(i => `- ${i.product_name} x${i.quantity} = ${formatRp(i.subtotal)}`).join('\n');
        const template = settings?.message_template || (
          `Halo ${storeConfig?.name || 'Ciltarasa'}!\n\nSaya mau pesan:\n{items_detail}\n\nNama: {customer_name}\nHP: {customer_phone}\nAlamat: {customer_address}\nCatatan: {notes}\n\nTotal: Rp {total}\nOrder ID: #{order_id}`
        );
        const msg = template
          .replace('{order_id}', newOrder.order_number)
          .replace('{customer_name}', newOrder.customer_name)
          .replace('{customer_phone}', newOrder.customer_phone)
          .replace('{customer_address}', newOrder.customer_address || 'Ambil Sendiri')
          .replace('{items_detail}', itemsDetail)
          .replace('{total}', formatRp(newOrder.total).replace('Rp ', ''))
          .replace('{notes}', newOrder.notes || '-');
        toast.success('Pesanan dibuat! Membuka WhatsApp...');
        // Langsung redirect ke WA seller — no extra step
        window.location.href = `https://wa.me/${sellerWA}?text=${encodeURIComponent(msg)}`;
        // Setelah klik back, akan masuk ke tracking page
        setTimeout(() => navigate(`/buyer/track?order=${newOrder.order_number}`), 800);
      } else {
        toast.success(`Pesanan ${newOrder.order_number} berhasil dibuat!`);
        navigate(`/buyer/track?order=${newOrder.order_number}`);
      }
    } catch (err) {
      toast.error('Gagal membuat pesanan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="font-heading text-2xl font-bold text-[#78350F] mb-2">Keranjang Kosong</h2>
        <p className="text-[#92400E] mb-6 font-body">Tambahkan produk dulu ya!</p>
        <button onClick={() => navigate('/buyer')} className="bg-[#D97706] text-white font-bold px-6 py-3 rounded-full hover:bg-[#B45309] transition-all">
          Kembali ke Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => navigate('/buyer')} className="flex items-center gap-2 text-[#78350F] hover:text-[#D97706] mb-6 font-semibold transition-colors">
        <ArrowLeft size={18} /> Kembali ke Menu
      </button>
      <h1 className="font-heading text-3xl font-bold text-[#78350F] mb-8">Checkout</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
          <h3 className="font-heading font-bold text-[#78350F] text-lg mb-4">Data Pemesan</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Nama Lengkap *</label>
              <input data-testid="input-name" type="text" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
                placeholder="Masukkan nama lengkap" className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Nomor HP (WhatsApp) *</label>
              <input data-testid="input-phone" type="tel" required value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)}
                placeholder="Contoh: 081234567890" className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03]" />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
          <h3 className="font-heading font-bold text-[#78350F] text-lg mb-4">Metode Pengambilan</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[{ id: 'delivery', label: 'Pengiriman', emoji: '🚚' }, { id: 'pickup', label: 'Ambil Sendiri', emoji: '🏠' }].map(m => (
              <button key={m.id} type="button" data-testid={`delivery-${m.id}`} onClick={() => set('delivery_method', m.id)}
                className={`p-4 rounded-xl border-2 font-semibold text-sm transition-all flex flex-col items-center gap-2 ${
                  form.delivery_method === m.id ? 'border-[#D97706] bg-[#FEF3C7] text-[#78350F]' : 'border-[#FED7AA] text-[#92400E] hover:border-[#D97706]'}`}>
                <span className="text-2xl">{m.emoji}</span>{m.label}
              </button>
            ))}
          </div>
          {form.delivery_method === 'delivery' && (
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Alamat Lengkap *</label>
              <textarea data-testid="input-address" required value={form.customer_address} onChange={e => set('customer_address', e.target.value)}
                placeholder="Jl. Nama Jalan No. RT/RW, Kecamatan, Kota" rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03] resize-none" />
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
          <h3 className="font-heading font-bold text-[#78350F] text-lg mb-4">Metode Pembayaran</h3>
          {activePayments.length === 0 ? (
            <p className="text-sm text-[#92400E]">Tidak ada metode pembayaran aktif. Silakan hubungi seller.</p>
          ) : (
            <div className={`grid gap-3 ${activePayments.length === 1 ? 'grid-cols-1' : activePayments.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {activePayments.map(p => (
                <button key={p.id} type="button" data-testid={`payment-${p.id}`} onClick={() => set('payment_method', p.id)}
                  className={`p-3 rounded-xl border-2 font-semibold text-xs transition-all flex flex-col items-center gap-1.5 ${
                    form.payment_method === p.id ? 'border-[#D97706] bg-[#FEF3C7] text-[#78350F]' : 'border-[#FED7AA] text-[#92400E] hover:border-[#D97706]'}`}>
                  <span className="text-xl">{p.emoji}</span>{p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
          <h3 className="font-heading font-bold text-[#78350F] text-lg mb-4">Catatan Tambahan</h3>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Catatan untuk seller (opsional)..."
            rows={2} className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03] resize-none" />
        </div>

        {/* Order Summary */}
        <div className="bg-[#FEF3C7] rounded-2xl border border-[#FED7AA] p-6">
          <h3 className="font-heading font-bold text-[#78350F] text-lg mb-3">Ringkasan Pesanan</h3>
          <div className="space-y-2 mb-4">
            {cart.map(({ product, qty }) => (
              <div key={product.id} className="flex justify-between text-sm text-[#451A03]">
                <span>{product.name} x{qty}</span>
                <span className="font-semibold">{formatRp(product.price * qty)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#FED7AA] pt-3 flex justify-between">
            <span className="font-bold text-[#78350F]">Total</span>
            <span className="font-bold text-[#D97706] text-lg">{formatRp(cartTotal)}</span>
          </div>
        </div>

        <button data-testid="submit-order-btn" type="submit" disabled={loading}
          className="w-full bg-[#D97706] text-white font-bold py-4 rounded-full hover:bg-[#B45309] transition-all transform hover:-translate-y-0.5 shadow-md text-lg disabled:opacity-70 flex items-center justify-center gap-2">
          {loading ? 'Memproses...' : <><MessageCircle size={20} /> Buat Pesanan</>}
        </button>
      </form>
    </div>
  );
}
