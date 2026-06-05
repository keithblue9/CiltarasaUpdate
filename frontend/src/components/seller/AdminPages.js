import React, { useState, useEffect } from 'react';
import { Save, Send, AlertTriangle, MessageCircle, ListOrdered, Trash2, Plus, RotateCcw, ShieldAlert, KeyRound, Eye, EyeOff, Lock, TrendingUp, Users, Smartphone, Globe, Monitor, RefreshCw, Target, MessagesSquare, FileText, ChevronDown, ChevronUp, Copy, Check, Type } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#FED7AA] flex items-center justify-between bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-white">
            <Icon size={18} />
          </div>
          <h3 className="font-heading font-bold text-[#7C2D12]">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── FONNTE WHATSAPP CONFIG ──────────────────────────────────────
export function FonnteConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [form, setForm] = useState({ fonnte_token: '', seller_notify_phone: '', wa_notif_enabled: true });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTarget, setTestTarget] = useState('');
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    if (storeConfig) {
      setForm({
        fonnte_token: storeConfig.fonnte_token || '',
        seller_notify_phone: storeConfig.seller_notify_phone || '',
        wa_notif_enabled: storeConfig.wa_notif_enabled !== false,
      });
      setTestTarget(storeConfig.seller_notify_phone || '');
    }
  }, [storeConfig]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const checkDeviceStatus = async () => {
    setCheckingStatus(true);
    try {
      const r = await axios.get(`${API}/api/admin/fonnte-status`);
      setDeviceStatus(r.data);
    } catch (e) {
      setDeviceStatus({ ok: false, connected: false, reason: 'Klik Cek Status untuk update' });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, form);
      await refreshStoreConfig();
      toast.success('Konfigurasi WhatsApp tersimpan! 📱');
      // Auto-check device status setelah simpan token baru
      setTimeout(() => checkDeviceStatus(), 500);
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testTarget) { toast.error('Masukkan nomor target dulu'); return; }
    setTesting(true);
    try {
      const r = await axios.post(`${API}/api/admin/test-wa`, { target: testTarget });
      if (r.data?.ok) {
        toast.success('✅ Notif WA terkirim! Cek WhatsApp tujuan.');
      } else if (r.data?.skipped) {
        toast.error(`Skipped: ${r.data.reason}`);
      } else {
        const reason = r.data?.response?.reason || r.data?.error || 'Unknown error';
        toast.error(`Gagal: ${reason}`, { duration: 6000 });
      }
    } catch (e) {
      toast.error('Error koneksi ke server');
    } finally {
      setTesting(false);
    }
  };

  // Auto-check status saat mount jika token sudah ada
  useEffect(() => {
    if (storeConfig?.fonnte_token) {
      checkDeviceStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeConfig?.fonnte_token]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">WhatsApp Settings (Fonnte API)</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Konfigurasi Fonnte API untuk kirim OTP login + notif pesanan otomatis ke seller & buyer.</p>
        </div>
        <button data-testid="save-fonnte-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>

      {/* Real-time Device Status Badge */}
      <div data-testid="fonnte-device-status" className={`rounded-2xl border-2 p-4 flex items-center justify-between gap-3 flex-wrap ${
        deviceStatus?.connected ? 'border-green-300 bg-green-50' :
        deviceStatus && !deviceStatus.connected ? 'border-red-300 bg-red-50' :
        'border-[#FED7AA] bg-[#FFF7ED]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            deviceStatus?.connected ? 'bg-green-500 animate-pulse' :
            deviceStatus && !deviceStatus.connected ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          <div>
            <p className="font-bold text-[#7C2D12] text-sm">
              Status Device Fonnte:&nbsp;
              {checkingStatus ? <span className="text-gray-500">Mengecek...</span> :
                deviceStatus?.connected ? <span className="text-green-700">Terhubung ✅</span> :
                deviceStatus ? <span className="text-red-700">Terputus ❌</span> :
                <span className="text-gray-500">Belum dicek</span>
              }
            </p>
            {deviceStatus && (
              <p className="text-xs text-[#9A3412] mt-0.5">
                {deviceStatus.connected ?
                  <>Device: <strong>{deviceStatus.device}</strong> · Quota: <strong>{deviceStatus.quota ?? '—'}</strong> · Sent: <strong>{deviceStatus.messages ?? '—'}</strong></> :
                  <>{deviceStatus.reason || 'Device disconnected. Scan ulang QR di fonnte.com'}</>
                }
              </p>
            )}
          </div>
        </div>
        <button data-testid="check-fonnte-status-btn" onClick={checkDeviceStatus} disabled={checkingStatus || !form.fonnte_token} className="flex items-center gap-2 bg-white border border-[#FED7AA] text-[#7C2D12] font-bold px-4 py-2 rounded-xl hover:bg-[#FFF7ED] disabled:opacity-50 text-sm">
          <RefreshCw size={14} className={checkingStatus ? 'animate-spin' : ''} /> Cek Status
        </button>
      </div>

      <Section title="Kredensial Fonnte" icon={MessageCircle}>
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-[#FED7AA] bg-[#FFF7ED] cursor-pointer">
            <input type="checkbox" checked={form.wa_notif_enabled} onChange={e => set('wa_notif_enabled', e.target.checked)} className="w-5 h-5 accent-[#EA580C]" />
            <div>
              <p className="font-bold text-[#7C2D12] text-sm">Aktifkan Notifikasi WhatsApp</p>
              <p className="text-xs text-[#9A3412]">Jika nonaktif, OTP akan kembali ke mode simulasi (kode 123456) & notif pesanan tidak terkirim.</p>
            </div>
          </label>

          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">Fonnte API Token</label>
            <input data-testid="fonnte-token-input" type="password" className={inputCls} value={form.fonnte_token} onChange={e => set('fonnte_token', e.target.value)} placeholder="Token dari fonnte.com → Device → Token" />
            <p className="text-[11px] text-gray-500 mt-1">Dapatkan dari dashboard <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-[#EA580C] font-bold hover:underline">fonnte.com</a> → klik Device → Token. Pastikan device sudah scan QR.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">Nomor WhatsApp Penerima Notif Seller</label>
            <input data-testid="seller-notify-phone-input" className={inputCls} value={form.seller_notify_phone} onChange={e => set('seller_notify_phone', e.target.value)} placeholder="6285249682337" />
            <p className="text-[11px] text-gray-500 mt-1">Format: 62xxx (tanpa +). Notif pesanan baru akan dikirim ke nomor ini.</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-900">
              <strong>Setup Fonnte:</strong> Login di fonnte.com → Buat Device → Scan QR pakai HP WhatsApp toko → Copy Token ke sini. Pastikan HP tetap online untuk kirim pesan.
            </div>
          </div>
        </div>
      </Section>

      <Section title="Tes Kirim WhatsApp" icon={Send}>
        <div className="space-y-3">
          <p className="text-xs text-[#9A3412]">Tes apakah token & device sudah terkonfigurasi dengan benar. Pesan tes akan dikirim ke nomor di bawah.</p>
          <div className="flex gap-2">
            <input data-testid="test-target-input" className={inputCls + ' flex-1'} value={testTarget} onChange={e => setTestTarget(e.target.value)} placeholder="6285249682337" />
            <button data-testid="send-test-wa-btn" onClick={handleTest} disabled={testing || !form.fonnte_token} className="flex items-center gap-2 bg-green-500 text-white font-bold px-4 py-2.5 rounded-xl shadow hover:bg-green-600 disabled:opacity-50">
              <Send size={14} /> {testing ? 'Mengirim...' : 'Kirim Test'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─── HOW TO ORDER STEPS ──────────────────────────────────────────
export function HowToOrderConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSteps(storeConfig?.how_to_order_steps || []);
  }, [storeConfig]);

  const add = () => setSteps([...steps, { id: 's-' + Date.now(), icon: '🎯', title: '', desc: '' }]);
  const update = (idx, k, v) => { const u = [...steps]; u[idx] = { ...u[idx], [k]: v }; setSteps(u); };
  const remove = (idx) => setSteps(steps.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { how_to_order_steps: steps });
      await refreshStoreConfig();
      toast.success('Step "Cara Pesan" tersimpan!');
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Cara Pesan (Steps)</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Edit langkah-langkah "Cara Pesan" yang tampil di buyer homepage.</p>
        </div>
        <button data-testid="save-howto-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>

      <Section title="Langkah Cara Pesan" icon={ListOrdered} action={<button data-testid="add-step-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah Step</button>}>
        <p className="text-[11px] text-gray-500 mb-3">Tip: gunakan emoji untuk icon. Pakai bahasa singkat & jelas. Best practice 3-4 steps.</p>
        <div className="space-y-2">
          {steps.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Belum ada step. Klik "Tambah Step" untuk mulai.</p>}
          {steps.map((s, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
              <div className="col-span-2 text-center">
                <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Icon (Emoji)</label>
                <input className={inputCls + ' text-center text-2xl'} value={s.icon || ''} onChange={e => update(idx, 'icon', e.target.value)} maxLength={4} />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Judul Step #{idx + 1}</label>
                <input data-testid={`step-title-${idx}`} className={inputCls} value={s.title || ''} onChange={e => update(idx, 'title', e.target.value)} placeholder="Pilih Produk" />
              </div>
              <div className="col-span-6">
                <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Deskripsi</label>
                <input data-testid={`step-desc-${idx}`} className={inputCls} value={s.desc || ''} onChange={e => update(idx, 'desc', e.target.value)} placeholder="Penjelasan singkat tentang step ini" />
              </div>
              <button onClick={() => remove(idx)} className="col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── RESET CUSTOMERS ─────────────────────────────────────────────
export function ResetCustomersConfig() {
  const { refreshPurchases } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleReset = async () => {
    if (confirmText !== 'RESET') { toast.error('Ketik RESET untuk konfirmasi'); return; }
    if (!window.confirm('YAKIN hapus data? Ini permanen dan tidak bisa dibatalkan.')) return;
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/admin/reset-customers`, { confirm: 'RESET', scope });
      setLastResult(r.data.deleted);
      setConfirmText('');
      toast.success(`Berhasil hapus ${r.data.deleted.orders} order, ${r.data.deleted.users} user, ${r.data.deleted.reviews} review`);
      // Force reload to get fresh data
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error('Gagal: ' + (e.response?.data?.detail || 'error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Reset Data Pelanggan</h1>
        <p className="text-xs text-[#9A3412] mt-0.5">Hapus pesanan dummy / user testing biar dashboard bersih sebelum mulai operasi production.</p>
      </div>

      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-red-900 text-lg">⚠️ Operasi Berbahaya</h3>
            <p className="text-sm text-red-700 mt-0.5">Aksi ini permanent menghapus data. Tidak bisa di-undo. Hati-hati.</p>
          </div>
        </div>

        <div className="space-y-3 bg-white rounded-xl p-4 border border-red-200">
          <div>
            <label className="block text-xs font-bold text-red-900 mb-1.5 uppercase">Pilih Scope Reset</label>
            <select className={inputCls + ' border-red-300'} value={scope} onChange={e => setScope(e.target.value)}>
              <option value="all">Hapus SEMUA (orders + users + reviews)</option>
              <option value="orders">Hanya hapus orders + reviews (user tetap)</option>
              <option value="users">Hanya hapus users (orders tetap)</option>
            </select>
            <p className="text-[11px] text-gray-600 mt-1">
              {scope === 'all' && '🗑️ Akan hapus: semua pesanan, semua user/pelanggan, semua review. Sold count produk juga di-reset ke 0.'}
              {scope === 'orders' && '🗑️ Akan hapus: semua pesanan & review. Akun pelanggan tetap ada.'}
              {scope === 'users' && '🗑️ Akan hapus: semua akun pelanggan. Pesanan tetap ada (sebagai history).'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-red-900 mb-1.5 uppercase">Ketik <code className="bg-red-100 px-1 rounded">RESET</code> untuk konfirmasi</label>
            <input
              data-testid="reset-confirm-input"
              className={inputCls + ' border-red-300 font-mono text-center font-extrabold'}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder="RESET"
            />
          </div>

          <button
            data-testid="reset-customers-btn"
            onClick={handleReset}
            disabled={loading || confirmText !== 'RESET'}
            className="w-full bg-gradient-to-r from-red-500 to-red-700 text-white font-bold py-3 rounded-xl shadow hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} /> {loading ? 'Menghapus...' : 'Hapus Data Sekarang'}
          </button>
        </div>

        {lastResult && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
            <p className="font-bold text-green-900">✅ Berhasil dihapus:</p>
            <p className="text-green-700 text-xs mt-1">{lastResult.orders} orders, {lastResult.users} users, {lastResult.reviews} reviews</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── CHANGE SELLER PIN ───────────────────────────────────────────
export function ChangePinConfig({ onPinChanged }) {
  const [form, setForm] = useState({ current_pin: '', new_pin: '', confirm_pin: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (k) => setShow(s => ({ ...s, [k]: !s[k] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.current_pin || !form.new_pin) { toast.error('Semua field wajib diisi'); return; }
    if (form.new_pin.length < 4) { toast.error('PIN baru minimal 4 karakter'); return; }
    if (form.new_pin !== form.confirm_pin) { toast.error('Konfirmasi PIN tidak cocok'); return; }
    if (form.new_pin === form.current_pin) { toast.error('PIN baru harus berbeda dari PIN saat ini'); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/api/admin/change-pin`, { current_pin: form.current_pin, new_pin: form.new_pin });
      if (r.data?.success) {
        setSuccess(true);
        toast.success('PIN berhasil diubah! Kamu akan logout dalam 3 detik...');
        setTimeout(() => {
          onPinChanged?.();
        }, 3000);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal ubah PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Ubah PIN Akses Seller</h1>
        <p className="text-xs text-[#9A3412] mt-0.5">Ganti PIN dashboard secara berkala biar akun lebih aman.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>Penting:</strong> Setelah PIN diubah, kamu akan otomatis logout. Login lagi dengan PIN baru. Pastikan kamu ingat — kalau lupa, hubungi admin sistem untuk reset via environment variable.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[#FED7AA] rounded-2xl p-5 space-y-4">
        {[
          { key: 'current_pin', toggleKey: 'current', label: 'PIN Saat Ini', placeholder: 'Masukkan PIN sekarang', testid: 'current-pin-input' },
          { key: 'new_pin', toggleKey: 'next', label: 'PIN Baru', placeholder: 'Min 4 karakter', testid: 'new-pin-input' },
          { key: 'confirm_pin', toggleKey: 'confirm', label: 'Konfirmasi PIN Baru', placeholder: 'Ulangi PIN baru', testid: 'confirm-pin-input' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">{f.label}</label>
            <div className="relative">
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9A3412]" />
              <input
                data-testid={f.testid}
                type={show[f.toggleKey] ? 'text' : 'password'}
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                disabled={success}
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 rounded-xl border-2 border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] tracking-wider disabled:opacity-60"
              />
              <button type="button" onClick={() => toggle(f.toggleKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9A3412]">
                {show[f.toggleKey] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ))}

        <button
          data-testid="submit-change-pin-btn"
          type="submit"
          disabled={loading || success || !form.current_pin || !form.new_pin || !form.confirm_pin}
          className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          <KeyRound size={16} /> {loading ? 'Mengubah PIN...' : success ? '✅ Berhasil! Logout...' : 'Ubah PIN Sekarang'}
        </button>
      </form>
    </div>
  );
}

// ─── TRAFFIC STATS ────────────────────────────────────────────────
const formatNum = (n) => Number(n || 0).toLocaleString('id-ID');
const SOURCE_ICONS = { direct: '🌐', google: '🔍', instagram: '📷', facebook: '👤', tiktok: '🎵', whatsapp: '💬', shopee: '🛍️', internal: '🏠', other: '🔗' };
const DEVICE_ICONS = { ios: '🍎', android: '🤖', desktop: '💻', other: '📱', unknown: '❓' };
const DEVICE_LABELS = { ios: 'iPhone / iPad', android: 'Android', desktop: 'Desktop', other: 'Lainnya', unknown: 'Tidak diketahui' };

function StatCard({ icon: Icon, label, value, sublabel, color = 'orange' }) {
  const colors = {
    orange: 'from-[#F97316] to-[#EA580C]',
    blue: 'from-blue-500 to-cyan-500',
    purple: 'from-purple-500 to-pink-500',
    green: 'from-green-500 to-emerald-500',
  };
  return (
    <div className="bg-white border border-[#FED7AA] rounded-2xl p-4 hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#9A3412] font-bold">{label}</p>
          {sublabel && <p className="text-[10px] text-gray-500">{sublabel}</p>}
        </div>
      </div>
      <p className="text-2xl font-extrabold text-[#7C2D12]">{typeof value === 'string' ? value : formatNum(value)}</p>
    </div>
  );
}

export function TrafficStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Date range filter (defaults: last 30d)
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [preset, setPreset] = useState('30d');

  const fetchStats = async (from = fromDate, to = toDate) => {
    try {
      const r = await axios.get(`${API}/api/analytics/stats`, { params: { from_date: from, to_date: to } });
      setStats(r.data);
    } catch {
      toast.error('Gagal memuat statistik');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); /* eslint-disable-next-line */ }, []);

  const applyPreset = (p) => {
    const now = new Date();
    let from = monthAgo;
    if (p === '7d') from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    else if (p === '30d') from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    else if (p === '90d') from = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    else if (p === 'today') from = today;
    const to = now.toISOString().slice(0, 10);
    setPreset(p);
    setFromDate(from); setToDate(to);
    setRefreshing(true);
    fetchStats(from, to);
  };

  const applyCustom = () => {
    setPreset('custom');
    setRefreshing(true);
    fetchStats(fromDate, toDate);
  };

  const refresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return <div className="text-center py-12 text-[#9A3412]">Memuat statistik pengunjung...</div>;
  }
  if (!stats) return null;

  const maxSource = Math.max(1, ...stats.sources.map(s => s.count));
  const maxDevice = Math.max(1, ...stats.devices.map(d => d.count));

  const presetBtn = (id, label) => (
    <button
      key={id}
      data-testid={`range-preset-${id}`}
      onClick={() => applyPreset(id)}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
        preset === id ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow' : 'bg-white border border-[#FED7AA] text-[#7C2D12] hover:bg-[#FEF3C7]'
      }`}
    >{label}</button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Statistik Pengunjung</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Pantau pengunjung & konversi ke order dengan filter rentang tanggal.</p>
        </div>
        <button data-testid="refresh-traffic-btn" onClick={refresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#FED7AA] text-[#7C2D12] font-bold text-xs hover:bg-[#FFF7ED] disabled:opacity-60">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white border border-[#FED7AA] rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {presetBtn('today', 'Hari Ini')}
          {presetBtn('7d', '7 Hari')}
          {presetBtn('30d', '30 Hari')}
          {presetBtn('90d', '90 Hari')}
        </div>
        <div className="flex-1 min-w-[260px] flex items-center gap-2 flex-wrap justify-end">
          <input
            data-testid="range-from-input"
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border-2 border-[#FED7AA] text-xs font-bold text-[#7C2D12] focus:outline-none focus:border-[#F97316]"
          />
          <span className="text-[#9A3412] text-xs">→</span>
          <input
            data-testid="range-to-input"
            type="date"
            value={toDate}
            min={fromDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border-2 border-[#FED7AA] text-xs font-bold text-[#7C2D12] focus:outline-none focus:border-[#F97316]"
          />
          <button
            data-testid="range-apply-btn"
            onClick={applyCustom}
            className="px-3 py-1.5 rounded-lg bg-[#7C2D12] text-white text-xs font-bold hover:bg-[#6B0F1A]"
          >Terapkan</button>
        </div>
      </div>

      {/* Range info banner */}
      <div className="text-[11px] text-[#9A3412] -mt-2 px-1">
        Menampilkan data <strong>{stats.range_from}</strong> sampai <strong>{stats.range_to}</strong>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Pengunjung (rentang)" sublabel={`${stats.range_from} - ${stats.range_to}`} value={stats.range_visits} color="orange" />
        <StatCard icon={Users} label="Order (rentang)" sublabel="exclude dibatalkan" value={stats.range_orders} color="blue" />
        <StatCard icon={Target} label="Konversi Rentang" sublabel={`${stats.range_orders}/${stats.range_visits} order`} value={`${stats.conversion_rate}%`} color="purple" />
        <StatCard icon={Smartphone} label="Total Pengunjung" sublabel={`Konversi all-time: ${stats.overall_conversion_rate}%`} value={stats.total_visits} color="green" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Hari Ini" value={stats.today_visits} color="orange" />
        <StatCard icon={Users} label="7 Hari Terakhir" value={stats.week_visits} color="blue" />
        <StatCard icon={Globe} label="30 Hari Terakhir" value={stats.month_visits} color="purple" />
      </div>

      <div className="bg-white border border-[#FED7AA] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-[#7C2D12]">Trend Pengunjung</h3>
            <p className="text-[11px] text-[#9A3412]">Jumlah pengunjung unik per hari dalam rentang</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-[#9A3412] font-bold">Total Hits</p>
            <p className="text-lg font-extrabold text-[#EA580C]">{formatNum(stats.total_hits)}</p>
          </div>
        </div>
        <div data-testid="traffic-chart" style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.daily} margin={{ top: 5, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FED7AA" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="#9A3412" fontSize={10} />
              <YAxis stroke="#9A3412" fontSize={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #FED7AA', fontSize: 12 }}
                labelFormatter={(l) => `Tanggal ${l}`}
                formatter={(v) => [`${v} pengunjung`, '']}
              />
              <Line type="monotone" dataKey="visits" stroke="#EA580C" strokeWidth={3} dot={{ fill: '#F97316', r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-[#FED7AA] rounded-2xl p-5">
          <h3 className="font-heading font-bold text-[#7C2D12] mb-3 flex items-center gap-2"><Globe size={16} /> Sumber Pengunjung (rentang)</h3>
          {stats.sources.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Belum ada data sumber dalam rentang ini.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.sources.slice(0, 8).map((s) => (
                <div key={s.source} className="flex items-center gap-3" data-testid={`source-${s.source}`}>
                  <span className="text-lg w-6 text-center">{SOURCE_ICONS[s.source] || '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-[#7C2D12] text-sm truncate capitalize">{s.source}</span>
                      <span className="text-xs font-extrabold text-[#EA580C]">{formatNum(s.count)}</span>
                    </div>
                    <div className="h-1.5 bg-[#FEF3C7] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full" style={{ width: `${(s.count / maxSource) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#FED7AA] rounded-2xl p-5">
          <h3 className="font-heading font-bold text-[#7C2D12] mb-3 flex items-center gap-2"><Monitor size={16} /> Device Pengunjung (rentang)</h3>
          {stats.devices.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Belum ada data device dalam rentang ini.</p>
          ) : (
            <div className="space-y-2.5">
              {stats.devices.map((d) => (
                <div key={d.device} className="flex items-center gap-3" data-testid={`device-${d.device}`}>
                  <span className="text-lg w-6 text-center">{DEVICE_ICONS[d.device] || '📱'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-[#7C2D12] text-sm">{DEVICE_LABELS[d.device] || d.device}</span>
                      <span className="text-xs font-extrabold text-[#EA580C]">{formatNum(d.count)}</span>
                    </div>
                    <div className="h-1.5 bg-[#FEF3C7] rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-full" style={{ width: `${(d.count / maxDevice) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 text-xs text-green-900 flex items-center gap-2">
            <Smartphone size={14} className="text-green-600" />
            <span><strong>{formatNum(stats.pwa_visits)}</strong> pengunjung sudah <strong>install PWA</strong> 🎉</span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── AUTO-CHAT CONFIG (FASE 3) ────────────────────────────────────
const STAGE_META = [
  { key: 'menunggu', label: 'Pesanan Diterima (Menunggu)', icon: '📋', desc: 'Saat order baru dibuat buyer. Notif untuk seller (default ON) & opsional buyer.' },
  { key: 'diproses', label: 'Diproses', icon: '👨‍🍳', desc: 'Saat seller mengubah status ke "Diproses".' },
  { key: 'siap', label: 'Siap Diambil/Dikirim', icon: '📦', desc: 'Saat pesanan siap diambil atau dikirim.' },
  { key: 'selesai', label: 'Selesai', icon: '🎉', desc: 'Saat pesanan sudah sampai/selesai.' },
  { key: 'dibatalkan', label: 'Dibatalkan', icon: '❌', desc: 'Saat pesanan dibatalkan.' },
];

const PLACEHOLDERS = [
  { tag: '{order_id}', desc: 'Nomor pesanan' },
  { tag: '{customer_name}', desc: 'Nama pelanggan' },
  { tag: '{customer_phone}', desc: 'No HP pelanggan' },
  { tag: '{customer_address}', desc: 'Alamat pelanggan' },
  { tag: '{delivery}', desc: 'Metode pengiriman' },
  { tag: '{items_detail}', desc: 'List detail item' },
  { tag: '{total}', desc: 'Total bayar' },
  { tag: '{subtotal}', desc: 'Subtotal' },
  { tag: '{notes}', desc: 'Catatan pelanggan' },
  { tag: '{status}', desc: 'Label status' },
  { tag: '{status_desc}', desc: 'Deskripsi status' },
  { tag: '{status_emoji}', desc: 'Emoji status' },
  { tag: '{store_name}', desc: 'Nama toko' },
  { tag: '{timestamp}', desc: 'Waktu order' },
  { tag: '{track_link}', desc: 'Link tracking buyer' },
];

function PlaceholderHelper({ onInsert }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
      <p className="text-xs font-bold text-amber-900 mb-2">💡 Placeholder tersedia (klik untuk salin):</p>
      <div className="flex flex-wrap gap-1.5">
        {PLACEHOLDERS.map(p => (
          <button
            key={p.tag}
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(p.tag);
              toast.success(`${p.tag} disalin!`);
              if (onInsert) onInsert(p.tag);
            }}
            title={p.desc}
            className="text-[10px] font-mono px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-800 hover:bg-amber-200 transition-all"
          >
            {p.tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function StageCard({ stage, cfg, onUpdate }) {
  const [open, setOpen] = useState(false);
  const update = (k, v) => onUpdate(stage.key, { ...cfg, [k]: v });
  return (
    <div className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
      <button
        type="button"
        data-testid={`stage-toggle-${stage.key}`}
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-amber-50 transition-all"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="text-2xl">{stage.icon}</div>
          <div>
            <p className="font-heading font-bold text-[#7C2D12] text-sm">{stage.label}</p>
            <p className="text-[10px] text-[#9A3412]">{stage.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cfg.seller_enabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">SELLER ✓</span>}
          {cfg.buyer_enabled && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">BUYER ✓</span>}
          {open ? <ChevronUp size={16} className="text-[#9A3412]" /> : <ChevronDown size={16} className="text-[#9A3412]" />}
        </div>
      </button>
      {open && (
        <div className="p-4 border-t border-amber-200 space-y-4 bg-[#FFFBF5]">
          {/* Seller */}
          <div className="rounded-xl bg-white border border-blue-200 p-3">
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">📤 Kirim ke Seller</span>
              <input
                type="checkbox"
                data-testid={`stage-${stage.key}-seller-toggle`}
                checked={cfg.seller_enabled || false}
                onChange={e => update('seller_enabled', e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
            {cfg.seller_enabled && (
              <textarea
                data-testid={`stage-${stage.key}-seller-template`}
                rows={6}
                value={cfg.seller_template || ''}
                onChange={e => update('seller_template', e.target.value)}
                placeholder="Template pesan untuk seller..."
                className="w-full px-3 py-2 rounded-lg border border-blue-200 text-xs font-mono resize-y text-[#451A03]"
              />
            )}
          </div>
          {/* Buyer */}
          <div className="rounded-xl bg-white border border-green-200 p-3">
            <label className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-green-900 flex items-center gap-1.5">📥 Kirim ke Buyer</span>
              <input
                type="checkbox"
                data-testid={`stage-${stage.key}-buyer-toggle`}
                checked={cfg.buyer_enabled || false}
                onChange={e => update('buyer_enabled', e.target.checked)}
                className="w-4 h-4 accent-green-600"
              />
            </label>
            {cfg.buyer_enabled && (
              <textarea
                data-testid={`stage-${stage.key}-buyer-template`}
                rows={6}
                value={cfg.buyer_template || ''}
                onChange={e => update('buyer_template', e.target.value)}
                placeholder="Template pesan untuk buyer..."
                className="w-full px-3 py-2 rounded-lg border border-green-200 text-xs font-mono resize-y text-[#451A03]"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AutoChatConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(storeConfig?.auto_chat_config || {});
  }, [storeConfig]);

  const updateStage = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { auto_chat_config: config });
      await refreshStoreConfig();
      toast.success('Auto-chat tersimpan! 💬');
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Auto-Chat WhatsApp</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Toggle on/off & edit wording WA otomatis per stage pesanan — untuk seller & buyer terpisah.</p>
        </div>
        <button data-testid="save-auto-chat-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>

      <PlaceholderHelper />

      <div className="space-y-3">
        {STAGE_META.map(stage => (
          <StageCard
            key={stage.key}
            stage={stage}
            cfg={config[stage.key] || {}}
            onUpdate={updateStage}
          />
        ))}
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-xs text-blue-900">
        <p className="font-bold mb-1">ℹ️ Catatan:</p>
        <ul className="list-disc list-inside space-y-1 text-[11px]">
          <li>WA akan terkirim aktual via Fonnte token yang diset di tab "WhatsApp (Fonnte)". Pastikan device aktif.</li>
          <li>Pesan ke <strong>seller</strong> dikirim ke nomor di <code>seller_notify_phone</code>.</li>
          <li>Pesan ke <strong>buyer</strong> dikirim ke nomor HP yang buyer isi saat checkout.</li>
          <li>Template pakai placeholder seperti <code className="bg-white px-1 rounded">{'{order_id}'}</code> — klik tag di atas untuk salin.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── INVOICE WORDING CONFIG (FASE 3) ──────────────────────────────
const INVOICE_TEXT_FIELDS = [
  { key: 'title', label: 'Judul Invoice', placeholder: 'INVOICE / STRUK PEMBELIAN' },
  { key: 'subtitle', label: 'Subjudul Invoice', placeholder: 'Terima kasih telah berbelanja...' },
  { key: 'order_number_label', label: 'Label No. Pesanan', placeholder: 'No. Pesanan' },
  { key: 'order_date_label', label: 'Label Tanggal', placeholder: 'Tanggal' },
  { key: 'payment_method_label', label: 'Label Metode Bayar', placeholder: 'Metode Bayar' },
  { key: 'delivery_method_label', label: 'Label Pengiriman', placeholder: 'Pengiriman' },
  { key: 'buyer_section_label', label: 'Heading Section Buyer', placeholder: 'DITAGIH KEPADA' },
  { key: 'items_section_label', label: 'Heading Section Items', placeholder: 'RINCIAN PESANAN' },
  { key: 'subtotal_label', label: 'Label Subtotal', placeholder: 'Subtotal' },
  { key: 'delivery_fee_label', label: 'Label Ongkir', placeholder: 'Ongkir' },
  { key: 'total_label', label: 'Label Total', placeholder: 'TOTAL' },
  { key: 'notes_label', label: 'Label Catatan', placeholder: 'Catatan' },
  { key: 'footer_thanks', label: 'Footer - Ucapan Terima Kasih', placeholder: 'Terima kasih telah mempercayai kami' },
  { key: 'footer_contact', label: 'Footer - Info Kontak', placeholder: 'Hubungi kami via WhatsApp jika ada keluhan' },
  { key: 'footer_disclaimer', label: 'Footer - Disclaimer', placeholder: 'Struk ini adalah bukti pembayaran sah.' },
];

export function InvoiceConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [texts, setTexts] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setTexts(storeConfig?.invoice_texts || {});
  }, [storeConfig]);

  const setText = (k, v) => setTexts(t => ({ ...t, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { invoice_texts: texts });
      await refreshStoreConfig();
      toast.success('Wording invoice tersimpan! 🧾');
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const mod = await import('../../lib/invoiceGenerator');
      const sampleOrder = {
        order_number: 'TST-001', customer_name: 'Bunda Demo', customer_phone: '6281234567890',
        customer_address: 'Jl. Contoh No. 1, Malang', delivery_method: 'delivery',
        payment_method: 'transfer', subtotal: 75000, delivery_fee: 10000, total: 85000,
        notes: 'Sample notes', status: 'selesai', received: true,
        created_at: new Date().toISOString(),
        items: [
          { product_name: 'Risoles Frozen (isi 10)', quantity: 2, price: 35000, subtotal: 70000 },
          { product_name: 'Lumpia Mini', quantity: 1, price: 5000, subtotal: 5000 },
        ],
      };
      // Gunakan wording yang sedang di-edit (state) sehingga preview real-time
      const tempConfig = { ...storeConfig, invoice_texts: texts };
      mod.generateInvoicePdf(sampleOrder, tempConfig);
      toast.success('Preview Invoice didownload!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal preview');
    } finally { setPreviewing(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Wording Invoice / Struk</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Edit semua teks yang muncul di PDF Invoice yang buyer download.</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="preview-invoice-btn" onClick={handlePreview} disabled={previewing} className="flex items-center gap-2 bg-white border border-[#FED7AA] text-[#7C2D12] font-bold px-4 py-2 rounded-full hover:bg-amber-50 text-sm">
            <FileText size={14} /> {previewing ? 'Generating...' : 'Preview PDF'}
          </button>
          <button data-testid="save-invoice-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow">
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <Section title="Teks Invoice" icon={FileText}>
        <p className="text-xs text-[#9A3412] mb-4">Klik "Preview PDF" untuk lihat hasil sebelum simpan. Invoice akan auto-pakai nama toko, tagline, alamat & WhatsApp dari Profil Toko.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INVOICE_TEXT_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-[#7C2D12] mb-1">{f.label}</label>
              <input
                data-testid={`invoice-text-${f.key}`}
                value={texts[f.key] || ''}
                placeholder={f.placeholder}
                onChange={e => setText(f.key, e.target.value)}
                className={inputCls + ' text-sm'}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
