import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProvider } from './context/AppContext';
import BuyerApp from './components/buyer/BuyerApp';
import SellerApp from './components/seller/SellerApp';
import './App.css';

function App() {
  // Auto-redirect jika dibuka dari seller subdomain
  if (window.location.hostname === 'seller.ciltarasa.online' && 
      !window.location.hash.includes('/seller')) {
    window.location.replace('/#/seller');
    return null;
  }

  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/buyer/*" element={<BuyerApp />} />
          <Route path="/seller/*" element={<SellerApp />} />
          <Route path="*" element={<Navigate to="/buyer" replace />} />
        </Routes>
      </HashRouter>
      <Toaster position="top-right" richColors />
    </AppProvider>
  );
}

export default App;
