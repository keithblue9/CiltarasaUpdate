import React, { useState, useEffect } from 'react';

// Branded placeholder SVG data URL (small, lightweight, never fails)
const PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23FFF7ED'/%3E%3Cstop offset='100%25' stop-color='%23FED7AA'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23g)'/%3E%3Ctext x='100' y='95' font-size='48' text-anchor='middle' dominant-baseline='middle'%3E%F0%9F%8D%B1%3C/text%3E%3Ctext x='100' y='140' font-size='14' fill='%237C2D12' font-family='Arial, sans-serif' font-weight='700' text-anchor='middle'%3EFoto tidak tersedia%3C/text%3E%3Ctext x='100' y='160' font-size='11' fill='%239A3412' font-family='Arial, sans-serif' text-anchor='middle'%3ECiltarasa%3C/text%3E%3C/svg%3E";

const CORS_PROXY = 'https://corsproxy.io/?';

// Google Drive share URL → direct view URL
export function normalizeImageUrl(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Google Drive /file/d/ID/view → uc?export=view&id=ID
  const gdMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gdMatch) return `https://drive.google.com/uc?export=view&id=${gdMatch[1]}`;

  // Google Drive ?id=...
  const gdIdMatch = trimmed.match(/drive\.google\.com\/.*[?&]id=([^&]+)/);
  if (gdIdMatch) return `https://drive.google.com/uc?export=view&id=${gdIdMatch[1]}`;

  // Imgur page link → direct
  const imgurMatch = trimmed.match(/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/);
  if (imgurMatch) return `https://i.imgur.com/${imgurMatch[1]}.jpg`;

  // ImgBB share page → try direct (best-effort)
  const ibbMatch = trimmed.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9]+)$/);
  if (ibbMatch) return `https://i.ibb.co/${ibbMatch[1]}/image.jpg`;

  return trimmed;
}

export default function SmartImage({ src, alt = '', className = '', style = {}, onLoadOk, onError, fallbackSrc = PLACEHOLDER_SVG, ...props }) {
  const initial = normalizeImageUrl(src);
  const [current, setCurrent] = useState(initial);
  const [stage, setStage] = useState(0); // 0=normal, 1=cors-proxy, 2=fallback

  useEffect(() => {
    setCurrent(normalizeImageUrl(src));
    setStage(0);
  }, [src]);

  const handleError = (e) => {
    if (stage === 0 && current && current.startsWith('http') && !current.startsWith('data:')) {
      // Try CORS proxy
      try {
        const proxied = CORS_PROXY + encodeURIComponent(current);
        setCurrent(proxied);
        setStage(1);
        return;
      } catch {}
    }
    if (stage < 2) {
      setCurrent(fallbackSrc);
      setStage(2);
      onError && onError(e);
    }
  };

  return (
    <img
      src={current || fallbackSrc}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
      onLoad={onLoadOk}
      {...props}
    />
  );
}
