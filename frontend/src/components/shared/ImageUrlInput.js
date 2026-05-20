import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Link as LinkIcon, Check, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { normalizeImageUrl } from './SmartImage';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Smart image URL input:
 * - Tab 1: Upload file (multipart → /api/media/upload)
 * - Tab 2: Paste URL (auto-normalize GDrive/Imgur)
 * - Live preview with green ✅ / red ❌ border
 */
export default function ImageUrlInput({ value, onChange, placeholder = 'https://...', testIdPrefix = 'image-url', size = 'md' }) {
  const [tab, setTab] = useState('upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [previewSrc, setPreviewSrc] = useState(value || '');
  const [status, setStatus] = useState('idle'); // idle | loading | ok | error
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Sync external value
  useEffect(() => {
    setUrlInput(value || '');
    setPreviewSrc(value ? toAbsolute(value) : '');
    setStatus(value ? 'loading' : 'idle');
  }, [value]);

  const toAbsolute = (u) => {
    if (!u) return '';
    if (u.startsWith('/api/')) return `${API}${u}`;
    return normalizeImageUrl(u);
  };

  const handleUrlChange = (raw) => {
    setUrlInput(raw);
    const normalized = normalizeImageUrl(raw);
    if (normalized !== raw) {
      // Notify user about GDrive conversion
      if (raw.includes('drive.google.com/file/d/')) {
        toast.success('URL Google Drive dikonversi otomatis ✅', { duration: 2000 });
      }
    }
    setPreviewSrc(toAbsolute(normalized));
    setStatus(normalized ? 'loading' : 'idle');
    onChange(normalized);
  };

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Ukuran maks 5 MB');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await axios.post(`${API}/api/media/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = r.data.url; // /api/media/{id}
      setUrlInput(url);
      setPreviewSrc(`${API}${url}`);
      setStatus('loading');
      onChange(url);
      toast.success('Foto berhasil diupload! 📸');
    } catch (err) {
      toast.error('Gagal upload: ' + (err.response?.data?.detail || 'error'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const borderClass =
    status === 'ok' ? 'border-green-400 ring-2 ring-green-100' :
    status === 'error' ? 'border-red-400 ring-2 ring-red-100' :
    'border-[#FED7AA]';

  const previewSize = size === 'sm' ? 'h-20 w-20' : size === 'lg' ? 'h-40 w-full' : 'h-28 w-28';

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 bg-[#FFF7ED] rounded-lg w-fit">
        <button
          type="button"
          data-testid={`${testIdPrefix}-tab-upload`}
          onClick={() => setTab('upload')}
          className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${tab === 'upload' ? 'bg-white text-[#EA580C] shadow' : 'text-[#9A3412]'}`}
        >
          <Upload size={12} /> Upload Foto
        </button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-tab-url`}
          onClick={() => setTab('url')}
          className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${tab === 'url' ? 'bg-white text-[#EA580C] shadow' : 'text-[#9A3412]'}`}
        >
          <LinkIcon size={12} /> Paste URL
        </button>
      </div>

      <div className="flex gap-2 items-start">
        {/* Preview thumbnail */}
        <div className={`${previewSize} flex-shrink-0 rounded-xl border-2 ${borderClass} bg-[#FFFBF5] overflow-hidden relative transition-all`}>
          {uploading ? (
            <div className="w-full h-full flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#EA580C]" /></div>
          ) : previewSrc ? (
            <>
              <img
                src={previewSrc}
                alt="preview"
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={() => setStatus('ok')}
                onError={() => setStatus('error')}
              />
              <div className="absolute top-1 right-1">
                {status === 'ok' && <div className="bg-green-500 rounded-full p-0.5 shadow"><Check size={10} className="text-white" /></div>}
                {status === 'error' && <div className="bg-red-500 rounded-full p-0.5 shadow"><X size={10} className="text-white" /></div>}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20} /></div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-1 space-y-1">
          {tab === 'upload' ? (
            <div>
              <input
                ref={fileRef}
                data-testid={`${testIdPrefix}-file-input`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-60"
              >
                <Upload size={14} /> {uploading ? 'Mengupload...' : 'Pilih Foto dari HP / Komputer'}
              </button>
              <p className="text-[10px] text-gray-500 mt-1">JPG/PNG/WEBP/GIF, maks 5 MB. Foto akan disimpan aman di server Ciltarasa.</p>
            </div>
          ) : (
            <div>
              <input
                data-testid={`${testIdPrefix}-url-input`}
                type="text"
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full px-3 py-2.5 rounded-xl border-2 ${borderClass} bg-white text-[#451A03] text-xs focus:outline-none focus:border-[#F97316] transition-all`}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Bisa pakai: Google Drive (auto-konversi), ImgBB, Imgur, atau URL gambar langsung.
                {status === 'error' && <span className="block text-red-600 font-bold mt-0.5">❌ Gambar tidak dapat dimuat, coba URL lain</span>}
                {status === 'ok' && <span className="block text-green-600 font-bold mt-0.5">✅ Gambar valid</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
