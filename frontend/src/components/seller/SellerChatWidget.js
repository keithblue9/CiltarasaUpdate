import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const PIN_KEY = 'seller_pin';

const QUICK = [
  'Kasih ide promo minggu ini dong',
  'Bikinin caption Instagram buat produk frozen',
  'Strategi naikin omzet bulan ini apa?',
  'Saran nama produk baru yang catchy',
];

// "Juragan" — AI business advisor for the seller. Free-form chat (Haiku).
export default function SellerChatWidget() {
  const [open, setOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [messages, setMessages] = useState([]); // {from:'ai'|'me', text}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const pin = typeof localStorage !== 'undefined' ? localStorage.getItem(PIN_KEY) : null;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const ask = useCallback(async (history) => {
    setBusy(true);
    try {
      const payload = history.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
      const r = await axios.post(`${API}/api/seller/chat`, { messages: payload }, {
        headers: { 'X-Seller-PIN': pin || '' },
      });
      setMessages((m) => [...m, { from: 'ai', text: (r.data && r.data.reply) || 'Maaf Juragan, coba lagi ya.' }]);
    } catch (e) {
      const msg = e?.response?.status === 401
        ? 'Sesi seller habis, Juragan. Coba logout-login lagi ya.'
        : 'Maaf Juragan, lagi ada gangguan koneksi. Coba lagi sebentar.';
      setMessages((m) => [...m, { from: 'ai', text: msg }]);
    } finally {
      setBusy(false);
    }
  }, [pin]);

  const boot = useCallback(() => {
    if (booted) return;
    setBooted(true);
    ask([]); // empty → backend sends a warm greeting
  }, [booted, ask]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !booted) boot();
  };

  const send = (text) => {
    const val = (text ?? input).trim();
    if (!val || busy) return;
    const next = [...messages, { from: 'me', text: val }];
    setMessages(next);
    setInput('');
    ask(next);
  };

  return (
    <>
      {!open && (
        <button
          onClick={toggle}
          aria-label="Asisten Juragan"
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))', right: 'calc(1.25rem + env(safe-area-inset-right))' }}
          className="fixed z-[55] flex items-center gap-2 pl-3 pr-4 h-12 rounded-full bg-gradient-to-br from-[#7C2D12] to-[#B45309] text-white shadow-lg hover:scale-105 transition-transform"
        >
          <Sparkles size={20} />
          <span className="font-bold text-sm">Tanya Juragan</span>
        </button>
      )}

      {open && (
        <div className="fixed z-[55] inset-x-0 bottom-0 h-[100dvh] sm:inset-x-auto sm:left-auto sm:right-5 sm:bottom-5 sm:w-[400px] sm:h-[600px] sm:max-h-[88vh] bg-[#FFFBF5] sm:rounded-3xl shadow-2xl sm:border border-[#FED7AA] flex flex-col overflow-hidden">
          <div style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }} className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#7C2D12] to-[#B45309] text-white">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"><Sparkles size={18} /></div>
            <div className="flex-1">
              <p className="font-bold leading-tight">Asisten Juragan</p>
              <p className="text-[10px] opacity-90">Penasihat bisnis AI · Ciltarasa</p>
            </div>
            <button onClick={toggle} aria-label="Tutup" className="p-1 rounded-full hover:bg-white/20"><X size={20} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.from === 'me'
                    ? 'bg-[#B45309] text-white rounded-br-sm'
                    : 'bg-white border border-[#FED7AA] text-[#3f2410] rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-[#9A3412] italic px-1">Juragan lagi mikir…</div>}
            {messages.length <= 1 && !busy && (
              <div className="pt-1 space-y-1.5">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="block w-full text-left text-sm px-3 py-2 rounded-xl bg-white border border-[#FED7AA] text-[#7C2D12] hover:border-[#B45309] hover:bg-[#FFFBF5]">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }} className="border-t border-[#FED7AA] p-2 flex gap-2 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Tanya apa aja ke Juragan…"
              className="flex-1 px-3 py-2 rounded-full border border-[#FED7AA] text-sm focus:outline-none focus:border-[#B45309]"
            />
            <button onClick={() => send()} disabled={busy} className="w-10 h-10 rounded-full bg-[#B45309] text-white flex items-center justify-center disabled:opacity-50">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
