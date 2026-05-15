import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toast } from 'sonner';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

function ProductCard({ product, onAdd, staggerIdx }) {
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  const isOOS = !product.active || product.stock === 0;
  const isLow = product.stock > 0 && product.stock < 10;

  const handleAdd = () => {
    if (isOOS) return;
    onAdd(product, qty);
    setAdded(true);
    setTimeout(() => { setAdded(false); setQty(1); }, 1500);
  };

  return (
    <div
      data-testid={`product-card-${product.id}`}
      className={`product-card bg-white rounded-2xl border border-[#FED7AA] overflow-hidden fade-in-up stagger-${Math.min(staggerIdx + 1, 8)}`}
    >
      <div className="relative overflow-hidden h-44">
        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
        {isOOS && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">Habis</span>
          </div>
        )}
        {isLow && !isOOS && (
          <div className="absolute top-2 right-2">
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <AlertCircle size={10} /> Stok Terbatas
            </span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${product.category === 'bebek' ? 'bg-[#78350F] text-white' : 'bg-[#D97706] text-white'}`}>
            {product.category === 'bebek' ? 'Bebek Pawon Ayu' : 'Frozen Snack'}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-heading font-bold text-[#78350F] text-base leading-snug mb-1">{product.name}</h3>
        <p className="text-xs text-[#92400E] font-body mb-3 line-clamp-2 leading-relaxed">{product.description}</p>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-[#D97706] text-lg">{formatRp(product.price)}</span>
          {!isOOS && (
            <span className="text-xs text-[#92400E]">Stok: {product.stock}</span>
          )}
        </div>
        {!isOOS && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-[#FED7AA] rounded-full overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-1 text-[#78350F] hover:bg-[#FED7AA] transition-colors font-bold">-</button>
              <span className="px-3 text-sm font-semibold text-[#78350F] min-w-[28px] text-center">{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.stock, q + 1))} className="px-3 py-1 text-[#78350F] hover:bg-[#FED7AA] transition-colors font-bold">+</button>
            </div>
            <button
              data-testid={`add-to-cart-${product.id}`}
              onClick={handleAdd}
              className={`flex-1 py-2 px-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-1 ${
                added ? 'bg-green-500 text-white' : 'bg-[#D97706] text-white hover:bg-[#B45309]'
              }`}
            >
              {added ? (
                <><Check size={14} className="check-pop" /> Ditambah!</>
              ) : (
                <><ShoppingCart size={14} /> Tambah</>
              )}
            </button>
          </div>
        )}
        {isOOS && (
          <button disabled className="w-full py-2 px-4 rounded-full bg-gray-200 text-gray-400 font-bold text-sm cursor-not-allowed">
            Stok Habis
          </button>
        )}
      </div>
    </div>
  );
}

export default function Catalog() {
  const { products, addToCart } = useApp();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');

  useEffect(() => {
    const handler = (e) => setCategory(e.detail);
    window.addEventListener('filterCategory', handler);
    return () => window.removeEventListener('filterCategory', handler);
  }, []);

  const handleAdd = (product, qty) => {
    addToCart(product, qty);
    toast.success(`${product.name} ditambahkan ke keranjang!`, { duration: 2000 });
  };

  const filtered = products
    .filter(p => p.active !== false)
    .filter(p => category === 'all' || p.category === category)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const snackCount = products.filter(p => p.active !== false && p.category === 'snack').length;
  const bebekCount = products.filter(p => p.active !== false && p.category === 'bebek').length;

  return (
    <section id="catalog" className="py-16 bg-[#FDF8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-[#78350F] mb-2">Menu Kami</h2>
          <p className="text-[#92400E] font-body">Pilihan frozen food premium untuk keluarga</p>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92400E]" />
            <input
              data-testid="catalog-search"
              type="text"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-full border border-[#FED7AA] bg-white text-[#451A03] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body"
            />
          </div>
          <select
            data-testid="catalog-sort"
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="px-4 py-3 rounded-full border border-[#FED7AA] bg-white text-[#78350F] focus:outline-none focus:ring-2 focus:ring-[#D97706] font-body font-semibold"
          >
            <option value="default">Urutan Default</option>
            <option value="price-asc">Harga: Murah dulu</option>
            <option value="price-desc">Harga: Mahal dulu</option>
            <option value="name">Nama A-Z</option>
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'Semua', count: snackCount + bebekCount },
            { id: 'snack', label: 'Frozen Snacks', emoji: '🍟', count: snackCount },
            { id: 'bebek', label: 'Bebek Pawon Ayu', emoji: '🦆', count: bebekCount },
          ].map(tab => (
            <button
              key={tab.id}
              data-testid={`category-tab-${tab.id}`}
              onClick={() => setCategory(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
                category === tab.id
                  ? 'bg-[#D97706] text-white shadow-md'
                  : 'bg-white text-[#78350F] border border-[#FED7AA] hover:bg-[#FED7AA]'
              }`}
            >
              {tab.emoji && <span>{tab.emoji}</span>}
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${category === tab.id ? 'bg-white/20' : 'bg-[#FED7AA]'}`}>
                {tab.count}
              </span>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} onAdd={handleAdd} staggerIdx={i % 8} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
