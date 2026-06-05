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
- **OnboardingTextsConfig** — new Seller menu "Teks Onboarding/Login" editing 13 fields of `storeConfig.onboarding_texts`. OnboardingModal reads from config with sensible defaults
- **PWA**: `manifest.json` (10 icons + maskable + apple-touch + 2 screenshots + 2 shortcuts), `sw.js` (cache-first static, network-first API, offline.html fallback, background sync, push-ready), install banner slide-up + floating "?" help FAB with browser+OS-detected install instructions, "Installed" badge in seller header on standalone
- **CRITICAL FIX** — backend `PUT /api/store-config` deep-merges nested dicts via dot-notation `$set`

### Phase 10 ✅ Editable Seller PIN + Visitor Analytics (Feb 2026)
- **Editable PIN**: PIN tersimpan di `db.auth_config` (override env). Endpoints:
  - `POST /api/admin/verify-pin` (public) untuk login
  - `POST /api/admin/change-pin` (validasi current PIN, min 4 char, harus berbeda)
- Frontend: menu seller **"Ubah PIN Akses"** dengan form 3 field (current/new/confirm + show-hide toggle). PIN baru otomatis logout setelah 3 detik. `localStorage.seller_pin` menyimpan PIN aktif → dipakai axios interceptor.
- **Visitor Analytics**:
  - `POST /api/analytics/track` (public, dipanggil sekali per session via `useTrackVisit` hook di BuyerApp; sessionStorage gate)
  - `GET /api/analytics/stats` (PIN-guarded) — total/today/week/month/pwa visits + daily 30-day chart + source breakdown (Google/IG/TikTok/WA/Shopee/Direct/...) + device breakdown (iOS/Android/Desktop)
- Frontend: menu seller **"Statistik Pengunjung"** dengan 4 KPI cards, recharts LineChart 30-hari, source & device breakdown bars + counter PWA installed
- Idempotent per-session: hit_count di-`$inc` saat session sama, first_seen/source/device hanya ditulis sekali (`$setOnInsert`)

### Phase 11 ✅ Conversion Metric + Date Range Filter + Editable Stock Threshold (Feb 2026)
- **GET /api/analytics/stats** sekarang menerima `from_date` & `to_date` (YYYY-MM-DD); default = 30 hari terakhir. Tambahan field response: `range_visits`, `range_orders`, `conversion_rate` (% order/visit dalam rentang), `total_orders`, `overall_conversion_rate`. Invalid date → fallback default. from>to → auto-swap.
- Frontend Traffic page: filter rentang tanggal (preset Hari Ini / 7d / 30d / 90d + date picker custom + tombol Terapkan), 4 KPI baru (Pengunjung rentang, Order rentang, **Konversi Rentang %**, Total Pengunjung + overall conversion subline). StatCard fixed agar render string-value (`14.29%`) tanpa NaN.
- **Editable Low-Stock Threshold**: 2 field baru di `store_config` — `low_stock_threshold` (default 10) & `restock_safety_days` (default 2). `/api/insights/dashboard` baca dari config; ProductManagement "Stok Rendah" badge pakai threshold dinamis dari storeConfig.
- Frontend Dashboard: header card "Saran Restock Pintar" punya tombol inline editor (chip `<10 unit · 2d safety`) → klik buka editor inline dengan 2 input + Save/Cancel, langsung PUT store-config & refresh insights tanpa pindah halaman.

### Phase 12 ✅ Code Quality Fixes (Feb 2026)
- **Security**: OTP generator dipindah dari `random.randint` → `secrets.randbelow` (cryptographically strong, anti-prediction).
- **Robustness**: Fonnte response handler lebih toleran — terima `False`/`"false"`/`0` sebagai status gagal (sebelumnya hanya `is not False` yang ketat).
- **React keys (round 1)**: Hero slideshow dots, ProductDetailModal media dots & review photos pakai stable key (uuid/url).
- **Error visibility (round 1)**: 6 empty catch blocks → `console.warn` (AppContext WS+parse, FinancialReport×2, SalesReport, DashboardOverview, IncomingOrders).
- **Hook hygiene**: 4 mount-only useEffect di AppContext + SellerApp annotate `eslint-disable react-hooks/exhaustive-deps`.

