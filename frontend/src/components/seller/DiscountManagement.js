import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Tag, X, Save } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

function DiscountForm({ initial, products, onSave, onCancel }) {
  const [f, setF] = useState(initial || { name: '', type: 'percent', value: 10, product_ids: [], active: true });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const toggleProduct = (id) => {
    setF(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(id) ? prev.product_ids.filter(x => x !== id) : [...prev.product_ids, id]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA] bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7]">
          <h3 className="font-heading font-bold text-[#7C2D12] text-xl">{initial ? 'Edit Diskon' : 'Tambah Diskon Baru'}</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#FED7AA]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Nama Diskon</label>
              <input data-testid="discount-name-input" className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} placeholder="Promo Spesial Lebaran" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Status</label>
              <label className="flex items-center gap-2 mt-2.5">
                <input type="checkbox" checked={f.active} onChange={e => set('active', e.target.checked)} className="w-5 h-5 accent-[#EA580C]" />
                <span className="text-sm font-semibold text-[#7C2D12]">{f.active ? 'Aktif' : 'Nonaktif'}</span>
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Tipe Diskon</label>
              <select className={inputCls} value={f.type} onChange={e => set('type', e.target.value)}>
                <option value="percent">Persen (%)</option>
                <option value="fixed">Potongan Tetap (Rp)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Nilai Diskon</label>
              <input data-testid="discount-value-input" type="number" className={inputCls} value={f.value} onChange={e => set('value', Number(e.target.value))} />
              <p className="text-xs text-gray-500 mt-1">{f.type === 'percent' ? `${f.value}% potongan harga` : `${fmt(f.value)} potongan harga`}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-2 uppercase">Pilih Produk yang Diberi Diskon ({f.product_ids.length} dipilih)</label>
            <div className="max-h-64 overflow-y-auto border border-[#FED7AA] rounded-xl p-2 space-y-1">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-[#FFF7ED] rounded-lg cursor-pointer">
                  <input type="checkbox" checked={f.product_ids.includes(p.id)} onChange={() => toggleProduct(p.id)} className="w-4 h-4 accent-[#EA580C]" />
                  <img src={p.image_url} alt="" className="w-9 h-9 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#7C2D12] truncate">{p.name}</p>
                    <p className="text-xs text-[#9A3412]">{fmt(p.price)}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#FED7AA]">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border-2 border-[#FED7AA] text-[#7C2D12] font-bold hover:bg-[#FED7AA]">Batal</button>
          <button data-testid="save-discount-btn" onClick={() => onSave(f)} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold flex items-center justify-center gap-2"><Save size={16} /> Simpan</button>
        </div>
      </div>
    </div>
  );
}

export default function DiscountManagement() {
  const { discounts, products, refreshDiscounts, refreshProducts } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const handleSave = async (form) => {
    try {
      if (editItem) await axios.put(`${API}/api/discounts/${editItem.id}`, form);
      else await axios.post(`${API}/api/discounts`, form);
      // Apply discount_id to selected products
      for (const p of products) {
        const shouldHave = form.product_ids.includes(p.id) && form.active;
        const currentId = editItem ? editItem.id : null;
        if (shouldHave && p.discount_id !== (editItem?.id || 'new')) {
          // Will be set after creation if new, skip
        }
        if (!shouldHave && p.discount_id === currentId) {
          await axios.put(`${API}/api/products/${p.id}`, { discount_id: null });
        }
      }
      await refreshDiscounts();
      // For new discount, fetch latest list to get its id and apply to products
      if (!editItem) {
        const list = await axios.get(`${API}/api/discounts`).then(r => r.data);
        const created = list.find(d => d.name === form.name && d.value === form.value);
        if (created) {
          for (const pid of form.product_ids) {
            await axios.put(`${API}/api/products/${pid}`, { discount_id: created.id });
          }
        }
      } else {
        for (const pid of form.product_ids) {
          await axios.put(`${API}/api/products/${pid}`, { discount_id: editItem.id });
        }
      }
      await refreshProducts();
      toast.success(`Diskon ${editItem ? 'diupdate' : 'ditambahkan'}!`);
      setShowForm(false); setEditItem(null);
    } catch { toast.error('Gagal simpan diskon'); }
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Hapus diskon "${d.name}"?`)) return;
    try {
      // Remove discount_id from products
      for (const p of products) {
        if (p.discount_id === d.id) await axios.put(`${API}/api/products/${p.id}`, { discount_id: null });
      }
      await axios.delete(`${API}/api/discounts/${d.id}`);
      await refreshDiscounts(); await refreshProducts();
      toast.success('Diskon dihapus!');
    } catch { toast.error('Gagal hapus'); }
  };

  const productsWithDiscount = (d) => products.filter(p => p.discount_id === d.id);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Diskon Produk</h1>
        <button data-testid="add-discount-btn" onClick={() => { setEditItem(null); setShowForm(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow hover:shadow-lg">
          <Plus size={18} /> Tambah Diskon
        </button>
      </div>

      {discounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-12 text-center">
          <Tag size={40} className="mx-auto text-[#FED7AA] mb-3" />
          <p className="font-bold text-[#7C2D12]">Belum ada diskon</p>
          <p className="text-sm text-[#9A3412] mt-1">Bikin promo biar pelanggan makin tergiur 🤩</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discounts.map(d => {
            const pp = productsWithDiscount(d);
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
                <div className={`px-5 py-3 ${d.active ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C]' : 'bg-gray-400'} text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Tag size={16} />
                    <span className="font-bold">{d.name}</span>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{d.active ? 'AKTIF' : 'NONAKTIF'}</span>
                </div>
                <div className="p-5">
                  <div className="text-3xl font-extrabold text-[#EA580C] mb-1">
                    {d.type === 'percent' ? `${d.value}%` : fmt(d.value)} OFF
                  </div>
                  <p className="text-xs text-[#9A3412] mb-3">Berlaku untuk {pp.length} produk</p>
                  {pp.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3 max-h-16 overflow-hidden">
                      {pp.slice(0, 4).map(p => (
                        <span key={p.id} className="text-[10px] px-2 py-0.5 bg-[#FEF3C7] text-[#7C2D12] rounded-full font-semibold">{p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name}</span>
                      ))}
                      {pp.length > 4 && <span className="text-[10px] px-2 py-0.5 bg-[#FEF3C7] text-[#7C2D12] rounded-full font-semibold">+{pp.length - 4}</span>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button data-testid={`edit-discount-${d.id}`} onClick={() => { setEditItem({ ...d, product_ids: pp.map(p => p.id) }); setShowForm(true); }} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-[#FEF3C7] text-[#92400E] hover:bg-[#FED7AA] text-sm font-bold"><Edit2 size={14} /> Edit</button>
                    <button onClick={() => handleDelete(d)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-sm font-bold"><Trash2 size={14} /> Hapus</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <DiscountForm
          initial={editItem}
          products={products}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditItem(null); }}
        />
      )}
    </div>
  );
}
