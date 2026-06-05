import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Trash2, Package, CheckCircle2, Clock, Truck, Lightbulb } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

function PurchaseForm({ products, prefill, onSave, onCancel }) {
  const [form, setForm] = useState({
    items: prefill?.items?.length ? prefill.items : [{ product_id: '', product_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }],
    supplier: prefill?.supplier || '',
    ordered_at: prefill?.ordered_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    notes: prefill?.notes || '',
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const addItem = () => setF('items', [...form.items, { product_id: '', product_name: '', quantity: 1, unit_cost: 0, subtotal: 0 }]);
  const removeItem = (idx) => setF('items', form.items.filter((_, i) => i !== idx));

  const updateItem = (idx, k, v) => {
    const u = [...form.items];
    u[idx] = { ...u[idx], [k]: v };
    if (k === 'product_id') {
      const p = products.find(x => x.id === v);
      if (p) { u[idx].product_name = p.name; u[idx].unit_cost = u[idx].unit_cost || p.cost_price || 0; }
    }
    u[idx].subtotal = (u[idx].quantity || 0) * (u[idx].unit_cost || 0);
    setF('items', u);
  };

  const total = form.items.reduce((s, i) => s + (i.subtotal || 0), 0);

  const submit = () => {
    if (!form.items.some(i => i.product_id && i.quantity > 0)) {
      toast.error('Tambahkan minimal 1 produk');
      return;
    }
    onSave({
      ...form,
      items: form.items.filter(i => i.product_id && i.quantity > 0),
      ordered_at: new Date(form.ordered_at).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA] bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] sticky top-0">
          <h3 className="font-heading font-bold text-[#7C2D12] text-xl">Buat Pesanan Pembelian (Restock)</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#FED7AA]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Supplier</label>
              <input className={inputCls} value={form.supplier} onChange={e => setF('supplier', e.target.value)} placeholder="Toko Sayur Pak Tono / Sendiri" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Tanggal Pesan</label>
              <input type="date" className={inputCls} value={form.ordered_at} onChange={e => setF('ordered_at', e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#7C2D12] uppercase">Item Yang Dipesan</label>
              <button data-testid="add-purchase-item" onClick={addItem} className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1"><Plus size={12} /> Tambah Item</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={it._uid || `pitem-${idx}-${it.product_id || ''}`} className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#FFFBF5] border border-[#FED7AA]">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Produk</label>
                    <select data-testid={`purchase-item-product-${idx}`} className={inputCls + ' text-xs'} value={it.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                      <option value="">Pilih produk...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (stok: {p.stock})</option>)}
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Qty</label>
                    <input data-testid={`purchase-item-qty-${idx}`} type="number" className={inputCls} value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">HPP/unit (Rp)</label>
                    <input data-testid={`purchase-item-cost-${idx}`} type="number" className={inputCls} value={it.unit_cost} onChange={e => updateItem(idx, 'unit_cost', Number(e.target.value))} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#7C2D12] mb-1">Subtotal</label>
                    <div className="px-3 py-2.5 text-xs font-bold text-[#EA580C]">{fmtRp(it.subtotal)}</div>
                  </div>
                  <button onClick={() => removeItem(idx)} className="col-span-1 p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <span className="text-sm text-[#9A3412]">Total: </span>
              <span className="text-xl font-extrabold text-[#EA580C]">{fmtRp(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Catatan</label>
            <textarea rows={2} className={inputCls + ' resize-none'} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Catatan untuk supplier atau pribadi..." />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-[#FED7AA] sticky bottom-0 bg-white">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border-2 border-[#FED7AA] text-[#7C2D12] font-bold hover:bg-[#FED7AA]">Batal</button>
          <button data-testid="save-purchase-btn" onClick={submit} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold flex items-center justify-center gap-2"><Save size={16} /> Simpan Pesanan</button>
        </div>
      </div>
    </div>
  );
}

function PurchaseCard({ purchase, onReceive, onDelete }) {
  const isReceived = purchase.status === 'received';
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().slice(0, 10));
  const [showReceiveForm, setShowReceiveForm] = useState(false);

  return (
    <div data-testid={`purchase-card-${purchase.id}`} className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
      <div className={`px-5 py-3 ${isReceived ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'} text-white flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {isReceived ? <CheckCircle2 size={16} /> : <Clock size={16} />}
          <span className="font-bold text-sm">{purchase.purchase_number}</span>
          <span className="text-[10px] font-bold bg-white/30 px-2 py-0.5 rounded-full">{isReceived ? 'DITERIMA' : 'PENDING'}</span>
        </div>
        <span className="font-bold text-sm">{fmtRp(purchase.total)}</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
          <div>
            <span className="text-[#9A3412] font-semibold">Supplier:</span>
            <p className="font-bold text-[#7C2D12]">{purchase.supplier || '-'}</p>
          </div>
          <div>
            <span className="text-[#9A3412] font-semibold">Tgl Pesan:</span>
            <p className="font-bold text-[#7C2D12]">{fmtDate(purchase.ordered_at)}</p>
          </div>
          {isReceived && (
            <>
              <div>
                <span className="text-[#9A3412] font-semibold">Tgl Diterima:</span>
                <p className="font-bold text-green-700">{fmtDate(purchase.received_at)}</p>
              </div>
              <div>
                <span className="text-[#9A3412] font-semibold">Lead Time:</span>
                <p className="font-bold text-[#7C2D12]">
                  {Math.round((new Date(purchase.received_at) - new Date(purchase.ordered_at)) / 86400000)} hari
                </p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-[#FED7AA] pt-3 space-y-1.5">
          {purchase.items?.map((item, i) => (
            <div key={`${purchase.id}-item-${item.product_id || i}`} className="flex items-center justify-between text-xs">
              <span className="text-[#451A03] truncate flex-1">{item.product_name} <span className="text-[#9A3412]">× {item.quantity}</span></span>
              <span className="font-bold text-[#7C2D12] ml-2">{fmtRp(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {purchase.notes && <p className="mt-2 text-xs text-[#9A3412] italic bg-[#FFFBF5] px-2 py-1 rounded">📝 {purchase.notes}</p>}

        {!isReceived && (
          <div className="mt-3 pt-3 border-t border-[#FED7AA]">
            {!showReceiveForm ? (
              <div className="flex gap-2">
                <button data-testid={`mark-received-${purchase.id}`} onClick={() => setShowReceiveForm(true)} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} /> Tandai Sudah Diterima
                </button>
                <button onClick={() => onDelete(purchase)} className="px-3 py-2 rounded-xl bg-red-50 text-red-500"><Trash2 size={14} /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#7C2D12]">Tanggal diterima:</label>
                <input type="date" className={inputCls} value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setShowReceiveForm(false)} className="flex-1 py-2 rounded-xl border border-[#FED7AA] text-[#7C2D12] font-bold text-xs">Batal</button>
                  <button onClick={() => onReceive(purchase, confirmDate)} className="flex-1 py-2 rounded-xl bg-green-500 text-white font-bold text-xs">Konfirmasi Terima</button>
                </div>
                <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded">⚠️ Stok produk akan auto-bertambah saat dikonfirmasi terima</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchaseManagement() {
  const { products, purchases, refreshPurchases, refreshProducts } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [filter, setFilter] = useState('all');

  // Listen for restock alert clicks via custom event
  useEffect(() => {
    const handler = (e) => {
      setPrefill({ items: [{ product_id: e.detail.id, product_name: e.detail.name, quantity: e.detail.suggested_qty || 20, unit_cost: e.detail.last_cost || 0, subtotal: (e.detail.suggested_qty || 20) * (e.detail.last_cost || 0) }] });
      setShowForm(true);
    };
    window.addEventListener('openRestockForm', handler);
    return () => window.removeEventListener('openRestockForm', handler);
  }, []);

  const handleSave = async (data) => {
    try {
      await axios.post(`${API}/api/purchases`, data);
      await refreshPurchases();
      toast.success('Pesanan pembelian dibuat!');
      setShowForm(false); setPrefill(null);
    } catch { toast.error('Gagal simpan'); }
  };

  const handleReceive = async (p, dateStr) => {
    try {
      const ts = new Date(dateStr).toISOString();
      await axios.post(`${API}/api/purchases/${p.id}/receive`, null, { params: { received_at: ts } });
      await refreshPurchases();
      await refreshProducts();
      toast.success('Stok produk auto-bertambah! 📦');
    } catch (e) { toast.error('Gagal: ' + (e.response?.data?.detail || 'error')); }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus pembelian ${p.purchase_number}?`)) return;
    try {
      await axios.delete(`${API}/api/purchases/${p.id}`);
      await refreshPurchases();
      toast.success('Pembelian dihapus');
    } catch { toast.error('Gagal hapus'); }
  };

  const filtered = purchases.filter(p => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Pembelian / Restock</h1>
          <p className="text-xs text-[#9A3412] mt-0.5">Kelola pembelian bahan baku & restock produk. Stok auto-bertambah saat barang diterima.</p>
        </div>
        <button data-testid="add-purchase-btn" onClick={() => { setPrefill(null); setShowForm(true); }} className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow hover:shadow-lg">
          <Plus size={16} /> Buat Pembelian
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'ordered', 'received'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold ${filter === f ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow' : 'bg-white border border-[#FED7AA] text-[#7C2D12]'}`}>
            {f === 'all' ? `Semua (${purchases.length})` : f === 'ordered' ? `Pending (${purchases.filter(p => p.status === 'ordered').length})` : `Diterima (${purchases.filter(p => p.status === 'received').length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-12 text-center">
          <Package size={40} className="mx-auto text-[#FED7AA] mb-3" />
          <p className="font-bold text-[#7C2D12]">Belum ada pembelian</p>
          <p className="text-xs text-[#9A3412] mt-1">Mulai dengan membuat pesanan pembelian pertama</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <PurchaseCard key={p.id} purchase={p} onReceive={handleReceive} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showForm && (
        <PurchaseForm products={products} prefill={prefill} onSave={handleSave} onCancel={() => { setShowForm(false); setPrefill(null); }} />
      )}
    </div>
  );
}
