import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Save, X, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

const EMPTY_FORM = { name: '', description: '', price: '', cost_price: '', category: 'snack', stock: '', active: true, image_url: '' };

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA]">
          <h3 className="font-heading font-bold text-[#78350F] text-xl">{initial ? 'Edit Produk' : 'Tambah Produk'}</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#FED7AA]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#78350F] mb-1">Nama Produk *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} data-testid="product-name-input"
              className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#78350F] mb-1">Deskripsi</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Harga Jual (Rp) *</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)} data-testid="product-price-input"
                className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Harga Modal (Rp)</label>
              <input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Kategori</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body">
                <option value="snack">Frozen Snack</option>
                <option value="bebek">Bebek Pawon Ayu</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#78350F] mb-1">Stok *</label>
              <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} data-testid="product-stock-input"
                className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#78350F] mb-1">URL Gambar</label>
            <input type="text" value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set('active', !form.active)}>
              {form.active ? <ToggleRight size={32} className="text-[#D97706]" /> : <ToggleLeft size={32} className="text-gray-400" />}
            </div>
            <span className="text-sm font-semibold text-[#78350F]">Produk Aktif (tampil di toko)</span>
          </label>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#FED7AA]">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border-2 border-[#FED7AA] text-[#78350F] font-bold hover:bg-[#FED7AA] transition-all">Batal</button>
          <button data-testid="save-product-btn" onClick={() => onSave(form)} className="flex-1 py-3 rounded-xl bg-[#D97706] text-white font-bold hover:bg-[#B45309] transition-all flex items-center justify-center gap-2">
            <Save size={16} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductManagement() {
  const { products, refreshProducts } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [filter, setFilter] = useState('all');

  const handleSave = async (form) => {
    if (!form.name || !form.price || form.stock === '') { toast.error('Nama, harga, dan stok wajib diisi!'); return; }
    try {
      const payload = { ...form, price: Number(form.price), cost_price: Number(form.cost_price) || 0, stock: Number(form.stock) };
      if (editProduct) {
        await axios.put(`${API}/api/products/${editProduct.id}`, payload);
        toast.success('Produk berhasil diupdate!');
      } else {
        await axios.post(`${API}/api/products`, payload);
        toast.success('Produk berhasil ditambahkan!');
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

  const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Manajemen Produk</h1>
        <button data-testid="add-product-btn" onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#D97706] text-white font-bold px-5 py-2.5 rounded-full hover:bg-[#B45309] transition-all">
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {[{id:'all',label:'Semua'},{id:'snack',label:'Frozen Snack'},{id:'bebek',label:'Bebek Pawon Ayu'}].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filter===f.id?'bg-[#D97706] text-white':'bg-white border border-[#FED7AA] text-[#78350F] hover:bg-[#FED7AA]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(product => (
          <div key={product.id} data-testid={`seller-product-${product.id}`} className={`bg-white rounded-2xl border overflow-hidden ${product.active ? 'border-[#FED7AA]' : 'border-gray-200 opacity-70'}`}>
            <div className="relative h-40">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              {!product.active && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">Nonaktif</span>
                </div>
              )}
              {product.stock < 10 && product.active && (
                <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} /> Stok Rendah
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-heading font-bold text-[#78350F] text-sm leading-snug mb-1">{product.name}</h3>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#D97706] font-bold">{formatRp(product.price)}</span>
                <span className="text-xs text-[#92400E]">Modal: {formatRp(product.cost_price)}</span>
              </div>

              {/* Stock control */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-[#78350F]">Stok:</span>
                <div className="flex items-center border border-[#FED7AA] rounded-full overflow-hidden">
                  <button onClick={() => handleStockChange(product, -1)} className="px-2.5 py-1 text-[#78350F] hover:bg-[#FED7AA] font-bold text-sm">-</button>
                  <span className="px-3 text-sm font-bold text-[#78350F] min-w-[32px] text-center">{product.stock}</span>
                  <button onClick={() => handleStockChange(product, 1)} className="px-2.5 py-1 text-[#78350F] hover:bg-[#FED7AA] font-bold text-sm">+</button>
                </div>
                <button onClick={() => handleToggle(product)} className="ml-auto" data-testid={`toggle-product-${product.id}`}>
                  {product.active ? <ToggleRight size={28} className="text-[#D97706]" /> : <ToggleLeft size={28} className="text-gray-400" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setEditProduct(product); setShowForm(true); }} data-testid={`edit-product-${product.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-[#FED7AA] text-sm font-semibold transition-all">
                  <Edit2 size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(product.id, product.name)} data-testid={`delete-product-${product.id}`}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-sm font-semibold transition-all">
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
        />
      )}
    </div>
  );
}
