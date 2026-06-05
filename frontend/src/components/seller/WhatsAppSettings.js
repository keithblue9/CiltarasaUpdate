import React, { useState, useEffect } from 'react';
import { Save, TestTube, MessageCircle, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WhatsAppSettings() {
  const { settings, refreshSettings } = useApp();
  const [form, setForm] = useState({
    seller_whatsapp: '',
    auto_whatsapp: true,
    message_template: '',
    store_name: 'Ciltarasa',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        seller_whatsapp: settings.seller_whatsapp || '',
        auto_whatsapp: settings.auto_whatsapp !== false,
        message_template: settings.message_template || '',
        store_name: settings.store_name || 'Ciltarasa',
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/settings`, form);
      await refreshSettings();
      toast.success('Pengaturan berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan pengaturan.');
    }
    setSaving(false);
  };

  const handleTest = () => {
    if (!form.seller_whatsapp) { toast.error('Nomor WhatsApp belum diisi!'); return; }
    const testMsg = (form.message_template || '')
      .replace('{order_id}', 'TEST-001')
      .replace('{customer_name}', 'Pelanggan Test')
      .replace('{customer_phone}', '081234567890')
      .replace('{customer_address}', 'Jl. Test No. 1, Malang')
      .replace('{items_detail}', '- Risoles Frozen x2 = Rp 70.000')
      .replace('{total}', '70.000')
      .replace('{notes}', 'Test pesanan');
    window.open(`https://wa.me/${form.seller_whatsapp}?text=${encodeURIComponent(testMsg)}`, '_blank');
    toast.success('Membuka WhatsApp...');
  };

  const VARS = ['{order_id}', '{customer_name}', '{customer_phone}', '{customer_address}', '{items_detail}', '{total}', '{notes}'];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[#78350F]">Pengaturan WhatsApp</h1>
        <button onClick={refreshSettings} className="p-2 text-[#D97706]"><RefreshCw size={18} /></button>
      </div>

      {/* WhatsApp Number */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[#78350F] text-lg">Nomor WhatsApp Seller</h2>
        <div>
          <label className="block text-sm font-semibold text-[#78350F] mb-1">Nomor WA (format: 628xxxx)</label>
          <div className="flex gap-3">
            <input
              data-testid="wa-number-input"
              type="text"
              value={form.seller_whatsapp}
              onChange={e => setForm(f => ({...f, seller_whatsapp: e.target.value}))}
              placeholder="6285190884129"
              className="flex-1 px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03]"
            />
            <button
              data-testid="wa-test-btn"
              onClick={handleTest}
              className="flex items-center gap-2 bg-green-500 text-white font-bold px-4 py-3 rounded-xl hover:bg-green-600 transition-all text-sm"
            >
              <TestTube size={16} /> Test
            </button>
          </div>
          <p className="text-xs text-[#92400E] mt-1">Contoh: 6285190884129 (tanpa +, dengan kode negara)</p>
        </div>
      </div>

      {/* Auto notification */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-semibold text-[#78350F] text-lg">Notifikasi Otomatis</h2>
            <p className="text-sm text-[#92400E] font-body mt-1">Buka WhatsApp otomatis saat ada pesanan baru</p>
          </div>
          <button
            data-testid="auto-wa-toggle"
            onClick={() => setForm(f => ({...f, auto_whatsapp: !f.auto_whatsapp}))}
          >
            {form.auto_whatsapp
              ? <ToggleRight size={40} className="text-[#D97706]" />
              : <ToggleLeft size={40} className="text-gray-400" />
            }
          </button>
        </div>
      </div>

      {/* Message template */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 space-y-4">
        <h2 className="font-heading font-semibold text-[#78350F] text-lg">Template Pesan</h2>
        <div className="bg-[#FDF8F0] rounded-xl p-3">
          <p className="text-xs font-semibold text-[#78350F] mb-2">Variabel yang tersedia:</p>
          <div className="flex flex-wrap gap-2">
            {VARS.map(v => (
              <button key={v} onClick={() => setForm(f => ({...f, message_template: f.message_template + v}))}
                className="text-xs bg-[#FED7AA] text-[#78350F] px-2 py-1 rounded-lg font-mono hover:bg-[#D97706] hover:text-white transition-all">
                {v}
              </button>
            ))}
          </div>
        </div>
        <textarea
          data-testid="message-template-input"
          value={form.message_template}
          onChange={e => setForm(f => ({...f, message_template: e.target.value}))}
          rows={8}
          className="w-full px-4 py-3 rounded-xl border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body text-[#451A03] text-sm resize-y"
          placeholder="Template pesan notifikasi..."
        />
        <p className="text-xs text-[#92400E]">Klik variabel di atas untuk menambahkannya ke template pesan</p>
      </div>

      {/* Save button */}
      <button
        data-testid="save-wa-settings-btn"
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-[#D97706] text-white font-bold py-4 rounded-2xl hover:bg-[#B45309] transition-all shadow-md disabled:opacity-70 text-lg"
      >
        <Save size={20} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
      </button>

      {/* Info */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <div className="flex gap-3">
          <MessageCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-700 text-sm">Cara Kerja Notifikasi</p>
            <p className="text-xs text-green-600 mt-1 font-body leading-relaxed">
              Saat pembeli melakukan checkout, sistem akan membuka WhatsApp Web/App dengan pesan pre-isi ke nomor seller.
              Pastikan WhatsApp sudah terinstall dan nomor dalam format internasional (628xxx).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
