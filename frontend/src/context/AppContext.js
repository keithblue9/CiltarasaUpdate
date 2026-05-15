import React, { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
const WS_URL = API.replace('https://', 'wss://').replace('http://', 'ws://');
const AppCtx = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const idx = state.findIndex(i => i.product.id === action.product.id);
      if (idx >= 0) {
        const updated = [...state];
        updated[idx] = { ...updated[idx], qty: Math.min(updated[idx].qty + action.qty, action.product.stock) };
        return updated;
      }
      return [...state, { product: action.product, qty: action.qty || 1 }];
    }
    case 'REMOVE': return state.filter(i => i.product.id !== action.id);
    case 'SET_QTY': return state.map(i => i.product.id === action.id ? { ...i, qty: action.qty } : i).filter(i => i.qty > 0);
    case 'CLEAR': return [];
    case 'INIT': return action.cart;
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsEvent, setWsEvent] = useState(null);
  const [cart, dispatch] = useReducer(cartReducer, []);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('ciltarasa_cart');
    if (saved) {
      try { dispatch({ type: 'INIT', cart: JSON.parse(saved) }); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ciltarasa_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    axios.get(`${API}/api/products`).then(r => setProducts(r.data)).catch(console.error);
    axios.get(`${API}/api/settings`).then(r => setSettings(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    let active = true;
    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(`${WS_URL}/api/ws`);
      wsRef.current = ws;
      ws.onopen = () => { if (active) setWsConnected(true); };
      ws.onmessage = (e) => {
        if (!active) return;
        try {
          const msg = JSON.parse(e.data);
          setWsEvent({ ...msg, _ts: Date.now() });
          if (msg.type === 'product_updated') {
            setProducts(prev => {
              const idx = prev.findIndex(p => p.id === msg.data.id);
              if (idx >= 0) { const u = [...prev]; u[idx] = msg.data; return u; }
              return [...prev, msg.data];
            });
          }
          if (msg.type === 'product_deleted') {
            setProducts(prev => prev.filter(p => p.id !== msg.data.id));
          }
          if (msg.type === 'settings_updated') setSettings(msg.data);
        } catch {}
      };
      ws.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        timerRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const value = {
    products,
    settings,
    wsConnected,
    wsEvent,
    cart,
    cartTotal: cart.reduce((s, i) => s + i.product.price * i.qty, 0),
    cartCount: cart.reduce((s, i) => s + i.qty, 0),
    addToCart: (product, qty = 1) => dispatch({ type: 'ADD', product, qty }),
    removeFromCart: (id) => dispatch({ type: 'REMOVE', id }),
    setCartQty: (id, qty) => dispatch({ type: 'SET_QTY', id, qty }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
    refreshProducts: () => axios.get(`${API}/api/products`).then(r => setProducts(r.data)),
    refreshSettings: () => axios.get(`${API}/api/settings`).then(r => setSettings(r.data)),
    API,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
