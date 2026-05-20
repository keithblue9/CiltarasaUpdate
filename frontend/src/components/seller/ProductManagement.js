import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X, AlertTriangle, Image as ImageIcon, Tag } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';
import ImageUrlInput from '../shared/ImageUrlInput';


const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

const EMPTY_FORM = {
  name: '', description: '', price: '', cost_price: '',
  category: 'snack', categories: [], stock: '', unit: 'pack', weight: '',
  active: true, image_url: '', media_urls: ['', '', '', '', ''], discount_id: ''
};

function MediaInput({ index, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-[#7C2D12]">FOTO/VIDEO #{index + 1}{index === 0 && ' (Cover)'}</label>
      <ImageUrlInput
        value={value}
        onChange={onChange}
        placeholder="GDrive / iCloud / URL gambar"
        testIdPrefix={`media-${index}`}
        size="sm"
      />
    </div>
  );
}

function ProductForm({ initial, onSave, onCancel, storeConfig, discounts }) {
  const initData = initial
    ? {
        ...EMPTY_FORM, ...initial,
        media_urls: [...(initial.media_urls || []), '', '', '', '', ''].slice(0, 5),
        categories: initial.categories || [],
        discount_id: initial.discount_id || '',
      }
    : EMPTY_FORM;
  const [form, setForm] = useState(initData);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMedia = (idx, v) => setForm(f => {
    const m = [...f.media_urls]; m[idx] = v; return { ...f, media_urls: m };
  });
  const toggleCat = (id) => setForm(f => ({
    ...f, categories: f.categories.includes(id) ? f.categories.filter(c => c !== id) : [...f.categories, id]
  }));
  const allCategories = storeConfig?.categories || [{ id: 'snack', name: 'Frozen Snack' }, { id: 'bebek', name: 'Bebek' }];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA] bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] sticky top-0 z-10">
          <h3 className="font-heading font-bold text-[#7C2D12] text-xl">{initial ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#FED7AA]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Basic info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#9A3412]">Informasi Dasar</h4>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Nama Produk *</label>
              <input data-testid="product-name-input" className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Deskripsi</label>
              <textarea className={inputCls + ' resize-none'} rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>

          {/* Media */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#9A3412]">Foto / Video Produk (Maks 5)</h4>
            <p className="text-[11px] text-gray-500">💡 Bisa pakai link Google Drive (share publik) atau iCloud atau URL gambar langsung. Foto pertama jadi cover.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2, 3, 4].map(i => (
                <MediaInput
                  key={i} index={i} value={form.media_urls[i] || ''}
                  onChange={v => setMedia(i, v)}
                />
              ))}
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#9A3412]">Harga & Stok</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Harga Jual (Rp) *</label>
                <input data-testid="product-price-input" type="number" className={inputCls} value={form.price} onChange={e => set('price', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">HPP / Modal (Rp)</label>
                <input data-testid="product-cost-input" type="number" className={inputCls} value={form.cost_price} onChange={e => set('cost_price', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Stok *</label>
                <input data-testid="product-stock-input" type="number" className={inputCls} value={form.stock} onChange={e => set('stock', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Satuan</label>
                <select className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)}>
                  <option value="pack">Pack</option>
                  <option value="ekor">Ekor</option>
                  <option value="kg">Kg</option>
                  <option value="paket">Paket</option>
                  <option value="pcs">Pcs</option>
                  <option value="botol">Botol</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Berat (kg)</label>
                <input type="number" step="0.1" className={inputCls} value={form.weight} onChange={e => set('weight', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Kategori Utama (legacy)</label>
                <select className={inputCls} value={form.category} onChange={e => set('category', e.target.value)}>
                  {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#9A3412]">Kategori Produk (Multi)</h4>
            <p className="text-[11px] text-gray-500">Pilih semua kategori yang sesuai biar produkmu gampang ditemukan.</p>
            <div className="flex flex-wrap gap-2">
              {allCategories.map(c => (
                <button
                  type="button"
                  key={c.id}
                  data-testid={`cat-chip-${c.id}`}
                  onClick={() => toggleCat(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${form.categories.includes(c.id) ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow' : 'bg-white border border-[#FED7AA] text-[#7C2D12] hover:bg-[#FEF3C7]'}`}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#9A3412]">Diskon</h4>
            <select data-testid="product-discount-select" className={inputCls} value={form.discount_id || ''} onChange={e => set('discount_id', e.target.value || null)}>
              <option value="">Tidak ada diskon</option>
              {(discounts || []).filter(d => d.active).map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type === 'percent' ? `${d.value}%` : formatRp(d.value)})
                </option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[#FFF7ED] border border-[#FED7AA]">
            <div onClick={() => set('active', !form.active)}>
              {form.active ? <ToggleRight size={32} className="text-[#EA580C]" /> : <ToggleLeft size={32} className="text-gray-400" />}
            </div>
            <span className="text-sm font-semibold text-[#7C2D12]">Produk Aktif (tampil di toko)</span>
          </label>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#FED7AA] sticky bottom-0 bg-white">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border-2 border-[#FED7AA] text-[#7C2D12] font-bold hover:bg-[#FED7AA]">Batal</button>
          <button data-testid="save-product-btn" onClick={() => onSave(form)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold flex items-center justify-center gap-2"><Save size={16} /> Simpan Produk</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductManagement() {
  const { products, refreshProducts, storeConfig, discounts } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [filter, setFilter] = useState('all');
  const lowStockThreshold = storeConfig?.low_stock_threshold ?? 10;

  const handleSave = async (form) => {
    if (!form.name || !form.price || form.stock === '') { toast.error('Nama, harga, dan stok wajib diisi!'); return; }
    try {
      const media = (form.media_urls || []).filter(u => u && u.trim());
      const payload = {
        ...form,
        price: Number(form.price),
        cost_price: Number(form.cost_price) || 0,
        stock: Number(form.stock),
        weight: Number(form.weight) || 0,
        media_urls: media,
        image_url: media[0] || form.image_url || '',
        discount_id: form.discount_id || null,
      };
      if (editProduct) {
        await axios.put(`${API}/api/products/${editProduct.id}`, payload);
        toast.success('Produk diupdate!');
      } else {
        await axios.post(`${API}/api/products`, payload);
        toast.success('Produk ditambahkan!');
      }
      await refreshProducts();
      setShowForm(false);
      setEditProduct(null);
    } catch { toast.error('Gagal menyimpan produk.'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus produk "${name}"?`)) return;
    try {
      await axios.delete(`${API}/api/products/${id}`);
      await refreshProducts();
      toast.success('Produk dihapus!');
    } catch { toast.error('Gagal menghapus.'); }
  };

  const handleToggle = async (product) => {
    try {
      await axios.put(`${API}/api/products/${product.id}`, { active: !product.active });
      await refreshProducts();
    } catch { toast.error('Gagal mengupdate status.'); }
  };

  const handleStockChange = async (product, delta) => {
    const newStock = Math.max(0, product.stock + delta);
    try {
      await axios.put(`${API}/api/products/${product.id}`, { stock: newStock });
      await refreshProducts();
    } catch { toast.error('Gagal update stok.'); }
  };

  const allCats = storeConfig?.categories || [];
  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter || (p.categories || []).includes(filter));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Manajemen Produk</h1>
        <button data-testid="add-product-btn" onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow hover:shadow-lg">
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-900 flex items-start gap-2">
        <span className="text-base">💡</span>
        <div>
          <strong>Info:</strong> Stok otomatis bertambah dari menu <strong>Pembelian / Restock</strong>. Di sini Anda hanya menambah/edit info produk, set diskon, dan kelola promo.
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${filter==='all'?'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white':'bg-white border border-[#FED7AA] text-[#7C2D12]'}`}>Semua ({products.length})</button>
        {allCats.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex items-center gap-1.5 ${filter===c.id?'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white':'bg-white border border-[#FED7AA] text-[#7C2D12]'}`}>
            <span>{c.icon}</span> {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(product => (
          <div key={product.id} data-testid={`seller-product-${product.id}`} className={`bg-white rounded-2xl border overflow-hidden ${product.active ? 'border-[#FED7AA]' : 'border-gray-200 opacity-70'}`}>
            <div className="relative h-40">
              <SmartImage src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              {!product.active && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">Nonaktif</span>
                </div>
              )}
              {product.discount && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <Tag size={10} /> {product.discount.type === 'percent' ? `${product.discount.value}% OFF` : `Diskon`}
                </div>
              )}
              {product.stock < lowStockThreshold && product.active && (
                <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} /> Stok Rendah
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-heading font-bold text-[#7C2D12] text-sm leading-snug mb-1 line-clamp-2">{product.name}</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[#EA580C] font-bold">{formatRp(product.final_price || product.price)}</div>
                  {product.final_price && product.final_price < product.price && (
                    <div className="text-xs text-gray-400 line-through">{formatRp(product.price)}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#9A3412]">HPP: {formatRp(product.cost_price)}</div>
                  <div className="text-xs text-green-600 font-bold">Sold: {product.sold_count || 0}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-[#7C2D12]">Stok:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#7C2D12]">{product.stock} {product.unit || ''}</span>
                <button onClick={() => handleToggle(product)} className="ml-auto" data-testid={`toggle-product-${product.id}`}>
                  {product.active ? <ToggleRight size={28} className="text-[#EA580C]" /> : <ToggleLeft size={28} className="text-gray-400" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setEditProduct(product); setShowForm(true); }} data-testid={`edit-product-${product.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-[#FED7AA] text-sm font-semibold">
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(product.id, product.name)} data-testid={`delete-product-${product.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-sm font-semibold">
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ProductForm
          initial={editProduct}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
          storeConfig={storeConfig}
          discounts={discounts}
        />
      )}
    </div>
  );
}
