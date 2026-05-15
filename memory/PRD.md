# Ciltarasa - Frozen Food Online Store

## Problem Statement
Full-stack platform Shopee/Tokopedia-style untuk Ciltarasa (frozen food Malang) — dengan 2 interface terpisah:
- **Buyer** `/#/buyer` — Customer storefront (simulated WA OTP auth)
- **Seller** `/#/seller` — Seller dashboard (PIN: `ciltarasa`)

## Target Audience
Ibu-ibu milenial & Gen Z (kelahiran 1980-2000) yang anaknya SD. Modern, kekinian, viral TikTok vibes, FOMO marketing. 100% Bahasa Indonesia, WIB.

## Architecture
- Frontend: React + Tailwind v4 + Recharts + Lucide + Shadcn UI
- Backend: FastAPI + MongoDB + WebSocket (real-time)
- State: React Context + useReducer + WS broadcast
- Auth: Simulated WhatsApp OTP (selalu `123456`), localStorage token
- Schema versioning: `SCHEMA_VERSION = v2.2.1` (bump = auto reset DB)

## What's Been Implemented (Feb 2026)

### Phase 1 ✅ Backend Schema & API Overhaul (v2.0)
### Phase 2 ✅ Buyer Auth + UI Cleanup
### Phase 3 ✅ Post-Delivery + Review Flow
### Phase 4 ✅ Seller Overhaul + Configuration Pages
### Phase 5 ✅ Catalog Shopee-style + Product Detail + Tab Tentang
### Phase 6 ✅ Flash Sale + Countdown Timer
### Phase 8 ✅ Fonnte WhatsApp + Admin Utilities + Security Hardening (Feb 2026)
- **Real Fonnte API** (`api.fonnte.com/send` via httpx) — Real 6-digit OTP, auto-notify seller on new order + auto-notify buyer on status update (Diproses/Siap/Selesai/Dibatalkan)
- **Seller pages NEW**: WhatsApp (Fonnte) config, Reset Pelanggan, Cara Pesan (Steps)
- **Security**: `X-Seller-PIN` header guard on ALL seller mutations; ENV vars `SELLER_PIN`+`APP_URL`; frontend axios interceptor
- **Branding**: title = "Ciltarasa - Premium Frozen Food"; Emergent badge removed (HTML+CSS+MutationObserver); demo OTP hints removed

### Phase 7 ✅ CMS + Slideshow + Purchases + Insights + Recommendations + Fun Facts (v2.2)
- **Editable Homepage Texts** — 13 text fields (viral pill, hero titles/subtitle/CTAs, social proof, section titles, tabs) editable via seller menu "Teks Homepage"
- **Hero Slideshow** — multi-slide background with per-slide duration, active toggle, reordering, crossfade transition + indicator dots
- **Modul Pembelian / Restock** — PO CRUD dengan supplier, items, ordered_at; "Tandai Diterima" auto-increment stok + update cost_price
- **Smart Dashboard Insights** — Restock Alerts (velocity 30 hari × avg lead time + safety buffer + suggested qty) + Top Sellers ranking; quick "Beli +N" pre-fills PO form
- **Auto-Stock from Purchases** — Product manual stock controls removed; info banner "Stok otomatis dari Pembelian/Restock"
- **Buyer Order History** `/buyer/orders` — 3 tabs (Ongoing/Selesai/Dibatalkan) dengan badge count
- **Buyer Recommendations Strip** — "Pesan Lagi" (repeat orders) + "Mungkin Suka"/"Lagi Hits" (similar category) untuk logged-in user
- **Fun Facts Popup** — 5 swipeable cards (image+title+text) muncul 2.5s setelah onboarding, dismissable, configurable via seller menu

## Test Credentials
- Seller PIN: `ciltarasa`
- Buyer OTP: `123456` (selalu valid - SIMULATED)
- Demo phone: `081912853950` (normalized → 6281912853950)
- Gmaps Review URL: https://maps.app.goo.gl/W8noqRWBkVsMESbHA

## Live URLs
- Buyer: `${REACT_APP_BACKEND_URL}/#/buyer`
- Seller: `${REACT_APP_BACKEND_URL}/#/seller`
- WebSocket: `/api/ws`

## Testing Status
- Phase 1-5: Backend 19/19 ✅ Frontend 15/15 ✅ (iteration_2.json)
- Phase 7: Backend 15/15 ✅ Frontend 100% ✅ (iteration_3.json)
- Cumulative: 49/49 endpoints + all UI flows verified

## Mocked Components
- OTP WhatsApp: backend selalu terima `123456`
- Photo upload (product & review): URL inputs only
- Hero slide & fun fact images: URL inputs

## Backlog / Roadmap

### P0 / P1 — Complete ✅
All user-requested features Phase 1-7 done.

### P2 — Code Hygiene & Scaling
- [ ] Split `server.py` (1121 lines) into routers: auth, products, orders, reviews, store_config, discounts, purchases, insights, recommendations
- [ ] Race-safe PO number generation (counter doc with $inc)
- [ ] Weighted-average cost_price update (multiple POs to same product)
- [ ] Real WhatsApp Business API (Twilio/Meta) — replace simulated OTP
- [ ] Real file upload (S3/Cloudinary) for media
- [ ] JWT auth signed tokens (currently token = user.id, no signature)
- [ ] PWA + push notifications
- [ ] CSV bulk stock import
- [ ] PDF export for sales/financial report
- [ ] Email/SMS order confirmation
