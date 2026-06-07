import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Upload, X, Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const API = process.env.REACT_APP_BACKEND_URL;

// Default payment methods (fallback)
const DEFAULT_PAYMENTS = [
  { id: 'transfer', name: 'Transfer Bank', type: 'transfer', emoji: '🏦', active: true },
  { id: 'cod', name: 'COD (Tunai)', type: 'cod', emoji: '💵', active: true },
  { id: 'qris', name: 'QRIS', type: 'qris', emoji: '📱', active: true },
];
const PAYMENT_EMOJI = { transfer: '🏦', cod: '💵', qris: '📱', ewallet: '👛', card: '💳' };

const DEFAULT_TEXTS = {
  bank_transfer_title: 'Transfer Bank',
  bank_transfer_instructions: 'Silakan transfer ke salah satu rekening berikut, lalu pilih cara bayar:',
  pay_now_label: 'Bayar Sekarang',
  pay_now_desc: 'Transfer sekarang & upload bukti bayar',
  pay_later_label: 'Bayar Nanti (COD)',
  pay_later_desc: 'Bayar saat pesanan sampai/diambil',
  upload_proof_label: 'Upload Bukti Transfer',
  upload_proof_hint: 'Format JPG/PNG, max 5MB. Pastikan foto jelas terbaca.',
  qris_title: 'Scan QRIS',
  qris_instructions: 'Scan QR di bawah pakai e-wallet kamu. Klik "Telah Bayar" setelah transfer berhasil.',
  qris_paid_label: 'Telah Bayar',
  qris_cancel_label: 'Batalkan',
  qris_upload_label: 'Upload Bukti Pembayaran QRIS',
  no_qris_image_warning: 'Seller belum upload QR. Hubungi seller via WhatsApp untuk minta QR.',
};

