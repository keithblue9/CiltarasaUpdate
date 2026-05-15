import React, { useEffect, useState } from 'react';
import { Sparkles, RotateCw, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ProductDetailModal from './ProductDetailModal';

const fmtRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

function MiniProductCard({ product, badge, onOpen }) {
  const final = product.final_price || product.price;
  const hasDiscount = product.final_price && product.final_price < product.price;
  return (
    <button
      onClick={() => onOpen(product)}
      data-testid={`reco-product-${product.id}`}
      className="group flex-shrink-0 w-40 sm:w-44 bg-white rounded-2xl border border-[#FED7AA] overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-square overflow-hidden">
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {badge && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-md shadow">
            {badge}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-[#7C2D12] line-clamp-2 mb-1 min-h-[2rem]">{product.name}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-extrabold text-[#EA580C]">{fmtRp(final)}</span>
          {hasDiscount && <span className="text-[10px] text-gray-400 line-through">{fmtRp(product.price)}</span>}
        </div>
      </div>
    </button>
  );
}

export default function RecommendationsStrip() {
  const { authUser, fetchRecommendations, recommendations } = useApp();
  const [loading, setLoading] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  useEffect(() => {
    if (!authUser) return;
    setLoading(true);
    fetchRecommendations({ user_id: authUser.id, phone: authUser.phone }).finally(() => setLoading(false));
  }, [authUser]);

  if (!authUser) return null;
  if (loading) return null;
  if (!recommendations || (!recommendations.repeat_orders?.length && !recommendations.similar_products?.length)) return null;

  return (
    <>
      <section data-testid="recommendations-section" className="py-8 bg-gradient-to-b from-[#FFFBF5] to-[#FDF8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Repeat orders */}
          {recommendations.repeat_orders?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <RotateCw size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#7C2D12]">Pesan Lagi, {authUser.name?.split(' ')[0] || 'Bunda'}?</h3>
                  <p className="text-xs text-[#9A3412]">Favorit kamu yang sering dibeli — buruan restok keluarga!</p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {recommendations.repeat_orders.map((r, i) => (
                  <MiniProductCard
                    key={r.product.id}
                    product={r.product}
                    badge={`Sudah ${r.times_bought}× 💝`}
                    onOpen={setDetailProduct}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Similar products */}
          {recommendations.similar_products?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#7C2D12]">
                    {recommendations.has_history ? 'Mungkin Kamu Suka Ini' : 'Lagi Hits di Ciltarasa'}
                  </h3>
                  <p className="text-xs text-[#9A3412]">{recommendations.has_history ? 'Mirip selera kamu sebelumnya 👀' : 'Pilihan terbaik untuk pelanggan baru'}</p>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {recommendations.similar_products.map(p => (
                  <MiniProductCard key={p.id} product={p} onOpen={setDetailProduct} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {detailProduct && <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} />}
    </>
  );
}
