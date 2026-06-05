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

### Phase 19 ✅ FASE 7 — Delivery+Ongkir Flow Rework + Receipt + Category Sync + Period Expand (Feb 2026)

**Task 1 — Buyer Checkout Pengiriman Flow**:
- `BankTransferFlow.isDelivery` prop: saat buyer pilih `delivery`, "Pay Now" button **disabled** (alasan: ongkir belum ditentukan seller), auto-set ke "Pay Later". Info banner biru muncul.
- `QrisFlow.isDelivery`: saat delivery, skip QR display entirely → banner biru "QRIS akan dikirim setelah ongkir ditentukan", submit langsung sebagai pay_later.
- `paymentReady` logic update: delivery + transfer/qris → ready tanpa proof upload di checkout.

**Task 2 — Seller Ongkir + Buyer Payment Proof Submission**:
- Backend `OrderStatusUpdate.delivery_fee: Optional[float]` — saat `PUT /api/orders/{id}/status` dengan `status='siap'` + `delivery_fee>0` → recompute `total = subtotal + delivery_fee`.
- Frontend `OngkirModal` di IncomingOrders: muncul saat seller klik "Siap" untuk order delivery. Checkbox "Tambahkan ongkir" + input nilai + tombol "Tandai Siap Kirim". Update total live.
- Backend new endpoint `POST /api/orders/{id}/payment-proof` (public — buyer-facing): accept `{proof_url}`, marks `payment_proof_submitted=true`, forward foto bukti ke seller via Fonnte (param `url` + `filename` untuk media attachment).
- Frontend OrderTracking `OrderCard`: setelah status=`siap` + delivery + bukan COD + belum submit → tampilkan section "Saatnya Bayar!" dengan: total (include ongkir), tombol "Download Resi Pembayaran" (small thermal-style PDF, BUKAN A5 invoice), upload bukti JPG/PNG, tombol "✅ Sudah Melakukan Pembayaran" → trigger forward ke WA seller.
- New `receiptGenerator.js`: jsPDF thermal 80mm style (dotted dividers, items, bank info di footer, "Terimakasih") — match contoh user.

**Task 3 — Categories Live Sync**:
- `dashboard_inventory.category_breakdown` & `dashboard_sales.category_sales`: lookup nama kategori dari `store_config.categories` (resolve `category_id → name`, fallback `name` apa adanya). Sekarang dashboard kategori 100% dinamis nyambung config.

**Task 4 — Date Filter Expand**:
- Backend `_parse_period`: tambah `today` (WIB midnight → now), `14d`, `1y` (alias 365d), tetap support `7d/30d/90d/custom`.
- Frontend Dashboard PERIODS: **Hari Ini, 7 Hari, 14 Hari, 30 Hari, 1 Tahun, 📅 Custom**. Custom pakai 2 `<input type="date">` (start s/d end). Apply ke 3 tab (general/sales/customer); inventory tetap tanpa filter (real-time snapshot).

**Smoke test results**:
- Periods: today=15, 7d=18, 14d=18, 30d=18, 1y=18, custom OK ✓
- Ongkir flow: subtotal 50000 + ongkir 15000 → total 65000 ✓
- Payment proof submit: `submitted=true`, WA forward dengan `url` param ke Fonnte ✓ (delivery gagal hanya karena token Fonnte expired — sesuai expected)
- All lint clean (0 advisory).

### Phase 18b ✅ Code Quality Fixes Round 3 (Feb 2026)
- **Backend dynamic imports → static**: `cryptography.hazmat.primitives.serialization` (Encoding, PublicFormat) imported di top-level. Hapus 2 instances `__import__()` dinamis di VAPID key gen (line 738-740 server.py).
- **Backend E701 cleanup**: 17 instances "multiple statements on one line" diperbaiki di `parse_device()`, `parse_referrer_source()`, dan VAPID `os.unlink` finally block. Code style consistent.
- **Backend ObjectId safety**: `_get_vapid()` sekarang projection `{"_id": 0}` defensive (meskipun _id="vapid" string, bukan ObjectId).
- **Frontend empty catch (3 instances) → logged**: `SellerPushSettings.refresh` (subscriptions fetch), `sellerPush.js` requestSubscribe existing unsub, unsubscribe local unsub — semua sekarang `console.warn` dengan context.
- **Frontend array-index keys (7 instances) → stable IDs**:
  - Dashboard.js AI insights: `restock-${product_name}`, `insight-${i}-${slice}`, `action-${i}-${slice}`
  - AdminPages.js steps: `s.id || step-${idx}-${title}`
  - AboutSection.js stats: `stat-${s.label}`; cerita paras: `para-${i}-${slice}`
  - FunFactsPopup.js dots: `dot-${id || title || i}`
  - PurchaseManagement.js items: `purchase.id-item-product_id` + `it._uid || pitem-${idx}-${product_id}`
  - FinancialReport.js rows: `fr-row-${row.label}`
