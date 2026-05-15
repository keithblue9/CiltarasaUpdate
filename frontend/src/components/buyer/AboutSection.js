import React from 'react';
import { MapPin, Phone, Clock, Instagram, Music2, Heart, Sparkles, Award, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function AboutSection() {
  const { storeConfig } = useApp();
  const sc = storeConfig || {};
  const ceritaParas = (sc.cerita || '').split('\n\n').filter(p => p.trim());

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#FB923C]/20 to-[#EA580C]/20 rounded-full mb-3">
          <Sparkles size={14} className="text-[#EA580C]" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#EA580C]">Cerita Kami</span>
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#7C2D12] mb-2">{sc.name || 'Ciltarasa'}</h2>
        <p className="text-[#9A3412] font-body italic">"{sc.tagline || 'Frozen Food Premium • Malang'}"</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[
          { icon: Users, num: '1.200+', label: 'Pelanggan Setia' },
          { icon: Award, num: '4.9★', label: 'Rating Google' },
          { icon: Heart, num: '5+ thn', label: 'Pengalaman' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#FED7AA] p-4 sm:p-5 text-center hover:shadow-lg transition-all">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-white">
              <s.icon size={18} />
            </div>
            <div className="font-heading text-xl sm:text-2xl font-extrabold text-[#7C2D12]">{s.num}</div>
            <div className="text-[10px] sm:text-xs text-[#9A3412] font-semibold uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Cerita */}
      <div className="bg-white rounded-3xl border border-[#FED7AA] p-6 sm:p-10 mb-8">
        <h3 className="font-heading text-2xl font-bold text-[#7C2D12] mb-4">Perjalanan Kami 📖</h3>
        <div className="space-y-4 text-[#451A03] font-body leading-relaxed">
          {ceritaParas.length > 0 ? (
            ceritaParas.map((p, i) => <p key={i}>{p}</p>)
          ) : (
            <p className="text-gray-500 italic">Cerita perjalanan toko belum diisi.</p>
          )}
        </div>
      </div>

      {/* Contact card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7] rounded-2xl border border-[#FED7AA] p-5">
          <h4 className="font-heading text-lg font-bold text-[#7C2D12] mb-3">Hubungi Kami</h4>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                <Phone size={14} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-[#7C2D12]">+{sc.whatsapp || '6281912853950'}</p>
                <p className="text-xs text-[#9A3412]">WhatsApp Bisnis</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-[#7C2D12]">{sc.address || 'Malang, Jawa Timur'}</p>
                <p className="text-xs text-[#9A3412]">Alamat Toko</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-[#7C2D12]">{sc.operating_hours || 'Setiap Hari • 08.00 - 21.00'}</p>
                <p className="text-xs text-[#9A3412]">Jam Operasional</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#FFF7ED] to-[#FEF3C7] rounded-2xl border border-[#FED7AA] p-5">
          <h4 className="font-heading text-lg font-bold text-[#7C2D12] mb-3">Ikuti Kami</h4>
          <div className="space-y-2.5 text-sm">
            {sc.social_links?.instagram && (
              <a href={sc.social_links.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:translate-x-1 transition-transform">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center"><Instagram size={14} className="text-white" /></div>
                <span className="font-bold text-[#7C2D12]">Instagram</span>
              </a>
            )}
            {sc.social_links?.tiktok && (
              <a href={sc.social_links.tiktok} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:translate-x-1 transition-transform">
                <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center"><Music2 size={14} className="text-white" /></div>
                <span className="font-bold text-[#7C2D12]">TikTok</span>
              </a>
            )}
            <a
              href={sc.gmaps_review_url || '#'}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow hover:shadow-lg transition-all"
            >
              <MapPin size={14} /> Review di Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
