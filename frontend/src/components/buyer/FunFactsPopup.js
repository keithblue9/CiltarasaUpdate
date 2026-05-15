import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const STORAGE_KEY = 'ciltarasa_funfact_dismissed';

export default function FunFactsPopup() {
  const { storeConfig, isAuthed, authMode } = useApp();
  const facts = (storeConfig?.fun_facts || []).filter(f => f.image_url || f.text);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef(null);

  // Show after onboarding dismissed
  useEffect(() => {
    if (facts.length === 0) return;
    if (!isAuthed && authMode !== 'guest') return; // wait for onboarding
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [facts.length, isAuthed, authMode]);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem(STORAGE_KEY, '1');
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
      <div className="relative w-full sm:max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-3 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#DC2626] text-white flex items-center justify-between">
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
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {facts.map((f, i) => (
            <div key={f.id || i} data-testid={`funfact-card-${i}`} className="min-w-full snap-center">
              <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                {f.image_url ? (
                  <img src={f.image_url} alt={f.title || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">✨</div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="font-heading text-lg font-extrabold text-white drop-shadow leading-snug">{f.title || 'Fun Fact'}</h3>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-[#451A03] leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#FED7AA] bg-[#FFFBF5]">
          <button
            onClick={() => idx > 0 && goTo(idx - 1)}
            disabled={idx === 0}
            className="p-2 rounded-full hover:bg-[#FED7AA] disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {facts.map((_, i) => (
              <button
                key={i}
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
