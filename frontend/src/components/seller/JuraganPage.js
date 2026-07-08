import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Send } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const PIN_KEY = 'seller_pin';

const QUICK = [
  'Kasih ide promo minggu ini dong',
  'Bikinin caption Instagram buat produk frozen',
  'Strategi naikin omzet bulan ini apa?',
  'Saran nama produk baru yang catchy',
];

// "Juragan" — AI business advisor for the seller, sebagai HALAMAN penuh (bukan bubble).
export default function JuraganPage() {
  const [messages, setMessages] = useState([]); // {from:'ai'|'me', text}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [booted, setBooted] = useState(false);
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

  // Auto-greeting saat halaman dibuka
  useEffect(() => {
    if (booted) return;
    setBooted(true);
    ask([]);
  }, [booted, ask]);

  const send = (text) => {
    const val = (text ?? input).trim();
    if (!val || busy) return;
    const next = [...messages, { from: 'me', text: val }];
    setMessages(next);
    setInput('');
    ask(next);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12] flex items-center gap-2">
          <Sparkles size={22} className="text-[#B45309]" /> Tanya Juragan
        </h1>
        <p className="text-xs text-[#9A3412] mt-0.5">Penasihat bisnis AI buat kamu — tanya ide promo, caption, strategi omzet, apa aja.</p>
      </div>

      <div className="bg-[#FFFBF5] rounded-2xl border border-[#FED7AA] flex flex-col h-[calc(100vh-230px)] min-h-[440px] overflow-hidden shadow-sm">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
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
            <div className="pt-2 space-y-1.5">
              <p className="text-[11px] text-[#9A3412] font-semibold px-1">Coba tanya:</p>
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="block w-full text-left text-sm px-3 py-2.5 rounded-xl bg-white border border-[#FED7AA] text-[#7C2D12] hover:border-[#B45309] hover:bg-[#FFF7ED] transition-colors">
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[#FED7AA] p-3 flex gap-2 bg-white">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Tanya apa aja ke Juragan…"
            className="flex-1 px-4 py-2.5 rounded-full border border-[#FED7AA] text-sm focus:outline-none focus:border-[#B45309]"
          />
          <button onClick={() => send()} disabled={busy} className="w-11 h-11 rounded-full bg-[#B45309] text-white flex items-center justify-center disabled:opacity-50 hover:bg-[#7C2D12] transition-colors">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
