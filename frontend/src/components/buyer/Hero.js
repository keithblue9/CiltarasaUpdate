import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { LogoWithText } from '../shared/Logo';

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
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="Ciltarasa Hero" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#451A03]/80 via-[#78350F]/60 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-xl">
            <div className="mb-6 fade-in-up">
              <LogoWithText size="lg" className="mb-4" />
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 fade-in-up stagger-1">
              Cemilan Segar,<br />
              <span className="text-[#FED7AA]">Rasa Istimewa</span>
            </h1>
            <p className="font-body text-lg text-orange-100 mb-8 leading-relaxed fade-in-up stagger-2">
              Frozen snack premium & Bebek Pawon Ayu khas Malang.<br />
              Tinggal goreng, langsung nikmat!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 fade-in-up stagger-3">
              <button
                data-testid="hero-order-btn"
                onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-[#D97706] text-white font-bold px-8 py-4 rounded-full hover:bg-[#B45309] transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                Pesan Sekarang <ChevronRight size={18} />
              </button>
              <button
                data-testid="hero-track-btn"
                onClick={() => navigate('/buyer/track')}
                className="bg-white/10 backdrop-blur-sm text-white border border-white/40 font-bold px-8 py-4 rounded-full hover:bg-white/20 transition-all flex items-center justify-center gap-2"
              >
                Lacak Pesanan
              </button>
            </div>
          </div>
        </div>
        {/* Category floating cards */}
        <div className="absolute bottom-8 right-8 hidden lg:flex flex-col gap-3 fade-in-up stagger-4">
          <button
            onClick={() => {
              document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => window.dispatchEvent(new CustomEvent('filterCategory', { detail: 'snack' })), 500);
            }}
            className="bg-white/90 backdrop-blur-sm text-[#78350F] font-semibold px-6 py-3 rounded-2xl shadow-lg hover:bg-white hover:-translate-y-1 transition-all flex items-center gap-3"
          >
            <span className="text-2xl">🍟</span>
            <span>Frozen Snacks</span>
          </button>
          <button
            onClick={() => {
              document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => window.dispatchEvent(new CustomEvent('filterCategory', { detail: 'bebek' })), 500);
            }}
            className="bg-white/90 backdrop-blur-sm text-[#78350F] font-semibold px-6 py-3 rounded-2xl shadow-lg hover:bg-white hover:-translate-y-1 transition-all flex items-center gap-3"
          >
            <span className="text-2xl">🦆</span>
            <span>Bebek Pawon Ayu</span>
          </button>
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
