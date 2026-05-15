import React from 'react';
import { X, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const formatRp = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

export default function CartDrawer({ open, onClose }) {
  const { cart, cartTotal, removeFromCart, setCartQty } = useApp();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate('/buyer/checkout');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        data-testid="cart-drawer"
        className={`fixed right-0 top-0 h-full w-full max-w-md z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#FED7AA] bg-[#FDF8F0]">
          <div className="flex items-center gap-2">
            <ShoppingBag size={22} className="text-[#D97706]" />
            <h2 className="font-heading text-xl font-bold text-[#78350F]">Keranjang</h2>
            {cart.length > 0 && (
              <span className="bg-[#D97706] text-white text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#FED7AA] transition-colors">
            <X size={20} className="text-[#78350F]" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ShoppingBag size={64} className="text-[#FED7AA] mb-4" />
              <h3 className="font-heading text-lg font-bold text-[#78350F] mb-2">Keranjang Kosong</h3>
              <p className="text-sm text-[#92400E] font-body mb-6">Belum ada produk di keranjangmu</p>
              <button onClick={onClose} className="bg-[#D97706] text-white font-bold px-6 py-3 rounded-full hover:bg-[#B45309] transition-all">
                Lihat Menu
              </button>
            </div>
          ) : (
            cart.map(({ product, qty }) => (
              <div key={product.id} data-testid={`cart-item-${product.id}`} className="flex gap-3 bg-[#FDF8F0] rounded-xl p-3 border border-[#FED7AA]">
                <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[#78350F] text-sm leading-snug truncate">{product.name}</h4>
                  <p className="text-[#D97706] font-bold text-sm mt-0.5">{formatRp(product.price)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-[#FED7AA] rounded-full bg-white overflow-hidden">
                      <button
                        data-testid={`cart-decrease-${product.id}`}
                        onClick={() => setCartQty(product.id, qty - 1)}
                        className="px-2.5 py-1 text-[#78350F] hover:bg-[#FED7AA] transition-colors text-sm font-bold"
                      >-</button>
                      <span className="px-2 text-sm font-semibold text-[#78350F] min-w-[24px] text-center">{qty}</span>
                      <button
                        data-testid={`cart-increase-${product.id}`}
                        onClick={() => setCartQty(product.id, Math.min(product.stock, qty + 1))}
                        className="px-2.5 py-1 text-[#78350F] hover:bg-[#FED7AA] transition-colors text-sm font-bold"
                      >+</button>
                    </div>
                    <span className="text-xs text-[#92400E] ml-auto">{formatRp(product.price * qty)}</span>
                  </div>
                </div>
                <button
                  data-testid={`cart-remove-${product.id}`}
                  onClick={() => removeFromCart(product.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-start"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer with total */}
        {cart.length > 0 && (
          <div className="border-t border-[#FED7AA] p-5 bg-[#FDF8F0]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[#78350F] font-semibold">Total</span>
              <span className="text-[#D97706] font-bold text-xl">{formatRp(cartTotal)}</span>
            </div>
            <button
              data-testid="checkout-btn"
              onClick={handleCheckout}
              className="w-full bg-[#D97706] text-white font-bold py-4 rounded-full hover:bg-[#B45309] transition-all transform hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2"
            >
              Lanjut ke Checkout <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
