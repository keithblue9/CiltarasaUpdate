import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Tag, X, Save, Sparkles, Brain, RefreshCw, Check, TrendingUp, Package } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;
const inputCls = "w-full px-4 py-2.5 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] font-body text-[#451A03] bg-white";

function DiscountForm({ initial, products, onSave, onCancel }) {
  const isoToLocal = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 16); } catch { return ''; }
  };
  const [f, setF] = useState(() => initial ? {
    ...initial,
    starts_at: isoToLocal(initial.starts_at),
    ends_at: isoToLocal(initial.ends_at),
  } : { name: '', type: 'percent', value: 10, product_ids: [], active: true, is_flash_sale: false, starts_at: '', ends_at: '' });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const toggleProduct = (id) => {
    setF(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(id) ? prev.product_ids.filter(x => x !== id) : [...prev.product_ids, id]
    }));
  };

  // Toggle flash sale: auto-set 24h window
  const toggleFlashSale = () => {
    const newVal = !f.is_flash_sale;
    if (newVal && !f.ends_at) {
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setF(prev => ({
        ...prev,
        is_flash_sale: true,
        starts_at: now.toISOString().slice(0, 16),
        ends_at: end.toISOString().slice(0, 16),
      }));
    } else {
      set('is_flash_sale', newVal);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA] bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7]">
          <h3 className="font-heading font-bold text-[#7C2D12] text-xl">{initial ? 'Edit Diskon' : 'Tambah Diskon Baru'}</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#FED7AA]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Flash Sale toggle */}
          <button
            type="button"
            data-testid="toggle-flash-sale"
            onClick={toggleFlashSale}
            className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-3 text-left ${f.is_flash_sale ? 'border-red-400 bg-gradient-to-r from-red-50 to-orange-50' : 'border-[#FED7AA] bg-white hover:bg-[#FFF7ED]'}`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl ${f.is_flash_sale ? 'bg-gradient-to-br from-red-500 to-orange-500 animate-pulse' : 'bg-[#FED7AA]'}`}>
              ⚡
            </div>
            <div className="flex-1">
              <div className="font-bold text-[#7C2D12]">Flash Sale Mode {f.is_flash_sale && '🔥'}</div>
              <div className="text-xs text-[#9A3412]">{f.is_flash_sale ? 'Aktif — countdown timer akan tampil di buyer' : 'Diskon promo terbatas waktu (kayak TikTok shop!)'}</div>
            </div>
            <div className={`w-12 h-7 rounded-full flex items-center transition-all ${f.is_flash_sale ? 'bg-red-500 justify-end' : 'bg-gray-300 justify-start'}`}>
              <div className="w-6 h-6 bg-white rounded-full m-0.5" />
            </div>
          </button>

          {f.is_flash_sale && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-red-50 rounded-2xl border border-red-200">
              <div>
                <label className="block text-xs font-bold text-red-700 mb-1.5 uppercase">Mulai</label>
                <input data-testid="flash-starts-input" type="datetime-local" className={inputCls} value={f.starts_at || ''} onChange={e => set('starts_at', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-red-700 mb-1.5 uppercase">Berakhir</label>
                <input data-testid="flash-ends-input" type="datetime-local" className={inputCls} value={f.ends_at || ''} onChange={e => set('ends_at', e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#7C2D12] mb-1.5 uppercase">Nama Diskon</label>
              <input data-testid="discount-name-input" className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} placeholder={f.is_flash_sale ? '⚡ Flash Sale Hari Ini' : 'Promo Spesial'} />
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
                  <SmartImage src={p.image_url} alt="" className="w-9 h-9 rounded object-cover" />
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

  // ─── AI Recommendations state ───
  const [aiRecs, setAiRecs] = useState([]);
  const [aiMode, setAiMode] = useState(null); // 'ai' | 'local'
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const [selectedRecIds, setSelectedRecIds] = useState(new Set());
  const [showAiSection, setShowAiSection] = useState(true);

  const generateAiRecs = async () => {
    setAiGenerating(true);
    try {
      const r = await axios.post(`${API}/api/ai/discount-recommendations/generate`);
      const recs = r.data?.recommendations || [];
      if (!recs.length) {
        toast.error('Tidak ada rekomendasi. Pastikan ada produk aktif dengan margin cukup.');
        return;
      }
      setAiRecs(recs);
      setAiMode(r.data._mode);
      // Auto-select all by default (user can untick)
      setSelectedRecIds(new Set(recs.map(rec => rec.product_id)));
      toast.success(`🎉 ${recs.length} rekomendasi diskon dari ${r.data._mode === 'ai' ? 'Claude AI' : 'algoritma lokal'}!`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal generate rekomendasi');
    } finally { setAiGenerating(false); }
  };

  const toggleRec = (pid) => {
    setSelectedRecIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  const applyAiRecs = async () => {
    const toApply = aiRecs.filter(r => selectedRecIds.has(r.product_id));
    if (toApply.length === 0) { toast.error('Pilih minimal 1 rekomendasi'); return; }
    if (!window.confirm(`Aktifkan ${toApply.length} diskon? Tiap rekomendasi akan dibuat sebagai entry diskon baru & otomatis di-apply ke produk-nya.`)) return;
    setAiApplying(true);
    try {
      const r = await axios.post(`${API}/api/ai/discount-recommendations/apply`, { recommendations: toApply });
      await refreshDiscounts();
      await refreshProducts();
      const { created, errors } = r.data || {};
      toast.success(`✅ ${created} diskon dibuat & diaktifkan!${(errors || []).length ? ` (${errors.length} skipped)` : ''}`);
      // Clear applied recs from view
      setAiRecs(prev => prev.filter(r => !selectedRecIds.has(r.product_id)));
      setSelectedRecIds(new Set());
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal apply rekomendasi');
    } finally { setAiApplying(false); }
  };

  const handleSave = async (form) => {
    try {
      const payload = {
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      let created;
      if (editItem) {
        await axios.put(`${API}/api/discounts/${editItem.id}`, payload);
        created = editItem;
      } else {
        const r = await axios.post(`${API}/api/discounts`, payload);
        created = r.data;
      }
      // Apply discount_id to products
      for (const p of products) {
        const wasOnThis = p.discount_id === created.id;
        const shouldHave = form.product_ids.includes(p.id);
        if (shouldHave && !wasOnThis) {
          await axios.put(`${API}/api/products/${p.id}`, { discount_id: created.id });
        } else if (!shouldHave && wasOnThis) {
          await axios.put(`${API}/api/products/${p.id}`, { discount_id: null });
        }
      }
      await refreshDiscounts();
      await refreshProducts();
      toast.success(`Diskon ${editItem ? 'diupdate' : 'ditambahkan'}! ${form.is_flash_sale ? '⚡' : ''}`);
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

      {/* ─── AI Recommendations Card ─── */}
      <div data-testid="ai-discount-rec-card" className="rounded-2xl bg-gradient-to-br from-purple-50 via-white to-orange-50 border-2 border-purple-200 p-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 opacity-10 text-9xl">✨</div>
        <div className="relative">
          <div className="flex items-start gap-3 flex-wrap mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0 ${aiMode === 'local' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
              <Brain size={24} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-heading font-bold text-[#451A03] text-lg flex items-center gap-2 flex-wrap">
                Rekomendasi Diskon by AI
                {aiMode && (
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${aiMode === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {aiMode === 'local' ? 'Local Algorithm' : 'Claude AI'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#7C2D12] mt-1 leading-relaxed">
                AI analisa produk laris + margin sehat → kasih rekomendasi diskon strategis. Tiap saran ada estimasi margin setelah diskon, biar kamu tau bakal masih untung berapa.
              </p>
            </div>
          </div>

          {aiRecs.length === 0 ? (
            <button
              data-testid="generate-ai-rec-btn"
              onClick={generateAiRecs}
              disabled={aiGenerating}
              className="w-full sm:w-auto flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm px-5 py-2.5 rounded-full shadow disabled:opacity-50"
            >
              <Sparkles size={16} className={aiGenerating ? 'animate-spin' : ''} />
              {aiGenerating ? 'Menganalisa produk...' : 'Generate Rekomendasi AI'}
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3 p-2.5 rounded-xl bg-white/70 border border-purple-100">
                <p className="text-xs font-bold text-[#451A03]">
                  💡 {aiRecs.length} rekomendasi · <span className="text-purple-700">{selectedRecIds.size} dipilih</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedRecIds(new Set(aiRecs.map(r => r.product_id)))}
                    className="text-[11px] font-bold text-purple-700 hover:underline"
                  >
                    Pilih Semua
                  </button>
                  <button
                    onClick={() => setSelectedRecIds(new Set())}
                    className="text-[11px] font-bold text-gray-500 hover:underline"
                  >
                    Hapus Pilihan
                  </button>
                  <button
                    onClick={generateAiRecs}
                    disabled={aiGenerating}
                    className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={aiGenerating ? 'animate-spin' : ''} /> Regenerate
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                {aiRecs.map(rec => {
                  const selected = selectedRecIds.has(rec.product_id);
                  const marginColor = rec.projected_margin_pct >= 30 ? 'text-emerald-700 bg-emerald-50' : rec.projected_margin_pct >= 20 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
                  const confColor = rec.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : rec.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700';
                  return (
                    <label
                      key={rec.product_id}
                      data-testid={`ai-rec-${rec.product_id}`}
                      onClick={() => toggleRec(rec.product_id)}
                      className={`flex gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selected
                          ? 'border-purple-500 bg-purple-50/60'
                          : 'border-gray-200 bg-white hover:border-purple-300'
                      }`}
                    >
                      <div className="flex-shrink-0 pt-0.5">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {}}
                          className="w-5 h-5 accent-purple-600 cursor-pointer pointer-events-none"
                        />
                      </div>
                      <SmartImage src={rec.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <p className="font-bold text-sm text-[#451A03] truncate flex-1 min-w-[120px]">{rec.product_name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-extrabold text-[#EA580C] leading-none">{rec.recommended_discount_pct}%</span>
                            <span className="text-[10px] font-bold text-[#EA580C] mt-1">OFF</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[11px] text-gray-500 line-through">{fmt(rec.current_price)}</span>
                          <span className="text-[12px] font-bold text-[#7C2D12]">→ {fmt(rec.projected_price)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${marginColor}`}>
                            Margin: {rec.projected_margin_pct}%
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${confColor} uppercase`}>
                            {rec.confidence === 'high' ? '🎯 Kuat' : rec.confidence === 'medium' ? '📊 Sedang' : '🤷 Hati-hati'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-[#9A3412]">
                          <span className="flex items-center gap-0.5"><TrendingUp size={11} /> {rec.sold_30d} terjual / 30 hari</span>
                          <span className="flex items-center gap-0.5"><Package size={11} /> Stok: {rec.stock}</span>
                          <span>Margin sekarang: <strong>{rec.current_margin_pct}%</strong></span>
                        </div>
                        <p className="text-[11px] text-[#451A03] mt-1.5 italic leading-relaxed">
                          {rec.reasoning}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  data-testid="apply-ai-recs-btn"
                  onClick={applyAiRecs}
                  disabled={aiApplying || selectedRecIds.size === 0}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-sm px-5 py-2.5 rounded-full shadow disabled:opacity-50"
                >
                  <Check size={16} />
                  {aiApplying ? 'Membuat diskon...' : `Aktifkan ${selectedRecIds.size} Diskon Terpilih`}
                </button>
                <button
                  onClick={() => { setAiRecs([]); setSelectedRecIds(new Set()); }}
                  className="text-sm text-gray-600 hover:underline px-3"
                >
                  Tutup Rekomendasi
                </button>
              </div>
              {aiMode === 'local' && (
                <p className="text-[10px] text-blue-700 mt-3 italic">
                  💡 Pakai algoritma lokal. Untuk rekomendasi yang lebih kontekstual, tambah <code className="bg-blue-50 px-1 rounded">ANTHROPIC_API_KEY</code> di env Render.
                </p>
              )}
            </>
          )}
        </div>
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
                <div className={`px-5 py-3 ${d.is_flash_sale ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse' : d.active ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C]' : 'bg-gray-400'} text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    {d.is_flash_sale ? <span className="text-lg">⚡</span> : <Tag size={16} />}
                    <span className="font-bold">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {d.is_flash_sale && <span className="text-[10px] font-extrabold bg-white/30 px-2 py-0.5 rounded-full">FLASH SALE</span>}
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{d.active ? 'AKTIF' : 'NONAKTIF'}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-3xl font-extrabold text-[#EA580C] mb-1">
                    {d.type === 'percent' ? `${d.value}%` : fmt(d.value)} OFF
                  </div>
                  <p className="text-xs text-[#9A3412] mb-1">Berlaku untuk {pp.length} produk</p>
                  {d.is_flash_sale && d.ends_at && (
                    <p className="text-xs text-red-600 font-bold mb-2">⏰ Berakhir: {new Date(d.ends_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  )}
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
