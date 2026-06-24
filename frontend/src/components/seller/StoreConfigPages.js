import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Store, BookOpen, FolderTree, Truck, CreditCard, Image as ImageIcon, MapPin, Phone, Clock, Instagram, Music2, Type, ImagePlus, Sparkles, ChevronUp, ChevronDown, LogIn, Brain, RefreshCw, Calendar } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';
import ImageUrlInput from '../shared/ImageUrlInput';

const API = process.env.REACT_APP_BACKEND_URL;

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

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

// ─── PROFIL TOKO ─────────────────────────────────────────────────
export function StoreProfile() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [form, setForm] = useState({
    name: '', tagline: '', logo_url: '', whatsapp: '', address: '', operating_hours: '',
    gmaps_review_url: '', bank_accounts: [], social_links: { instagram: '', tiktok: '', shopee: '' }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (storeConfig) {
      setForm(f => ({
        ...f,
        ...storeConfig,
        bank_accounts: storeConfig.bank_accounts || [],
        social_links: storeConfig.social_links || { instagram: '', tiktok: '', shopee: '' }
      }));
    }
  }, [storeConfig]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm(f => ({ ...f, social_links: { ...f.social_links, [k]: v } }));

  const addBank = () => {
    setForm(f => ({ ...f, bank_accounts: [...f.bank_accounts, { id: Date.now().toString(), bank: '', name: '', number: '' }] }));
  };
  const updateBank = (idx, k, v) => {
    setForm(f => {
      const ba = [...f.bank_accounts];
      ba[idx] = { ...ba[idx], [k]: v };
      return { ...f, bank_accounts: ba };
    });
  };
  const removeBank = (idx) => {
    setForm(f => ({ ...f, bank_accounts: f.bank_accounts.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, form);
      await refreshStoreConfig();
      toast.success('Profil toko tersimpan!');
    } catch {
      toast.error('Gagal simpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Profil Toko</h1>
        <button data-testid="save-store-profile-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow hover:shadow-lg disabled:opacity-60">
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      <Section title="Identitas Toko" icon={Store}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nama Toko"><input data-testid="store-name-input" className={inputCls} value={form.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Tagline"><input className={inputCls} value={form.tagline || ''} onChange={e => set('tagline', e.target.value)} /></Field>
          <div className="md:col-span-2"><Field label="Logo Toko" hint="Logo akan tampil di header & onboarding. Upload atau paste URL."><ImageUrlInput value={form.logo_url || ''} onChange={v => set('logo_url', v)} placeholder="https://..." testIdPrefix="store-logo" size="md" /></Field></div>
          <Field label="WhatsApp Bisnis" hint="Format: 6281xxxxxx"><input className={inputCls} value={form.whatsapp || ''} onChange={e => set('whatsapp', e.target.value)} /></Field>
          <div className="md:col-span-2"><Field label="Alamat Toko"><textarea rows={2} className={inputCls + ' resize-none'} value={form.address || ''} onChange={e => set('address', e.target.value)} /></Field></div>
          <Field label="Jam Operasional"><input className={inputCls} value={form.operating_hours || ''} onChange={e => set('operating_hours', e.target.value)} placeholder="Setiap Hari • 08.00 - 21.00" /></Field>
          <Field label="Google Maps Review URL"><input data-testid="gmaps-url-input" className={inputCls} value={form.gmaps_review_url || ''} onChange={e => set('gmaps_review_url', e.target.value)} placeholder="https://maps.app.goo.gl/..." /></Field>
        </div>
      </Section>

      <Section
        title="Rekening Bank"
        icon={CreditCard}
        action={<button data-testid="add-bank-btn" onClick={addBank} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}
      >
        {form.bank_accounts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Belum ada rekening bank. Klik "+ Tambah".</p>
        ) : (
          <div className="space-y-3">
            {form.bank_accounts.map((b, idx) => (
              <div key={b.id || `bank-${idx}`} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
                <div className="col-span-3"><Field label="Bank"><input className={inputCls} value={b.bank} onChange={e => updateBank(idx, 'bank', e.target.value)} placeholder="BCA" /></Field></div>
                <div className="col-span-5"><Field label="Nama Pemilik"><input className={inputCls} value={b.name} onChange={e => updateBank(idx, 'name', e.target.value)} /></Field></div>
                <div className="col-span-3"><Field label="No. Rekening"><input className={inputCls} value={b.number} onChange={e => updateBank(idx, 'number', e.target.value)} /></Field></div>
                <button onClick={() => removeBank(idx)} className="col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Sosial Media" icon={Instagram}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Instagram URL"><input className={inputCls} value={form.social_links.instagram || ''} onChange={e => setSocial('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field>
          <Field label="TikTok URL"><input className={inputCls} value={form.social_links.tiktok || ''} onChange={e => setSocial('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
          <Field label="Shopee URL"><input className={inputCls} value={form.social_links.shopee || ''} onChange={e => setSocial('shopee', e.target.value)} /></Field>
        </div>
      </Section>
    </div>
  );
}

// ─── CERITA PERJALANAN ───────────────────────────────────────────
const STAT_ICON_OPTIONS = [
  { v: 'users', t: '👥 Pelanggan' },
  { v: 'award', t: '🏅 Penghargaan' },
  { v: 'heart', t: '❤️ Hati' },
  { v: 'star', t: '⭐ Bintang' },
  { v: 'truck', t: '🚚 Pengiriman' },
  { v: 'clock', t: '🕒 Waktu' },
  { v: 'shopping', t: '🛍️ Belanja' },
  { v: 'thumbs', t: '👍 Jempol' },
];
const DEFAULT_ABOUT_STATS = [
  { icon: 'users', num: '1.200+', label: 'Pelanggan Setia' },
  { icon: 'award', num: '4.9★', label: 'Rating Google' },
  { icon: 'heart', num: '5+ thn', label: 'Pengalaman' },
];

export function StoreCerita() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [cerita, setCerita] = useState('');
  const [stats, setStats] = useState(DEFAULT_ABOUT_STATS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCerita(storeConfig?.cerita || '');
    const s = (Array.isArray(storeConfig?.about_stats) && storeConfig.about_stats.length > 0)
      ? storeConfig.about_stats : DEFAULT_ABOUT_STATS;
    setStats([0, 1, 2].map(i => ({
      icon: s[i]?.icon || DEFAULT_ABOUT_STATS[i].icon,
      num: s[i]?.num ?? '',
      label: s[i]?.label ?? '',
    })));
  }, [storeConfig]);

  const setStat = (i, k, v) => setStats(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { cerita, about_stats: stats });
      await refreshStoreConfig();
      toast.success('Tersimpan!');
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Cerita Perjalanan</h1>
        <button data-testid="save-cerita-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>

      <Section title="Statistik Toko (Tentang Kami)" icon={Sparkles}>
        <p className="text-xs text-gray-500 mb-3">3 kartu angka yang tampil di tab "Tentang Kami" buyer. Atur ikon, angka, & keterangannya. Kosongkan angka kalau mau sembunyikan kartu.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={`stat-edit-${i}`} className="border border-[#FED7AA] rounded-xl p-3 space-y-2 bg-[#FFFBF5]">
              <div className="text-[10px] font-bold text-[#9A3412] uppercase tracking-wide">Kartu {i + 1}</div>
              <select className={inputCls} value={s.icon} onChange={e => setStat(i, 'icon', e.target.value)}>
                {STAT_ICON_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
              <input className={inputCls} value={s.num} onChange={e => setStat(i, 'num', e.target.value)} placeholder="cth: 1.200+" />
              <input className={inputCls} value={s.label} onChange={e => setStat(i, 'label', e.target.value)} placeholder="cth: Pelanggan Setia" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tentang Toko Kami" icon={BookOpen}>
        <p className="text-xs text-gray-500 mb-2">Tulis cerita perjalanan toko, akan tampil di tab "Tentang" di buyer app. Gunakan baris baru untuk paragraf.</p>
        <textarea data-testid="cerita-textarea" rows={14} className={inputCls + ' resize-none'} value={cerita} onChange={e => setCerita(e.target.value)} placeholder="Toko kami berdiri sejak..." />
        <p className="text-xs text-gray-500 mt-2">{cerita.length} karakter</p>
      </Section>
    </div>
  );
}

// ─── KATEGORI PRODUK ─────────────────────────────────────────────
export function CategoriesConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [cats, setCats] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCats(storeConfig?.categories || []); }, [storeConfig]);

  const add = () => setCats(prev => [...prev, { id: 'kat-' + Date.now(), name: '', icon: '📦' }]);
  const update = (idx, k, v) => setCats(prev => { const u = [...prev]; u[idx] = { ...u[idx], [k]: v }; return u; });
  const remove = (idx) => setCats(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/store-config`, { categories: cats }); await refreshStoreConfig(); toast.success('Kategori tersimpan!'); } catch { toast.error('Gagal'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Kategori Produk</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Daftar Kategori" icon={FolderTree} action={<button data-testid="add-category-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-2">
          {cats.map((c, idx) => (
            <div key={c.id || `cat-${idx}`} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
              <div className="col-span-3"><Field label="ID Unik"><input className={inputCls} value={c.id} onChange={e => update(idx, 'id', e.target.value.toLowerCase().replace(/\s/g, '-'))} /></Field></div>
              <div className="col-span-5"><Field label="Nama"><input className={inputCls} value={c.name} onChange={e => update(idx, 'name', e.target.value)} /></Field></div>
              <div className="col-span-3"><Field label="Icon Emoji"><input className={inputCls + ' text-center text-2xl'} value={c.icon} onChange={e => update(idx, 'icon', e.target.value)} /></Field></div>
              <button onClick={() => remove(idx)} className="col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── LAYANAN PENGIRIMAN ──────────────────────────────────────────
export function DeliveryConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // Normalize: ensure all flags are EXPLICIT booleans + sane defaults per option
    const raw = storeConfig?.delivery_options || [];
    setItems(raw.map(d => {
      const detectedPickup = d.is_pickup === true
        || (d.id || '').toLowerCase() === 'pickup'
        || /(ambil|sendiri|pickup)/i.test(d.name || '');
      return {
        ...d,
        is_pickup: detectedPickup,
        active: d.active !== false,
        // requires_address: default = NOT pickup (pickup ngga butuh alamat)
        requires_address: d.requires_address !== undefined ? d.requires_address : !detectedPickup,
        // needs_ongkir_input: default false; if true, seller fills ongkir saat tandai siap kirim
        needs_ongkir_input: d.needs_ongkir_input === true,
        // emoji + free_label: seller bisa override
        emoji: d.emoji || (detectedPickup ? '🏠' : '🚚'),
        free_label: d.free_label || 'Gratis',
      };
    }));
  }, [storeConfig]);
  const add = () => setItems(prev => [...prev, {
    id: 'opt-' + Date.now(), name: '', description: '', fee: 0,
    active: true, is_pickup: false, requires_address: true,
    needs_ongkir_input: false, emoji: '🚚', free_label: 'Gratis',
  }]);
  const update = (idx, k, v) => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [k]: v }; return u; });
  const remove = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const handleSave = async () => { setSaving(true); try { await axios.put(`${API}/api/store-config`, { delivery_options: items }); await refreshStoreConfig(); toast.success('Tersimpan!'); } catch { toast.error('Gagal'); } finally { setSaving(false); } };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Layanan Pengiriman</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Opsi Pengiriman" icon={Truck} action={<button data-testid="add-delivery-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-3">
          {items.map((it, idx) => {
            return (
            <div key={it.id || `del-${idx}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] space-y-2">
              {/* Row 1: Nama, Emoji, Ongkir */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-4"><Field label="Nama"><input className={inputCls} value={it.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="Kurir Toko" /></Field></div>
                <div className="col-span-3 sm:col-span-1"><Field label="Emoji"><input className={inputCls + ' text-center text-xl'} maxLength={4} value={it.emoji} onChange={e => update(idx, 'emoji', e.target.value)} placeholder="🚚" /></Field></div>
                <div className="col-span-9 sm:col-span-3"><Field label="Ongkir (Rp)"><input type="number" className={inputCls} value={it.fee} onChange={e => update(idx, 'fee', Number(e.target.value))} disabled={it.needs_ongkir_input} placeholder={it.needs_ongkir_input ? 'Diisi nanti' : '0'} /></Field></div>
                <div className="col-span-9 sm:col-span-3"><Field label="Deskripsi"><input className={inputCls} value={it.description} onChange={e => update(idx, 'description', e.target.value)} placeholder="Diantar kurir toko..." /></Field></div>
                <div className="col-span-3 sm:col-span-1 flex flex-col items-center justify-end gap-1 pb-2">
                  <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-[#7C2D12]">
                    <input type="checkbox" checked={it.active !== false} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" />
                    AKTIF
                  </label>
                  <button onClick={() => remove(idx)} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
              {/* Row 2: Free label + advanced flags */}
              <div className="grid grid-cols-12 gap-2 pt-2 border-t border-[#FED7AA]/60">
                <div className="col-span-12 sm:col-span-3">
                  <Field label='Wording "Gratis"'>
                    <input className={inputCls + ' text-xs py-1.5'} value={it.free_label} onChange={e => update(idx, 'free_label', e.target.value)} placeholder="Gratis" />
                  </Field>
                  <p className="text-[9px] text-gray-500 italic mt-0.5">Muncul kalau ongkir = 0</p>
                </div>
                <div className="col-span-12 sm:col-span-9 flex flex-wrap gap-3 items-center text-xs pt-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#7C2D12]">
                    <input
                      data-testid={`delivery-is-pickup-${idx}`}
                      type="checkbox"
                      checked={it.is_pickup}
                      onChange={e => {
                        update(idx, 'is_pickup', e.target.checked);
                        // Auto-toggle requires_address logically
                        if (e.target.checked) update(idx, 'requires_address', false);
                      }}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    🏠 Ambil Sendiri
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#7C2D12]">
                    <input
                      data-testid={`delivery-requires-address-${idx}`}
                      type="checkbox"
                      checked={it.requires_address}
                      onChange={e => update(idx, 'requires_address', e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    🏠 Butuh Alamat Lengkap
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#7C2D12]">
                    <input
                      data-testid={`delivery-needs-ongkir-${idx}`}
                      type="checkbox"
                      checked={it.needs_ongkir_input}
                      onChange={e => {
                        update(idx, 'needs_ongkir_input', e.target.checked);
                        if (e.target.checked) update(idx, 'fee', 0);
                      }}
                      className="w-4 h-4 accent-purple-600"
                    />
                    💰 Ongkir Diisi Nanti (saat Tandai Siap)
                  </label>
                </div>
                <p className="col-span-12 text-[10px] text-[#9A3412] italic">
                  💡 <strong>Butuh Alamat</strong>: muncul field alamat di checkout. <strong>Ongkir Nanti</strong>: ongkir bukan flat — seller isi nominal saat order siap kirim (mis: GoSend ongkir variabel).
                </p>
              </div>
            </div>
          );})}
        </div>
      </Section>
    </div>
  );
}

// ─── METODE PEMBAYARAN ──────────────────────────────────────────
const PAYMENT_TEXT_FIELDS = [
  { key: 'bank_transfer_title', label: 'Judul Section Transfer', placeholder: 'Transfer Bank' },
  { key: 'bank_transfer_instructions', label: 'Instruksi Transfer', placeholder: 'Silakan transfer...', multiline: true },
  { key: 'pay_now_label', label: 'Label "Bayar Sekarang"', placeholder: 'Bayar Sekarang' },
  { key: 'pay_now_desc', label: 'Deskripsi "Bayar Sekarang"', placeholder: 'Transfer & upload bukti' },
  { key: 'pay_later_label', label: 'Label "Bayar Nanti"', placeholder: 'Bayar Nanti (COD)' },
  { key: 'pay_later_desc', label: 'Deskripsi "Bayar Nanti"', placeholder: 'Bayar saat pesanan sampai' },
  { key: 'upload_proof_label', label: 'Label Upload Bukti', placeholder: 'Upload Bukti Transfer' },
  { key: 'upload_proof_hint', label: 'Hint Upload Bukti', placeholder: 'Format JPG/PNG, max 5MB', multiline: true },
  { key: 'qris_title', label: 'Judul Section QRIS', placeholder: 'Scan QRIS' },
  { key: 'qris_instructions', label: 'Instruksi QRIS', placeholder: 'Scan QR di bawah...', multiline: true },
  { key: 'qris_paid_label', label: 'Tombol "Telah Bayar"', placeholder: 'Telah Bayar' },
  { key: 'qris_cancel_label', label: 'Tombol "Batalkan"', placeholder: 'Batalkan' },
  { key: 'qris_upload_label', label: 'Label Upload Bukti QRIS', placeholder: 'Upload Bukti Pembayaran QRIS' },
  { key: 'no_qris_image_warning', label: 'Warning jika QR belum diupload', placeholder: 'Seller belum upload QR...', multiline: true },
];

export function PaymentsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [items, setItems] = useState([]);
  const [qrisImageUrl, setQrisImageUrl] = useState('');
  const [paymentTexts, setPaymentTexts] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    // ✅ Per-option config: each (delivery_option × payment_method) combo is independent.
    // Schema: payment_method.by_delivery = { [delivery_option_id]: { available, timing } }
    // Backward-compat: if by_delivery is missing for some options, backfill from old global
    // fields (available_for_delivery/pickup, delivery_timing/pickup_timing).
    const raw = storeConfig?.payment_methods || [];
    const dOpts = storeConfig?.delivery_options || [];
    setItems(raw.map(p => {
      const byD = { ...(p.by_delivery || {}) };
      for (const d of dOpts) {
        if (byD[d.id]) continue; // already set, don't overwrite
        const dPickup = d.is_pickup === true
          || (d.id || '').toLowerCase() === 'pickup'
          || /(ambil|sendiri|pickup)/i.test(d.name || '');
        const fallbackAvail = dPickup ? (p.available_for_pickup !== false) : (p.available_for_delivery !== false);
        const fallbackTiming = dPickup ? (p.pickup_timing || 'both') : (p.delivery_timing || 'later');
        byD[d.id] = { available: fallbackAvail, timing: fallbackTiming };
      }
      return {
        ...p,
        // Keep global flags as "defaults for new delivery options added later"
        available_for_delivery: p.available_for_delivery !== false,
        available_for_pickup: p.available_for_pickup !== false,
        delivery_timing: p.delivery_timing || 'later',
        pickup_timing: p.pickup_timing || 'both',
        by_delivery: byD,
        active: p.active !== false,
      };
    }));
    setQrisImageUrl(storeConfig?.qris_image_url || '');
    setPaymentTexts(storeConfig?.payment_texts || {});
  }, [storeConfig]);
  const add = () => setItems(prev => [...prev, { id: 'pay-' + Date.now(), name: '', type: 'transfer', details: '', active: true, available_for_delivery: true, available_for_pickup: true, delivery_timing: 'later', pickup_timing: 'both', by_delivery: {} }]);
  const update = (idx, k, v) => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], [k]: v }; return u; });
  const remove = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const setText = (k, v) => setPaymentTexts(t => ({ ...t, [k]: v }));
  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, {
        payment_methods: items,
        qris_image_url: qrisImageUrl,
        payment_texts: paymentTexts,
      });
      await refreshStoreConfig();
      toast.success('Tersimpan!');
    } catch { toast.error('Gagal'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Metode Pembayaran</h1>
        <button data-testid="save-payments-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Opsi Pembayaran" icon={CreditCard} action={<button data-testid="add-payment-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-3">
          {items.map((it, idx) => {
            return (
            <div key={it.id || `pay-${idx}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] space-y-2">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-3"><Field label="Nama"><input className={inputCls} value={it.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="Transfer BCA" /></Field></div>
                <div className="col-span-6 sm:col-span-2">
                  <Field label="Tipe">
                    <select className={inputCls} value={it.type} onChange={e => update(idx, 'type', e.target.value)}>
                      <option value="transfer">Transfer Bank</option>
                      <option value="qris">QRIS</option>
                      <option value="cod">COD / Tunai</option>
                      <option value="ewallet">E-Wallet</option>
                    </select>
                  </Field>
                </div>
                <div className="col-span-12 sm:col-span-5"><Field label="Detail / Petunjuk"><input className={inputCls} value={it.details} onChange={e => update(idx, 'details', e.target.value)} /></Field></div>
                <div className="col-span-6 sm:col-span-1 pb-2 flex items-center gap-1">
                  <input data-testid={`payment-active-${it.id || idx}`} type="checkbox" checked={it.active !== false} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" />
                  <span className="text-[10px] font-bold text-[#7C2D12]">AKTIF</span>
                </div>
                <button onClick={() => remove(idx)} className="col-span-6 sm:col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500 self-end"><Trash2 size={16} /></button>
              </div>
              <p className="text-[11px] text-[#9A3412] italic pt-1 border-t border-[#FED7AA]/60">
                ✏️ Atur <strong>ketersediaan</strong> & <strong>timing bayar</strong> per kombinasi pengiriman di Preview Matrix bawah ↓
              </p>
            </div>
          );})}
        </div>
      </Section>

      {/* Live Compatibility Matrix — visualize what buyer sees AND edit per (delivery×payment) cell */}
      {items.filter(it => it.active !== false).length > 0 && (
        <Section title="🔗 Setting per Kombinasi: Pengiriman × Pembayaran" icon={CreditCard}>
          <p className="text-xs text-[#9A3412] mb-3">
            <strong>Setiap cell independen</strong> — atur ketersediaan & timing bayar untuk setiap kombinasi (Pengiriman × Metode Bayar). Ngubah satu cell <strong>ngga ngaruh</strong> cell lain.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-[#FEF3C7] border border-[#FED7AA] font-bold text-[#7C2D12]">Opsi Pengiriman ↓ \ Bayar →</th>
                  {items.filter(it => it.active !== false).map(p => (
                    <th key={p.id} className="text-center p-2 bg-[#FEF3C7] border border-[#FED7AA] font-bold text-[#7C2D12] min-w-[150px]">
                      {p.name || '(tanpa nama)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(storeConfig?.delivery_options || []).filter(d => d.active !== false).map(d => {
                  const dPickup = d.is_pickup === true
                    || (d.id || '').toLowerCase() === 'pickup'
                    || /(ambil|sendiri|pickup)/i.test(d.name || '');
                  return (
                    <tr key={d.id}>
                      <td className="p-2 border border-[#FED7AA] bg-white font-semibold text-[#451A03]">
                        {dPickup ? '🏠 ' : '🚚 '}{d.name}
                        {dPickup && <span className="text-[10px] text-emerald-700 ml-1">(pickup)</span>}
                      </td>
                      {items.filter(it => it.active !== false).map(p => {
                        const idx = items.findIndex(i => i.id === p.id);
                        // ✅ Per-option config — each cell independent
                        const cellConfig = p.by_delivery?.[d.id] || { available: true, timing: dPickup ? 'both' : 'later' };
                        const ok = cellConfig.available !== false;
                        const timing = cellConfig.timing || (dPickup ? 'both' : 'later');
                        const updateCell = (patch) => {
                          const nextByDelivery = {
                            ...(p.by_delivery || {}),
                            [d.id]: { ...cellConfig, ...patch },
                          };
                          update(idx, 'by_delivery', nextByDelivery);
                        };
                        const timingLabel = { now: '⚡ Bayar Sekarang', later: '🕒 Bayar Nanti', both: '✨ Buyer Pilih' };
                        const timingDescShort = { now: 'Wajib upload bukti', later: 'Setelah ongkir', both: 'Fleksibel' };
                        return (
                          <td
                            key={`${d.id}-${p.id}`}
                            className={`p-2 border border-[#FED7AA] text-center align-middle transition-colors ${ok ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}`}
                          >
                            <button
                              type="button"
                              data-testid={`matrix-toggle-${d.id}-${p.id}`}
                              onClick={() => updateCell({ available: !ok })}
                              className={`w-full text-[11px] font-bold mb-1.5 px-2 py-1 rounded-md transition-all ${ok ? 'bg-emerald-200/60 hover:bg-emerald-300 text-emerald-800' : 'bg-red-200/60 hover:bg-red-300 text-red-800'}`}
                            >
                              {ok ? '✅ Tersedia' : '⛔ Hidden'}
                            </button>
                            {ok && p.type !== 'cod' && (
                              <select
                                data-testid={`matrix-timing-${d.id}-${p.id}`}
                                value={timing}
                                onChange={e => updateCell({ timing: e.target.value })}
                                className="w-full text-[10px] px-1 py-0.5 rounded border border-[#FED7AA] bg-white text-[#7C2D12] cursor-pointer"
                                title={timingDescShort[timing]}
                              >
                                <option value="later">🕒 Nanti</option>
                                <option value="now">⚡ Sekarang</option>
                                <option value="both">✨ Pilih</option>
                              </select>
                            )}
                            {ok && p.type !== 'cod' && (
                              <p className="text-[9px] text-gray-500 mt-0.5">{timingLabel[timing]}</p>
                            )}
                            {ok && p.type === 'cod' && (
                              <p className="text-[9px] text-gray-500 mt-0.5 italic">💵 Tunai (always)</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(storeConfig?.delivery_options || []).filter(d => d.active !== false).length === 0 && (
                  <tr>
                    <td colSpan={items.filter(it => it.active !== false).length + 1} className="p-4 text-center text-sm text-gray-500 italic border border-[#FED7AA] bg-white">
                      Belum ada opsi pengiriman aktif. Set di menu <strong>Layanan Pengiriman</strong>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#9A3412] italic mt-3">
            ⚠️ Klik cell hijau/merah untuk toggle. Dropdown timing kontrol Bayar Sekarang/Nanti. <strong>Jangan lupa Simpan</strong> setelah edit di matrix.
          </p>
        </Section>
      )}

      <Section title="QRIS — Upload Gambar QR" icon={ImageIcon}>
        <div className="space-y-3">
          <p className="text-xs text-[#9A3412]">Upload gambar QRIS (dari komputer/HP/Google Drive). Buyer akan scan QR ini saat memilih metode QRIS di checkout.</p>
          <ImageUrlInput
            value={qrisImageUrl}
            onChange={setQrisImageUrl}
            data-testid="qris-image-input"
          />
          {qrisImageUrl && (
            <div className="mt-2 p-3 bg-[#FFF7ED] rounded-xl border border-[#FED7AA] inline-block">
              <p className="text-xs font-bold text-[#7C2D12] mb-2">Preview QR yang akan dilihat buyer:</p>
              <SmartImage src={qrisImageUrl} alt="QRIS Preview" className="w-48 h-48 object-contain bg-white rounded-lg" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Wording / Teks Halaman Pembayaran" icon={Type}>
        <p className="text-xs text-[#9A3412] mb-4">Edit semua teks yang dilihat buyer di halaman checkout — instruksi, label tombol, hint upload, dll.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAYMENT_TEXT_FIELDS.map(f => (
            <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
              <Field label={f.label}>
                {f.multiline ? (
                  <textarea
                    data-testid={`payment-text-${f.key}`}
                    rows={2}
                    className={inputCls + ' resize-y'}
                    value={paymentTexts[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => setText(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    data-testid={`payment-text-${f.key}`}
                    className={inputCls}
                    value={paymentTexts[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => setText(f.key, e.target.value)}
                  />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}


// ─── HOMEPAGE TEXTS (CMS) ──────────────────────────────────────
const TEXT_FIELDS = [
  { key: 'viral_pill', label: 'Pill atas Hero (badge viral)', placeholder: 'Lagi Viral di Malang 🔥' },
  { key: 'hero_title_1', label: 'Hero Judul Baris 1', placeholder: 'Cemilan Frozen' },
  { key: 'hero_title_2', label: 'Hero Judul Baris 2 (highlight)', placeholder: 'Yang Bikin Nagih' },
  { key: 'hero_subtitle', label: 'Hero Subtitle', placeholder: 'Frozen snack premium...', multiline: true },
  { key: 'hero_cta_primary', label: 'Tombol Hero #1 (Beli)', placeholder: 'Belanja Sekarang' },
  { key: 'hero_cta_secondary', label: 'Tombol Hero #2 (Lacak)', placeholder: 'Lacak Pesananku' },
  { key: 'social_proof_text', label: 'Teks Social Proof', placeholder: '1.200+ keluarga...' },
  { key: 'how_to_order_title', label: 'Judul Section "Cara Pesan"', placeholder: 'Cara Pesan' },
  { key: 'how_to_order_subtitle', label: 'Subtitle "Cara Pesan"', placeholder: 'Mudah, cepat, dan praktis' },
  { key: 'catalog_section_title', label: 'Judul Katalog', placeholder: 'Lagi Viral Bulan Ini 🔥' },
  { key: 'catalog_section_subtitle', label: 'Subtitle Katalog', placeholder: 'Pilihan frozen food premium' },
  { key: 'tab_menu_label', label: 'Label Tab "Menu Kami"', placeholder: '🍽️ Menu Kami' },
  { key: 'tab_about_label', label: 'Label Tab "Tentang Kami"', placeholder: '✨ Tentang Kami' },
];

export function HomepageTextsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [texts, setTexts] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setTexts(storeConfig?.homepage_texts || {}); }, [storeConfig]);
  const set = (k, v) => setTexts(prev => ({ ...prev, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/store-config`, { homepage_texts: texts }); await refreshStoreConfig(); toast.success('Teks homepage tersimpan! Buyer akan lihat update real-time 🎉'); }
    catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Teks Homepage Buyer</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Edit semua tulisan yang muncul di homepage buyer. Update langsung tampil real-time.</p>
        </div>
        <button data-testid="save-homepage-texts-btn" onClick={save} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Teks Hero & Homepage" icon={Type}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEXT_FIELDS.map(f => (
            <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
              <Field label={f.label}>
                {f.multiline ? (
                  <textarea data-testid={`text-input-${f.key}`} rows={2} className={inputCls + ' resize-none'} value={texts[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                ) : (
                  <input data-testid={`text-input-${f.key}`} className={inputCls} value={texts[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── HERO SLIDESHOW ────────────────────────────────────────────
export function HeroSlideshowConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [slides, setSlides] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSlides(storeConfig?.hero_slides || []); }, [storeConfig]);
  const add = () => setSlides(prev => [...prev, { id: 'slide-' + Date.now(), image_url: '', duration_ms: 5000, active: true }]);
  const update = (idx, k, v) => setSlides(prev => { const u = [...prev]; u[idx] = { ...u[idx], [k]: v }; return u; });
  const remove = (idx) => setSlides(prev => prev.filter((_, i) => i !== idx));
  const move = (idx, dir) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= slides.length) return;
    const u = [...slides];
    [u[idx], u[ni]] = [u[ni], u[idx]];
    setSlides(u);
  };
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/store-config`, { hero_slides: slides }); await refreshStoreConfig(); toast.success('Slideshow tersimpan! 🎬'); }
    catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Slideshow Hero</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Slideshow gambar background di homepage buyer. Set durasi per slide (ms).</p>
        </div>
        <button data-testid="save-slides-btn" onClick={save} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Daftar Slide" icon={ImagePlus} action={<button data-testid="add-slide-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <p className="text-[11px] text-gray-500 mb-3">💡 Pakai URL gambar landscape resolusi tinggi (min 1600px lebar). Durasi dalam millisecond (5000 = 5 detik).</p>
        <div className="space-y-3">
          {slides.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Belum ada slide. Tambahkan slide pertamamu!</p>}
          {slides.map((s, idx) => (
            <div key={s.id || `slide-${idx}`} className="grid grid-cols-12 gap-2 items-start p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
              <div className="col-span-12 sm:col-span-8">
                <Field label={`Gambar Slide #${idx + 1}`}>
                  <ImageUrlInput
                    value={s.image_url}
                    onChange={v => update(idx, 'image_url', v)}
                    placeholder="Upload atau paste URL gambar landscape (min 1600px)"
                    testIdPrefix={`slide-${idx}`}
                    size="lg"
                  />
                </Field>
              </div>
              <div className="col-span-7 sm:col-span-2"><Field label="Durasi (ms)"><input type="number" className={inputCls} value={s.duration_ms} onChange={e => update(idx, 'duration_ms', Number(e.target.value))} /></Field></div>
              <div className="col-span-3 sm:col-span-1 flex flex-col items-center gap-1 pt-3">
                <label className="flex flex-col items-center cursor-pointer text-[10px] font-bold text-[#7C2D12]">
                  <input type="checkbox" checked={s.active !== false} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" />
                  <span className="mt-0.5">Aktif</span>
                </label>
              </div>
              <div className="col-span-2 sm:col-span-1 flex flex-col gap-1">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 rounded bg-white border border-[#FED7AA] disabled:opacity-30"><ChevronUp size={12} /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === slides.length - 1} className="p-1 rounded bg-white border border-[#FED7AA] disabled:opacity-30"><ChevronDown size={12} /></button>
                <button onClick={() => remove(idx)} className="p-1 rounded bg-red-50 text-red-500"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── FUN FACTS ─────────────────────────────────────────────────
const REFRESH_PERIOD_OPTIONS = [
  { value: 0, label: 'Manual saja (tidak auto-refresh)' },
  { value: 1, label: 'Harian' },
  { value: 3, label: 'Setiap 3 Hari' },
  { value: 7, label: 'Mingguan' },
  { value: 14, label: 'Setiap 2 Minggu' },
];

// Berapa lama popup boleh muncul lagi setelah buyer close-nya
const RESHOW_HOURS_OPTIONS = [
  { value: 0, label: 'Sekali saja per sesi browser' },
  { value: 1, label: 'Setelah 1 jam' },
  { value: 6, label: 'Setelah 6 jam' },
  { value: 12, label: 'Setelah 12 jam' },
  { value: 24, label: 'Setelah 1 hari' },
  { value: 72, label: 'Setelah 3 hari' },
  { value: 168, label: 'Setelah 1 minggu' },
];

export function FunFactsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [facts, setFacts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiMeta, setAiMeta] = useState(null); // {_mode, _generated_at}
  const [refreshPeriodDays, setRefreshPeriodDays] = useState(7);
  const [reshowAfterHours, setReshowAfterHours] = useState(24);
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

  useEffect(() => {
    setFacts(storeConfig?.fun_facts || []);
    const meta = storeConfig?.fun_facts_meta || {};
    setRefreshPeriodDays(Number(meta.refresh_period_days ?? 7));
    setReshowAfterHours(Number(meta.reshow_after_hours ?? 24));
    setLastGeneratedAt(meta.last_generated_at || null);
    if (meta.mode) {
      setAiMeta({ _mode: meta.mode, _generated_at: meta.last_generated_at });
    }
  }, [storeConfig]);

  const add = () => setFacts(prev => [...prev, { id: 'ff-' + Date.now(), image_url: '', title: '', text: '', show_image: false }]);
  const update = (idx, k, v) => setFacts(prev => { const u = [...prev]; u[idx] = { ...u[idx], [k]: v }; return u; });
  const remove = (idx) => setFacts(prev => prev.filter((_, i) => i !== idx));
  const toggleImage = (idx) => {
    const u = [...facts];
    const curr = u[idx].show_image ?? !!u[idx].image_url;
    u[idx] = { ...u[idx], show_image: !curr };
    // Kalau dimatikan, kosongkan image_url juga (biar bersih)
    if (curr) u[idx].image_url = '';
    setFacts(u);
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, {
        fun_facts: facts,
        fun_facts_meta: {
          refresh_period_days: refreshPeriodDays,
          reshow_after_hours: reshowAfterHours,
          last_generated_at: lastGeneratedAt,
          mode: aiMeta?._mode || null,
        },
      });
      await refreshStoreConfig();
      toast.success('Fun facts tersimpan! ✨');
    } catch { toast.error('Gagal simpan'); }
    finally { setSaving(false); }
  };

  const generateAi = async (replaceExisting = true) => {
    if (!replaceExisting && !window.confirm('Tambah 5 fun facts baru ke list yang ada? (Total bisa > 5)')) return;
    if (replaceExisting && facts.length > 0 && !window.confirm('Ganti semua fun facts dengan 5 yang baru di-generate AI?')) return;
    setGenerating(true);
    try {
      const r = await axios.post(`${API}/api/ai/fun-facts/generate`);
      const newFacts = r.data?.fun_facts || [];
      if (!newFacts.length) {
        toast.error('AI tidak generate fun facts. Coba lagi.');
        return;
      }
      const next = replaceExisting ? newFacts : [...facts, ...newFacts];
      setFacts(next);
      const now = new Date().toISOString();
      setLastGeneratedAt(now);
      setAiMeta({ _mode: r.data._mode, _generated_at: now });
      // Auto-save after generation
      await axios.put(`${API}/api/store-config`, {
        fun_facts: next,
        fun_facts_meta: {
          refresh_period_days: refreshPeriodDays,
          reshow_after_hours: reshowAfterHours,
          last_generated_at: now,
          mode: r.data._mode,
        },
      });
      await refreshStoreConfig();
      toast.success(`🎉 5 fun facts baru di-generate via ${r.data._mode === 'ai' ? 'Claude AI' : 'Template Lokal'} & tersimpan otomatis!`, { duration: 5000 });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal generate fun facts');
    } finally { setGenerating(false); }
  };

  // Compute if refresh is "due"
  const isDue = (() => {
    if (!refreshPeriodDays || !lastGeneratedAt) return false;
    try {
      const last = new Date(lastGeneratedAt);
      const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= refreshPeriodDays;
    } catch { return false; }
  })();

  const nextRefreshDate = (() => {
    if (!refreshPeriodDays || !lastGeneratedAt) return null;
    try {
      const last = new Date(lastGeneratedAt);
      return new Date(last.getTime() + refreshPeriodDays * 24 * 60 * 60 * 1000);
    } catch { return null; }
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Fun Facts Popup</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Popup edukasi pelanggan di homepage buyer (bisa di-swipe). Best practice: 5 fun facts.</p>
        </div>
        <button data-testid="save-funfacts-btn" onClick={save} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>

      {/* AI Generator Card */}
      <div data-testid="funfacts-ai-card" className="rounded-2xl bg-gradient-to-br from-purple-50 via-white to-orange-50 border-2 border-purple-200 p-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 opacity-10 text-9xl">✨</div>
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0 ${aiMeta?._mode === 'local' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
            <Brain size={24} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="font-heading font-bold text-[#451A03] text-lg flex items-center gap-2 flex-wrap">
              Generate Fun Facts dengan AI
              {aiMeta?._mode && (
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${aiMeta._mode === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                  {aiMeta._mode === 'local' ? 'Local Templates' : 'Claude AI'}
                </span>
              )}
            </h3>
            <p className="text-xs text-[#7C2D12] mt-1 leading-relaxed">
              AI baca produk-produk kamu & generate 5 fun facts personal: sejarah makanan, manfaat gizi, tips kuliner, atau trivia menarik. Random tiap kali di-generate.
            </p>
            {lastGeneratedAt && (
              <p className="text-[10px] text-[#9A3412] mt-2">
                Terakhir generate: {new Date(lastGeneratedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            data-testid="funfacts-generate-replace-btn"
            onClick={() => generateAi(true)}
            disabled={generating}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm px-4 py-2 rounded-full shadow disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Generate 5 Fun Facts (Replace)'}
          </button>
          {facts.length > 0 && (
            <button
              data-testid="funfacts-generate-add-btn"
              onClick={() => generateAi(false)}
              disabled={generating}
              className="flex items-center gap-2 bg-white border-2 border-purple-300 hover:bg-purple-50 text-purple-700 font-bold text-sm px-4 py-2 rounded-full disabled:opacity-50"
            >
              <Plus size={14} />
              Tambah 5 (Append)
            </button>
          )}
        </div>

        {/* Refresh Period */}
        <div className="mt-5 pt-5 border-t border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-purple-600" />
            <h4 className="font-bold text-[#451A03] text-sm">Auto-Refresh Period</h4>
          </div>
          <p className="text-[11px] text-[#7C2D12] mb-3">
            Reminder muncul di sini kalau udah lewat periode ini. Buyer dapat fun facts fresh terus.
          </p>
          <select
            data-testid="funfacts-refresh-period"
            value={refreshPeriodDays}
            onChange={e => setRefreshPeriodDays(Number(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-purple-200 bg-white text-sm font-bold text-[#451A03]"
          >
            {REFRESH_PERIOD_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {nextRefreshDate && refreshPeriodDays > 0 && (
            <p className="text-[10px] text-[#9A3412] mt-2">
              Refresh berikutnya: {nextRefreshDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
          {isDue && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
              ⏰ <strong>Saatnya refresh!</strong> Periode refresh sudah lewat. Klik "Generate 5 Fun Facts" di atas untuk fresh content.
            </div>
          )}
        </div>

        {/* Reshow Timer — berapa lama setelah buyer close popup, baru muncul lagi */}
        <div className="mt-5 pt-5 border-t border-purple-100">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-orange-600" />
            <h4 className="font-bold text-[#451A03] text-sm">Reshow Timer (setelah buyer close)</h4>
          </div>
          <p className="text-[11px] text-[#7C2D12] mb-3">
            Berapa lama jeda sebelum popup muncul lagi setelah buyer klik tutup? Bigger = less nagging.
          </p>
          <select
            data-testid="funfacts-reshow-hours"
            value={reshowAfterHours}
            onChange={e => setReshowAfterHours(Number(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-orange-200 bg-white text-sm font-bold text-[#451A03]"
          >
            {RESHOW_HOURS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-[#9A3412] mt-2 italic">
            💡 Default 1 hari. Kalau popup muncul terlalu sering, perpanjang ke 3 hari atau 1 minggu.
          </p>
        </div>
      </div>

      <Section title="Daftar Fun Facts" icon={Sparkles} action={<button data-testid="add-funfact-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah Manual</button>}>
        <div className="space-y-3">
          {facts.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Belum ada fun fact. Klik "Generate" di atas untuk AI buat otomatis, atau tambah manual!</p>}
          {facts.map((f, idx) => {
            // show_image: explicit flag. Backward-compat: if undefined, infer from image_url
            const showImage = f.show_image ?? !!f.image_url;
            return (
            <div key={f.id || `ff-${idx}`} className="rounded-xl bg-[#FFFBF5] border border-[#FED7AA] p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <span className="text-xs font-bold text-[#7C2D12] uppercase tracking-wide">Fun Fact #{idx + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#7C2D12]">
                    <input
                      data-testid={`funfact-show-image-${idx}`}
                      type="checkbox"
                      checked={showImage}
                      onChange={() => toggleImage(idx)}
                      className="w-4 h-4 accent-[#EA580C]"
                    />
                    <ImagePlus size={14} className={showImage ? 'text-[#EA580C]' : 'text-gray-400'} />
                    Tampilkan Gambar
                  </label>
                  <button onClick={() => remove(idx)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className={`grid gap-3 ${showImage ? 'grid-cols-12' : 'grid-cols-1'}`}>
                {showImage && (
                  <div className="col-span-12 sm:col-span-5">
                    <Field label="Gambar (4:3 ideal)">
                      <ImageUrlInput
                        value={f.image_url}
                        onChange={v => update(idx, 'image_url', v)}
                        placeholder="Upload atau paste URL"
                        testIdPrefix={`funfact-img-${idx}`}
                        size="lg"
                      />
                    </Field>
                  </div>
                )}
                <div className={`${showImage ? 'col-span-12 sm:col-span-7' : 'col-span-1'} space-y-2`}>
                  <Field label="Judul"><input data-testid={`funfact-title-${idx}`} className={inputCls} value={f.title} onChange={e => update(idx, 'title', e.target.value)} placeholder="Risoles Si Imigran Belanda 🇳🇱" /></Field>
                  <Field label="Narasi / Cerita"><textarea data-testid={`funfact-text-${idx}`} rows={4} className={inputCls + ' resize-none'} value={f.text} onChange={e => update(idx, 'text', e.target.value)} placeholder="Cerita menarik tentang produk atau brand..." /></Field>
                </div>
              </div>
            </div>
          );})}
        </div>
      </Section>
    </div>
  );
}


// ─── ONBOARDING TEXTS (Login/Register Popup) ─────────────────────────
const ONBOARDING_FIELDS = [
  { key: 'header_title', label: 'Header Title (atas popup)', placeholder: 'Halo, Bunda! 🦆' },
  { key: 'header_subtitle', label: 'Header Subtitle', placeholder: 'Frozen Food premium yang lagi viral di Malang' },
  { key: 'welcome_title', label: 'Welcome Title (judul utama)', placeholder: 'Yuk, mulai belanja!' },
  { key: 'welcome_subtitle', label: 'Welcome Subtitle', placeholder: 'Daftar dulu untuk akses promo...', multiline: true },
  { key: 'register_label', label: 'Tombol Daftar - Label', placeholder: 'Daftar Sekarang' },
  { key: 'register_subtitle', label: 'Tombol Daftar - Subtitle', placeholder: 'Dapatkan poin & promo special' },
  { key: 'login_label', label: 'Tombol Masuk - Label', placeholder: 'Masuk' },
  { key: 'login_subtitle', label: 'Tombol Masuk - Subtitle', placeholder: 'Sudah punya akun? Masuk yuk' },
  { key: 'guest_label', label: 'Tombol Tamu - Label', placeholder: 'Lanjut sebagai Tamu' },
  { key: 'guest_subtitle', label: 'Tombol Tamu - Subtitle', placeholder: 'Belanja tanpa daftar (no promo)' },
  { key: 'tos_text', label: 'Teks Syarat & Ketentuan', placeholder: 'Dengan melanjutkan, kamu setuju...', multiline: true },
  { key: 'phone_hint', label: 'Hint Nomor Telepon', placeholder: '💡 Pastikan nomor WhatsApp aktif...' },
  { key: 'otp_hint', label: 'Hint Layar OTP', placeholder: '📱 Cek WhatsApp kamu untuk lihat kode OTP' },
];

export function OnboardingTextsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [texts, setTexts] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setTexts(storeConfig?.onboarding_texts || {}); }, [storeConfig]);
  const set = (k, v) => setTexts(prev => ({ ...prev, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/store-config`, { onboarding_texts: texts }); await refreshStoreConfig(); toast.success('Teks onboarding tersimpan! Buyer akan lihat update real-time 🎉'); }
    catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Teks Onboarding Buyer</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Edit wording di popup login/register/guest yang tampil pertama kali ke pelanggan baru.</p>
        </div>
        <button data-testid="save-onboarding-texts-btn" onClick={save} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Wording Popup Login & Register" icon={LogIn}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ONBOARDING_FIELDS.map(f => (
            <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
              <Field label={f.label}>
                {f.multiline ? (
                  <textarea data-testid={`onb-text-${f.key}`} rows={2} className={inputCls + ' resize-none'} value={texts[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                ) : (
                  <input data-testid={`onb-text-${f.key}`} className={inputCls} value={texts[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
