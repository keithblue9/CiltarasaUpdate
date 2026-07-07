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

  // ─── Listen for Service Worker push messages and play in-page audio ─────
  // When a push arrives while the seller PWA is open (foreground), the OS
  // suppresses showNotification's sound. We rely on the SW to postMessage
  // back so we can play an in-page chime + vibrate via Web Audio.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let active = true;
    let handlers = null;
    (async () => {
      try {
        // Dynamic import to avoid Web Audio issues for non-seller routes
        const mod = await import('../lib/notificationAlert');
        if (!active) return;
        handlers = mod;
        const onMessage = (event) => {
          const data = event.data;
          if (!data || data.type !== 'PUSH_RECEIVED') return;
          const t = data.payload?.alert_type;
          if (t === 'payment') {
            handlers.triggerPaymentAlert();
          } else {
            handlers.triggerOrderAlert();
          }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        // Save for cleanup
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
      } catch (e) {
        console.warn('[ws] alert handler attach failed:', e?.message);
      }
    })();
    return () => { active = false; };
  }, []);

  // Auth actions (passcode-based)
  const applyAuth = (data) => {
    setAuthUser(data.user);
    setAuthToken(data.token);
    localStorage.setItem('ciltarasa_token', data.token);
    localStorage.removeItem('ciltarasa_guest');
    setAuthMode(null);
  };
  const checkPhone = async (phone, name) => {
    const r = await axios.post(`${API}/api/auth/check-phone`, { phone, name });
    return r.data;
  };
  const setPasscode = async (phone, passcode, name) => {
    const r = await axios.post(`${API}/api/auth/set-passcode`, { phone, passcode, name });
    applyAuth(r.data);
    return r.data;
  };
  const login = async (phone, passcode) => {
    const r = await axios.post(`${API}/api/auth/login`, { phone, passcode });
    applyAuth(r.data);
    return r.data;
  };
  const changePasscode = async (oldPasscode, newPasscode) => {
    const t = authToken || localStorage.getItem('ciltarasa_token');
    const r = await axios.post(`${API}/api/auth/change-passcode`, {
      token: t, old_passcode: oldPasscode, new_passcode: newPasscode,
    });
    return r.data;
  };
  const updateProfile = async (patch) => {
    const t = authToken || localStorage.getItem('ciltarasa_token');
    const r = await axios.post(`${API}/api/auth/profile`, { token: t, ...patch });
    if (r.data?.user) setAuthUser(r.data.user);
    return r.data;
  };
  const logout = () => {
    setAuthUser(null);
    setAuthToken(null);
    localStorage.removeItem('ciltarasa_token');
    // Keep guest mode after logout so the OTP/onboarding popup doesn't auto-trigger.
    localStorage.setItem('ciltarasa_guest', '1');
    setAuthMode('guest');
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
    checkPhone,
    setPasscode,
    login,
    changePasscode,
    updateProfile,
    logout,
    continueAsGuest,
    isAuthed: !!authUser,
    API,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
