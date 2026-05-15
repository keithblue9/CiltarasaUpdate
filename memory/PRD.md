# Ciltarasa - Frozen Food Online Store

## Problem Statement
Full-stack web app for Ciltarasa frozen food brand (Malang) — Shopee/Tokopedia-style platform with two interfaces:
- `/#/buyer` — Customer Storefront (auth + simulated WA OTP)
- `/#/seller` — Seller Dashboard (PIN: `ciltarasa`)

## Target User
- Ibu-ibu milenial & Gen Z (kelahiran 1980-2000) yang anaknya SD
- Modern, kekinian, viral TikTok vibes, FOMO marketing

## Architecture
- **Frontend**: React + Tailwind v4 + Recharts + Lucide + Shadcn UI
- **Backend**: FastAPI + MongoDB + WebSocket (real-time)
- **State**: React Context + useReducer + WebSocket events
- **Auth**: Simulated WhatsApp OTP (always accepts `123456`), localStorage token
- **Schema versioning**: `SCHEMA_VERSION` in server.py — bump to force DB reset+reseed
- **Timezone**: WIB (GMT+7)
- **Language**: 100% Bahasa Indonesia

## What's Been Implemented

### Phase 1 ✅ (Feb 2026) — Backend Schema & API Overhaul
- New Mongo collections: `users`, `reviews`, `store_config`, `discounts`, `system_meta`
- Auth endpoints: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `GET /api/auth/me`
- Store config: `GET /api/store-config`, `PUT /api/store-config` (profile, cerita, categories, delivery_options, payment_methods, bank_accounts, social_links, gmaps_review_url)
- Discounts CRUD: `/api/discounts`
- Reviews: `GET /api/reviews?product_id|order_id`, `POST /api/reviews` (rating 1-5, photos)
- Order received: `PUT /api/orders/{id}/received`
- Product enhancements: `media_urls[]` (up to 5, with GDrive conversion), `categories[]`, `discount_id`, `sold_count`, `unit`, `weight`
- Product GET attaches: `final_price`, `discount`, `rating_avg`, `rating_count`
- Order enhancements: `delivery_option_id`, `delivery_fee`, `payment_method_id`, `user_id`, `received`
- Phone normalization to 62xx format
- DB reset on schema version mismatch
- Seeded: 12 products with sold_count, 6 categories (snack/bebek/viral/anak/premium/paket), 4 delivery options, 3 payment methods, store config with Gmaps review URL

### Phase 2 ✅ (Feb 2026) — Buyer Auth & UI Cleanup
- Fullscreen OnboardingModal (Daftar/Masuk/Tamu)
- Simulated WA OTP flow → token saved to localStorage
- Profile dropdown in header (avatar initial, name, phone, Pesananku, Logout)
- Hero redesigned: removed logo image, removed floating category buttons, added "Lagi Viral di Malang 🔥" pill, social proof avatars + 5★ rating
- Checkout auto-prefills user data when logged in
- `user_id` linked to orders

### MVP (already done)
- Buyer: catalog, cart, checkout, tracking
- Seller: PIN login, dashboard, products, orders, reports
- Real-time WebSocket sync

## Prioritized Backlog

### P0 - Critical Done ✅
- [x] Backend schema overhaul (Phase 1)
- [x] Buyer auth + onboarding (Phase 2)
- [x] Hero & UI cleanups

### P1 - In Progress
- [ ] **Phase 3**: Post-delivery & review flow (step 6 "Konfirmasi Penerimaan", review modal, Gmaps button)
- [ ] **Phase 4**: Seller overhaul (Shopee-style dashboard, sidebar nav, order tabs, configuration menus, enhanced product form with 5 media links)
- [ ] **Phase 5**: Buyer catalog redesign (Shopee-style cards, sort Terlaris/Terbaik, product detail page, Tentang tab)

## Test Credentials
- Seller PIN: `ciltarasa`
- Buyer OTP: `123456` (simulasi)
- Demo phone: `081912853950`
- Gmaps Review URL: https://maps.app.goo.gl/W8noqRWBkVsMESbHA

## Next Tasks
1. Phase 3 — Review system + post-delivery confirmation
2. Phase 4 — Seller Shopee-style overhaul + configuration menus
3. Phase 5 — Buyer catalog redesign + product detail page + Tentang
