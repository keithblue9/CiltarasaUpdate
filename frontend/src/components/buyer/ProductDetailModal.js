import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Star, ShoppingCart, Plus, Minus, Check, Flame } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import SmartImage from '../shared/SmartImage';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart } = useApp();
  const [activeMedia, setActiveMedia] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [added, setAdded] = useState(false);

  const media = (product.media_urls && product.media_urls.length > 0) ? product.media_urls : [product.image_url];
  const finalPrice = product.final_price || product.price;
  const hasDiscount = product.discount && finalPrice < product.price;
  const discountPct = hasDiscount ? Math.round((1 - finalPrice / product.price) * 100) : 0;

  useEffect(() => {
    axios.get(`${API}/api/reviews?product_id=${product.id}`).then(r => setReviews(r.data)).catch(() => {});
  }, [product.id]);

  const next = () => setActiveMedia(i => (i + 1) % media.length);
  const prev = () => setActiveMedia(i => (i - 1 + media.length) % media.length);

  const handleAdd = () => {
    addToCart(product, qty);
    setAdded(true);
    toast.success(`${qty}× ${product.name} masuk keranjang!`);
    setTimeout(() => setAdded(false), 1500);
  };

  const isOOS = !product.active || product.stock === 0;

  return (
    <div data-testid="product-detail-modal" className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-4xl max-h-[95vh] bg-white sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow hover:bg-white">
          <X size={18} className="text-[#7C2D12]" />
        </button>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {/* Media carousel */}
            <div className="relative bg-[#FDF8F0] aspect-square">
              <SmartImage src={media[activeMedia]} alt={product.name} className="w-full h-full object-cover" />
              {hasDiscount && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg">
                  -{discountPct}% OFF 🔥
                </div>
              )}
              {media.length > 1 && (
                <>
                  <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full shadow flex items-center justify-center hover:bg-white">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full shadow flex items-center justify-center hover:bg-white">
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {media.map((url, i) => (
                      <button key={`media-dot-${url}-${i}`} onClick={() => setActiveMedia(i)} className={`w-2 h-2 rounded-full transition-all ${i === activeMedia ? 'bg-white w-6' : 'bg-white/60'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Info */}
            <div className="p-5 sm:p-6 flex flex-col">
              <h2 className="font-heading text-2xl font-bold text-[#7C2D12] mb-2 leading-tight">{product.name}</h2>

              {/* Rating + sold */}
              <div className="flex items-center gap-3 mb-3 text-sm">
                {product.rating_count > 0 ? (
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    <span className="font-bold">{product.rating_avg}</span>
                    <span className="text-gray-500">({product.rating_count})</span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">Belum ada review</span>
                )}
                <span className="text-gray-300">|</span>
                <span className="text-xs font-semibold text-[#9A3412]">{product.sold_count || 0} terjual</span>
              </div>

              {/* Price */}
              <div className="bg-gradient-to-r from-[#FFF7ED] to-[#FEF3C7] rounded-2xl p-4 mb-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-3xl font-extrabold text-[#EA580C]">{fmtRp(finalPrice)}</span>
                  {hasDiscount && (
                    <span className="text-base text-gray-400 line-through">{fmtRp(product.price)}</span>
                  )}
                  <span className="text-xs text-[#9A3412] ml-auto">per {product.unit || 'pack'}</span>
                </div>
                {hasDiscount && (
                  <p className="text-xs text-red-600 font-bold mt-1">💸 Hemat {fmtRp(product.price - finalPrice)}!</p>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-[#9A3412] mb-1.5">Deskripsi</h3>
                <p className="text-sm text-[#451A03] leading-relaxed whitespace-pre-wrap">{product.description || '-'}</p>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-[#9A3412]">Stok: <span className="font-bold text-[#7C2D12]">{product.stock}</span></span>
                {product.weight > 0 && <span className="text-xs text-[#9A3412]">Berat: <span className="font-bold text-[#7C2D12]">{product.weight} kg</span></span>}
              </div>

              {/* Qty + add to cart */}
              {!isOOS ? (
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#7C2D12]">Jumlah</span>
                    <div className="flex items-center border-2 border-[#FED7AA] rounded-full overflow-hidden">
                      <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-1.5 text-[#7C2D12] hover:bg-[#FED7AA]"><Minus size={14} /></button>
                      <span className="px-4 font-bold text-[#7C2D12] min-w-[40px] text-center">{qty}</span>
                      <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="px-3 py-1.5 text-[#7C2D12] hover:bg-[#FED7AA]"><Plus size={14} /></button>
                    </div>
                  </div>
                  <button
                    data-testid="detail-add-cart-btn"
                    onClick={handleAdd}
                    className={`w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${added ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white hover:shadow-xl hover:-translate-y-0.5'}`}
                  >
                    {added ? <><Check size={18} /> Masuk Keranjang!</> : <><ShoppingCart size={18} /> Tambah ke Keranjang</>}
                  </button>
                </div>
              ) : (
                <button disabled className="mt-auto w-full py-3.5 rounded-2xl font-bold bg-gray-200 text-gray-400 cursor-not-allowed">Stok Habis</button>
              )}
            </div>
          </div>

          {/* Reviews section */}
          <div className="p-5 sm:p-6 border-t border-[#FED7AA] bg-[#FFFBF5]">
            <h3 className="font-heading text-lg font-bold text-[#7C2D12] mb-3 flex items-center gap-2">
              <Star size={18} className="fill-amber-400 text-amber-400" /> Ulasan Pembeli
              {reviews.length > 0 && <span className="text-sm text-[#9A3412] font-normal">({reviews.length})</span>}
            </h3>
            {reviews.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Belum ada ulasan untuk produk ini. Jadilah yang pertama! ✨</p>
            ) : (
              <div className="space-y-3">
                {reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="bg-white rounded-xl p-4 border border-[#FED7AA]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-white font-bold text-xs">
                        {(r.user_name || 'U').charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#7C2D12]">{r.user_name}</p>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} size={11} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                          ))}
                        </div>
                      </div>
                    </div>
                    {r.text && <p className="text-sm text-[#451A03] mt-1">{r.text}</p>}
                    {r.photos?.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {r.photos.map((p, i) => (
                          <SmartImage key={`${r.id}-photo-${i}`} src={p} alt="" className="w-14 h-14 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