// ─── ProofUploader: reusable component untuk upload bukti bayar .jpg/.png ───
function ProofUploader({ value, onChange, label, hint, testId = 'proof-uploader' }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(f.type)) {
      toast.error('Hanya file JPG/PNG/WEBP yang diterima');
      return;
    }
    if (f.size > 5 * 1024 * 1024) { toast.error('Ukuran maks 5MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${API}/api/media/upload-proof`, fd);
      onChange(r.data.url);
      toast.success('Bukti bayar terupload!');
    } catch {
      toast.error('Gagal upload. Coba lagi.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const previewSrc = value?.startsWith('/api/') ? `${API}${value}` : value;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[#78350F]">{label}</label>
      {value ? (
        <div className="flex items-start gap-3">
          <SmartImage src={previewSrc} alt="Bukti bayar" className="w-28 h-28 object-cover rounded-xl border-2 border-green-300 bg-white" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-green-600 text-sm font-bold mb-2">
              <CheckCircle2 size={16} /> Bukti terupload
            </div>
            <button type="button" data-testid={`${testId}-remove`} onClick={() => onChange('')}
              className="flex items-center gap-1 text-xs text-red-500 hover:underline font-semibold">
              <X size={12} /> Hapus & upload ulang
            </button>
          </div>
        </div>
      ) : (
        <button type="button" data-testid={testId} onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full border-2 border-dashed border-[#FED7AA] hover:border-[#D97706] rounded-2xl p-6 text-center transition-all bg-[#FFFBF5]">
          {uploading ? (
            <Loader2 size={28} className="mx-auto text-[#D97706] animate-spin" />
          ) : (
            <Upload size={28} className="mx-auto text-[#D97706] mb-2" />
          )}
          <p className="text-sm font-bold text-[#78350F]">{uploading ? 'Mengupload...' : 'Klik untuk upload foto bukti'}</p>
          <p className="text-xs text-[#92400E] mt-1">{hint}</p>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleFile} className="hidden" />
    </div>
  );
}

// ─── BankTransferFlow: pilih bank → pay_now/pay_later → upload bukti (jika now) ───
function BankTransferFlow({ banks, texts, paymentBankId, setPaymentBankId, paymentType, setPaymentType, proofUrl, setProofUrl, isDelivery }) {
  // FASE 7: Saat delivery, Pay Now di-disable karena ongkir belum diketahui — buyer wajib pilih Bayar Nanti
  // Auto-pilih pay_later jika delivery
  useEffect(() => {
    if (isDelivery && paymentType === 'now') {
      setPaymentType('later');
      setProofUrl('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDelivery]);

  return (
    <div className="space-y-5 mt-4 p-4 rounded-2xl bg-[#FFFBF5] border border-[#FED7AA]">
      <div>
        <h4 className="font-heading font-bold text-[#78350F] text-base flex items-center gap-2 mb-2">
          <Building2 size={18} /> {texts.bank_transfer_title}
        </h4>
        <p className="text-xs text-[#92400E] mb-3 whitespace-pre-line">{texts.bank_transfer_instructions}</p>
        {isDelivery && (
          <div className="mb-3 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
            ℹ️ Karena kamu pilih <strong>dikirim</strong>, ongkir akan dihitung oleh seller. Bayar setelah seller siap kirim ya.
          </div>
        )}
        {banks.length === 0 ? (
          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">Belum ada rekening bank. Hubungi seller.</p>
        ) : (
          <div className="space-y-2">
            {banks.map((b, idx) => (
              <button key={b.id || idx} type="button" data-testid={`bank-${b.id || idx}`} onClick={() => setPaymentBankId(b.id)}
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  paymentBankId === b.id ? 'border-[#D97706] bg-[#FEF3C7]' : 'border-[#FED7AA] bg-white hover:border-[#D97706]'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#78350F] text-sm">{b.bank}</p>
                    <p className="text-xs text-[#92400E]">a/n {b.name}</p>
                    <p className="font-mono text-sm text-[#451A03] mt-0.5">{b.number}</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(b.number); toast.success('Nomor rekening disalin!'); }}
                    className="text-xs px-2 py-1 rounded-lg bg-[#FED7AA] text-[#78350F] font-bold hover:bg-[#D97706] hover:text-white transition-all">
                    Salin
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {paymentBankId && (
        <div>
          <h4 className="font-heading font-bold text-[#78350F] text-base mb-2">Cara Bayar</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" data-testid="pay-type-now" onClick={() => !isDelivery && setPaymentType('now')}
              disabled={isDelivery}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isDelivery ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' :
                paymentType === 'now' ? 'border-[#D97706] bg-[#FEF3C7]' : 'border-[#FED7AA] bg-white hover:border-[#D97706]'}`}>
              <p className="font-bold text-[#78350F] text-sm">⚡ {texts.pay_now_label}</p>
              <p className="text-xs text-[#92400E] mt-1">{isDelivery ? 'Tidak tersedia untuk pengiriman' : texts.pay_now_desc}</p>
            </button>
            <button type="button" data-testid="pay-type-later" onClick={() => { setPaymentType('later'); setProofUrl(''); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                paymentType === 'later' ? 'border-[#D97706] bg-[#FEF3C7]' : 'border-[#FED7AA] bg-white hover:border-[#D97706]'}`}>
              <p className="font-bold text-[#78350F] text-sm">🕒 {isDelivery ? 'Bayar setelah ongkir' : texts.pay_later_label}</p>
              <p className="text-xs text-[#92400E] mt-1">{isDelivery ? 'Seller akan kirim invoice + ongkir nanti' : texts.pay_later_desc}</p>
            </button>
          </div>
        </div>
      )}

      {paymentBankId && paymentType === 'now' && !isDelivery && (
        <ProofUploader value={proofUrl} onChange={setProofUrl} label={texts.upload_proof_label + ' *'} hint={texts.upload_proof_hint} testId="bank-proof-uploader" />
      )}
    </div>
  );
}

// ─── QrisFlow: tampilkan QR → Telah Bayar (upload bukti) / Batalkan ───
// Saat delivery: skip prepayment, langsung "later"
function QrisFlow({ qrisImageUrl, texts, qrisStage, setQrisStage, proofUrl, setProofUrl, isDelivery }) {
  const previewSrc = qrisImageUrl?.startsWith('/api/') ? `${API}${qrisImageUrl}` : qrisImageUrl;

  if (isDelivery) {
    return (
      <div className="mt-4 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-2">
        <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-bold mb-1">QRIS akan dikirim setelah ongkir ditentukan</p>
          <p className="text-xs">Karena kamu pilih dikirim, seller akan kalkulasi ongkir dulu. Setelah itu kamu dapat resi + QR untuk transfer. Lanjut submit aja ya 🧡</p>
        </div>
      </div>
    );
  }

  if (!qrisImageUrl) {
    return (
      <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2">
        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700">{texts.no_qris_image_warning}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4 p-4 rounded-2xl bg-[#FFFBF5] border border-[#FED7AA]">
      <h4 className="font-heading font-bold text-[#78350F] text-base">{texts.qris_title}</h4>
      <p className="text-xs text-[#92400E] whitespace-pre-line">{texts.qris_instructions}</p>

      <div className="flex justify-center">
        <SmartImage src={previewSrc} alt="QRIS" data-testid="qris-image" className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl bg-white border-2 border-[#FED7AA] p-2" />
      </div>

      {qrisStage === 'pending' && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" data-testid="qris-paid-btn" onClick={() => setQrisStage('paid')}
            className="bg-green-500 text-white font-bold py-3 rounded-xl hover:bg-green-600 transition-all">
            ✅ {texts.qris_paid_label}
          </button>
          <button type="button" data-testid="qris-cancel-btn" onClick={() => { setQrisStage('cancelled'); setProofUrl(''); }}
            className="bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-all">
            ❌ {texts.qris_cancel_label}
          </button>
        </div>
      )}

      {qrisStage === 'paid' && (
        <ProofUploader value={proofUrl} onChange={setProofUrl} label={texts.qris_upload_label + ' *'} hint={texts.upload_proof_hint} testId="qris-proof-uploader" />
      )}

      {qrisStage === 'cancelled' && (
        <button type="button" data-testid="qris-retry-btn" onClick={() => setQrisStage('pending')}
          className="w-full bg-[#FED7AA] text-[#78350F] font-bold py-2.5 rounded-xl text-sm hover:bg-[#D97706] hover:text-white transition-all">
          Coba Bayar Lagi
        </button>
      )}
    </div>
  );
}

export default function Checkout() {
  const { cart, cartTotal, clearCart, settings, storeConfig, authUser, authToken } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: authUser?.name || '',
    customer_phone: authUser?.phone ? authUser.phone.replace(/^62/, '0') : '',
    customer_address: '',
    delivery_method: 'delivery', notes: '', payment_method: 'transfer',
    payment_bank_id: '', payment_type: '', payment_proof_url: '',
  });
  const [qrisStage, setQrisStage] = useState('pending'); // pending | paid | cancelled

  const activePayments = useMemo(() => {
    const list = (storeConfig?.payment_methods || []).filter(p => p.active !== false);
    if (list.length === 0) return DEFAULT_PAYMENTS;
    return list.map(p => ({ ...p, emoji: p.emoji || PAYMENT_EMOJI[p.type] || PAYMENT_EMOJI[p.id] || '💳' }));
  }, [storeConfig]);

  const banks = useMemo(() => storeConfig?.bank_accounts || [], [storeConfig]);
  const qrisImageUrl = storeConfig?.qris_image_url || '';
  const texts = useMemo(() => ({ ...DEFAULT_TEXTS, ...(storeConfig?.payment_texts || {}) }), [storeConfig]);

  const currentPaymentType = activePayments.find(p => p.id === form.payment_method)?.type;

  useEffect(() => {
    if (activePayments.length > 0 && !activePayments.find(p => p.id === form.payment_method)) {
      setForm(f => ({ ...f, payment_method: activePayments[0].id }));
    }
  }, [activePayments, form.payment_method]);

  // Reset payment sub-state ketika method berubah
  useEffect(() => {
    setForm(f => ({ ...f, payment_bank_id: '', payment_type: '', payment_proof_url: '' }));
    setQrisStage('pending');
  }, [form.payment_method]);

  useEffect(() => {
    if (authUser) {
      setForm(f => ({
        ...f,
        customer_name: f.customer_name || authUser.name || '',
        customer_phone: f.customer_phone || (authUser.phone ? authUser.phone.replace(/^62/, '0') : ''),
      }));
    }
  }, [authUser]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Validasi: tombol submit hanya enabled jika payment flow lengkap
  const isDelivery = form.delivery_method === 'delivery';
  const paymentReady = useMemo(() => {
    if (currentPaymentType === 'transfer') {
      if (!form.payment_bank_id) return false;
      if (!form.payment_type) return false;
      // Saat delivery, hanya 'later' yang diizinkan
      if (isDelivery && form.payment_type === 'now') return false;
      if (form.payment_type === 'now' && !form.payment_proof_url) return false;
      return true;
    }
    if (currentPaymentType === 'qris') {
      // Saat delivery, langsung ready (bayar nanti setelah resi)
      if (isDelivery) return true;
      if (qrisStage !== 'paid') return false;
      if (!form.payment_proof_url) return false;
      return true;
    }
    return true;
  }, [currentPaymentType, form.payment_bank_id, form.payment_type, form.payment_proof_url, qrisStage, isDelivery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) { toast.error('Keranjang kosong!'); return; }
    if (!form.customer_name || !form.customer_phone) { toast.error('Nama dan nomor HP wajib diisi!'); return; }
    if (form.delivery_method === 'delivery' && !form.customer_address) { toast.error('Alamat wajib diisi untuk pengiriman!'); return; }
    if (!paymentReady) {
      if (currentPaymentType === 'transfer' && !form.payment_bank_id) { toast.error('Pilih bank tujuan transfer dulu'); return; }
      if (currentPaymentType === 'transfer' && !form.payment_type) { toast.error('Pilih cara bayar (Sekarang/Nanti)'); return; }
      if (currentPaymentType === 'transfer' && form.payment_type === 'now') { toast.error('Upload bukti transfer dulu ya'); return; }
      if (currentPaymentType === 'qris' && qrisStage !== 'paid') { toast.error('Klik "Telah Bayar" setelah transfer QRIS'); return; }
      if (currentPaymentType === 'qris') { toast.error('Upload bukti pembayaran QRIS dulu'); return; }
      return;
    }

    setLoading(true);
    try {
      const items = cart.map(({ product, qty }) => {
        const price = product.final_price || product.price;
        return { product_id: product.id, product_name: product.name, price, quantity: qty, subtotal: price * qty, image_url: product.image_url || '' };
      });
      const res = await axios.post(`${API}/api/orders`, {
        ...form, items, subtotal: cartTotal, total: cartTotal,
        user_id: authToken || null,
      });
      const newOrder = res.data;
      clearCart();

      const sellerWA = settings?.seller_whatsapp || storeConfig?.seller_notify_phone || storeConfig?.whatsapp;
      if (sellerWA) {
        const itemsDetail = items.map(i => `- ${i.product_name} x${i.quantity} = ${formatRp(i.subtotal)}`).join('\n');
        const paymentLine = (() => {
          if (currentPaymentType === 'transfer') {
            const bank = banks.find(b => b.id === form.payment_bank_id);
            const bankLabel = bank ? `${bank.bank} (${bank.number})` : '';
            const typeLabel = form.payment_type === 'now' ? texts.pay_now_label : texts.pay_later_label;
            return `Bayar: Transfer ${bankLabel} - ${typeLabel}`;
          }
          if (currentPaymentType === 'qris') return 'Bayar: QRIS (sudah upload bukti)';
          if (currentPaymentType === 'cod') return 'Bayar: COD';
          return `Bayar: ${form.payment_method}`;
        })();
        const proofLine = form.payment_proof_url
          ? `\n📎 Bukti bayar: ${form.payment_proof_url.startsWith('/api/') ? API + form.payment_proof_url : form.payment_proof_url}`
          : '';
        const template = settings?.message_template || (
          `Halo ${storeConfig?.name || 'Ciltarasa'}!\n\nSaya mau pesan:\n{items_detail}\n\nNama: {customer_name}\nHP: {customer_phone}\nAlamat: {customer_address}\nCatatan: {notes}\n${paymentLine}${proofLine}\n\nTotal: Rp {total}\nOrder ID: #{order_id}`
        );
        const msg = template
          .replace('{order_id}', newOrder.order_number)
          .replace('{customer_name}', newOrder.customer_name)
          .replace('{customer_phone}', newOrder.customer_phone)
          .replace('{customer_address}', newOrder.customer_address || 'Ambil Sendiri')
          .replace('{items_detail}', itemsDetail)
          .replace('{total}', formatRp(newOrder.total).replace('Rp ', ''))
          .replace('{notes}', (newOrder.notes || '-') + (proofLine ? proofLine : ''));
        toast.success('Pesanan dibuat! Membuka WhatsApp...');
        window.location.href = `https://wa.me/${sellerWA}?text=${encodeURIComponent(msg)}`;
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
              <input data-testid="checkout-name-input" type="text" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
                placeholder="Masukkan nama lengkap" className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Nomor HP (WhatsApp) *</label>
              <input data-testid="checkout-phone-input" type="tel" required value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)}
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
              <textarea data-testid="checkout-address-input" required value={form.customer_address} onChange={e => set('customer_address', e.target.value)}
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

          {/* Sub-flows per payment type */}
          {currentPaymentType === 'transfer' && (
            <BankTransferFlow
              banks={banks}
              texts={texts}
              paymentBankId={form.payment_bank_id}
              setPaymentBankId={(v) => set('payment_bank_id', v)}
              paymentType={form.payment_type}
              setPaymentType={(v) => set('payment_type', v)}
              proofUrl={form.payment_proof_url}
              setProofUrl={(v) => set('payment_proof_url', v)}
              isDelivery={isDelivery}
            />
          )}
          {currentPaymentType === 'qris' && (
            <QrisFlow
              qrisImageUrl={qrisImageUrl}
              texts={texts}
              qrisStage={qrisStage}
              setQrisStage={setQrisStage}
              proofUrl={form.payment_proof_url}
              setProofUrl={(v) => set('payment_proof_url', v)}
              isDelivery={isDelivery}
            />
          )}
          {currentPaymentType === 'cod' && (
            <div className="mt-4 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-start gap-2">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Bayar tunai saat pesanan sampai/diambil. Pastikan siapkan uang pas ya!</p>
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

        <button data-testid="submit-order-btn" type="submit" disabled={loading || !paymentReady}
          className="w-full bg-[#D97706] text-white font-bold py-4 rounded-full hover:bg-[#B45309] transition-all transform hover:-translate-y-0.5 shadow-md text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? 'Memproses...' : <><MessageCircle size={20} /> Buat Pesanan</>}
        </button>
        {!paymentReady && !loading && (
          <p className="text-xs text-center text-[#92400E]">Lengkapi pilihan pembayaran di atas untuk lanjut</p>
        )}
      </form>
    </div>
  );
}
