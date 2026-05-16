# Ciltarasa - Frozen Food Online Store

## Problem Statement
Full-stack platform Shopee/Tokopedia-style untuk Ciltarasa (frozen food Malang) — dengan 2 interface terpisah:
- **Buyer** `/#/buyer` — Customer storefront (real Fonnte WA OTP, fallback simulasi)
- **Seller** `/#/seller` — Seller dashboard (PIN: `ciltarasa`)

## Target Audience
Ibu-ibu milenial & Gen Z (kelahiran 1980-2000) yang anaknya SD. Modern, kekinian, viral TikTok vibes, FOMO marketing. 100% Bahasa Indonesia, WIB.

## Architecture
- Frontend: React + Tailwind v4 + Recharts + Lucide + Shadcn UI + PWA (manifest + sw.js)
- Backend: FastAPI + MongoDB + WebSocket (real-time)
- State: React Context + useReducer + WS broadcast
- Auth (buyer): Fonnte WhatsApp OTP (fallback `123456`), localStorage token
- Auth (seller): PIN + `X-Seller-PIN` header guard on all mutations
- Schema versioning: `SCHEMA_VERSION = v2.4.1` (bump = auto reset DB)
- Service Worker: cache-first static, network-first API, offline fallback, push-ready

## What's Been Implemented

### Phase 1-7 ✅ Backend + Buyer Auth + Reviews + CMS + Slideshow + Purchases + Insights + Fun Facts
### Phase 8 ✅ Fonnte WhatsApp + Admin Utilities + Security Hardening
### Phase 9 ✅ Image Pipeline + Onboarding CMS + PWA (Feb 2026)
- **SmartImage rollout** — every `<img>` in buyer & seller swapped to `<SmartImage>` with CORS-proxy fallback + GDrive/Imgur/ImgBB auto-conversion + branded SVG placeholder on error
- **ImageUrlInput** — tabbed upload (multipart POST → /api/media) or paste URL with live ✅/❌ preview validation. Used in Hero slideshow, Fun Facts, Store Logo, 5 product media inputs
- **Media endpoint** — POST /api/media/upload (5 MB max, JPG/PNG/WEBP/GIF, base64 stored in Mongo), GET /api/media/{id} with 1-year cache headers; PIN-guarded
- **OnboardingTextsConfig** — new Seller menu "Teks Onboarding/Login" editing 13 fields of `storeConfig.onboarding_texts` (header_title/subtitle, welcome, register/login/guest labels & subtitles, ToS, OTP hint, phone hint). OnboardingModal reads from config with sensible defaults
- **PWA**:
  - `manifest.json` — id, start_url=/#/buyer, theme #6B0F1A, bg #FDF8F0, 10 icons (72-512 + maskable + apple-touch), 2 screenshots, 2 shortcuts (Lacak Pesanan, Riwayat)
  - `sw.js` — cache-first static assets, network-first /api/, offline.html fallback, background sync for queued orders, push notification ready structure
  - PWA install banner (slide-up bottom sheet, dismissable per-session, triggered 30s OR catalog visible)
  - Floating "?" help FAB (bottom-left) opening modal with browser+OS-detected install instructions (Chrome/Firefox/Edge/Samsung × Android/iOS/Desktop + Safari iOS+Mac)
  - Standalone detection → hides banner, one-time welcome toast, "Installed" badge in seller mobile header
- **CRITICAL FIX** — backend `PUT /api/store-config` now deep-merges nested dicts via dot-notation `$set` so partial updates (e.g. only editing one onboarding_text key) don't wipe sibling keys

## Test Credentials
- Seller PIN: `ciltarasa` (also `X-Seller-PIN` header)
- Buyer OTP: real Fonnte OTP via WA, fallback `123456` if Fonnte device disconnected/disabled
- Demo phone: `081912853950` (normalized → 6281912853950)
- Test seller WA: `6285249682337`
- Fonnte token (seeded): `QyMJ55FmqmLQGUxmwsBw` (device must be connected at fonnte.com)

## Live URLs
- Buyer: `${REACT_APP_BACKEND_URL}/#/buyer`
- Seller: `${REACT_APP_BACKEND_URL}/#/seller`
- WebSocket: `/api/ws`
- Manifest: `/manifest.json`
- SW: `/sw.js`

## Testing Status
- Phase 1-7: Backend 49/49 ✅ Frontend full ✅
- Phase 8: 13/13 ✅ (iteration_4.json)
- Phase 9: 13/13 backend + UI verified ✅ Critical nested-dict bug fixed (iteration_5.json)

## Mocked Components
- Review photo upload (mock unsplash URL only — easy upgrade later via ImageUrlInput)

## Backlog / Roadmap

### P1 — Recommended Next
- [ ] Fonnte device status indicator in seller WA config (UI badge + toast on disconnect)
- [ ] Review photo upload via ImageUrlInput (replace mock unsplash random)
- [ ] Loyalty / reward points (redeem points for vouchers) — boost retention

### P2 — Code Hygiene & Scaling
- [ ] Split `server.py` (~1370 lines) into routers: auth, products, orders, reviews, store_config, discounts, purchases, insights, recommendations, admin, media
- [ ] DB indexes (products.id, orders.customer_phone, orders.user_id, users.phone)
- [ ] `.limit()` on large queries (orders/reviews/products list endpoints)
- [ ] Race-safe PO number generation (counter doc with $inc)
- [ ] Weighted-average cost_price update on multiple POs
- [ ] JWT signed tokens (currently token = user.id)
- [ ] Real S3/Cloudinary media (currently base64 in Mongo)
- [ ] CSV bulk product/stock import
- [ ] PDF export for sales/financial report

### Backlog
- [ ] Real WhatsApp Business API (Meta/Twilio) as Fonnte alternative
- [ ] Push notifications via SW (FCM integration)
- [ ] Multi-language toggle
