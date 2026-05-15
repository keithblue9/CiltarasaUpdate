import React, { useState, useEffect } from 'react';
import { Save, Send, AlertTriangle, MessageCircle, ListOrdered, Trash2, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, form);
      await refreshStoreConfig();
      toast.success('Konfigurasi WhatsApp tersimpan! 📱');
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">WhatsApp Settings (Fonnte API)</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Konfigurasi Fonnte API untuk kirim OTP login + notif pesanan otomatis ke seller & buyer.</p>
        </div>
        <button data-testid="save-fonnte-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
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
