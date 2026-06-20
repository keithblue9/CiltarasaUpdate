import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, ShoppingBag, ChevronLeft } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const rp = (n) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

// Acil Tata — buyer chat assistant. Order is built via clickable buttons
// (deterministic, no hallucinated prices/cart). Submits through POST /api/orders,
// which automatically triggers the seller's web + WhatsApp notifications.
export default function BuyerChatWidget() {
  const [open, setOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);     // {from:'acil'|'buyer', text}
  const [phase, setPhase] = useState('idle');
  const [cart, setCart] = useState([]);             // {product, qty}
  const [picking, setPicking] = useState(null);     // product awaiting qty
  const [selectedCat, setSelectedCat] = useState(null);
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_address: '',
    delivery_method: '', delivery_option_id: '', delivery_fee: 0,
    payment_method: '', payment_bank_id: '', payment_type: '',
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneOrder, setDoneOrder] = useState(null);
  const scrollRef = useRef(null);

  const say = useCallback((from, text) => {
    setMessages((m) => [...m, { from, text }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, phase, busy]);

  // ─── Boot on first open ───
  const boot = useCallback(async () => {
    if (booted) return;
    setBooted(true);
    setBusy(true);
    try {
      const [pr, cf] = await Promise.all([
        axios.get(`${API}/api/products`),
        axios.get(`${API}/api/store-config`),
      ]);
      const active = (pr.data || []).filter((p) => p.active !== false && (Number(p.stock) || 0) > 0);
      setProducts(active);
      setConfig(cf.data || {});
      // Acil Tata greeting (Haiku) — graceful fallback handled by backend
      let greet = 'Halo, aku Acil Tata! 😊 Mau pesan apa hari ini? Klik produk di bawah ya.';
      try {
        const hint = active.slice(0, 12).map((p) => `${p.name} (${rp(p.final_price || p.price)})`).join(', ');
        const r = await axios.post(`${API}/api/buyer/chat`, { messages: [], products_hint: hint });
        if (r.data && r.data.reply) greet = r.data.reply;
      } catch { /* keep fallback */ }
      say('acil', greet);
      setPhase('welcome');
    } catch {
      say('acil', 'Maaf ya, lagi ada gangguan ambil data toko. Coba refresh halaman sebentar 🙏');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }, [booted, say]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !booted) boot();
  };

  // ─── Order flow ───
  const startOrdering = () => {
    say('buyer', 'Mau pesan 🛍️');
    say('acil', 'Asik! Mau lihat kategori yang mana dulu? 😊');
    setSelectedCat(null);
    setPhase('category');
  };

  const chooseCategory = (cat) => {
    setSelectedCat(cat);
    say('buyer', `${cat.icon || ''} ${cat.name}`.trim());
    say('acil', `Ini pilihan di ${cat.name} 👇 Klik yang mau dipesan ya.`);
    setPhase('products');
  };

  const pickProduct = (p) => {
    setPicking(p);
    say('buyer', p.name);
    say('acil', `Mau berapa ${p.name}? 😋`);
    setPhase('qty');
  };

  const chooseQty = (n) => {
    if (!picking || !n || n < 1) return;
    setCart((c) => {
      const i = c.findIndex((x) => x.product.id === picking.id);
      if (i >= 0) { const cp = [...c]; cp[i] = { ...cp[i], qty: cp[i].qty + n }; return cp; }
      return [...c, { product: picking, qty: n }];
    });
    say('buyer', `${n} ${picking.unit || 'pcs'}`);
    say('acil', `Sip! ${n} ${picking.name} masuk keranjang ✅ Mau tambah lagi atau lanjut checkout?`);
    setPicking(null);
    setPhase('cart_review');
  };

  const cartTotal = cart.reduce((s, { product, qty }) => s + (product.final_price || product.price) * qty, 0);

  const goContact = () => {
    if (cart.length === 0) { say('acil', 'Keranjangnya masih kosong, pilih produk dulu ya 😊'); setPhase('category'); return; }
    say('acil', 'Asik! Boleh tahu nama kamu siapa? ✍️');
    setPhase('name');
  };

  const submitText = () => {
    const val = input.trim();
    if (!val) return;
    setInput('');

    if (phase === 'name') {
      setForm((f) => ({ ...f, customer_name: val }));
      say('buyer', val);
      say('acil', `Halo ${val}! 😊 Nomor WhatsApp aktif kamu berapa? (biar seller bisa info pesanan)`);
      setPhase('phone');
    } else if (phase === 'phone') {
      const digits = val.replace(/[^0-9]/g, '');
      if (digits.length < 9) { say('acil', 'Kayaknya nomornya kurang lengkap, coba ketik ulang ya 🙏'); return; }
      setForm((f) => ({ ...f, customer_phone: val }));
      say('buyer', val);
      say('acil', 'Mantap! Pengirimannya mau gimana?');
      setPhase('delivery');
    } else if (phase === 'address') {
      setForm((f) => ({ ...f, customer_address: val }));
      say('buyer', val);
      say('acil', 'Noted alamatnya 🏠 Sekarang, mau bayar pakai apa?');
      setPhase('payment');
    } else {
      // free chat → ask Acil Tata
      handleFreeChat(val);
    }
  };

  const handleFreeChat = async (val) => {
    say('buyer', val);
    setBusy(true);
    try {
      const hint = products.slice(0, 12).map((p) => `${p.name} (${rp(p.final_price || p.price)})`).join(', ');
      const hist = [...messages, { from: 'buyer', text: val }].slice(-8)
        .map((m) => ({ role: m.from === 'buyer' ? 'user' : 'assistant', content: m.text }));
      const r = await axios.post(`${API}/api/buyer/chat`, { messages: hist, products_hint: hint });
      say('acil', (r.data && r.data.reply) || 'Klik tombol produk di bawah ya buat mulai pesan 😊');
    } catch {
      say('acil', 'Hehe, buat pesan tinggal klik tombol produk di bawah ya 😊');
    } finally {
      setBusy(false);
    }
  };

  const chooseDelivery = (opt) => {
    const fee = Number(opt.fee) || 0;
    const isPickup = opt.is_pickup === true;
    setForm((f) => ({ ...f, delivery_method: isPickup ? 'pickup' : 'delivery', delivery_option_id: opt.id, delivery_fee: fee }));
    say('buyer', opt.name);
    if (opt.requires_address && !isPickup) {
      say('acil', 'Boleh tulis alamat lengkap pengirimannya? 🏠');
      setPhase('address');
    } else {
      say('acil', 'Oke! Mau bayar pakai apa?');
      setPhase('payment');
    }
  };

  const choosePayment = (pm) => {
    setForm((f) => ({ ...f, payment_method: pm.id, payment_bank_id: '', payment_type: '' }));
    say('buyer', pm.name);
    const type = (pm.type || pm.id || '').toLowerCase();
    if (type === 'transfer') {
      say('acil', 'Transfer ke rekening mana?');
      setPhase('bank');
    } else if (type === 'cod') {
      say('acil', 'Siap, bayar di tempat ya 😊 Cek dulu pesanannya yuk.');
      setPhase('review');
    } else {
      say('acil', 'Mau bayar sekarang atau nanti?');
      setPhase('timing');
    }
  };

  const chooseBank = (bank) => {
    setForm((f) => ({ ...f, payment_bank_id: bank.id }));
    say('buyer', `${bank.bank} - ${bank.number}`);
    say('acil', 'Mau transfer sekarang atau bayar nanti?');
    setPhase('timing');
  };

  const chooseTiming = (t) => {
    setForm((f) => ({ ...f, payment_type: t }));
    say('buyer', t === 'now' ? 'Bayar sekarang' : 'Bayar nanti');
    say('acil', 'Oke! Cek dulu ringkasan pesanannya ya 👇');
    setPhase('review');
  };

  const submitOrder = async () => {
    setBusy(true);
    try {
      const items = cart.map(({ product, qty }) => {
        const price = product.final_price || product.price;
        return { product_id: product.id, product_name: product.name, price, quantity: qty, subtotal: price * qty, image_url: product.image_url || '' };
      });
      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const total = subtotal + (Number(form.delivery_fee) || 0);
      const res = await axios.post(`${API}/api/orders`, {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address || '',
        delivery_method: form.delivery_method,
        delivery_option_id: form.delivery_option_id,
        delivery_fee: Number(form.delivery_fee) || 0,
        payment_method: form.payment_method,
        payment_bank_id: form.payment_bank_id || '',
        payment_type: form.payment_type || '',
        payment_proof_url: '',
        notes: 'Pesanan via chat Acil Tata',
        items, subtotal, total, user_id: null,
      });
      const ord = res.data;
      setDoneOrder(ord);
      say('acil', `Yeay, pesanan ${ord.order_number} berhasil dibuat! 🎉 Seller langsung dapat notifnya.`);
      if (form.payment_type === 'now') {
        say('acil', 'Jangan lupa transfer & upload bukti di halaman Lacak Pesanan ya 🙏');
      }
      setPhase('done');
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Gagal membuat pesanan. Coba lagi ya.';
      say('acil', `Yah, ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setCart([]); setDoneOrder(null);
    setForm({ customer_name: '', customer_phone: '', customer_address: '', delivery_method: '', delivery_option_id: '', delivery_fee: 0, payment_method: '', payment_bank_id: '', payment_type: '' });
    say('acil', 'Mau pesan lagi? Pilih kategorinya ya 😊');
    setSelectedCat(null);
    setPhase('category');
  };

  // ─── Derived option lists ───
  const deliveryOpts = (config?.delivery_options || []).filter((d) => d.active !== false);
  const catProducts = (catId) => products.filter((p) => p.category === catId || (p.categories || []).includes(catId));
  const cats = (config?.categories || []).filter((c) => catProducts(c.id).length > 0);
  const paymentOpts = (config?.payment_methods || []).filter((p) => p.active !== false);
  const banks = config?.bank_accounts || [];

  // ─── UI helpers ───
  const Btn = ({ onClick, children, tone = 'solid' }) => (
    <button onClick={onClick} disabled={busy}
      className={`text-left text-sm px-3 py-2 rounded-xl border transition-all disabled:opacity-50 ${
        tone === 'solid'
          ? 'bg-white border-[#FED7AA] text-[#7C2D12] hover:border-[#D97706] hover:bg-[#FFFBF5]'
          : 'bg-[#D97706] border-[#D97706] text-white hover:bg-[#B45309]'
      }`}>
      {children}
    </button>
  );

  const ActionPanel = () => {
    if (busy && phase !== 'review') return <div className="text-xs text-[#9A3412] italic px-1">Acil lagi ngetik…</div>;
    switch (phase) {
      case 'welcome':
        return (
          <div className="space-y-1.5">
            <Btn tone="filled" onClick={startOrdering}>🛍️ Mau pesan sekarang</Btn>
            <p className="text-[10px] text-[#9A3412] px-1">Atau ketik pertanyaan ke Acil Tata di bawah 👇</p>
          </div>
        );
      case 'category':
        return (
          <div className="grid grid-cols-2 gap-1.5">
            {cats.length === 0 && <p className="text-xs text-[#9A3412] col-span-2">Belum ada produk tersedia.</p>}
            {cats.map((c) => (
              <Btn key={c.id} onClick={() => chooseCategory(c)}>
                <span className="font-semibold">{c.icon ? `${c.icon} ` : ''}{c.name}</span>
                <span className="block text-[10px] text-[#9A3412]">{catProducts(c.id).length} produk</span>
              </Btn>
            ))}
            {cart.length > 0 && (
              <Btn tone="filled" onClick={() => setPhase('cart_review')}>🛒 Keranjang ({cart.length})</Btn>
            )}
          </div>
        );
      case 'products':
        return (
          <div className="grid grid-cols-1 gap-1.5">
            <button onClick={() => setPhase('category')} disabled={busy}
              className="flex items-center gap-1 text-xs text-[#9A3412] hover:text-[#D97706] mb-0.5">
              <ChevronLeft size={14} /> Kategori lain
            </button>
            {selectedCat && catProducts(selectedCat.id).map((p) => (
              <Btn key={p.id} onClick={() => pickProduct(p)}>
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-[#D97706] font-bold whitespace-nowrap">{rp(p.final_price || p.price)}</span>
                </span>
              </Btn>
            ))}
            {cart.length > 0 && (
              <Btn tone="filled" onClick={() => setPhase('cart_review')}>
                🛒 Lihat keranjang ({cart.length}) & lanjut
              </Btn>
            )}
          </div>
        );
      case 'qty':
        return (
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 5, 10].map((n) => (
              <Btn key={n} onClick={() => chooseQty(n)}>{n}</Btn>
            ))}
          </div>
        );
      case 'cart_review':
        return (
          <div className="space-y-1.5">
            <div className="bg-[#FEF3C7] rounded-xl p-2.5 text-xs text-[#78350F]">
              {cart.map(({ product, qty }) => (
                <div key={product.id} className="flex justify-between">
                  <span>{qty}× {product.name}</span>
                  <span className="font-semibold">{rp((product.final_price || product.price) * qty)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-[#FCD34D] mt-1 pt-1">
                <span>Subtotal</span><span>{rp(cartTotal)}</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Btn onClick={() => setPhase('category')}>➕ Tambah produk</Btn>
              <Btn tone="filled" onClick={goContact}>Lanjut checkout →</Btn>
            </div>
          </div>
        );
      case 'delivery':
        return (
          <div className="grid grid-cols-1 gap-1.5">
            {deliveryOpts.map((d) => (
              <Btn key={d.id} onClick={() => chooseDelivery(d)}>
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{d.emoji || '🚚'} {d.name}</span>
                  <span className="text-[#D97706] whitespace-nowrap">{Number(d.fee) > 0 ? rp(d.fee) : (d.free_label || 'Gratis')}</span>
                </span>
              </Btn>
            ))}
          </div>
        );
      case 'payment':
        return (
          <div className="grid grid-cols-1 gap-1.5">
            {paymentOpts.map((p) => (
              <Btn key={p.id} onClick={() => choosePayment(p)}>
                <span className="font-semibold">{p.name}</span>
                {p.details && <span className="block text-[10px] text-[#9A3412]">{p.details}</span>}
              </Btn>
            ))}
          </div>
        );
      case 'bank':
        return (
          <div className="grid grid-cols-1 gap-1.5">
            {banks.length === 0 && <p className="text-xs text-[#9A3412]">Seller akan info rekening lewat WhatsApp.</p>}
            {banks.map((b) => (
              <Btn key={b.id} onClick={() => chooseBank(b)}>
                <span className="font-semibold">{b.bank}</span>
                <span className="block text-[10px] text-[#9A3412]">{b.number} a.n. {b.name}</span>
              </Btn>
            ))}
            {banks.length === 0 && <Btn tone="filled" onClick={() => { say('acil', 'Mau bayar sekarang atau nanti?'); setPhase('timing'); }}>Lanjut →</Btn>}
          </div>
        );
      case 'timing':
        return (
          <div className="flex gap-1.5">
            <Btn onClick={() => chooseTiming('now')}>💳 Bayar Sekarang</Btn>
            <Btn onClick={() => chooseTiming('later')}>⏰ Bayar Nanti</Btn>
          </div>
        );
      case 'review': {
        const total = cartTotal + (Number(form.delivery_fee) || 0);
        const dName = deliveryOpts.find((d) => d.id === form.delivery_option_id)?.name || form.delivery_method;
        const pName = paymentOpts.find((p) => p.id === form.payment_method)?.name || form.payment_method;
        return (
          <div className="space-y-1.5">
            <div className="bg-[#FEF3C7] rounded-xl p-2.5 text-xs text-[#78350F] space-y-0.5">
              {cart.map(({ product, qty }) => (
                <div key={product.id} className="flex justify-between"><span>{qty}× {product.name}</span><span>{rp((product.final_price || product.price) * qty)}</span></div>
              ))}
              <div className="flex justify-between border-t border-[#FCD34D] mt-1 pt-1"><span>Ongkir</span><span>{Number(form.delivery_fee) > 0 ? rp(form.delivery_fee) : 'Gratis'}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>{rp(total)}</span></div>
              <div className="pt-1 text-[10px] text-[#9A3412]">
                {form.customer_name} · {form.customer_phone}<br />
                {dName} {form.customer_address ? `· ${form.customer_address}` : ''}<br />
                Bayar: {pName} {form.payment_type ? `(${form.payment_type === 'now' ? 'sekarang' : 'nanti'})` : ''}
              </div>
            </div>
            <Btn tone="filled" onClick={submitOrder}>{busy ? 'Mengirim…' : '✅ Kirim Pesanan'}</Btn>
          </div>
        );
      }
      case 'done':
        return (
          <div className="space-y-1.5">
            {doneOrder && (
              <a href={`/#/buyer/track?order=${doneOrder.order_number}`}
                className="block text-center bg-[#D97706] text-white text-sm font-bold px-3 py-2 rounded-xl hover:bg-[#B45309]">
                📦 Lacak Pesanan {doneOrder.order_number}
              </a>
            )}
            <Btn onClick={restart}>🛍️ Pesan lagi</Btn>
          </div>
        );
      default:
        return null;
    }
  };

  const showTextInput = ['name', 'phone', 'address', 'welcome', 'category', 'products', 'cart_review'].includes(phase);
  const textPlaceholder = phase === 'name' ? 'Ketik nama kamu…'
    : phase === 'phone' ? 'Ketik nomor WhatsApp…'
    : phase === 'address' ? 'Ketik alamat lengkap…'
    : 'Tanya Acil Tata…';

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={toggle}
          aria-label="Chat dengan Acil Tata"
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-[#F97316] to-[#D97706] text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle size={26} />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed z-[60] inset-x-0 bottom-0 h-[100dvh] sm:inset-x-auto sm:left-auto sm:right-5 sm:bottom-5 sm:w-[380px] sm:h-[560px] sm:max-h-[85vh] bg-[#FFFBF5] sm:rounded-3xl shadow-2xl sm:border border-[#FED7AA] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#D97706] to-[#B45309] text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">🧕</div>
            <div className="flex-1">
              <p className="font-bold leading-tight">Acil Tata</p>
              <p className="text-[10px] opacity-90">Asisten belanja Ciltarasa</p>
            </div>
            <button onClick={toggle} aria-label="Tutup" className="p-1 rounded-full hover:bg-white/20"><X size={20} /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                  m.from === 'buyer'
                    ? 'bg-[#D97706] text-white rounded-br-sm'
                    : 'bg-white border border-[#FED7AA] text-[#7C2D12] rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {/* Action panel sits under the conversation */}
            <div className="pt-1"><ActionPanel /></div>
          </div>

          {/* Text input */}
          {showTextInput && (
            <div className="border-t border-[#FED7AA] p-2 flex gap-2 bg-white">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitText(); }}
                placeholder={textPlaceholder}
                className="flex-1 px-3 py-2 rounded-full border border-[#FED7AA] text-sm focus:outline-none focus:border-[#D97706]"
              />
              <button onClick={submitText} disabled={busy} className="w-10 h-10 rounded-full bg-[#D97706] text-white flex items-center justify-center disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
