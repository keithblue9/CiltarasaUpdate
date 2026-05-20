import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { LogoWithText } from '../shared/Logo';
import { toast } from 'sonner';

export default function SellerLogin({ onLogin }) {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const ok = await onLogin(pin);
    if (!ok) {
      setError('PIN salah. Coba lagi.');
      setPin('');
    } else {
      toast.success('Selamat datang di Dashboard Ciltarasa!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#78350F] via-[#92400E] to-[#D97706] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <LogoWithText size="lg" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#78350F]">Seller Dashboard</h1>
            <p className="text-sm text-[#92400E] font-body mt-1">Masukkan PIN untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-2">PIN Dashboard</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92400E]" />
                <input
                  data-testid="seller-pin-input"
                  type={show ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Masukkan PIN"
                  className="w-full pl-10 pr-12 py-3.5 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#D97706] font-body text-[#451A03] text-center tracking-widest text-lg"
                  autoFocus
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#92400E]">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                <p data-testid="pin-error" className="text-red-500 text-xs mt-2 text-center font-semibold">{error}</p>
              )}
            </div>
            <button
              data-testid="seller-login-btn"
              type="submit"
              disabled={loading || !pin}
              className="w-full bg-[#D97706] text-white font-bold py-4 rounded-xl hover:bg-[#B45309] transition-all shadow-md disabled:opacity-60 text-lg"
            >
              {loading ? 'Memverifikasi...' : 'Masuk Dashboard'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/#/buyer" className="text-sm text-[#D97706] hover:text-[#B45309] font-semibold transition-colors">
              Lihat Toko Buyer
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
