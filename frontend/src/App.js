import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProvider } from './context/AppContext';
import BuyerApp from './components/buyer/BuyerApp';
import SellerApp from './components/seller/SellerApp';
import './App.css';

function App() {
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
