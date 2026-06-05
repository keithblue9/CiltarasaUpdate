import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Store, BookOpen, FolderTree, Truck, CreditCard, Image as ImageIcon, MapPin, Phone, Clock, Instagram, Music2, Type, ImagePlus, Sparkles, ChevronUp, ChevronDown, LogIn } from 'lucide-react';
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
export function StoreCerita() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [cerita, setCerita] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCerita(storeConfig?.cerita || ''); }, [storeConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, { cerita });
      await refreshStoreConfig();
      toast.success('Cerita perjalanan tersimpan!');
    } catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Cerita Perjalanan</h1>
        <button data-testid="save-cerita-btn" onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
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

  const add = () => setCats([...cats, { id: 'kat-' + Date.now(), name: '', icon: '📦' }]);
  const update = (idx, k, v) => { const u = [...cats]; u[idx] = { ...u[idx], [k]: v }; setCats(u); };
  const remove = (idx) => setCats(cats.filter((_, i) => i !== idx));

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
  useEffect(() => { setItems(storeConfig?.delivery_options || []); }, [storeConfig]);
  const add = () => setItems([...items, { id: 'opt-' + Date.now(), name: '', description: '', fee: 0, active: true }]);
  const update = (idx, k, v) => { const u = [...items]; u[idx] = { ...u[idx], [k]: v }; setItems(u); };
  const remove = (idx) => setItems(items.filter((_, i) => i !== idx));
  const handleSave = async () => { setSaving(true); try { await axios.put(`${API}/api/store-config`, { delivery_options: items }); await refreshStoreConfig(); toast.success('Tersimpan!'); } catch { toast.error('Gagal'); } finally { setSaving(false); } };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Layanan Pengiriman</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Opsi Pengiriman" icon={Truck} action={<button data-testid="add-delivery-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={it.id || `del-${idx}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4"><Field label="Nama"><input className={inputCls} value={it.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="Kurir Toko" /></Field></div>
                <div className="col-span-3"><Field label="Ongkir (Rp)"><input type="number" className={inputCls} value={it.fee} onChange={e => update(idx, 'fee', Number(e.target.value))} /></Field></div>
                <div className="col-span-4"><Field label="Deskripsi"><input className={inputCls} value={it.description} onChange={e => update(idx, 'description', e.target.value)} /></Field></div>
                <div className="col-span-1 flex flex-col items-center justify-end pb-2">
                  <label className="flex items-center gap-1 cursor-pointer text-xs font-bold text-[#7C2D12]">
                    <input type="checkbox" checked={it.active} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" />
                  </label>
                  <button onClick={() => remove(idx)} className="mt-1 p-1 text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
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
    setItems(storeConfig?.payment_methods || []);
    setQrisImageUrl(storeConfig?.qris_image_url || '');
    setPaymentTexts(storeConfig?.payment_texts || {});
  }, [storeConfig]);
  const add = () => setItems([...items, { id: 'pay-' + Date.now(), name: '', type: 'transfer', details: '', active: true }]);
  const update = (idx, k, v) => { const u = [...items]; u[idx] = { ...u[idx], [k]: v }; setItems(u); };
  const remove = (idx) => setItems(items.filter((_, i) => i !== idx));
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
          {items.map((it, idx) => (
            <div key={it.id || `pay-${idx}`} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><Field label="Nama"><input className={inputCls} value={it.name} onChange={e => update(idx, 'name', e.target.value)} placeholder="Transfer BCA" /></Field></div>
                <div className="col-span-2">
                  <Field label="Tipe">
                    <select className={inputCls} value={it.type} onChange={e => update(idx, 'type', e.target.value)}>
                      <option value="transfer">Transfer Bank</option>
                      <option value="qris">QRIS</option>
                      <option value="cod">COD</option>
                      <option value="ewallet">E-Wallet</option>
                    </select>
                  </Field>
                </div>
                <div className="col-span-5"><Field label="Detail / Petunjuk"><input className={inputCls} value={it.details} onChange={e => update(idx, 'details', e.target.value)} /></Field></div>
                <div className="col-span-1 pb-2"><input data-testid={`payment-active-${it.id || idx}`} type="checkbox" checked={it.active} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" /></div>
                <button onClick={() => remove(idx)} className="col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>

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
  const add = () => setSlides([...slides, { id: 'slide-' + Date.now(), image_url: '', duration_ms: 5000, active: true }]);
  const update = (idx, k, v) => { const u = [...slides]; u[idx] = { ...u[idx], [k]: v }; setSlides(u); };
  const remove = (idx) => setSlides(slides.filter((_, i) => i !== idx));
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
export function FunFactsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [facts, setFacts] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setFacts(storeConfig?.fun_facts || []); }, [storeConfig]);
  const add = () => setFacts([...facts, { id: 'ff-' + Date.now(), image_url: '', title: '', text: '' }]);
  const update = (idx, k, v) => { const u = [...facts]; u[idx] = { ...u[idx], [k]: v }; setFacts(u); };
  const remove = (idx) => setFacts(facts.filter((_, i) => i !== idx));
  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/api/store-config`, { fun_facts: facts }); await refreshStoreConfig(); toast.success('Fun facts tersimpan! ✨'); }
    catch { toast.error('Gagal simpan'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Fun Facts Popup</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Popup edukasi pelanggan di homepage buyer (bisa di-swipe). Best practice: 5 fun facts.</p>
        </div>
        <button data-testid="save-funfacts-btn" onClick={save} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Daftar Fun Facts" icon={Sparkles} action={<button data-testid="add-funfact-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-3">
          {facts.length === 0 && <p className="text-sm text-gray-500 text-center py-6">Belum ada fun fact. Buat 5 fakta menarik tentang toko!</p>}
          {facts.map((f, idx) => (
            <div key={f.id || `ff-${idx}`} className="grid grid-cols-12 gap-3 p-4 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
              <div className="col-span-12 sm:col-span-4">
                <Field label={`Gambar Fun Fact #${idx + 1}`}>
                  <ImageUrlInput
                    value={f.image_url}
                    onChange={v => update(idx, 'image_url', v)}
                    placeholder="Upload atau paste URL gambar 4:3"
                    testIdPrefix={`funfact-img-${idx}`}
                    size="lg"
                  />
                </Field>
              </div>
              <div className="col-span-11 sm:col-span-7 space-y-2">
                <Field label={`Judul Fun Fact #${idx + 1}`}><input data-testid={`funfact-title-${idx}`} className={inputCls} value={f.title} onChange={e => update(idx, 'title', e.target.value)} placeholder="Risoles Bunda Itu Resep Turunan" /></Field>
                <Field label="Narasi / Cerita"><textarea data-testid={`funfact-text-${idx}`} rows={4} className={inputCls + ' resize-none'} value={f.text} onChange={e => update(idx, 'text', e.target.value)} placeholder="Cerita menarik tentang produk atau brand..." /></Field>
              </div>
              <div className="col-span-1 flex justify-end">
                <button onClick={() => remove(idx)} className="p-2 rounded-lg bg-red-50 text-red-500 self-start"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
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
