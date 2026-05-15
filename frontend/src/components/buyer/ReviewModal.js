import React, { useState } from 'react';
import { X, Star, Image as ImageIcon, MessageSquare, MapPin, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-125"
          data-testid={`star-${n}`}
        >
          <Star
            size={28}
            className={(hover || value) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
      <span className="ml-2 text-sm font-bold text-[#7C2D12]">
        {value > 0 ? `${value}/5` : 'Beri rating'}
      </span>
    </div>
  );
}

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const { authUser, storeConfig } = useApp();
  // Initialize item reviews
  const [itemReviews, setItemReviews] = useState(() =>
    (order.items || []).map(it => ({
      product_id: it.product_id,
      product_name: it.product_name,
      image_url: it.image_url,
      rating: 0,
      text: '',
      photos: [],
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  const update = (idx, field, value) => {
    setItemReviews(prev => {
      const u = [...prev];
      u[idx] = { ...u[idx], [field]: value };
      return u;
    });
  };

  const addPhoto = (idx) => {
    // Mock photo upload — uses a random Unsplash food image
    const mockPhotos = [
      'https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=200&q=70',
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=200&q=70',
      'https://images.unsplash.com/photo-1626202373052-9d6d5b9bca5b?w=200&q=70',
    ];
    const random = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
    setItemReviews(prev => {
      const u = [...prev];
      const photos = u[idx].photos.length < 3 ? [...u[idx].photos, random] : u[idx].photos;
      u[idx] = { ...u[idx], photos };
      return u;
    });
  };

  const removePhoto = (idx, pIdx) => {
    setItemReviews(prev => {
      const u = [...prev];
      u[idx] = { ...u[idx], photos: u[idx].photos.filter((_, i) => i !== pIdx) };
      return u;
    });
  };

  const handleSubmit = async () => {
    const toSubmit = itemReviews.filter(r => r.rating > 0);
    if (toSubmit.length === 0) {
      toast.error('Beri rating minimal 1 produk dulu ya');
      return;
    }
    setSubmitting(true);
    try {
      for (const r of toSubmit) {
        await axios.post(`${API}/api/reviews`, {
          order_id: order.id,
          product_id: r.product_id,
          user_id: authUser?.id || null,
          user_name: authUser?.name || order.customer_name || 'Pembeli',
          rating: r.rating,
          text: r.text,
          photos: r.photos,
        });
      }
      toast.success(`${toSubmit.length} review terkirim! Terima kasih 💝`);
      onSubmitted?.();
      onClose();
    } catch (e) {
      toast.error('Gagal kirim review. Coba lagi ya.');
    } finally {
      setSubmitting(false);
    }
  };

  const openGmaps = () => {
    const url = storeConfig?.gmaps_review_url || 'https://maps.app.goo.gl/W8noqRWBkVsMESbHA';
    window.open(url, '_blank');
  };

  return (
    <div data-testid="review-modal" className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#FB923C] to-[#EA580C] text-white flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Tulis Review</h2>
            <p className="text-xs text-orange-100">{order.order_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {itemReviews.map((item, idx) => (
            <div key={idx} className="border border-[#FED7AA] rounded-2xl p-4 bg-[#FFFBF5]">
              <div className="flex items-center gap-3 mb-3">
                {item.image_url && (
                  <img src={item.image_url} alt={item.product_name} className="w-14 h-14 rounded-xl object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#7C2D12] truncate">{item.product_name}</p>
                  <p className="text-xs text-[#9A3412] mt-0.5">Gimana rasanya?</p>
                </div>
              </div>

              <div className="mb-3">
                <StarPicker value={item.rating} onChange={v => update(idx, 'rating', v)} />
              </div>

              <textarea
                data-testid={`review-text-${idx}`}
                value={item.text}
                onChange={e => update(idx, 'text', e.target.value)}
                placeholder="Ceritakan pengalamanmu... (opsional)"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-[#FED7AA] focus:outline-none focus:border-[#F97316] text-sm font-body text-[#451A03] bg-white resize-none"
              />

              {/* Photo upload mock */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {item.photos.map((p, pIdx) => (
                  <div key={pIdx} className="relative">
                    <img src={p} alt="" className="w-14 h-14 rounded-lg object-cover" />
                    <button
                      onClick={() => removePhoto(idx, pIdx)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {item.photos.length < 3 && (
                  <button
                    type="button"
                    data-testid={`add-photo-${idx}`}
                    onClick={() => addPhoto(idx)}
                    className="w-14 h-14 rounded-lg border-2 border-dashed border-[#FED7AA] hover:border-[#F97316] flex flex-col items-center justify-center text-[#9A3412] hover:bg-[#FFF7ED] transition-all"
                  >
                    <ImageIcon size={16} />
                    <span className="text-[9px] mt-0.5 font-semibold">Foto</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Gmaps CTA */}
          <button
            data-testid="gmaps-review-btn"
            onClick={openGmaps}
            className="w-full p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl hover:shadow-md transition-all flex items-center gap-3 text-left"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-blue-900">Review di Google Maps</p>
              <p className="text-xs text-blue-700">Bantu kami biar makin banyak yang tau! 🌟</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#FED7AA] bg-white">
          <button
            data-testid="submit-review-btn"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Mengirim...</> : <><Send size={16} /> Kirim Review</>}
          </button>
        </div>
      </div>
    </div>
  );
}
