import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Check, AlertCircle, Star, Flame, Sparkles, TrendingUp, Award } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';
import ProductDetailModal from './ProductDetailModal';
import AboutSection from './AboutSection';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

function ProductCard({ product, onAdd, onOpen, staggerIdx }) {
  const isOOS = !product.active || product.stock === 0;
  const isLow = product.stock > 0 && product.stock < 10;
  const finalPrice = product.final_price || product.price;
  const hasDiscount = product.discount && finalPrice < product.price;
  const isFlashSale = product.discount?.is_flash_sale;
  const discountPct = hasDiscount ? Math.round((1 - finalPrice / product.price) * 100) : 0;
  const isHot = (product.sold_count || 0) > 100;
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (isOOS) return;
    onAdd(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div
      data-testid={`product-card-${product.id}`}
      onClick={() => onOpen(product)}
      className={`group bg-white rounded-2xl border border-[#FED7AA] overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 fade-in-up stagger-${Math.min(staggerIdx + 1, 8)}`}
    >
      <div className="relative aspect-square overflow-hidden">
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {isFlashSale ? (
            <span className="bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow flex items-center gap-0.5 animate-pulse">
              <Flame size={10} className="fill-yellow-300 text-yellow-300" /> FLASH -{discountPct}%
            </span>
          ) : hasDiscount && (
            <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow flex items-center gap-0.5">
              -{discountPct}%
            </span>
          )}
          {isHot && !hasDiscount && (
            <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow flex items-center gap-0.5">
              <Flame size={10} /> HOT
            </span>
          )}
        </div>

        {isOOS && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">Habis</span>
          </div>
        )}

        {isLow && !isOOS && (
          <div className="absolute bottom-2 right-2">
            <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <AlertCircle size={8} /> Stok Tipis
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <h3 className="font-body font-semibold text-[#451A03] text-xs sm:text-sm leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>

        {/* Price */}
        <div className="flex items-end gap-1.5 flex-wrap mb-1">
          <span className="font-extrabold text-[#EA580C] text-base sm:text-lg">{formatRp(finalPrice)}</span>
          {hasDiscount && (
            <span className="text-[10px] text-gray-400 line-through mb-0.5">{formatRp(product.price)}</span>
          )}
        </div>

        {/* Rating + sold */}
        <div className="flex items-center gap-2 text-[10px] text-[#9A3412] mb-2">
          {product.rating_count > 0 && (
            <div className="flex items-center gap-0.5">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span className="font-bold">{product.rating_avg}</span>
            </div>
          )}
          <span className="text-gray-400">•</span>
          <span>{product.sold_count || 0} terjual</span>
        </div>

        {/* Add to cart button */}
        {!isOOS ? (
          <button
            data-testid={`add-to-cart-${product.id}`}
            onClick={handleAdd}
            className={`w-full py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              added ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white hover:shadow-md'
            }`}
          >
            {added ? <><Check size={12} /> Masuk!</> : <><ShoppingCart size={12} /> + Keranjang</>}
          </button>
        ) : (
          <button disabled className="w-full py-1.5 rounded-full bg-gray-200 text-gray-400 font-bold text-xs cursor-not-allowed">Habis</button>
        )}
      </div>
    </div>
  );
}

export default function Catalog() {
  const { products, addToCart, storeConfig } = useApp();
  const [activeTab, setActiveTab] = useState('menu'); // menu | tentang
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('terlaris');
  const [detailProduct, setDetailProduct] = useState(null);

  useEffect(() => {
    const handler = (e) => { setActiveTab('menu'); setCategory(e.detail); };
    window.addEventListener('filterCategory', handler);
    return () => window.removeEventListener('filterCategory', handler);
  }, []);

  const handleAdd = (product, qty) => {
    addToCart(product, qty);
    toast.success(`${product.name} masuk keranjang!`, { duration: 1500 });
  };

  const categories = storeConfig?.categories || [];

  const filtered = products
    .filter(p => p.active !== false)
    .filter(p => category === 'all' || p.category === category || (p.categories || []).includes(category))
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price-asc') return (a.final_price || a.price) - (b.final_price || b.price);
      if (sort === 'price-desc') return (b.final_price || b.price) - (a.final_price || a.price);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'terlaris') return (b.sold_count || 0) - (a.sold_count || 0);
      if (sort === 'terbaik') return (b.rating_avg || 0) - (a.rating_avg || 0);
      if (sort === 'terbaru') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return 0;
    });

  return (
    <section id="catalog" className="py-12 sm:py-16 bg-[#FDF8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-[#FED7AA]">
          <button
            data-testid="tab-menu"
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-3 font-bold text-sm transition-all relative ${activeTab === 'menu' ? 'text-[#EA580C]' : 'text-[#9A3412] hover:text-[#EA580C]'}`}
          >
            🍽️ Menu Kami
            {activeTab === 'menu' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-t-full" />}
          </button>
          <button
            data-testid="tab-tentang"
            onClick={() => setActiveTab('tentang')}
            className={`px-4 py-3 font-bold text-sm transition-all relative ${activeTab === 'tentang' ? 'text-[#EA580C]' : 'text-[#9A3412] hover:text-[#EA580C]'}`}
          >
            ✨ Tentang Kami
            {activeTab === 'tentang' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F97316] to-[#EA580C] rounded-t-full" />}
          </button>
        </div>

        {activeTab === 'tentang' ? (
          <AboutSection />
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#78350F] mb-2">Lagi Viral Bulan Ini 🔥</h2>
              <p className="text-[#92400E] font-body">Pilihan frozen food premium untuk keluarga</p>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92400E]" />
                <input
                  data-testid="catalog-search"
                  type="text"
                  placeholder="Cari produk..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full border border-[#FED7AA] bg-white text-[#451A03] focus:outline-none focus:ring-2 focus:ring-[#F97316] font-body"
                />
              </div>
              <select
                data-testid="catalog-sort"
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="px-4 py-3 rounded-full border border-[#FED7AA] bg-white text-[#7C2D12] focus:outline-none focus:ring-2 focus:ring-[#F97316] font-body font-bold text-sm"
              >
                <option value="terlaris">🔥 Terlaris</option>
                <option value="terbaik">⭐ Rating Terbaik</option>
                <option value="terbaru">🆕 Terbaru</option>
                <option value="price-asc">💰 Harga: Termurah</option>
                <option value="price-desc">💎 Harga: Termahal</option>
                <option value="name">🔤 Nama A-Z</option>
              </select>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
              <button
                data-testid="category-tab-all"
                onClick={() => setCategory('all')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
                  category === 'all' ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-md' : 'bg-white text-[#7C2D12] border border-[#FED7AA] hover:bg-[#FED7AA]'
                }`}
              >
                <Sparkles size={12} /> Semua
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  data-testid={`category-tab-${cat.id}`}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all ${
                    category === cat.id ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-md' : 'bg-white text-[#7C2D12] border border-[#FED7AA] hover:bg-[#FED7AA]'
                  }`}
                >
                  <span>{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="font-heading text-xl text-[#78350F] mb-2">Produk tidak ditemukan</h3>
                <p className="text-[#92400E] font-body">Coba kata kunci lain atau pilih kategori berbeda</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filtered.map((product, i) => (
                  <ProductCard
                    key={product.id} product={product}
                    onAdd={handleAdd} onOpen={setDetailProduct}
                    staggerIdx={i % 8}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {detailProduct && (
        <ProductDetailModal product={detailProduct} onClose={() => setDetailProduct(null)} />
      )}
    </section>
  );
}
