import React, { useState, useEffect } from 'react';
import { Save, Palette, Type, Globe, Eye, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// ─── 5 preset color themes ───
const PRESETS = [
  { id: 'warm',  name: '🍊 Hangat',  desc: 'Default Ciltarasa',
    primary_color: '#D97706', primary_hover: '#B45309', secondary_color: '#F97316',
    bg_color: '#FDF8F0', text_color: '#451A03', heading_color: '#78350F', accent_color: '#FED7AA' },
  { id: 'cool',  name: '🌊 Sejuk',   desc: 'Biru segar',
    primary_color: '#0EA5E9', primary_hover: '#0284C7', secondary_color: '#06B6D4',
    bg_color: '#F0F9FF', text_color: '#0C4A6E', heading_color: '#075985', accent_color: '#BAE6FD' },
  { id: 'fresh', name: '🌿 Segar',   desc: 'Hijau organic',
    primary_color: '#10B981', primary_hover: '#059669', secondary_color: '#34D399',
    bg_color: '#F0FDF4', text_color: '#064E3B', heading_color: '#065F46', accent_color: '#BBF7D0' },
  { id: 'sweet', name: '🌸 Manis',   desc: 'Pink lembut',
    primary_color: '#EC4899', primary_hover: '#DB2777', secondary_color: '#F472B6',
    bg_color: '#FDF2F8', text_color: '#831843', heading_color: '#9D174D', accent_color: '#FBCFE8' },
  { id: 'royal', name: '👑 Mewah',   desc: 'Ungu elegan',
    primary_color: '#8B5CF6', primary_hover: '#7C3AED', secondary_color: '#A78BFA',
    bg_color: '#FAF5FF', text_color: '#3B0764', heading_color: '#581C87', accent_color: '#DDD6FE' },
  { id: 'dark',  name: '🌙 Gelap',   desc: 'Mode malam',
    primary_color: '#F59E0B', primary_hover: '#D97706', secondary_color: '#FBBF24',
    bg_color: '#1F2937', text_color: '#F9FAFB', heading_color: '#FCD34D', accent_color: '#374151' },
];

const FONT_FAMILIES = [
  { id: 'system', label: 'System (Default)', preview: 'system-ui' },
  { id: 'Inter',  label: 'Inter (Modern)',   preview: 'Inter, system-ui' },
  { id: 'Poppins',label: 'Poppins (Bulat)',  preview: 'Poppins, system-ui' },
  { id: 'Lora',   label: 'Lora (Klasik)',    preview: 'Lora, serif' },
  { id: 'Playfair Display', label: 'Playfair (Elegan)', preview: 'Playfair Display, serif' },
];

const DEFAULT_THEME = PRESETS[0];
const DEFAULT_SEO = {
  title: 'Ciltarasa - Premium Frozen Food & Bebek Pawon Ayu khas Malang',
  description: 'Frozen food premium dari Malang. Pesan online, kirim cepat ke seluruh Indonesia.',
  og_image_url: '',
  theme_color: '#D97706',
};

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#FED7AA] focus:outline-none focus:ring-2 focus:ring-[#D97706] text-sm';

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-[#FED7AA] overflow-hidden">
      <div className="bg-gradient-to-r from-[#FEF3C7] to-[#FFFBEB] px-4 py-3 flex items-center justify-between border-b border-[#FED7AA]">
        <h3 className="font-heading font-bold text-[#7C2D12] flex items-center gap-2">
          <Icon size={18} /> {title}
        </h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[#7C2D12] mb-1">
        {label}
        {hint && <span className="ml-1 text-[10px] font-normal text-gray-500">{hint}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded-lg border border-[#FED7AA] cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#D97706"
          className={inputCls + ' font-mono'}
          maxLength={7}
        />
      </div>
    </div>
  );
}

export default function SeoThemeConfig() {
  const { storeConfig, refreshStoreConfig } = useApp();
  const [seo, setSeo] = useState(DEFAULT_SEO);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [activePreset, setActivePreset] = useState(null);

  useEffect(() => {
    if (storeConfig?.seo) setSeo({ ...DEFAULT_SEO, ...storeConfig.seo });
    if (storeConfig?.theme) {
      const t = { ...DEFAULT_THEME, ...storeConfig.theme };
      setTheme(t);
      // Detect if current theme matches a preset
      const match = PRESETS.find(p => p.primary_color === t.primary_color && p.bg_color === t.bg_color);
      setActivePreset(match?.id || null);
    }
  }, [storeConfig]);

  const updateSeo = (k, v) => setSeo(prev => ({ ...prev, [k]: v }));
  const updateTheme = (k, v) => {
    setTheme(prev => ({ ...prev, [k]: v }));
    setActivePreset(null); // mark as custom after manual edit
  };

  const applyPreset = (preset) => {
    setTheme(prev => ({
      ...prev,
      primary_color: preset.primary_color,
      primary_hover: preset.primary_hover,
      secondary_color: preset.secondary_color,
      bg_color: preset.bg_color,
      text_color: preset.text_color,
      heading_color: preset.heading_color,
      accent_color: preset.accent_color,
    }));
    setActivePreset(preset.id);
    toast.success(`Tema "${preset.name}" diterapkan! Klik Simpan untuk persist.`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/store-config`, {
        seo,
        theme: { ...theme, font_size_base: Number(theme.font_size_base) || 16 },
      });
      await refreshStoreConfig();
      toast.success('SEO & Theme tersimpan! Tab buyer akan auto-refresh ke design baru.');
    } catch (e) {
      toast.error('Gagal menyimpan. ' + (e?.response?.data?.detail || ''));
    } finally { setSaving(false); }
  };

  const resetDefault = () => {
    if (!window.confirm('Reset ke default Ciltarasa (Hangat)? Setting custom akan hilang.')) return;
    setSeo(DEFAULT_SEO);
    setTheme(DEFAULT_THEME);
    setActivePreset('warm');
    toast.success('Reset done. Klik Simpan untuk apply.');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#7C2D12]">Tampilan & SEO</h1>
          <p className="text-xs text-[#92400E] mt-1">Atur judul/deskripsi web (untuk Google &amp; share link) dan warna/font tema buyer.</p>
        </div>
        <div className="flex gap-2">
          <button
            data-testid="seothem-reset-btn"
            onClick={resetDefault}
            className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] px-3 py-2 rounded-full border border-[#FED7AA] hover:bg-orange-50"
          >
            <RefreshCw size={13} /> Reset
          </button>
          <button
            data-testid="seothem-save-btn"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold px-5 py-2.5 rounded-full shadow disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* ─── SEO Section ─── */}
      <Section title="SEO &amp; Meta (Search Engine, Share Link)" icon={Globe}>
        <p className="text-[11px] text-[#9A3412] italic mb-3">
          💡 Ini yang muncul di Google search result, browser tab, dan share preview (WhatsApp/IG/FB).
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1">
              Judul (Title) <span className="text-gray-500 font-normal">— max 60 karakter ideal</span>
            </label>
            <input
              data-testid="seo-title-input"
              type="text"
              value={seo.title}
              onChange={(e) => updateSeo('title', e.target.value)}
              placeholder="Ciltarasa - Premium Frozen Food khas Malang"
              maxLength={120}
              className={inputCls}
            />
            <p className="text-[10px] text-gray-500 mt-0.5">{seo.title.length} / 120</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1">
              Deskripsi (Description) <span className="text-gray-500 font-normal">— max 160 karakter ideal</span>
            </label>
            <textarea
              data-testid="seo-desc-input"
              value={seo.description}
              onChange={(e) => updateSeo('description', e.target.value)}
              placeholder="Frozen food premium dari Malang. Pesan online, kirim cepat..."
              maxLength={320}
              rows={3}
              className={inputCls + ' resize-none'}
            />
            <p className="text-[10px] text-gray-500 mt-0.5">{seo.description.length} / 320</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-1">
              Gambar Share (OG Image URL) <span className="text-gray-500 font-normal">— optional, 1200×630 ideal</span>
            </label>
            <input
              data-testid="seo-ogimage-input"
              type="url"
              value={seo.og_image_url}
              onChange={(e) => updateSeo('og_image_url', e.target.value)}
              placeholder="https://ciltarasa.online/og-image.jpg"
              className={inputCls}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Preview Google Search</p>
          <div className="space-y-1">
            <p className="text-[11px] text-[#1a0dab]">ciltarasa.online</p>
            <p className="text-base text-[#1a0dab] hover:underline cursor-pointer truncate">{seo.title}</p>
            <p className="text-xs text-gray-600 line-clamp-2">{seo.description}</p>
          </div>
        </div>
      </Section>

      {/* ─── Theme Presets ─── */}
      <Section title="Tema Warna — Pilihan Cepat" icon={Palette}>
        <p className="text-[11px] text-[#9A3412] italic mb-3">
          💡 Klik satu preset → semua warna auto-set. Bisa custom lebih detail di bawah.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESETS.map(p => (
            <button
              key={p.id}
              data-testid={`theme-preset-${p.id}`}
              onClick={() => applyPreset(p)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                activePreset === p.id ? 'border-[#D97706] shadow-md' : 'border-gray-200 hover:border-[#D97706]'
              }`}
              style={{ backgroundColor: p.bg_color }}
            >
              <p className="text-sm font-bold mb-2" style={{ color: p.heading_color }}>{p.name}</p>
              <div className="flex gap-1 mb-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: p.primary_color }}></div>
                <div className="w-6 h-6 rounded" style={{ backgroundColor: p.secondary_color }}></div>
                <div className="w-6 h-6 rounded" style={{ backgroundColor: p.accent_color }}></div>
              </div>
              <p className="text-[10px]" style={{ color: p.text_color, opacity: 0.7 }}>{p.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── Custom Color Picker ─── */}
      <Section title="Custom Warna" icon={Palette}>
        <p className="text-[11px] text-[#9A3412] italic mb-3">
          💡 Pilih warna manual. Pastikan kontras teks vs background cukup (gelap di terang, terang di gelap).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ColorField label="Primary" hint="Tombol utama, badge harga" value={theme.primary_color} onChange={(v) => updateTheme('primary_color', v)} />
          <ColorField label="Primary Hover" hint="Hover state tombol" value={theme.primary_hover} onChange={(v) => updateTheme('primary_hover', v)} />
          <ColorField label="Secondary" hint="Gradient pasangan primary" value={theme.secondary_color} onChange={(v) => updateTheme('secondary_color', v)} />
          <ColorField label="Background" hint="Latar halaman" value={theme.bg_color} onChange={(v) => updateTheme('bg_color', v)} />
          <ColorField label="Heading" hint="Judul produk, header" value={theme.heading_color} onChange={(v) => updateTheme('heading_color', v)} />
          <ColorField label="Text" hint="Teks body normal" value={theme.text_color} onChange={(v) => updateTheme('text_color', v)} />
          <ColorField label="Accent" hint="Border, card bg light" value={theme.accent_color} onChange={(v) => updateTheme('accent_color', v)} />
        </div>
      </Section>

      {/* ─── Font Family + Size ─── */}
      <Section title="Tipografi (Font &amp; Ukuran)" icon={Type}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-2">Font Family</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FONT_FAMILIES.map(f => (
                <button
                  key={f.id}
                  data-testid={`font-family-${f.id}`}
                  onClick={() => updateTheme('font_family', f.id)}
                  className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                    theme.font_family === f.id ? 'border-[#D97706] bg-[#FEF3C7]' : 'border-gray-200 hover:border-[#D97706]'
                  }`}
                  style={{ fontFamily: f.preview }}
                >
                  <p className="font-bold text-sm text-[#451A03]">{f.label}</p>
                  <p className="text-xs text-gray-500">The quick brown fox 0123</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              💡 Non-system fonts perlu di-load via Google Fonts (link di index.html). Default system aman dipakai.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#7C2D12] mb-2">
              Ukuran Font Body: <span className="text-[#EA580C]">{theme.font_size_base || 16}px</span>
            </label>
            <input
              data-testid="font-size-slider"
              type="range"
              min="12"
              max="22"
              step="1"
              value={theme.font_size_base || 16}
              onChange={(e) => updateTheme('font_size_base', Number(e.target.value))}
              className="w-full accent-[#EA580C]"
            />
            <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
              <span>12 (kecil)</span>
              <span>16 (default)</span>
              <span>22 (besar)</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Live Preview ─── */}
      <Section title="Preview Live" icon={Eye}>
        <p className="text-[11px] text-[#9A3412] italic mb-3">
          💡 Preview kira-kira tampilan buyer. Buka tab buyer di window/tab lain → refresh setelah Simpan untuk lihat efek penuh.
        </p>
        <div
          className="rounded-xl p-5 border-2"
          style={{
            backgroundColor: theme.bg_color,
            borderColor: theme.accent_color,
            color: theme.text_color,
            fontSize: `${theme.font_size_base || 16}px`,
            fontFamily: theme.font_family && theme.font_family !== 'system'
              ? `"${theme.font_family}", system-ui, sans-serif`
              : undefined,
          }}
        >
          <h3 className="font-bold text-2xl mb-2" style={{ color: theme.heading_color }}>
            Bola Ayam Keju Premium
          </h3>
          <p className="mb-3" style={{ opacity: 0.85 }}>
            Bola ayam isi keju mozzarella, frozen siap goreng. Cocok buat camilan keluarga.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xl font-extrabold" style={{ color: theme.primary_color }}>Rp 33.000</span>
            <button
              type="button"
              className="text-sm font-bold px-4 py-2 rounded-full text-white shadow"
              style={{
                background: `linear-gradient(to right, ${theme.secondary_color}, ${theme.primary_color})`,
              }}
            >
              + Tambah ke Keranjang
            </button>
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: theme.accent_color }}>
            <p className="text-sm font-semibold" style={{ color: theme.heading_color }}>
              💡 Ini contoh card. Warna border &amp; background dari Accent.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