- **Tidak dikerjakan (rationale)**:
  - **localStorage PIN**: Bukan token JWT — PIN seller adalah shared secret untuk single-tenant UMKM app. Migrasi ke httpOnly cookies butuh backend session/CSRF refactor major + breaking change utk semua existing axios calls. P2 backlog.
  - **Hook deps "missing"**: 72 instance ESLint warnings — mayoritas BUKAN bug (loadAll/setState/setData stable, sengaja run once on mount). Adding all deps = infinite re-render loops. Code is sound; warnings are stylistic.
  - **seed_database / Checkout / Catalog complexity refactor**: working code, high regression risk, low return. P2 backlog dengan explicit test coverage prerequisite.
  - **create_order / update_order_status refactor**: Sudah sebagian extracted (broadcast_push, fonnte helpers). Further refactor menunggu Backend Refactor Phase (server.py → /routes/).
- **All linters clean**: backend ruff 0 advisory, frontend eslint 0 advisory.
- **Smoke test**: buyer page 0 console errors. Backend health: products 12, VAPID key 87 chars, maintenance enabled=false. All endpoints functional post-cleanup.

### Phase 18 ✅ FASE 6 — Maintenance Mode + AI Insights + Modular Routes (Feb 2026)
- **Maintenance / Store Closed Mode**: Seller toggle on/off via UI besar. Wording configurable (judul, pesan dengan placeholder `{return_date}` & `{return_time}`, tanggal+jam buka kembali, teks tombol WA). Background image uploadable (PC/HP/Google Drive). Buyer otomatis lihat MaintenanceScreen full-screen menggantikan katalog saat enabled. Polling 60s + WebSocket broadcast untuk near-realtime update.
- **AI-Powered Insights** (Claude Sonnet 4-6 via Emergent LLM Key):
  - `GET /api/ai/insights` → restock_suggestions (urgency, qty, days_until_stockout), demand_forecast (next 7d orders/revenue, trend, top 3 predicted sellers), key_insights, action_items
  - Cache 1 jam di `db.ai_insights_cache`. `?force=true` untuk regenerate. `DELETE /api/ai/insights/cache` clear.
  - Prompt highly-structured (Indonesia santai, target UMKM). JSON-only output dengan defensive markdown stripping.
  - UI: card di Dashboard General tab dengan 4 sub-section (forecast, restock, insights, actions). Refresh button. Widget visibility toggleable.
- **Modular Routes Refactor (partial)**: `/app/backend/routes/{__init__.py, maintenance.py, ai_insights.py}`. setup() pattern injects deps (api_router, db, require_seller, manager) — avoid circular imports. Clean decoupling, ready untuk continued refactor.
- **Frontend baru**:
  - `MaintenanceScreen.js` (buyer) — full-screen lock dengan background image + gradient overlay + WA button
  - `MaintenanceConfig` (seller AdminPages) — toggle card + 5 wording fields + bg upload + preview
  - `AiInsightsCard` (Dashboard) — 4 sub-section dengan urgency colors + trend icons
- **Widget config**: `show_ai_insights` flag baru di `dashboard_config.general`. Default true.
- **Test report**: `/app/test_reports/iteration_13.json` — Backend 12/12 (100%), Frontend 100%. AI Insights live-verified dengan Claude content real.
- **Tech debt**: server.py masih 2443 lines. P1 lanjutkan extract push/orders/dashboard ke `/routes/`.

### Phase 17 ✅ FASE 5 — PWA Seller App + Web Push (Feb 2026)
- **Seller Manifest**: `/seller-manifest.json` baru. `start_url=/#/seller`, `theme=#7C2D12`, 3 shortcuts (Pesanan Masuk, Dashboard, Produk). Auto-swap saat masuk seller route, restore saat keluar.
- **Web Push (VAPID standar, bukan FCM)**: backend `pywebpush + py-vapid`. Keys auto-generated saat startup pertama (stored di `db.auth_config._id=vapid`). Persist across restart.
- **5 Push Endpoints**:
  - `GET /api/push/vapid-key` (public) — public key base64url
  - `POST /api/push/subscribe` (PIN) — upsert by endpoint (no duplicate on re-subscribe)
  - `POST /api/push/unsubscribe` (PIN)
  - `GET /api/push/subscriptions` (PIN) — list all devices
  - `POST /api/push/test` (PIN) — broadcast test
