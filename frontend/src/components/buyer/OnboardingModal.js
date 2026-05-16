import React, { useState } from 'react';
import { Sparkles, MessageCircle, User, ShoppingBag, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';

const HERO_FOOD = 'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=800&q=80';

const DEFAULT_TEXTS = {
  header_title: 'Halo, Bunda! 🦆',
  header_subtitle: 'Frozen Food premium yang lagi viral di Malang',
  welcome_title: 'Yuk, mulai belanja!',
  welcome_subtitle: 'Daftar dulu untuk akses promo eksklusif & tracking pesanan yang gampang banget ✨',
  register_label: 'Daftar Sekarang',
  register_subtitle: 'Dapatkan poin & promo special',
  login_label: 'Masuk',
  login_subtitle: 'Sudah punya akun? Masuk yuk',
  guest_label: 'Lanjut sebagai Tamu',
  guest_subtitle: 'Belanja tanpa daftar (no promo)',
  tos_text: 'Dengan melanjutkan, kamu setuju dengan syarat & ketentuan Ciltarasa',
  otp_hint: '📱 Cek WhatsApp kamu untuk lihat kode OTP yang dikirim',
  phone_hint: '💡 Pastikan nomor WhatsApp aktif untuk terima kode OTP',
};

export default function OnboardingModal() {
  const { authMode, isAuthed, storeConfig, requestOtp, verifyOtp, continueAsGuest } = useApp();
  const [step, setStep] = useState('welcome'); // welcome | phone | otp
  const [mode, setMode] = useState('register'); // register | login
  const [form, setForm] = useState({ name: '', phone: '', otp: '' });
  const [loading, setLoading] = useState(false);

  const t = { ...DEFAULT_TEXTS, ...(storeConfig?.onboarding_texts || {}) };

  const showModal = !isAuthed && authMode !== 'guest';
  if (!showModal) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRequestOtp = async () => {
    if (!form.phone || form.phone.length < 9) {
      toast.error('Nomor HP tidak valid');
      return;
    }
    if (mode === 'register' && !form.name) {
      toast.error('Nama wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const res = await requestOtp(form.phone, mode === 'register' ? form.name : undefined);
      toast.success(res.message || 'Kode OTP terkirim!');
      setStep('otp');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal kirim OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (form.otp.length !== 6) {
      toast.error('Masukkan 6 digit kode OTP');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(form.phone, form.otp, mode === 'register' ? form.name : undefined);
      toast.success(`Selamat datang${form.name ? ', ' + form.name : ''}! 🎉`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'OTP salah');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    toast('Lanjut sebagai tamu. Kamu bisa daftar nanti! 👋', { icon: '✨' });
  };

  return (
    <div data-testid="onboarding-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="relative w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl overflow-hidden bg-gradient-to-br from-[#FFF7ED] via-white to-[#FEF3C7] shadow-2xl flex flex-col">
        <div className="relative h-32 sm:h-40 overflow-hidden bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#EA580C]">
          <SmartImage src={HERO_FOOD} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-yellow-200" />
              <span className="text-xs uppercase tracking-widest text-yellow-100 font-bold">Ciltarasa</span>
              <Sparkles size={18} className="text-yellow-200" />
            </div>
            <h1 data-testid="onboarding-header-title" className="font-heading text-2xl sm:text-3xl font-extrabold text-white drop-shadow-lg">
              {t.header_title}
            </h1>
            <p data-testid="onboarding-header-subtitle" className="text-xs sm:text-sm text-orange-100 mt-1 font-medium">{t.header_subtitle}</p>
          </div>
        </div>

        <div className="flex-1 px-6 sm:px-8 py-6 sm:py-8 overflow-y-auto">
          {step === 'welcome' && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 data-testid="onboarding-welcome-title" className="font-heading text-xl font-bold text-[#7C2D12] mb-1">{t.welcome_title}</h2>
                <p data-testid="onboarding-welcome-subtitle" className="text-sm text-[#9A3412]">{t.welcome_subtitle}</p>
              </div>

              <button
                data-testid="onboarding-register-btn"
                onClick={() => { setMode('register'); setStep('phone'); }}
                className="w-full group flex items-center gap-3 p-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-base">{t.register_label}</div>
                  <div className="text-xs text-orange-100">{t.register_subtitle}</div>
                </div>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                data-testid="onboarding-login-btn"
                onClick={() => { setMode('login'); setStep('phone'); }}
                className="w-full group flex items-center gap-3 p-4 bg-white border-2 border-[#FED7AA] text-[#7C2D12] rounded-2xl hover:border-[#F97316] hover:bg-[#FFF7ED] transition-all"
              >
                <div className="w-10 h-10 bg-[#FEF3C7] rounded-xl flex items-center justify-center">
                  <User size={20} className="text-[#EA580C]" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-base">{t.login_label}</div>
                  <div className="text-xs text-[#9A3412]">{t.login_subtitle}</div>
                </div>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                data-testid="onboarding-guest-btn"
                onClick={handleGuest}
                className="w-full group flex items-center gap-3 p-3 text-[#78350F] hover:bg-[#FEF3C7] rounded-2xl transition-all"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={18} className="text-gray-500" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-sm">{t.guest_label}</div>
                  <div className="text-xs text-gray-500">{t.guest_subtitle}</div>
                </div>
              </button>

              <div className="text-center pt-2">
                <p className="text-[10px] text-gray-400">{t.tos_text}</p>
              </div>
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('welcome')}
                className="flex items-center gap-1 text-sm text-[#9A3412] hover:text-[#EA580C] font-semibold"
              >
                <ArrowLeft size={16} /> Kembali
              </button>
              <div>
                <h2 className="font-heading text-xl font-bold text-[#7C2D12] mb-1">
                  {mode === 'register' ? 'Daftar Akun Baru' : 'Masuk ke Akunmu'}
                </h2>
                <p className="text-sm text-[#9A3412]">Kami akan kirim kode OTP ke WhatsApp kamu</p>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">Nama Lengkap</label>
                  <input
                    data-testid="onboarding-name-input"
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Bunda Siti"
                    className="w-full px-4 py-3 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">Nomor WhatsApp</label>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#FED7AA] bg-white focus-within:border-[#F97316]">
                  <span className="text-[#9A3412] font-semibold text-sm">+62</span>
                  <input
                    data-testid="onboarding-phone-input"
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, ''))}
                    placeholder="81234567890"
                    className="flex-1 outline-none font-body text-[#451A03] bg-transparent"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">{t.phone_hint}</p>
              </div>

              <button
                data-testid="onboarding-send-otp-btn"
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Mengirim...</> : <><MessageCircle size={18} /> Kirim Kode OTP</>}
              </button>

              <p className="text-center text-xs text-gray-500">
                Belum punya akun?{' '}
                <button
                  onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                  className="text-[#EA580C] font-bold hover:underline"
                >
                  {mode === 'register' ? 'Masuk di sini' : 'Daftar di sini'}
                </button>
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('phone')}
                className="flex items-center gap-1 text-sm text-[#9A3412] hover:text-[#EA580C] font-semibold"
              >
                <ArrowLeft size={16} /> Ganti nomor
              </button>
              <div>
                <h2 className="font-heading text-xl font-bold text-[#7C2D12] mb-1">Cek WhatsApp Kamu! 📱</h2>
                <p className="text-sm text-[#9A3412]">
                  Kode OTP sudah dikirim ke nomor <span className="font-bold">+62{form.phone}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Masukkan 6 Digit Kode OTP</label>
                <input
                  data-testid="onboarding-otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.otp}
                  onChange={e => set('otp', e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full px-4 py-4 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-bold text-2xl text-center tracking-[0.5em] text-[#451A03] bg-white"
                />
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-800">{t.otp_hint}</p>
                </div>
              </div>

              <button
                data-testid="onboarding-verify-btn"
                onClick={handleVerify}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Memverifikasi...</> : <>Verifikasi & Masuk <ArrowRight size={18} /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
