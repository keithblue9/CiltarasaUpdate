import React, { useState, useEffect } from 'react';
import { X, KeyRound, MapPin, Truck, Bell, BellRing, Loader2, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import { isPushSupported, getCurrentPermission, getExistingSubscription, subscribeBuyer, unsubscribeBuyer } from '../pwa/buyerPush';

export default function BuyerProfileModal({ open, onClose }) {
  const { authUser, authToken, storeConfig, changePasscode, updateProfile } = useApp();

  const [tab, setTab] = useState('profile'); // profile | passcode
  const [address, setAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [deliveryOptId, setDeliveryOptId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPc, setOldPc] = useState('');
  const [newPc, setNewPc] = useState('');
  const [confirmPc, setConfirmPc] = useState('');
  const [savingPc, setSavingPc] = useState(false);

  const [pushSupported, setPushSupported] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const deliveryOptions = storeConfig?.delivery_options || [];

  useEffect(() => {
    if (!open || !authUser) return;
    setAddress(authUser.address || '');
    setDeliveryMethod(authUser.delivery_method || '');
    setDeliveryOptId(authUser.delivery_option_id || '');
    setOldPc(''); setNewPc(''); setConfirmPc('');
    setTab('profile');
    (async () => {
      const sup = await isPushSupported();
      setPushSupported(sup);
      if (sup) {
        const perm = await getCurrentPermission();
        const sub = await getExistingSubscription();
        setPushOn(perm === 'granted' && !!sub);
      }
    })();
  }, [open, authUser]);

  if (!open || !authUser) return null;

  const chooseDelivery = (opt) => {
    const oid = opt.id || opt.name;
    if (deliveryOptId === oid) {
      // klik lagi opsi yang sama → batalkan pilihan
      setDeliveryOptId('');
      setDeliveryMethod('');
    } else {
      setDeliveryOptId(oid);
      setDeliveryMethod(opt.is_pickup ? 'pickup' : 'delivery');
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({
        address,
        delivery_method: deliveryMethod,
        delivery_option_id: deliveryOptId,
      });
      toast.success('Profil tersimpan! ✅');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan profil');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePasscode = async () => {
    if (newPc.length !== 6) { toast.error('Passcode baru harus 6 angka'); return; }
    if (newPc !== confirmPc) { toast.error('Konfirmasi passcode tidak cocok'); return; }
    setSavingPc(true);
    try {
      await changePasscode(oldPc, newPc);
      toast.success('Passcode berhasil diganti! 🔐');
      setOldPc(''); setNewPc(''); setConfirmPc('');
      setTab('profile');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal ganti passcode');
    } finally {
      setSavingPc(false);
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeBuyer();
        setPushOn(false);
        toast('Notifikasi dimatikan di HP ini.');
      } else {
        await subscribeBuyer(authToken, 'HP ' + (authUser.name || 'Buyer'));
        setPushOn(true);
        toast.success('Notifikasi aktif! Kamu akan dapat kabar saat status pesanan berubah. 🔔');
      }
    } catch (e) {
      toast.error(e.message || 'Gagal mengubah notifikasi');
    } finally {
      setPushBusy(false);
    }
  };

  const codeCls = "w-full px-4 py-3 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-bold text-xl text-center tracking-[0.4em] text-[#451A03] bg-white";
  const codeInput = (val, setter, testid) => (
    <input
      data-testid={testid}
      type="text" inputMode="numeric" maxLength={6}
      value={val}
      onChange={e => setter(e.target.value.replace(/\D/g, ''))}
      placeholder="• • • • • •"
      className={codeCls}
    />
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white flex items-center justify-between">
          <h3 className="font-heading font-bold text-lg">Pengaturan Akun</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>

        <div className="flex border-b border-[#FED7AA]">
          <button
            onClick={() => setTab('profile')}
            className={`flex-1 py-3 text-sm font-bold ${tab === 'profile' ? 'text-[#EA580C] border-b-2 border-[#EA580C]' : 'text-gray-400'}`}
          >Profil & Notif</button>
          <button
            onClick={() => setTab('passcode')}
            className={`flex-1 py-3 text-sm font-bold ${tab === 'passcode' ? 'text-[#EA580C] border-b-2 border-[#EA580C]' : 'text-gray-400'}`}
          >Ganti Passcode</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'profile' && (
            <>
              <div className="bg-[#FFF7ED] rounded-xl p-3 border border-[#FED7AA]">
                <p className="text-xs uppercase tracking-wide text-[#9A3412] font-bold">Akun</p>
                <p className="font-bold text-[#7C2D12]">{authUser.name || 'Bunda'}</p>
                <p className="text-xs text-[#9A3412]">+{authUser.phone}</p>
              </div>

              {/* Notifications */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">
                  <Bell size={13} /> Notifikasi Pesanan
                </label>
                {pushSupported ? (
                  <button
                    onClick={togglePush}
                    disabled={pushBusy}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all ${pushOn ? 'border-green-300 bg-green-50' : 'border-[#FED7AA] bg-white'}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#7C2D12]">
                      {pushOn ? <BellRing size={18} className="text-green-600" /> : <Bell size={18} className="text-[#EA580C]" />}
                      {pushOn ? 'Notifikasi aktif di HP ini' : 'Aktifkan notifikasi di HP ini'}
                    </span>
                    {pushBusy ? <Loader2 size={16} className="animate-spin text-[#EA580C]" />
                      : pushOn ? <Check size={18} className="text-green-600" /> : <span className="text-xs text-[#EA580C] font-bold">Aktifkan</span>}
                  </button>
                ) : (
                  <p className="text-xs text-gray-500 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    Browser ini belum mendukung notifikasi. Install app ke home screen dulu untuk hasil terbaik.
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">
                  <MapPin size={13} /> Alamat Pengiriman
                </label>
                <textarea
                  data-testid="profile-address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Jl. Contoh No. 123, Kelurahan, Kecamatan, Malang"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white resize-none"
                />
              </div>

              {/* Delivery method */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">
                  <Truck size={13} /> Metode Kirim Favorit
                </label>
                <div className="space-y-2">
                  {deliveryOptions.length === 0 && (
                    <p className="text-xs text-gray-500">Belum ada opsi pengiriman dari seller.</p>
                  )}
                  {deliveryOptions.map((opt) => {
                    const oid = opt.id || opt.name;
                    const active = deliveryOptId === oid;
                    return (
                      <button
                        key={oid}
                        onClick={() => chooseDelivery(opt)}
                        className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl border-2 text-left transition-all ${active ? 'border-[#EA580C] bg-[#FFF7ED]' : 'border-[#FED7AA] bg-white'}`}
                      >
                        <span className="text-sm font-semibold text-[#7C2D12]">{opt.name || opt.label}</span>
                        {active && <Check size={16} className="text-[#EA580C]" />}
                      </button>
                    );
                  })}
                </div>
                {deliveryOptId && <p className="text-[11px] text-gray-500 mt-1.5">Klik lagi opsi yang terpilih untuk membatalkan.</p>}
              </div>

              <button
                data-testid="profile-save-btn"
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {savingProfile ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : 'Simpan Profil'}
              </button>
            </>
          )}

          {tab === 'passcode' && (
            <>
              <div className="flex items-center gap-2 text-[#7C2D12]">
                <KeyRound size={18} className="text-[#EA580C]" />
                <p className="text-sm font-semibold">Ganti passcode 6 angka kamu</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Passcode Lama</label>
                {codeInput(oldPc, setOldPc, 'profile-old-passcode')}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Passcode Baru</label>
                {codeInput(newPc, setNewPc, 'profile-new-passcode')}
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase tracking-wide">Ulangi Passcode Baru</label>
                {codeInput(confirmPc, setConfirmPc, 'profile-confirm-passcode')}
              </div>
              <button
                data-testid="profile-change-passcode-btn"
                onClick={handleChangePasscode}
                disabled={savingPc}
                className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {savingPc ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : 'Ganti Passcode'}
              </button>
              <p className="text-xs text-gray-500 text-center">Lupa passcode lama? Hubungi seller untuk reset.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
