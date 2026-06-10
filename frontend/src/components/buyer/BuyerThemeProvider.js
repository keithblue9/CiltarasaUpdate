import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * BuyerThemeProvider:
 *  - Reads storeConfig.seo and updates <title>, meta description, og tags, theme-color
 *  - Reads storeConfig.theme and injects CSS variables + override layer
 *  - Theme overrides scoped via [data-buyer-themed] attribute on wrapper div
 *
 * Defaults (current Ciltarasa palette):
 *   primary:        #D97706 (orange-600)
 *   primary_hover:  #B45309
 *   secondary:      #F97316
 *   bg:             #FDF8F0
 *   text:           #451A03
 *   heading:        #78350F
 *   accent:         #FED7AA
 *   font_base:      16px
 */

const DEFAULTS = {
  primary_color: '#D97706',
  primary_hover: '#B45309',
  secondary_color: '#F97316',
  bg_color: '#FDF8F0',
  text_color: '#451A03',
  heading_color: '#78350F',
  accent_color: '#FED7AA',
  font_size_base: 16,
};

const SEO_DEFAULTS = {
  title: 'Ciltarasa - Premium Frozen Food & Bebek Pawon Ayu khas Malang',
  description: 'Frozen food premium dari Malang. Pesan online, kirim cepat.',
  og_image_url: '',
};

// Strip non-hex characters and validate. Returns null if invalid.
function safeHex(h, fallback) {
  if (typeof h !== 'string') return fallback;
  const cleaned = h.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleaned)) return cleaned;
  return fallback;
}

function clampFontSize(n) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return DEFAULTS.font_size_base;
  return Math.max(12, Math.min(22, Math.round(v)));
}

function setMeta(name, content, attr = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function BuyerThemeProvider({ children }) {
  const { storeConfig } = useApp();

  // ─── SEO meta tags ───
  useEffect(() => {
    const seo = storeConfig?.seo || {};
    const title = (seo.title || '').trim() || SEO_DEFAULTS.title;
    const description = (seo.description || '').trim() || SEO_DEFAULTS.description;
    const ogImage = (seo.og_image_url || '').trim();
    const themeColor = safeHex(seo.theme_color, storeConfig?.theme?.primary_color || DEFAULTS.primary_color);

    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    if (ogImage) setMeta('og:image', ogImage, 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    if (ogImage) setMeta('twitter:image', ogImage);
    setMeta('theme-color', themeColor);
    setMeta('apple-mobile-web-app-title', title.split(' - ')[0] || title);
  }, [storeConfig?.seo, storeConfig?.theme?.primary_color]);

  // ─── Theme: inject CSS variables + override layer ───
  useEffect(() => {
    const t = storeConfig?.theme || {};
    const primary = safeHex(t.primary_color, DEFAULTS.primary_color);
    const primaryHover = safeHex(t.primary_hover, DEFAULTS.primary_hover);
    const secondary = safeHex(t.secondary_color, DEFAULTS.secondary_color);
    const bg = safeHex(t.bg_color, DEFAULTS.bg_color);
    const text = safeHex(t.text_color, DEFAULTS.text_color);
    const heading = safeHex(t.heading_color, DEFAULTS.heading_color);
    const accent = safeHex(t.accent_color, DEFAULTS.accent_color);
    const fontBase = clampFontSize(t.font_size_base || DEFAULTS.font_size_base);
    const fontFamily = t.font_family && t.font_family !== 'system'
      ? `${t.font_family}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      : null;

    // Override the most common Tailwind hex utility classes used in buyer UI.
    // Note: \\ in template strings becomes a single backslash in CSS — needed
    // because Tailwind generates classes like ".text-\[\#451A03\]".
    const css = `
      [data-buyer-themed] {
        background-color: ${bg};
        color: ${text};
        font-size: ${fontBase}px;
        ${fontFamily ? `font-family: ${fontFamily};` : ''}
      }

      /* Text colors */
      [data-buyer-themed] .text-\\[\\#451A03\\] { color: ${text} !important; }
      [data-buyer-themed] .text-\\[\\#78350F\\] { color: ${heading} !important; }
      [data-buyer-themed] .text-\\[\\#7C2D12\\] { color: ${heading} !important; }
      [data-buyer-themed] .text-\\[\\#9A3412\\] { color: ${heading} !important; }
      [data-buyer-themed] .text-\\[\\#92400E\\] { color: ${text} !important; opacity: 0.85; }
      [data-buyer-themed] .text-\\[\\#D97706\\] { color: ${primary} !important; }
      [data-buyer-themed] .text-\\[\\#EA580C\\] { color: ${primary} !important; }
      [data-buyer-themed] .text-\\[\\#B45309\\] { color: ${primaryHover} !important; }

      /* Background colors */
      [data-buyer-themed] .bg-\\[\\#FDF8F0\\] { background-color: ${bg} !important; }
      [data-buyer-themed] .bg-\\[\\#FEF3C7\\] { background-color: ${accent} !important; opacity: 0.85; }
      [data-buyer-themed] .bg-\\[\\#FED7AA\\] { background-color: ${accent} !important; }
      [data-buyer-themed] .bg-\\[\\#D97706\\] { background-color: ${primary} !important; }
      [data-buyer-themed] .bg-\\[\\#EA580C\\] { background-color: ${primary} !important; }
      [data-buyer-themed] .bg-\\[\\#B45309\\] { background-color: ${primaryHover} !important; }
      [data-buyer-themed] .hover\\:bg-\\[\\#B45309\\]:hover { background-color: ${primaryHover} !important; }

      /* Border colors */
      [data-buyer-themed] .border-\\[\\#FED7AA\\] { border-color: ${accent} !important; }
      [data-buyer-themed] .border-\\[\\#D97706\\] { border-color: ${primary} !important; }
      [data-buyer-themed] .hover\\:border-\\[\\#D97706\\]:hover { border-color: ${primary} !important; }

      /* Gradients used in buttons (e.g. from-[#F97316] to-[#EA580C]) */
      [data-buyer-themed] .bg-gradient-to-r.from-\\[\\#F97316\\],
      [data-buyer-themed] .bg-gradient-to-r.from-\\[\\#EA580C\\] {
        background-image: linear-gradient(to right, ${secondary}, ${primary}) !important;
      }
      [data-buyer-themed] .bg-gradient-to-br.from-\\[\\#F97316\\] {
        background-image: linear-gradient(to bottom right, ${secondary}, ${primary}) !important;
      }

      /* Focus ring on inputs */
      [data-buyer-themed] .focus\\:ring-\\[\\#D97706\\]:focus {
        --tw-ring-color: ${primary} !important;
      }
    `;

    let el = document.getElementById('ciltarasa-buyer-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'ciltarasa-buyer-theme';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [storeConfig?.theme]);

  return <div data-buyer-themed="1">{children}</div>;
}
