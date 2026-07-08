import React, { useState } from 'react';
import { Sparkles, User, ShoppingBag, ArrowRight, ArrowLeft, Loader2, KeyRound, ShieldCheck } from 'lucide-react';
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
  guest_subtitle: 'Belanja langsung tanpa daftar — cepat & praktis',
  tos_text: 'Dengan melanjutkan, kamu setuju dengan syarat & ketentuan Ciltarasa',
  otp_hint: '🔐 Masukkan passcode 6 angka kamu',
  phone_hint: '💡 Pertama kali? Kamu akan diminta buat passcode 6 angka',
};

// Reusable 6-digit input
function CodeInput({ value, onChange, testid }) {
  return (
    <input
      data-testid={testid}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder="• • • • • •"
      className="w-full px-4 py-4 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-bold text-2xl text-center tracking-[0.5em] text-[#451A03] bg-white"
    />
  );
}

export default function OnboardingModal() {
  const { authMode, isAuthed, storeConfig, checkPhone, setPasscode, login, continueAsGuest } = useApp();
  const [step, setStep] = useState('welcome'); // welcome | phone | set | passcode
  const [mode, setMode] = useState('register'); // register | login
  const [form, setForm] = useState({ name: '', phone: '', passcode: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const t = { ...DEFAULT_TEXTS, ...(storeConfig?.onboarding_texts || {}) };

  const showModal = !isAuthed && authMode !== 'guest';
  if (!showModal) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCheckPhone = async () => {
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
      const res = await checkPhone(form.phone, mode === 'register' ? form.name : undefined);
      if (res.name && !form.name) set('name', res.name);
      set('passcode', '');
      set('confirm', '');
      if (res.has_passcode) {
        setStep('passcode');
      } else {
        setStep('set');
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal memproses nomor');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPasscode = async () => {
    if (form.passcode.length !== 6) {
      toast.error('Passcode harus 6 angka');
      return;
    }
    if (form.passcode !== form.confirm) {
      toast.error('Konfirmasi passcode tidak cocok');
      return;
    }
    setLoading(true);
    try {
      await setPasscode(form.phone, form.passcode, form.name || undefined);
      toast.success(`Passcode dibuat! Selamat datang${form.name ? ', ' + form.name : ''}! 🎉`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal membuat passcode');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (form.passcode.length !== 6) {
      toast.error('Masukkan 6 angka passcode');
      return;
    }
    setLoading(true);
    try {
      await login(form.phone, form.passcode);
      toast.success('Berhasil masuk! 🎉');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Passcode salah');
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

              <p className="text-center text-xs text-[#9A3412] pt-1">Baru pertama & bingung? Langsung pesan aja tanpa daftar 👇</p>
              <button
                data-testid="onboarding-guest-btn"
                onClick={handleGuest}
                className="w-full group flex items-center gap-3 p-4 rounded-2xl border-2 border-[#D97706] bg-[#FFF7ED] hover:bg-[#FEF3C7] transition-all relative shadow-sm"
              >
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-[#D97706] text-white px-2 py-0.5 rounded-full shadow">✨ Paling Gampang</span>
                <div className="w-10 h-10 bg-[#FED7AA] rounded-xl flex items-center justify-center">
                  <ShoppingBag size={18} className="text-[#EA580C]" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-sm text-[#7C2D12]">{t.guest_label}</div>
                  <div className="text-xs text-[#9A3412]">{t.guest_subtitle}</div>
                </div>
                <ArrowRight size={18} className="text-[#EA580C] group-hover:translate-x-1 transition-transform" />
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
                <p className="text-sm text-[#9A3412]">Masukkan nomor HP kamu untuk lanjut</p>
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
                data-testid="onboarding-continue-btn"
                onClick={handleCheckPhone}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Memproses...</> : <>Lanjut <ArrowRight size={18} /></>}
              </button>

              <p className="text-center text-xs text-gray-500">
                {mode === 'register' ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
                <button
                  onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                  className="text-[#EA580C] font-bold hover:underline"
                >
                  {mode === 'register' ? 'Masuk di sini' : 'Daftar di sini'}
                </button>
              </p>
            </div>
          )}

          {step === 'set' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('phone')}
                className="flex items-center gap-1 text-sm text-[#9A3412] hover:text-[#EA580C] font-semibold"
              >
                <ArrowLeft size={16} /> Ganti nomor
              </button>
              <div>
                <h2 className="font-heading text-xl font-bold text-[#7C2D12] mb-1 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-[#EA580C]" /> Buat Passcode
                </h2>
                <p className="text-sm text-[#9A3412]">
                  Buat passcode 6 angka untuk nomor <span className="font-bold">+62{form.phone}</span>. Passcode ini dipakai untuk login berikutnya.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Passcode Baru (6 angka)</label>
                <CodeInput testid="onboarding-passcode-input" value={form.passcode} onChange={v => set('passcode', v)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Ulangi Passcode</label>
                <CodeInput testid="onboarding-passcode-confirm" value={form.confirm} onChange={v => set('confirm', v)} />
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-800">🔐 Ingat baik-baik passcode kamu ya. Kalau lupa, hubungi seller untuk reset.</p>
              </div>

              <button
                data-testid="onboarding-set-passcode-btn"
                onClick={handleSetPasscode}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <>Simpan & Masuk <ArrowRight size={18} /></>}
              </button>
            </div>
          )}

          {step === 'passcode' && (
            <div className="space-y-4">
              <button
                onClick={() => setStep('phone')}
                className="flex items-center gap-1 text-sm text-[#9A3412] hover:text-[#EA580C] font-semibold"
              >
                <ArrowLeft size={16} /> Ganti nomor
              </button>
              <div>
                <h2 className="font-heading text-xl font-bold text-[#7C2D12] mb-1 flex items-center gap-2">
                  <KeyRound size={20} className="text-[#EA580C]" /> Masukkan Passcode
                </h2>
                <p className="text-sm text-[#9A3412]">
                  Masukkan passcode 6 angka untuk <span className="font-bold">+62{form.phone}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Passcode</label>
                <CodeInput testid="onboarding-login-passcode-input" value={form.passcode} onChange={v => set('passcode', v)} />
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs text-blue-800">{t.otp_hint}</p>
                </div>
              </div>

              <button
                data-testid="onboarding-login-btn-submit"
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Memverifikasi...</> : <>Masuk <ArrowRight size={18} /></>}
              </button>

              <p className="text-center text-xs text-gray-500">
                Lupa passcode?{' '}
                <button
                  onClick={() => toast('Hubungi seller lewat WhatsApp untuk reset passcode kamu ya 🙏', { icon: '🔑' })}
                  className="text-[#EA580C] font-bold hover:underline"
                >
                  Reset lewat seller
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
