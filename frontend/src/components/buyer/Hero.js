import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SmartImage from '../shared/SmartImage';

const DEFAULT_SLIDE = 'https://static.prod-images.emergentagent.com/jobs/fa7f3ba8-8537-4e4d-b681-0c7370599acf/images/3fd09d3c0fc14b6148e6065a022d94002c52a9aafb799d7dda170d7445053fd9.png';

const defaultTexts = {
  viral_pill: 'Lagi Viral di Malang 🔥',
  hero_title_1: 'Cemilan Frozen',
  hero_title_2: 'Yang Bikin Nagih',
  hero_subtitle: 'Frozen snack premium & Bebek Pawon Ayu khas Malang. Tinggal goreng, anak-anak langsung suka! ✨',
  hero_cta_primary: 'Belanja Sekarang',
  hero_cta_secondary: 'Lacak Pesananku',
  social_proof_text: '1.200+ keluarga di Malang sudah berlangganan',
  how_to_order_title: 'Cara Pesan',
  how_to_order_subtitle: 'Mudah, cepat, dan praktis',
};

const defaultSteps = [
  { id: 's1', icon: '🛒', title: 'Pilih Produk', desc: 'Pilih frozen snack atau bebek favoritmu dari katalog kami.' },
  { id: 's2', icon: '📝', title: 'Isi Data Pesanan', desc: 'Lengkapi nama, nomor HP, dan alamat pengiriman.' },
  { id: 's3', icon: '🎉', title: 'Pesanan Dikirim', desc: 'Kami proses dan kirim langsung ke pintumu!' },
];

function HeroSlideshow({ slides }) {
  const [idx, setIdx] = useState(0);
  const activeSlides = slides.filter(s => s.active !== false);

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const duration = activeSlides[idx]?.duration_ms || 5000;
    const t = setTimeout(() => setIdx((i) => (i + 1) % activeSlides.length), duration);
    return () => clearTimeout(t);
  }, [idx, activeSlides]);

  if (activeSlides.length === 0) {
    return (
      <>
        <SmartImage src={DEFAULT_SLIDE} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#451A03]/85 via-[#78350F]/55 to-transparent" />
      </>
    );
  }
  return (
    <>
      {activeSlides.map((s, i) => (
        <SmartImage
          key={s.id || i}
          src={s.image_url}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#451A03]/85 via-[#78350F]/55 to-transparent" />
      {activeSlides.length > 1 && (
        <div className="absolute bottom-5 right-5 flex gap-1.5 z-10">
          {activeSlides.map((s, i) => (
            <button
              key={s.id || `slide-${i}`}
              data-testid={`hero-slide-dot-${i}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-8' : 'bg-white/40 w-3'}`}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const { storeConfig } = useApp();
  const t = { ...defaultTexts, ...(storeConfig?.homepage_texts || {}) };
  const slides = storeConfig?.hero_slides || [];
  const steps = storeConfig?.how_to_order_steps?.length ? storeConfig.how_to_order_steps : defaultSteps;

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[78vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <HeroSlideshow slides={slides} />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-xl">
            {/* Tagline pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-5 fade-in-up">
              <Flame size={14} className="text-amber-300" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">{t.viral_pill}</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] mb-4 fade-in-up stagger-1">
              {t.hero_title_1}<br />
              <span className="bg-gradient-to-r from-[#FED7AA] to-[#FBBF24] bg-clip-text text-transparent">{t.hero_title_2}</span>
            </h1>
            <p className="font-body text-base sm:text-lg text-orange-100 mb-8 leading-relaxed fade-in-up stagger-2 max-w-md">
              {t.hero_subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 fade-in-up stagger-3">
              <button
                data-testid="hero-order-btn"
                onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-7 py-3.5 rounded-full hover:shadow-2xl hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> {t.hero_cta_primary} <ChevronRight size={16} />
              </button>
              <button
                data-testid="hero-track-btn"
                onClick={() => navigate('/buyer/track')}
                className="bg-white/10 backdrop-blur-md text-white border border-white/40 font-bold px-7 py-3.5 rounded-full hover:bg-white/20 transition-all"
              >
                {t.hero_cta_secondary}
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 mt-8 fade-in-up stagger-4">
              <div className="flex -space-x-2">
                {['👩', '👩‍🦱', '👵', '👨'].map((e, i) => (
                  <div key={`avatar-${e}-${i}`} className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-lg border-2 border-white shadow">{e}</div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-300 text-sm">
                  {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
                </div>
                <p className="text-xs text-orange-100 font-semibold">{t.social_proof_text}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to Order */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-[#78350F] mb-3">{t.how_to_order_title}</h2>
            <p className="text-[#92400E] font-body">{t.how_to_order_subtitle}</p>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${steps.length >= 3 ? 'lg:grid-cols-3' : ''} ${steps.length >= 4 ? 'xl:grid-cols-4' : ''} gap-6 lg:gap-8`}>
            {steps.map((step, i) => (
              <div key={step.id || i} className={`text-center p-8 rounded-2xl border border-[#FED7AA] bg-[#FDF8F0] fade-in-up stagger-${Math.min(i+1, 4)}`}>
                <div className="text-5xl mb-4">{step.icon}</div>
                <div className="w-8 h-8 bg-[#D97706] text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 className="font-heading text-xl font-bold text-[#78350F] mb-2">{step.title}</h3>
                <p className="text-sm text-[#92400E] font-body leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
