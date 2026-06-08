import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, AlertCircle, Package } from 'lucide-react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';

const API = process.env.REACT_APP_BACKEND_URL;
const STATUS_LABEL = {
  menunggu: 'Menunggu Konfirmasi',
  diproses: 'Diproses',
  siap: 'Siap Kirim',
};
const STATUS_COLOR = {
  menunggu: 'bg-yellow-100 text-yellow-800',
  diproses: 'bg-blue-100 text-blue-800',
  siap: 'bg-emerald-100 text-emerald-800',
};

/**
 * Floating alert dock — shows pending orders (menunggu/diproses/siap)
 * that haven't been shipped (selesai). Dismisses itself when list empty.
 *
 * Refreshes:
 *  - On mount
 *  - On every WS event from useApp (any order create/update/delete)
 *  - Polling every 60s as safety net
 */
export default function PendingOrdersAlert({ onNavigateOrders }) {
  const { wsEvent } = useApp();
  const [pending, setPending] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/orders`);
      const list = (res.data || []).filter(o => ['menunggu', 'diproses', 'siap'].includes(o.status));
      setPending(list);
      if (list.length === 0) setDismissed(false); // re-arm when list goes empty
    } catch {}
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);
  useEffect(() => { fetchPending(); }, [wsEvent, fetchPending]);
  useEffect(() => {
    const id = setInterval(fetchPending, 60000);
    return () => clearInterval(id);
  }, [fetchPending]);

  if (pending.length === 0 || dismissed) return null;

  return (
    <div
      data-testid="pending-orders-dock"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-96"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-orange-400 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full p-3 bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-between hover:from-orange-600 hover:to-red-600 transition-all"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="animate-pulse" />
            <span className="font-bold text-sm">
              {pending.length} Pesanan Perlu Action
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs opacity-80">{collapsed ? '▲' : '▼'}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="p-1 hover:bg-white/20 rounded"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="max-h-64 overflow-y-auto">
            {pending.slice(0, 10).map(order => (
              <button
                key={order.id}
                onClick={() => onNavigateOrders && onNavigateOrders(order.id)}
                className="w-full p-3 border-b border-orange-100 hover:bg-orange-50 transition-all text-left flex items-center gap-2"
              >
                <Package size={16} className="text-orange-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-[#451A03]">
                      {order.order_number || order.id?.slice(0, 8)}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#92400E] truncate mt-0.5">
                    {order.customer_name} · {order.items?.length || 0} item · Rp {(order.total || 0).toLocaleString('id-ID')}
                  </p>
                </div>
                <span className="text-[10px] text-orange-500 font-bold whitespace-nowrap">Klik →</span>
              </button>
            ))}
            {pending.length > 10 && (
              <div className="p-2 text-center text-[10px] text-gray-500 italic bg-orange-50">
                +{pending.length - 10} lainnya — buka halaman Pesanan Masuk
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
