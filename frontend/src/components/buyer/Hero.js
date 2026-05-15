import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles, Flame } from 'lucide-react';

const HERO_BG = 'https://static.prod-images.emergentagent.com/jobs/fa7f3ba8-8537-4e4d-b681-0c7370599acf/images/3fd09d3c0fc14b6148e6065a022d94002c52a9aafb799d7dda170d7445053fd9.png';

const steps = [
  { icon: '🛒', title: 'Pilih Produk', desc: 'Pilih frozen snack atau bebek favoritmu dari katalog kami.' },
  { icon: '📝', title: 'Isi Data Pesanan', desc: 'Lengkapi nama, nomor HP, dan alamat pengiriman.' },
  { icon: '🎉', title: 'Pesanan Dikirim', desc: 'Kami proses dan kirim langsung ke pintumu!' },
];

export default function Hero() {
  const navigate = useNavigate();
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[78vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="Ciltarasa Hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#451A03]/85 via-[#78350F]/55 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-xl">
            {/* Tagline pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-5 fade-in-up">
              <Flame size={14} className="text-amber-300" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Lagi Viral di Malang 🔥</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] mb-4 fade-in-up stagger-1">
              Cemilan Frozen<br />
              <span className="bg-gradient-to-r from-[#FED7AA] to-[#FBBF24] bg-clip-text text-transparent">Yang Bikin Nagih</span>
            </h1>
            <p className="font-body text-base sm:text-lg text-orange-100 mb-8 leading-relaxed fade-in-up stagger-2 max-w-md">
              Frozen snack premium & Bebek Pawon Ayu khas Malang. Tinggal goreng, anak-anak langsung suka! ✨
            </p>
            <div className="flex flex-col sm:flex-row gap-3 fade-in-up stagger-3">
              <button
                data-testid="hero-order-btn"
                onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-7 py-3.5 rounded-full hover:shadow-2xl hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                <Sparkles size={16} /> Belanja Sekarang <ChevronRight size={16} />
              </button>
              <button
                data-testid="hero-track-btn"
                onClick={() => navigate('/buyer/track')}
                className="bg-white/10 backdrop-blur-md text-white border border-white/40 font-bold px-7 py-3.5 rounded-full hover:bg-white/20 transition-all"
              >
                Lacak Pesananku
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 mt-8 fade-in-up stagger-4">
              <div className="flex -space-x-2">
                {['👩', '👩‍🦱', '👵', '👨'].map((e, i) => (
                  <div key={i} className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center text-lg border-2 border-white shadow">{e}</div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 text-amber-300 text-sm">
                  {'★★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
                </div>
                <p className="text-xs text-orange-100 font-semibold">1.200+ keluarga di Malang sudah berlangganan</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to Order */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-[#78350F] mb-3">Cara Pesan</h2>
            <p className="text-[#92400E] font-body">Mudah, cepat, dan praktis</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className={`text-center p-8 rounded-2xl border border-[#FED7AA] bg-[#FDF8F0] fade-in-up stagger-${i+1}`}>
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
