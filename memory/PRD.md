# Ciltarasa - Frozen Food Online Store

## Problem Statement
Full-stack web app for Ciltarasa frozen food brand (Malang) — Shopee/Tokopedia-style platform with:
- `/#/buyer` — Customer storefront (simulated WA OTP auth)
- `/#/seller` — Seller dashboard (PIN: `ciltarasa`)

## Target Audience
- Ibu-ibu milenial & Gen Z (kelahiran 1980-2000) yang anaknya SD
- Modern, kekinian, viral TikTok vibes, FOMO marketing
- 100% Bahasa Indonesia, WIB timezone

## Architecture
- **Frontend**: React + Tailwind v4 + Recharts + Lucide + Shadcn UI
- **Backend**: FastAPI + MongoDB + WebSocket
- **State**: React Context + useReducer + WebSocket events
- **Auth**: Simulated WhatsApp OTP (always accepts `123456`), localStorage token
- **Schema versioning**: `SCHEMA_VERSION = v2.0.2` in server.py — bump to force DB reset

## What's Been Implemented (Feb 2026)

### Phase 1 ✅ Backend Schema & API Overhaul
- New collections: users, reviews, store_config, discounts, system_meta
- Auth: POST /api/auth/request-otp, verify-otp, GET /api/auth/me
- Store config: profile, cerita, categories, delivery_options, payment_methods, bank_accounts, social_links, gmaps_review_url
- Discounts CRUD: /api/discounts (percent/fixed)
- Reviews: rating 1-5 + photos, aggregation in product GET
- Order received: PUT /api/orders/{id}/received
- Product enhancements: media_urls (max 5, GDrive auto-convert), categories (multi), discount_id, sold_count, unit, weight
- Phone normalization (62xx format)
- DB auto-reset on schema version mismatch

### Phase 2 ✅ Buyer Auth & UI Cleanup
- Fullscreen OnboardingModal (Daftar/Masuk/Tamu)
- Simulated WA OTP flow → token in localStorage
- Profile dropdown (avatar, name, phone, Pesananku, Logout)
- Hero redesigned: removed logo image + floating buttons, added "Lagi Viral di Malang 🔥" pill, social proof
- Checkout auto-prefills user data when logged in

### Phase 3 ✅ Post-Delivery & Review Flow
- 6th status step "Konfirmasi Penerimaan" (when received=true)
- Action banner on selesai (Sudah Terima / Belum)
- ReviewModal: per-item rating 5★, textarea, mock photo upload
- "Review di Google Maps" CTA → opens user's gmaps_review_url

### Phase 4 ✅ Seller Overhaul
- Sidebar grouped: Operasional + Konfigurasi Toko
- StoreProfile page (name, logo, WA, address, bank accounts, social, GMaps URL)
- StoreCerita page (rich textarea)
- CategoriesConfig (multi categories with emoji icons)
- DeliveryConfig (delivery options with fee, active toggle)
- PaymentsConfig (payment methods with type)
- DiscountManagement (CRUD with product selector)
- Enhanced ProductForm: 5 media URL inputs, HPP, multi-category chips, unit/weight, discount selector

### Phase 5 ✅ Buyer Catalog + Detail + Tentang
- Shopee-style product cards with HOT/discount badges, rating, sold_count, strikethrough pricing
- Sort by Terlaris (default), Terbaik, Terbaru, Harga, Nama
- Dynamic category chips from storeConfig
- ProductDetailModal with media carousel, full description, reviews list, qty + add-to-cart
- Tab "Tentang Kami" with stats (1.200+ pelanggan, 4.9★, 5+ thn), cerita paragraphs, contact, social links, Gmaps CTA

### MVP (already done)
- Seller: PIN login, dashboard, products, orders, reports, financial, WhatsApp settings
- Real-time WebSocket sync across buyer/seller

## Testing Status
- Backend: 19/19 PASSED ✅ (iteration_2.json)
- Frontend: 15/15 PASSED ✅ (iteration_2.json)
- Test file: `/app/backend/tests/test_ciltarasa.py`

## Test Credentials
- Seller PIN: `ciltarasa`
- Buyer OTP: `123456` (selalu valid)
- Demo phone: `081912853950` (normalized → 6281912853950)
- Gmaps Review URL: https://maps.app.goo.gl/W8noqRWBkVsMESbHA

## Project Health
- ✅ All flows working (auth, catalog, cart, checkout, tracking, review, seller dashboard, all config pages, discount, real-time sync)
- 🟡 Mocked: OTP (123456), photo uploads (URL strings), Google Drive direct conversion
- 📋 Real-time WebSocket sync verified working

## Roadmap / Backlog

### P2 - Future Enhancements
- [ ] Replace flaky Unsplash images with stable food CDN (cosmetic)
- [ ] Real WhatsApp Business API integration (replace simulated OTP) — requires Twilio/Meta Business
- [ ] Real file upload for product media (S3 / Cloudinary)
- [ ] Push notifications (PWA)
- [ ] Email/SMS order confirmation
- [ ] Bulk stock import (CSV upload)
- [ ] Print/PDF export for sales report
- [ ] Refactor server.py into routers (auth, products, orders, reviews, store_config, discounts)
- [ ] Real JWT auth (currently token = user.id, no signature)

## Architecture Notes (from testing agent)
- server.py ~830 lines, approaching 700-line threshold → split into routers when scaling further
- DB drops collections on schema bump — fine for dev, guard before production
- Phone normalization assumes Indonesian format
- Token = user.id (no JWT/signature) — acceptable for simulated MVP only
