import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Flame, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

function useCountdown(endIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  const diff = Math.max(0, end - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { hours, minutes, seconds, expired: diff <= 0, totalMs: diff };
}

function TimeBox({ value, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/80 rounded-xl flex items-center justify-center font-mono font-extrabold text-white text-xl sm:text-2xl shadow-inner border border-white/10">
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider mt-1">{label}</span>
    </div>
  );
}

export default function FlashSaleBanner({ onProductClick }) {
  const { products, discounts } = useApp();
  // Find active flash sale
  const flashSale = useMemo(() => {
    const now = new Date().toISOString();
    return (discounts || []).find(d =>
      d.is_flash_sale && d.active &&
      (!d.ends_at || d.ends_at > now) &&
      (!d.starts_at || d.starts_at <= now)
    );
  }, [discounts]);

  const cd = useCountdown(flashSale?.ends_at);
  const flashProducts = useMemo(() => {
    if (!flashSale) return [];
    return products.filter(p => p.discount_id === flashSale.id && p.active !== false);
  }, [products, flashSale]);

  if (!flashSale || flashProducts.length === 0 || cd?.expired) return null;

  return (
    <section className="py-8 sm:py-10 bg-[#FDF8F0]" data-testid="flash-sale-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-orange-500 to-yellow-500 shadow-2xl">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-300/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

          <div className="relative p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            {/* Left: Title + countdown */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/30 backdrop-blur rounded-full mb-3 animate-pulse">
                <Zap size={14} className="text-yellow-300 fill-yellow-300" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white">Lagi Live Sekarang!</span>
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white drop-shadow-lg leading-tight mb-2">
                {flashSale.name}
              </h2>
              <p className="text-white/90 text-sm sm:text-base font-semibold mb-4">
                Diskon spesial <span className="bg-yellow-300 text-red-700 px-2 py-0.5 rounded-md font-extrabold">
                  {flashSale.type === 'percent' ? `${flashSale.value}% OFF` : formatRp(flashSale.value) + ' OFF'}
                </span> — buruan sebelum kehabisan! 🔥
              </p>

              {/* Countdown */}
              {cd && (
                <div data-testid="flash-countdown" className="flex items-center gap-2 sm:gap-3">
                  <span className="text-white/90 text-xs font-bold uppercase tracking-wider hidden sm:block">Berakhir:</span>
                  <div className="flex items-center gap-2">
                    <TimeBox value={cd.hours} label="Jam" />
                    <span className="text-white font-extrabold text-2xl">:</span>
                    <TimeBox value={cd.minutes} label="Menit" />
                    <span className="text-white font-extrabold text-2xl">:</span>
                    <TimeBox value={cd.seconds} label="Detik" />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Product carousel preview */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {flashProducts.slice(0, 4).map(p => {
                  const final = p.final_price || p.price;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onProductClick?.(p)}
                      data-testid={`flash-product-${p.id}`}
                      className="group relative bg-white/95 backdrop-blur rounded-2xl overflow-hidden text-left hover:shadow-2xl hover:-translate-y-1 transition-all"
                    >
                      <div className="aspect-square overflow-hidden">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md shadow flex items-center gap-0.5">
                        <Zap size={9} className="fill-white" /> {flashSale.type === 'percent' ? `-${flashSale.value}%` : 'FS'}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] sm:text-xs font-bold text-[#7C2D12] line-clamp-1">{p.name}</p>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs sm:text-sm font-extrabold text-red-600">{formatRp(final)}</span>
                          <span className="text-[9px] text-gray-400 line-through">{formatRp(p.price)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {flashProducts.length > 4 && (
                <button
                  onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                  className="mt-3 w-full bg-white text-red-600 font-extrabold py-2 rounded-full text-xs flex items-center justify-center gap-1.5 hover:bg-yellow-50 transition-all shadow"
                >
                  Lihat Semua ({flashProducts.length}) <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
