import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, MapPin, Phone, Clock, Instagram, Menu, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LogoWithText } from '../shared/Logo';
import Hero from './Hero';
import Catalog from './Catalog';
import CartDrawer from './CartDrawer';
import Checkout from './Checkout';
import OrderTracking from './OrderTracking';

function BuyerHeader({ onCartClick }) {
  const { cartCount } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [bounce, setBounce] = useState(false);

  React.useEffect(() => {
    if (cartCount > prevCount) {
      setBounce(true);
      setTimeout(() => setBounce(false), 400);
    }
    setPrevCount(cartCount);
  }, [cartCount]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#FDF8F0]/90 border-b border-[#FED7AA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => navigate('/buyer')} className="flex items-center">
            <LogoWithText size="sm" />
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate('/buyer')} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">Beranda</button>
            <button onClick={() => navigate('/buyer')} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">Menu</button>
            <button onClick={() => navigate('/buyer/track')} className="text-[#78350F] hover:text-[#D97706] font-body font-semibold text-sm transition-colors">Lacak Pesanan</button>
          </nav>
          <div className="flex items-center gap-3">
            <button
              data-testid="cart-button"
              onClick={onCartClick}
              className="relative p-2 rounded-full bg-[#D97706] text-white hover:bg-[#B45309] transition-all shadow-md"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className={`absolute -top-1 -right-1 bg-[#78350F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ${bounce ? 'badge-bounce' : ''}`}>
                  {cartCount}
                </span>
              )}
            </button>
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={24} className="text-[#78350F]" /> : <Menu size={24} className="text-[#78350F]" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-3 border-t border-[#FED7AA] pt-3">
            <button onClick={() => { navigate('/buyer'); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">Beranda</button>
            <button onClick={() => { navigate('/buyer'); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">Menu</button>
            <button onClick={() => { navigate('/buyer/track'); setMenuOpen(false); }} className="text-left text-[#78350F] font-semibold py-2">Lacak Pesanan</button>
          </div>
        )}
      </div>
    </header>
  );
}

function BuyerFooter() {
  return (
    <footer className="bg-[#78350F] text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-heading text-xl font-bold mb-3 text-[#FED7AA]">Ciltarasa</h3>
            <p className="text-sm text-orange-200 font-body leading-relaxed">
              Frozen snack premium dan Bebek Pawon Ayu khas Malang. Tinggal goreng, langsung nikmat!
            </p>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3 text-[#FED7AA]">Kontak</h4>
            <div className="space-y-2 text-sm text-orange-200">
              <div className="flex items-center gap-2">
                <Phone size={14} />
                <span>0852-4968-2337</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} />
                <span>Malang, Jawa Timur</span>
              </div>
              <div className="flex items-center gap-2">
                <Instagram size={14} />
                <span>@ciltarasa.official</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-heading font-semibold mb-3 text-[#FED7AA]">Jam Operasional</h4>
            <div className="space-y-1 text-sm text-orange-200">
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span>Senin - Sabtu: 08.00 - 20.00</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span>Minggu: 09.00 - 17.00</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-amber-700 mt-8 pt-6 text-center text-xs text-orange-300">
          © 2025 Ciltarasa. Premium Frozen Snacks & Bebek Pawon Ayu.
        </div>
      </div>
    </footer>
  );
}

function BuyerHome() {
  return (
    <>
      <Hero />
      <Catalog />
    </>
  );
}

export default function BuyerApp() {
  const [cartOpen, setCartOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#FDF8F0] font-body">
      <BuyerHeader onCartClick={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <Routes>
        <Route index element={<BuyerHome />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="track" element={<OrderTracking />} />
      </Routes>
      <BuyerFooter />
    </div>
  );
}
