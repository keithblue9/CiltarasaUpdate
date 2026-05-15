# Ciltarasa - Frozen Food Online Store

## Problem Statement
Full-stack web app for Ciltarasa frozen food brand — specializing in frozen snacks and "Bebek Pawon Ayu" (traditional Javanese smoked duck). Two separate interfaces:
- `/buyer` — Customer Storefront (public)
- `/seller` — Seller Dashboard (PIN protected: `ciltarasa`)

## Architecture
- **Frontend**: React + Tailwind CSS + Recharts + Lucide React
- **Backend**: FastAPI + MongoDB + WebSocket (real-time)
- **State**: React Context + useReducer (cart) + WebSocket events
- **Fonts**: Playfair Display (headings) + Nunito (body)
- **Brand Colors**: Primary #D97706 (amber), BG #FDF8F0 (cream), Heading #78350F (brown)

## User Personas
1. **Buyer** — mobile-first Indonesian food customer from Malang area
2. **Seller** — Ciltarasa business owner managing orders/products via dashboard

## Core Requirements (Static)
- Buyer: Browse catalog, add to cart, checkout, track orders
- Seller: PIN login, manage products, process orders, view reports, WhatsApp notifications
- Real-time sync via WebSocket across different browsers/devices
- WhatsApp deep link notifications (wa.me/ links)
- Mobile responsive (375px to 1280px+)

## What's Been Implemented (Feb 2026)

### Buyer Storefront (/#/buyer)
- [x] Hero section with food background, brand logo, Playfair Display heading
- [x] "Cara Pesan" (How to Order) 3-step section
- [x] Product catalog: 12 products (8 snack + 4 bebek) with category filters
- [x] Search bar + sort (price asc/desc, name)
- [x] Add to cart with +/- quantity, animated button, OOS badge
- [x] Slide-in cart drawer with quantity controls
- [x] Checkout form (name, phone, address, delivery/pickup, payment method)
- [x] WhatsApp auto-notification on order submit
- [x] Order tracking by Order ID or phone number
- [x] Live timeline with 5 status steps + auto-refresh every 10s
- [x] Sticky header with cart badge

### Seller Dashboard (/#/seller)
- [x] PIN login screen (PIN: `ciltarasa`)
- [x] Dashboard Overview: 4 KPI cards, 7-day revenue line chart, recent orders
- [x] Product Management: Add/Edit/Delete products, stock +/- controls, active toggle
- [x] Incoming Orders: Status pipeline (menunggu → diproses → siap → selesai), order detail modal
- [x] WhatsApp order notifications via wa.me deep link
- [x] Sales Report: Period filters, bar chart, category donut, status pie, product performance table
- [x] Financial Report: Laba rugi, monthly chart, expense entries, transaction history
- [x] WhatsApp Settings: WA number, auto-notification toggle, template editor

### Backend API
- [x] GET/POST/PUT/DELETE /api/products
- [x] GET/POST /api/orders, PUT /api/orders/{id}/status
- [x] GET /api/orders/track (by order_id or phone)
- [x] GET/PUT /api/settings
- [x] GET/POST/DELETE /api/financial-entries
- [x] GET /api/reports/sales (period: today/week/month/year)
- [x] GET /api/reports/financial
- [x] WebSocket /api/ws (real-time broadcast)
- [x] Seed data: 12 products, 5 sample orders, default settings

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Full buyer flow (browse → cart → checkout → track)
- [x] Full seller flow (login → orders → status update)
- [x] Real-time sync via WebSocket

### P1 - High Priority (Next Sprint)
- [ ] Improve product images (replace picsum.photos with actual food images)
- [ ] Email/SMS order confirmation to buyer
- [ ] Print/PDF export for sales & financial reports
- [ ] Bulk stock update in product management
- [ ] Order search in tracking by multiple order IDs

### P2 - Nice to Have
- [ ] Push notifications (PWA)
- [ ] Customer order history page
- [ ] Product reviews/ratings
- [ ] Promo codes & discounts
- [ ] COD payment confirmation flow

## Next Tasks
1. Replace product placeholder images with real food photos
2. Add PDF export for financial reports
3. Add bulk stock update in Product Management
4. Consider PWA manifest for mobile install