### Phase 12b ✅ Code Quality Fixes Round 2 (Feb 2026)
- **More empty catches → logged**: `SmartImage` CORS proxy, `PwaInstallBanner` install prompt, `useTrackVisit` analytics fail + tracking init.
- **More React keys (stable IDs)**: StoreConfigPages bank/categories/delivery/payment/slides/funfacts pakai `item.id || fallback-idx`. SalesReport top cards (label), pie cells (entry.name), product table (product id/name). Hero stars (`star-${i}`). ReviewModal item (product_id) + photo (composite product_id+idx+hash).
- **SmartImage useEffect**: dokumentasi komentar bahwa setters/normalizer stable & sengaja tidak masuk deps.
- **Tidak dikerjakan (alasan tetap)**: httpOnly cookies (P2 — butuh backend session refactor + CSRF), refactor complexity `seed_database`/`insights_dashboard`/`analytics_stats`/`get_sales_report` (P2 — di backlog), refactor komponen `Catalog`/`Checkout`/`OnboardingModal` (P2), index-as-key di test files (tidak runtime-impact), `is` vs `==` di server.py 752/1173 (false-positive — `is not None` adalah convention Python yang benar).

### Phase 13 ✅ FASE 1 — P0 Bug Fixes (Feb 2026)
- **Bug #11 (Stock Restoration on Cancel)**: `PUT /api/orders/{oid}/status` sekarang restore stock + decrement sold_count saat status = `dibatalkan`. Idempotent: flag `stock_restored` di order doc mencegah double-restore. Hanya restore jika `prev_status != dibatalkan` AND `stock_restored != true`. Verified via testing agent.
- **Bug #4 (Filter Inactive Payment Methods)**: `Checkout.js` sekarang baca dari `storeConfig.payment_methods.filter(p => p.active !== false)` instead of hardcoded `[transfer, cod, qris]`. Auto-pilih method aktif pertama jika current selection tidak tersedia. Fallback ke DEFAULT_PAYMENTS jika store_config kosong.
- **Bug #3 (WA Notif Diagnostics)**: `POST /api/orders` & `PUT /api/orders/{oid}/status` sekarang return `_wa_seller_sent`, `_wa_seller_reason`, `_wa_buyer_sent`, `_wa_buyer_reason` untuk diagnostic. Logger warn jika gagal kirim.
- **NEW: Live Fonnte Device Status Endpoint** `GET /api/admin/fonnte-status` (PIN-guarded): real-time check device terhubung/terputus via Fonnte `/device` API. Returns `connected`, `status`, `device`, `quota`, `messages`, `reason` (top-level untuk error precision). UI badge live di FonnteConfig dengan warna hijau/merah + tombol "Cek Status" + auto-check on mount.
- **Fix #2 (Remove Popup → Direct WA Redirect)**: `Checkout.js` `SuccessScreen` modal dihapus. Setelah order dibuat → toast "Pesanan dibuat! Membuka WhatsApp..." → `window.location.href = wa.me/...` langsung → fallback navigate ke `/buyer/track?order={number}`.
- **Test report**: `/app/test_reports/iteration_8.json` — 100% backend (4/4) + 90% frontend pass.

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

### P0 — User Requested (11 items, FASE 1 ✅ done)
- [x] Bug #3: WA notif diagnostic + live device status (Phase 13)
- [x] Bug #4: Filter inactive payment methods (Phase 13)
- [x] Bug #11: Stock restoration on cancel (Phase 13)
- [x] Fix #2: Remove popup → direct WA redirect (Phase 13)
- [ ] **FASE 2 — Payment Flow Revamp (P1, next)**
  - Bank Transfer: pilih bank → Pay Now vs Pay Later → upload bukti .jpg jika Pay Now
  - QRIS: seller upload QR via config → buyer scan → "Telah Bayar" → upload bukti .jpg
  - Wording payment proof configurable di seller admin
- [ ] **FASE 3 — Auto-Chat & Invoice (P1)**
  - Auto-chat config per stage order (toggle + edit wording)
  - PDF Invoice/Receipt (jsPDF client-side) — wording configurable
- [ ] **FASE 4 — Seller Dashboard Revamp (P2)**
  - 4 tab dinamis: General, Inventory, Sales, Customer (real-time, no dummy)
  - Widget visibility config (hide/show)
- [ ] **FASE 5 — PWA Seller App (P2)**
  - Manifest + SW khusus seller route

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