- **Auto-broadcast on new order**: `POST /api/orders` panggil `broadcast_push()` ke semua subscribers. Stale subscription (404/410) auto-cleanup. `_push_sent` di response.
- **Service Worker** `/sw.js` v1.1.0: extended push handler dengan focus-existing-tab logic + 3 actions.
- **SellerPushSettings**: UI penuh — status card (BellRing/BellOff), label device, list active subscriptions, test push, delete per-device.
- **SellerPwaInstallBanner**: appear 10s setelah masuk seller, separate dari buyer banner, session-persistent dismiss.
- **Axios interceptor**: PIN auto-attach untuk `/api/push/*`.
- **Test report**: `/app/test_reports/iteration_12.json` — Backend 13/13 (100%), Frontend 100% (semua manifest swap, install banner, dismiss persistence, axios PIN injection verified).
- **Fixed minor 401 race**: Dashboard pertama load — silent retry 800ms jika 401 (PIN interceptor belum ready).
- **Tech debt**: server.py = 2434 lines. Refactor ke `/app/backend/routes/{push,orders,dashboard}.py` jadi P1 priority.

### Phase 16 ✅ FASE 4 — Seller Dashboard Revamp (Feb 2026)
- **4 Dynamic Tabs**: Umum (General), Inventori, Penjualan (Sales), Pelanggan (Customer). Real-time data dari MongoDB, NO dummy.
- **4 Backend Endpoints** (PIN-guarded):
  - `GET /api/dashboard/general?period=7d|30d|90d|custom` → KPI {revenue, orders, AOV, unique_customers}, trend chart, top_products, recent_orders, status_breakdown
  - `GET /api/dashboard/inventory` → KPI {total_products, low_stock, OOS, stock_value}, low_stock_items, top_movers, slow_movers, category_breakdown
  - `GET /api/dashboard/sales?period=...` → trend (revenue+orders 2-axis), payment_breakdown (pie), category_sales (bar), best_sellers, status_funnel, hour_heatmap (24)
  - `GET /api/dashboard/customer?period=...` → KPI {total, new, returning, retention%, avg_orders}, top_customers (lifetime), acquisition_trend (stacked bar)
- **Frontend**: `Dashboard.js` baru dengan recharts (AreaChart, LineChart, BarChart, PieChart). KpiCard + ChartCard helpers. Period switcher 7d/30d/90d (hidden untuk Inventory — always real-time snapshot).
- **Widget Visibility Config**: `storeConfig.dashboard_config` dengan 4 sub-dicts. Seller page "Widget Dashboard" untuk toggle on/off per widget. `show_* !== false` → render. Bulk "Show All / Hide All" per tab.
- **Default Period Configurable**: `dashboard_config.default_period` (7d/30d/90d) — saved & loaded on dashboard mount.
- **Axios interceptor diperluas**: auto-attach X-Seller-PIN untuk `/api/dashboard/*`, `/api/admin/fonnte-status`.
- **Note**: `stock_value` & category breakdown pakai `cost_price OR price * stock` — semantically lebih akurat utk valuasi inventori (cost basis bukan retail).
- **Test report**: `/app/test_reports/iteration_11.json` — Backend 22/22 (100%), Frontend 37/37 (100%).
- **Tech debt naik**: server.py kini 2253 lines — refactor ke `/app/backend/routes/*.py` prioritas P1 di backlog.

### Phase 15 ✅ FASE 3 — Auto-Chat WhatsApp + PDF Invoice (Feb 2026)
- **Auto-Chat Config (per stage, seller + buyer)**: 5 stage `menunggu/diproses/siap/selesai/dibatalkan` masing-masing punya `seller_enabled`, `seller_template`, `buyer_enabled`, `buyer_template`. Template support 15 placeholder: `{order_id}, {customer_name}, {customer_phone}, {customer_address}, {delivery}, {items_detail}, {total}, {subtotal}, {notes}, {status}, {status_desc}, {status_emoji}, {store_name}, {timestamp}, {track_link}`.
- **Backend logic**:
  - `POST /api/orders` → fire WA pakai `auto_chat_config["menunggu"]` (default seller_enabled=True, buyer_enabled=False)
  - `PUT /api/orders/{id}/status` → fire WA pakai `auto_chat_config[new_status]`
  - Response always include `_wa_seller_sent`, `_wa_buyer_sent`, `_wa_seller_reason`, `_wa_buyer_reason` (debugging)
  - `render_chat_template()` helper di server.py
