import React, { useState, useEffect } from 'react';
import { RefreshCw, Wallet, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { PeriodTabs, KpiCard, DetailModal } from './ReportShared';

const API = process.env.REACT_APP_BACKEND_URL;
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const TYPE_META = {
  topup_saldo: { label: 'Top-up', color: 'text-green-700', sign: '+' },
  saldo_usage: { label: 'Pemakaian (ongkir order)', color: 'text-blue-700', sign: '−' },
  expense: { label: 'Biaya admin', color: 'text-red-500', sign: '−' },
};

export default function OngkirReport() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // 'topup' | 'usage' | 'admin' | null

  const load = async (p = period) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/reports/ongkir-history?period=${p}`);
      setData(r.data);
    } catch (e) { console.warn('[OngkirReport] load failed:', e); }
    setLoading(false);
  };
  useEffect(() => { load(period); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  if (loading || !data) return <div className="flex justify-center py-20"><RefreshCw size={32} className="text-[#D97706] animate-spin" /></div>;

  const entries = data.entries || [];
  const usages = entries.filter(e => e.type === 'saldo_usage');
  const topups = entries.filter(e => e.type === 'topup_saldo');
  const admins = entries.filter(e => e.type === 'expense');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#7C2D12]">Saldo Ongkir & History</h2>
          <p className="text-xs text-[#9A3412] mt-0.5">Setiap kamu isi ongkir saat "Tandai Siap Kirim", saldo otomatis kepotong & tercatat di sini.</p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} color={data.saldo_current >= 0 ? 'green' : 'red'} title="Saldo Ongkir Sekarang" value={fmtRp(data.saldo_current)} sub="top-up − pemakaian − admin fee" />
        <KpiCard icon={TrendingUp} color="green" title="Total Top-up" value={fmtRp(data.topup_total)} sub={`${topups.length} kali isi ulang`} onClick={topups.length ? () => setDetail('topup') : null} />
        <KpiCard icon={TrendingDown} color="blue" title="Total Pemakaian Ongkir" value={fmtRp(data.usage_total)} sub={`${usages.length} order (diganti customer)`} onClick={usages.length ? () => setDetail('usage') : null} />
        <KpiCard icon={AlertTriangle} color="amber" title="Biaya Admin" value={fmtRp(data.admin_fee_total)} sub={`${admins.length} entri (masuk P&L)`} onClick={admins.length ? () => setDetail('admin') : null} />
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
        ℹ️ <strong>Pemakaian ongkir bersifat netral</strong> (nggak mengurangi laba) karena sudah diganti customer lewat harga total. Cuma <strong>biaya admin</strong> yang beneran biaya (mengurangi laba).
      </div>

      {/* Riwayat detail */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-5">
        <h3 className="font-heading font-bold text-[#78350F] mb-3">Riwayat Pemakaian Ongkir per Order</h3>
        {usages.length === 0 ? (
          <p className="text-sm text-[#92400E] text-center py-6">Belum ada pemakaian ongkir di periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#FED7AA] text-[#92400E] text-xs">
                  <th className="text-left py-2 px-2 font-semibold">Tanggal</th>
                  <th className="text-left py-2 px-2 font-semibold">Order</th>
                  <th className="text-left py-2 px-2 font-semibold">Customer</th>
                  <th className="text-right py-2 px-2 font-semibold">Ongkir</th>
                </tr>
              </thead>
              <tbody>
                {usages.map(u => (
                  <tr key={u.id} className="border-b border-[#FED7AA]/50 hover:bg-[#FDF8F0]">
                    <td className="py-2 px-2 text-[#92400E] text-xs">{u.date}</td>
                    <td className="py-2 px-2 font-bold text-[#D97706]">#{u.order_number || '-'}</td>
                    <td className="py-2 px-2 text-[#451A03]">{u.customer_name || '-'}</td>
                    <td className="py-2 px-2 text-right font-bold text-blue-700">−{fmtRp(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#FED7AA]">
                  <td colSpan={3} className="py-2.5 px-2 font-bold text-[#78350F]">TOTAL PEMAKAIAN</td>
                  <td className="py-2.5 px-2 text-right font-heading font-bold text-blue-700">−{fmtRp(data.usage_total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Semua entry lain gabungan */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-5">
        <h3 className="font-heading font-bold text-[#78350F] mb-3">Semua Aktivitas Saldo</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-[#92400E] text-center py-6">Belum ada aktivitas di periode ini.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map(e => {
              const m = TYPE_META[e.type] || TYPE_META.expense;
              return (
                <div key={e.id} className="flex items-center justify-between p-3 bg-[#FDF8F0] rounded-xl gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#451A03] text-sm truncate">{e.description}</p>
                    <p className="text-[11px] text-[#92400E]">{m.label} · {e.date}{e.order_number ? ` · #${e.order_number}` : ''}{e.customer_name ? ` · ${e.customer_name}` : ''}</p>
                  </div>
                  <span className={`font-bold text-sm ${m.color}`}>{m.sign}{fmtRp(e.amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DetailModal open={detail === 'topup'} onClose={() => setDetail(null)} title="Detail Top-up Saldo" subtitle={`${topups.length} kali · Total ${fmtRp(data.topup_total)}`}>
        <SimpleList rows={topups} sign="+" color="text-green-700" />
      </DetailModal>
      <DetailModal open={detail === 'usage'} onClose={() => setDetail(null)} title="Detail Pemakaian Saldo" subtitle={`${usages.length} order · Total ${fmtRp(data.usage_total)}`}>
        <SimpleList rows={usages} sign="−" color="text-blue-700" showOrder />
      </DetailModal>
      <DetailModal open={detail === 'admin'} onClose={() => setDetail(null)} title="Detail Biaya Admin" subtitle={`${admins.length} entri · Total ${fmtRp(data.admin_fee_total)}`}>
        <SimpleList rows={admins} sign="−" color="text-red-500" />
      </DetailModal>
    </div>
  );
}

function SimpleList({ rows, sign, color, showOrder }) {
  if (!rows.length) return <p className="text-center text-[#92400E] py-6 text-sm">Tidak ada data.</p>;
  return (
    <div className="space-y-2">
      {rows.map(e => (
        <div key={e.id} className="flex justify-between items-start p-3 bg-[#FDF8F0] rounded-xl gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-[#451A03] text-sm truncate">{e.description}</p>
            <p className="text-[11px] text-[#92400E]">{e.date}{showOrder && e.order_number ? ` · #${e.order_number} · ${e.customer_name}` : ''}{e.note ? ` · ${e.note}` : ''}</p>
          </div>
          <span className={`font-bold text-sm ${color}`}>{sign}{fmtRp(e.amount)}</span>
        </div>
      ))}
    </div>
  );
}
