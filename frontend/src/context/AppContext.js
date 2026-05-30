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
  const [storeConfig, setStoreConfig] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [insights, setInsights] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsEvent, setWsEvent] = useState(null);
  const [cart, dispatch] = useReducer(cartReducer, []);

  // Auth
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [authMode, setAuthMode] = useState(null); // null | 'register' | 'login' | 'guest'

  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // Load cart from localStorage (run once on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const saved = localStorage.getItem('ciltarasa_cart');
    if (saved) {
      try { dispatch({ type: 'INIT', cart: JSON.parse(saved) }); }
      catch (e) { console.warn('[AppContext] Failed to parse saved cart:', e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ciltarasa_cart', JSON.stringify(cart));
  }, [cart]);

  // Load auth session (run once on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = localStorage.getItem('ciltarasa_token');
    const guest = localStorage.getItem('ciltarasa_guest');
    if (t) {
      axios.get(`${API}/api/auth/me?token=${t}`)
        .then(r => { setAuthUser(r.data); setAuthToken(t); })
        .catch(() => { localStorage.removeItem('ciltarasa_token'); });
    } else if (guest) {
      setAuthMode('guest');
    }
  }, []);

  // Load global data
  const loadAll = () => {
    axios.get(`${API}/api/products`).then(r => setProducts(r.data)).catch(() => {});
    axios.get(`${API}/api/settings`).then(r => setSettings(r.data)).catch(() => {});
    axios.get(`${API}/api/store-config`).then(r => setStoreConfig(r.data)).catch(() => {});
    axios.get(`${API}/api/discounts`).then(r => setDiscounts(r.data)).catch(() => {});
    axios.get(`${API}/api/reviews`).then(r => setReviews(r.data)).catch(() => {});
    axios.get(`${API}/api/purchases`).then(r => setPurchases(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // WebSocket
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          if (msg.type === 'store_config_updated') setStoreConfig(msg.data);
          if (msg.type === 'discount_updated') {
            setDiscounts(prev => {
              const idx = prev.findIndex(d => d.id === msg.data.id);
              if (idx >= 0) { const u = [...prev]; u[idx] = msg.data; return u; }
              return [msg.data, ...prev];
            });
            axios.get(`${API}/api/products`).then(r => setProducts(r.data)).catch(() => {});
          }
          if (msg.type === 'discount_deleted') {
            setDiscounts(prev => prev.filter(d => d.id !== msg.data.id));
          }
          if (msg.type === 'review_created') {
            setReviews(prev => [msg.data, ...prev]);
            axios.get(`${API}/api/products`).then(r => setProducts(r.data)).catch(() => {});
          }
          if (msg.type === 'purchase_updated') {
            setPurchases(prev => {
              const idx = prev.findIndex(p => p.id === msg.data.id);
              if (idx >= 0) { const u = [...prev]; u[idx] = msg.data; return u; }
              return [msg.data, ...prev];
            });
          }
          if (msg.type === 'purchase_deleted') {
            setPurchases(prev => prev.filter(p => p.id !== msg.data.id));
          }
        } catch (err) { console.warn('[AppContext WS] message parse error:', err); }
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

  // Auth actions
  const requestOtp = async (phone, name) => {
    const r = await axios.post(`${API}/api/auth/request-otp`, { phone, name });
    return r.data;
  };
  const verifyOtp = async (phone, otp, name) => {
    const r = await axios.post(`${API}/api/auth/verify-otp`, { phone, otp, name });
    setAuthUser(r.data.user);
    setAuthToken(r.data.token);
    localStorage.setItem('ciltarasa_token', r.data.token);
    localStorage.removeItem('ciltarasa_guest');
    setAuthMode(null);
    return r.data;
  };
  const logout = () => {
    setAuthUser(null);
    setAuthToken(null);
    localStorage.removeItem('ciltarasa_token');
    localStorage.removeItem('ciltarasa_guest');
    setAuthMode(null);
  };
  const continueAsGuest = () => {
    localStorage.setItem('ciltarasa_guest', '1');
    setAuthMode('guest');
  };

  const value = {
    products,
    settings,
    storeConfig,
    discounts,
    reviews,
    wsConnected,
    wsEvent,
    cart,
    cartTotal: cart.reduce((s, i) => s + (i.product.final_price || i.product.price) * i.qty, 0),
    cartCount: cart.reduce((s, i) => s + i.qty, 0),
    addToCart: (product, qty = 1) => dispatch({ type: 'ADD', product, qty }),
    removeFromCart: (id) => dispatch({ type: 'REMOVE', id }),
    setCartQty: (id, qty) => dispatch({ type: 'SET_QTY', id, qty }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
    refreshProducts: () => axios.get(`${API}/api/products`).then(r => setProducts(r.data)),
    refreshSettings: () => axios.get(`${API}/api/settings`).then(r => setSettings(r.data)),
    refreshStoreConfig: () => axios.get(`${API}/api/store-config`).then(r => setStoreConfig(r.data)),
    refreshDiscounts: () => axios.get(`${API}/api/discounts`).then(r => setDiscounts(r.data)),
    refreshReviews: () => axios.get(`${API}/api/reviews`).then(r => setReviews(r.data)),
    purchases,
    refreshPurchases: () => axios.get(`${API}/api/purchases`).then(r => setPurchases(r.data)),
    insights,
    fetchInsights: () => axios.get(`${API}/api/insights/dashboard`).then(r => { setInsights(r.data); return r.data; }),
    recommendations,
    fetchRecommendations: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return axios.get(`${API}/api/recommendations?${qs}`).then(r => { setRecommendations(r.data); return r.data; });
    },
    // Auth
    authUser,
    authToken,
    authMode,
    setAuthMode,
    requestOtp,
    verifyOtp,
    logout,
    continueAsGuest,
    isAuthed: !!authUser,
    API,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