- **AutoChatConfig seller page** `/seller#auto-chat`: 5 collapsible StageCard, masing-masing 2 toggles + 2 textarea editable. PlaceholderHelper bar dengan 15 tag clickable (copy to clipboard).
- **Invoice PDF (jsPDF client-side)**: 
  - Lib `/app/frontend/src/lib/invoiceGenerator.js` pakai `jspdf` + `jspdf-autotable`
  - Wording fully configurable via `storeConfig.invoice_texts` (15 keys: title, subtitle, labels, footers)
  - InvoiceConfig seller page `/seller#invoice` dengan 15 input fields + Preview PDF button (download sample dengan data demo, real-time pakai wording yang sedang di-edit)
  - Buyer page `/buyer/track`: tombol `[data-testid='download-invoice-btn']` muncul saat `order.received || order.status==='selesai'`
- **Sidebar additions**: "Auto-Chat WhatsApp" + "Wording Invoice" tabs di seller sidebar.
- **Backfill**: auto_chat_config & invoice_texts auto-merge missing keys saat startup (preserve user edits).
- **Test report**: `/app/test_reports/iteration_10.json` — Backend 100% (10/10), Frontend 95% (PDF download visual-verified, Playwright blob download flaky tapi click flow OK).

### Phase 14 ✅ FASE 2 — Payment Flow Revamp (Feb 2026)
- **Bank Transfer Flow**: Buyer → pilih bank dari `storeConfig.bank_accounts` → pilih cara bayar (Pay Now / Pay Later) → upload bukti .jpg jika Pay Now (proof uploader). Submit button disabled sampai flow lengkap. Tombol "Salin nomor rekening" otomatis copy ke clipboard.
- **QRIS Flow**: Buyer → klik QRIS → lihat QR image dari `storeConfig.qris_image_url` → klik "Telah Bayar" / "Batalkan" → upload bukti .jpg → submit. Atau klik "Batalkan" → "Coba Bayar Lagi" untuk reset stage.
- **COD Flow**: Info banner hijau, langsung submittable.
- **NEW: Public Proof Upload** `POST /api/media/upload-proof` (no PIN, image-only, max 5MB, tagged `kind=proof`). Sebelumnya `/api/media/upload` butuh PIN seller — sekarang buyer punya endpoint sendiri.
- **OrderCreate**: tambah `payment_bank_id`, `payment_type` ('now'|'later'), `payment_proof_url`.
- **StoreConfig**: tambah `qris_image_url` (string) + `payment_texts` (dict, 14 keys configurable). Backfill on startup tanpa wipe data.
- **PaymentsConfig seller page**: tambah 2 section baru — "QRIS Upload Gambar QR" (pakai existing `ImageUrlInput` — support computer/HP/Google Drive) + "Wording / Teks Halaman Pembayaran" (14 input fields utk customize semua teks buyer-facing).
- **Test report**: `/app/test_reports/iteration_9.json` — Backend 90%, Frontend 100% FASE 2.

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
- [x] **FASE 2 — Payment Flow Revamp (P1)** ✅ done
  - Bank Transfer: pilih bank → Pay Now vs Pay Later → upload bukti .jpg jika Pay Now
  - QRIS: seller upload QR via config → buyer scan → "Telah Bayar" → upload bukti .jpg
  - Wording payment proof configurable di seller admin (14 fields)
  - Public proof upload endpoint `/api/media/upload-proof` (no auth, image-only)
- [x] **FASE 3 — Auto-Chat & Invoice (P1)** ✅ done
  - Auto-chat config 5 stages × {seller, buyer} = 10 templates configurable
  - PDF Invoice jsPDF client-side + 15 configurable text fields
  - Backfill safe (preserve user edits)
- [x] **FASE 4 — Seller Dashboard Revamp (P2)** ✅ done
  - 4 tabs General/Inventory/Sales/Customer (recharts, real-time, no dummy)
  - Period filter 7d/30d/90d + Widget visibility config + Default period saveable
- [x] **FASE 5 — PWA Seller App + Web Push (P2)** ✅ done
  - Seller manifest separate + auto-swap on route
  - Web Push (VAPID) with device subscription management
  - Install banner & 3 shortcuts terpisah dari buyer PWA
  - Auto-push on new order + stale cleanup
- [x] **FASE 6 — Maintenance Mode + AI Insights + Partial Refactor (P1)** ✅ done
  - Store Closed: toggle, configurable wording (judul+pesan+tanggal+jam), bg image, halaman buyer locked
  - AI Insights (Claude Sonnet 4-6): restock + forecast + insights + action items, cached 1h
  - Modular routes: /app/backend/routes/{maintenance.py, ai_insights.py}
- [ ] **Tech Debt — Continue Refactor (P1, next)**
  - Split server.py (2443 lines) → routes/{push,orders,products,dashboard,store_config,auth}.py
  - Models → /app/backend/models/
  - Helpers → /app/backend/lib/
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
