import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MessageCircle, Home } from 'lucide-react';
import axios from 'axios';
import SmartImage from '../shared/SmartImage';

const API = process.env.REACT_APP_BACKEND_URL;

function formatReturnDateOnly(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return date;
  }
}

function formatReturnDateTime(date, time) {
  const dateLabel = formatReturnDateOnly(date);
  if (!dateLabel) return '';
  return time ? `${dateLabel}, pukul ${time} WIB` : dateLabel;
}

export default function MaintenanceScreen({ config, storeConfig, settings }) {
  const returnLabel = formatReturnDateTime(config.return_date, config.return_time);
  const message = (config.message || '')
    .replace('{return_date}', formatReturnDateOnly(config.return_date) || 'segera')
    .replace('{return_time}', config.return_time || '');
  const bg = config.background_image_url;
  const bgSrc = bg?.startsWith('/api/') ? `${API}${bg}` : bg;
  const wa = settings?.seller_whatsapp || storeConfig?.seller_notify_phone || storeConfig?.whatsapp;

  return (
    <div data-testid="maintenance-screen" className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Background */}
      {bgSrc ? (
        <>
          <SmartImage src={bgSrc} alt="Maintenance background" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#451A03]/70 via-[#7C2D12]/60 to-[#451A03]/80" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C2D12] via-[#9A3412] to-[#451A03]" />
      )}

      {/* Floating decorative emojis */}
      <div className="absolute top-10 left-10 text-6xl opacity-20 animate-pulse">🍱</div>
      <div className="absolute bottom-16 right-12 text-5xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}>☕</div>
      <div className="absolute top-1/3 right-20 text-4xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}>🥟</div>

      {/* Content card */}
      <div className="relative z-10 max-w-xl w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 sm:p-10 border-2 border-amber-200">
        {storeConfig?.logo_url && (
          <div className="flex justify-center mb-4">
            <SmartImage src={storeConfig.logo_url} alt={storeConfig.name} className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          </div>
        )}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold mb-4">
            <Clock size={12} /> SEDANG LIBUR
          </div>
          <h1 data-testid="maintenance-title" className="font-heading text-3xl sm:text-4xl font-bold text-[#451A03] mb-3 leading-tight">
            {config.title || 'Maaf, kami sedang libur...'}
          </h1>
          <p data-testid="maintenance-message" className="text-[#7C2D12] text-base sm:text-lg leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        {returnLabel && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Buka Kembali</p>
                <p data-testid="maintenance-return-date" className="font-heading text-base sm:text-lg font-bold text-[#451A03]">{returnLabel}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {config.show_contact_wa && wa && (
            <a
              data-testid="maintenance-wa-btn"
              href={`https://wa.me/${wa}?text=${encodeURIComponent('Halo, saya mau menanyakan tentang ' + (storeConfig?.name || 'Ciltarasa'))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-5 rounded-full shadow-lg transition-all"
            >
              <MessageCircle size={18} /> {config.return_button_text || 'Hubungi via WhatsApp'}
            </a>
          )}
        </div>

        <p className="text-center text-xs text-[#92400E] mt-6">
          <span className="opacity-70">— {storeConfig?.name || 'Ciltarasa'} —</span>
        </p>
      </div>
    </div>
  );
}
