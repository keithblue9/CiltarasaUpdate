import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SmartImage from '../shared/SmartImage';

// localStorage key: stores millisecond timestamp of last dismissal
const STORAGE_KEY = 'ciltarasa_funfact_dismissed_at';
// sessionStorage key: when reshow_after_hours=0, dismissal is per-session
const SESSION_KEY = 'ciltarasa_funfact_session_dismissed';

// Decide if popup should show based on reshow_after_hours config
function shouldShow(reshowAfterHours) {
  // Per-session mode
  if (reshowAfterHours === 0) {
    try { return !sessionStorage.getItem(SESSION_KEY); } catch { return true; }
  }
  // Time-based mode
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (!ts) return true;
    const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
    return ageHours >= reshowAfterHours;
  } catch { return true; }
}

export default function FunFactsPopup() {
  const { storeConfig, isAuthed, authMode } = useApp();
  // Show fact if it has TEXT (image is now optional)
  const facts = (storeConfig?.fun_facts || []).filter(f => (f.title || f.text));
  const reshowAfterHours = Number(storeConfig?.fun_facts_meta?.reshow_after_hours ?? 24);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef(null);

  // Show after onboarding dismissed (respects reshow timer)
  useEffect(() => {
    if (facts.length === 0) return;
    if (!isAuthed && authMode !== 'guest') return; // wait for onboarding
    if (!shouldShow(reshowAfterHours)) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [facts.length, isAuthed, authMode, reshowAfterHours]);

  const close = () => {
    setOpen(false);
    try {
      if (reshowAfterHours === 0) {
        sessionStorage.setItem(SESSION_KEY, '1');
      } else {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    } catch {}
  };

  const goTo = (i) => {
    setIdx(i);
    scrollRef.current?.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const newIdx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    if (newIdx !== idx) setIdx(newIdx);
  };

  if (!open || facts.length === 0) return null;

  return (
    <div data-testid="funfact-popup" className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full sm:max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#DC2626] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-yellow-300 fill-yellow-300" />
            <span className="font-bold text-sm">Fun Facts {idx + 1}/{facts.length}</span>
          </div>
          <button data-testid="close-funfact" onClick={close} className="p-1 hover:bg-white/20 rounded-full">
            <X size={18} />
          </button>
        </div>

        {/* Carousel slides */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide flex-1"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {facts.map((f, i) => {
            // Image is optional now. show_image flag OR presence of image_url determines display.
            const hasImage = (f.show_image ?? !!f.image_url) && !!f.image_url;
            return (
              <div key={f.id || i} data-testid={`funfact-card-${i}`} className="min-w-full snap-center flex flex-col">
                {hasImage ? (
                  <>
                    {/* Image mode: photo on top with title overlay */}
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                      <SmartImage src={f.image_url} alt={f.title || ''} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                        <h3 className="font-heading text-lg font-extrabold text-white drop-shadow leading-snug">{f.title || 'Fun Fact'}</h3>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-[#451A03] leading-relaxed">{f.text}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Text-only mode: compact, title-focused, decorative gradient bar on top */}
                    <div className="h-2 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#DC2626] flex-shrink-0" />
                    <div className="px-6 pt-6 pb-2">
                      <h3 className="font-heading text-2xl font-extrabold text-[#7C2D12] leading-tight">{f.title || 'Fun Fact'}</h3>
                    </div>
                    <div className="px-6 pb-6">
                      <p className="text-[15px] text-[#451A03] leading-relaxed">{f.text}</p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#FED7AA] bg-[#FFFBF5] flex-shrink-0">
          <button
            onClick={() => idx > 0 && goTo(idx - 1)}
            disabled={idx === 0}
            className="p-2 rounded-full hover:bg-[#FED7AA] disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {facts.map((f, i) => (
              <button
                key={`dot-${f?.id || f?.title || i}`}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? 'bg-[#EA580C] w-6' : 'bg-[#FED7AA] w-2'}`}
              />
            ))}
          </div>
          <button
            onClick={() => idx < facts.length - 1 && goTo(idx + 1)}
            disabled={idx >= facts.length - 1}
            className="p-2 rounded-full hover:bg-[#FED7AA] disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
