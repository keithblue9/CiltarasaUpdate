import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Store, BookOpen, FolderTree, Truck, CreditCard, Image as ImageIcon, MapPin, Phone, Clock, Instagram, Music2 } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

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
          <Field label="Logo URL" hint="URL gambar logo (opsional)"><input className={inputCls} value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." /></Field>
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
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
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
            <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
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
            <div key={idx} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA] space-y-2">
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
export function PaymentsConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setItems(storeConfig?.payment_methods || []); }, [storeConfig]);
  const add = () => setItems([...items, { id: 'pay-' + Date.now(), name: '', type: 'transfer', details: '', active: true }]);
  const update = (idx, k, v) => { const u = [...items]; u[idx] = { ...u[idx], [k]: v }; setItems(u); };
  const remove = (idx) => setItems(items.filter((_, i) => i !== idx));
  const handleSave = async () => { setSaving(true); try { await axios.put(`${API}/api/store-config`, { payment_methods: items }); await refreshStoreConfig(); toast.success('Tersimpan!'); } catch { toast.error('Gagal'); } finally { setSaving(false); } };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Metode Pembayaran</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow"><Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}</button>
      </div>
      <Section title="Opsi Pembayaran" icon={CreditCard} action={<button data-testid="add-payment-btn" onClick={add} className="flex items-center gap-1 text-xs font-bold text-[#EA580C] hover:underline"><Plus size={14} /> Tambah</button>}>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
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
                <div className="col-span-1 pb-2"><input type="checkbox" checked={it.active} onChange={e => update(idx, 'active', e.target.checked)} className="w-4 h-4 accent-[#EA580C]" /></div>
                <button onClick={() => remove(idx)} className="col-span-1 p-2.5 rounded-xl bg-red-50 text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
