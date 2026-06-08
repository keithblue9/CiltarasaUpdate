"""AI-powered Business Insights router — connected directly to Anthropic Claude.

- GET /api/ai/insights — generate restock suggestions + demand forecast
- Cached 1 jam di db.ai_insights_cache untuk hemat token
- Force refresh via query param ?force=true

Requirements:
- Environment variable ANTHROPIC_API_KEY must be set
- Backwards-compatible fallback: if EMERGENT_LLM_KEY is set AND emergentintegrations
  is available, will use that path. Default path is Anthropic direct.
"""
from fastapi import Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import json
import logging
import httpx

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 1
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
# Haiku 4.5 — cepat, hemat token, cocok untuk structured JSON output dashboard
# Pakai dated version explicit untuk stabilitas. Bisa diganti ke sonnet untuk quality lebih tinggi.
DEFAULT_MODEL = "claude-haiku-4-5-20251001"
HTTP_TIMEOUT = 60.0


def _fmt_rp(n):
    try:
        return f"Rp {int(n):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "Rp 0"


def _build_insight_prompt(products, orders_window, low_stock_threshold, period_label):
    """Bangun prompt detail untuk Claude. Berikan data terstruktur dan minta JSON output."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=90)
    velocity = {}
    for o in orders_window:
        if o.get("status") == "dibatalkan":
            continue
        try:
            ts = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
            if ts < cutoff:
                continue
        except Exception:
            continue
        for it in o.get("items", []):
            pid = it.get("product_id")
            if not pid:
                continue
            velocity.setdefault(pid, 0)
            velocity[pid] += it.get("quantity", 0)

    summary_lines = []
    for p in products[:50]:
        v_90d = velocity.get(p["id"], 0)
        v_daily = round(v_90d / 90.0, 2)
        days_left = round(p.get("stock", 0) / v_daily, 1) if v_daily > 0 else (999 if p.get("stock", 0) > 0 else 0)
        summary_lines.append(
            f"- {p['name']} | Kategori: {p.get('category', '-')} | "
            f"Stok: {p.get('stock', 0)} | Modal: {_fmt_rp(p.get('cost_price', 0))} | "
            f"Harga: {_fmt_rp(p.get('price', 0))} | Terjual 90 hari: {v_90d} | "
            f"Velocity: {v_daily}/hari | Stok cukup: {days_left} hari"
        )

    total_revenue = sum(o.get("total", 0) for o in orders_window if o.get("status") != "dibatalkan")
    total_orders = len([o for o in orders_window if o.get("status") != "dibatalkan"])
    cancelled = len([o for o in orders_window if o.get("status") == "dibatalkan"])

    prompt = f"""Kamu adalah konsultan bisnis F&B untuk toko frozen food kecil-menengah di Indonesia. Analisis data berikut dan berikan insights actionable.

# Konteks Data ({period_label} terakhir)
- Total Revenue: {_fmt_rp(total_revenue)}
- Total Order Valid: {total_orders}
- Order Dibatalkan: {cancelled}
- Threshold Stok Menipis: {low_stock_threshold} unit

# Daftar Produk
{chr(10).join(summary_lines) if summary_lines else '(belum ada produk)'}

# Tugas
Berikan analisis dalam format JSON valid (TANPA markdown wrapper, TANPA penjelasan tambahan di luar JSON). Struktur exact:

{{
  "restock_suggestions": [
    {{
      "product_name": "nama produk",
      "urgency": "tinggi|sedang|rendah",
      "reason": "alasan singkat 1 kalimat dalam Bahasa Indonesia santai",
      "suggested_qty": angka (estimasi qty restock untuk 30 hari),
      "days_until_stockout": angka
    }}
  ],
  "demand_forecast": {{
    "next_7d_estimated_orders": angka,
    "next_7d_estimated_revenue": angka,
    "top_3_predicted_sellers": ["nama1", "nama2", "nama3"],
    "trend": "naik|stabil|turun",
    "confidence": "tinggi|sedang|rendah"
  }},
  "key_insights": [
    "insight singkat 1 (Bahasa Indonesia, max 100 char)",
    "insight singkat 2",
    "insight singkat 3"
  ],
  "action_items": [
    "saran action 1 (kalimat command, max 80 char)",
    "saran action 2",
    "saran action 3"
  ]
}}

Aturan:
- restock_suggestions: max 8 produk paling urgent (yang habis dalam <14 hari atau sudah habis tapi velocity tinggi). Sortir by urgency.
- demand_forecast: estimasi realistis berdasarkan velocity rata-rata.
- key_insights: insight bisnis yang berguna (mis: "Kategori Risoles dominan 45% revenue", "Order weekend 2x weekdays", "Best seller A naik 30%").
- action_items: rekomendasi konkret (mis: "Restock Risoles Ayam 100 unit minggu ini", "Buat bundle Lumpia + Risoles diskon 15%").
- Bahasa Indonesia santai, hangat, support bunda/seller kecil. JANGAN pakai bahasa korporat formal.
- HANYA JSON valid. Jangan tambah teks apapun di luar JSON."""
    return prompt


def _strip_code_fence(text: str) -> str:
    """Buang ```json ... ``` wrapper kalau model salah balikin."""
    t = (text or "").strip()
    if t.startswith("```"):
        # Drop opening fence line
        nl = t.find("\n")
        if nl != -1:
            t = t[nl + 1:]
        else:
            t = t.lstrip("`")
        # Drop closing fence
        if t.endswith("```"):
            t = t[:-3].rstrip()
        # Drop language tag if at start
        if t.startswith("json"):
            t = t[4:].lstrip()
    return t.strip()


async def _call_anthropic(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Direct call to Anthropic Messages API. Returns assistant text content."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            503,
            "ANTHROPIC_API_KEY belum di-set di environment Render. "
            "Tambahkan di Render → Environment Variables, lalu redeploy."
        )

    body = {
        "model": model,
        "max_tokens": 2000,
        "system": (
            "Kamu adalah konsultan bisnis F&B yang membantu UMKM Indonesia. "
            "Selalu output JSON valid sesuai schema yang diminta, "
            "tanpa text tambahan, tanpa markdown wrapper."
        ),
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            r = await client.post(ANTHROPIC_API_URL, json=body, headers=headers)
    except httpx.TimeoutException:
        raise HTTPException(504, "AI request timeout. Coba lagi dalam beberapa detik.")
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Tidak bisa konek ke Anthropic API: {str(e)[:200]}")

    if r.status_code == 401:
        raise HTTPException(503, "ANTHROPIC_API_KEY tidak valid. Cek API key di console.anthropic.com.")
    if r.status_code == 429:
        raise HTTPException(429, "Rate limit Anthropic API. Tunggu beberapa detik lalu refresh ulang.")
    if r.status_code == 400:
        # Possibly invalid model name — try fallback
        try:
            err_detail = r.json().get("error", {}).get("message", "")[:200]
        except Exception:
            err_detail = r.text[:200]
        raise HTTPException(502, f"Anthropic 400: {err_detail}")
    if r.status_code >= 400:
        raise HTTPException(502, f"Anthropic error {r.status_code}: {r.text[:200]}")

    try:
        payload = r.json()
    except Exception:
        raise HTTPException(502, "Anthropic response bukan JSON valid.")

    # Extract text content from content blocks
    text_parts = []
    for block in payload.get("content", []):
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
    text = "\n".join(text_parts).strip()
    if not text:
        raise HTTPException(502, "Anthropic response kosong.")
    return text


def _generate_local_insights(products, orders_window, low_stock_threshold, period_label):
    """Algorithmic insights from data — fallback when Anthropic API unavailable.
    Produces same schema as AI version so frontend doesn't need to differentiate."""
    now = datetime.now(timezone.utc)

    # Velocity per product (qty terjual / hari rata-rata 90 hari terakhir)
    cutoff = now - timedelta(days=90)
    velocity = {}
    revenue_by_product = {}
    qty_recent = {}  # 30 days for "predicted seller" ranking
    cutoff_30 = now - timedelta(days=30)

    for o in orders_window:
        if o.get("status") == "dibatalkan":
            continue
        try:
            ts = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        for it in o.get("items", []):
            pid = it.get("product_id")
            if not pid:
                continue
            qty = float(it.get("quantity") or 0)
            sub = float(it.get("subtotal") or 0)
            if ts >= cutoff:
                velocity[pid] = velocity.get(pid, 0) + qty
                revenue_by_product[pid] = revenue_by_product.get(pid, 0) + sub
            if ts >= cutoff_30:
                qty_recent[pid] = qty_recent.get(pid, 0) + qty

    # Build restock suggestions
    restock = []
    for p in products:
        v_90d = velocity.get(p["id"], 0)
        v_daily = v_90d / 90.0
        stock = float(p.get("stock") or 0)
        days_left = (stock / v_daily) if v_daily > 0 else (999 if stock > 0 else 0)
        if v_daily <= 0 and stock > 0:
            continue  # no velocity, no urgency
        urgency = None
        if stock == 0 and v_daily > 0:
            urgency = "tinggi"
            reason = f"Habis tapi velocity {v_daily:.1f}/hari — kehilangan penjualan kalau ga restock segera!"
        elif days_left < 7:
            urgency = "tinggi"
            reason = f"Stok cuma cukup {days_left:.0f} hari ke depan, butuh restock minggu ini."
        elif days_left < 14:
            urgency = "sedang"
            reason = f"Stok aman {days_left:.0f} hari, mulai pikirkan restock 1-2 minggu lagi."
        elif days_left < 30 and v_daily > 1:
            urgency = "rendah"
            reason = f"Stok cukup {days_left:.0f} hari, monitor velocity-nya."
        if urgency:
            suggested_qty = max(int(v_daily * 30 - stock), int(low_stock_threshold))  # cover 30 days
            restock.append({
                "product_name": p["name"],
                "urgency": urgency,
                "reason": reason,
                "suggested_qty": suggested_qty,
                "days_until_stockout": round(days_left, 1),
            })
    # Sort by urgency tinggi → sedang → rendah, then by days_left ascending
    urg_order = {"tinggi": 0, "sedang": 1, "rendah": 2}
    restock.sort(key=lambda r: (urg_order.get(r["urgency"], 3), r["days_until_stockout"]))
    restock = restock[:8]

    # Demand forecast (simple linear projection)
    valid_orders = [o for o in orders_window if o.get("status") != "dibatalkan"]
    total_rev = sum(float(o.get("total") or 0) for o in valid_orders)
    n_days = max(1, (now - cutoff).days)
    daily_avg_rev = total_rev / n_days
    daily_avg_orders = len(valid_orders) / n_days

    # Trend: compare last 14 days vs prior 14 days
    cutoff_14 = now - timedelta(days=14)
    cutoff_28 = now - timedelta(days=28)
    rev_last14 = sum(float(o.get("total") or 0) for o in valid_orders
                     if o.get("created_at", "") >= cutoff_14.isoformat())
    rev_prior14 = sum(float(o.get("total") or 0) for o in valid_orders
                      if cutoff_28.isoformat() <= o.get("created_at", "") < cutoff_14.isoformat())
    if rev_prior14 == 0:
        trend = "naik" if rev_last14 > 0 else "stabil"
    else:
        change_pct = (rev_last14 - rev_prior14) / rev_prior14 * 100
        trend = "naik" if change_pct > 5 else ("turun" if change_pct < -5 else "stabil")

    # Top 3 predicted sellers — by 30d qty
    top_predicted = sorted(qty_recent.items(), key=lambda x: -x[1])[:3]
    pname_map = {p["id"]: p["name"] for p in products}
    top_3_names = [pname_map.get(pid, "-") for pid, _ in top_predicted]

    forecast = {
        "next_7d_estimated_orders": int(daily_avg_orders * 7),
        "next_7d_estimated_revenue": int(daily_avg_rev * 7),
        "top_3_predicted_sellers": top_3_names,
        "trend": trend,
        "confidence": "sedang" if n_days >= 14 else "rendah",
    }

    # Key insights — text observations
    insights = []
    if valid_orders:
        cancelled_count = len([o for o in orders_window if o.get("status") == "dibatalkan"])
        cancel_rate = cancelled_count / max(1, len(orders_window)) * 100
        if cancel_rate > 20:
            insights.append(f"⚠️ Cancel rate {cancel_rate:.0f}% — cek alasan kenapa banyak pesanan dibatalkan.")
        if trend == "naik":
            insights.append(f"📈 Revenue 14 hari terakhir naik vs 14 hari sebelumnya — tren bagus!")
        elif trend == "turun":
            insights.append(f"📉 Revenue 14 hari terakhir turun — perlu promo atau follow-up pelanggan lama.")

    # Top product contribution
    if revenue_by_product:
        top_pid, top_rev = max(revenue_by_product.items(), key=lambda x: x[1])
        top_share = top_rev / max(1, total_rev) * 100
        if top_share > 30:
            insights.append(f"🌟 {pname_map.get(top_pid, 'Top produk')} kontribusi {top_share:.0f}% revenue — andalan toko.")

    # Low stock count
    oos = [p for p in products if (p.get("stock") or 0) == 0]
    low = [p for p in products if 0 < (p.get("stock") or 0) < low_stock_threshold]
    if oos:
        insights.append(f"🚫 {len(oos)} produk habis stok — kehilangan potensi penjualan.")
    elif low:
        insights.append(f"⚠️ {len(low)} produk stok menipis (< {low_stock_threshold} unit).")

    insights = insights[:5]

    # Action items
    actions = []
    if restock:
        urgent_count = sum(1 for r in restock if r["urgency"] == "tinggi")
        if urgent_count:
            actions.append(f"Restock {urgent_count} produk urgent minggu ini (lihat list di atas).")
    if top_3_names and top_3_names[0] != "-":
        actions.append(f"Buat promo bundling untuk {top_3_names[0]} — best seller 30 hari terakhir.")
    if trend == "turun":
        actions.append("Kirim WA broadcast ke pelanggan lama dengan diskon comeback.")
    if not actions:
        actions.append("Pantau dashboard rutin & update foto produk untuk engagement.")

    return {
        "restock_suggestions": restock,
        "demand_forecast": forecast,
        "key_insights": insights,
        "action_items": actions[:5],
    }


def setup(api_router, db, require_seller):
    """Register AI insights endpoints."""

    @api_router.get("/ai/insights")
    async def get_ai_insights(
        force: bool = Query(False),
        period: str = Query("90d"),
        start: Optional[str] = Query(None),
        end: Optional[str] = Query(None),
        _auth: bool = Depends(require_seller),
    ):
        """Generate AI insights — restock + demand forecast.

        Period: today|7d|14d|30d|90d|1y|custom
        Cache: 1 jam per (period, start, end)
        Force refresh: ?force=true
        """
        cache_key = f"main:{period}:{start or ''}:{end or ''}"

        # Cek cache dulu
        if not force:
            cached = await db.ai_insights_cache.find_one({"_id": cache_key})
            if cached:
                try:
                    ts = datetime.fromisoformat(cached.get("created_at", "").replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) - ts < timedelta(hours=CACHE_TTL_HOURS):
                        return {
                            **cached.get("data", {}),
                            "_cached": True,
                            "_period": period,
                            "_period_label": cached.get("period_label"),
                            "_generated_at": cached.get("created_at"),
                            "_cache_age_minutes": int((datetime.now(timezone.utc) - ts).total_seconds() / 60),
                        }
                except Exception:
                    pass

        # Parse period range
        now = datetime.now(timezone.utc)
        period_labels = {
            "today": "hari ini", "7d": "7 hari", "14d": "14 hari",
            "30d": "30 hari", "90d": "90 hari", "1y": "1 tahun", "365d": "1 tahun",
        }
        days_map = {"today": 1, "7d": 7, "14d": 14, "30d": 30, "90d": 90, "365d": 365, "1y": 365}

        if period == "custom" and start and end:
            try:
                s_dt = datetime.fromisoformat(start.replace("Z", "+00:00")) if "T" in start else datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
                # Just validate end format
                _ = datetime.fromisoformat(end.replace("Z", "+00:00")) if "T" in end else datetime.fromisoformat(end).replace(tzinfo=timezone.utc)
                cutoff = s_dt
                period_label = f"{start} s/d {end}"
            except Exception:
                cutoff = now - timedelta(days=90)
                period_label = "90 hari"
        else:
            days = days_map.get(period, 90)
            cutoff = now - timedelta(days=days)
            period_label = period_labels.get(period, "90 hari")

        # Load data
        products = await db.products.find({}, {"_id": 0}).to_list(200)
        orders = await db.orders.find(
            {"created_at": {"$gte": cutoff.isoformat()}},
            {"_id": 0},
        ).to_list(2000)
        cfg = await db.store_config.find_one({"_id": "main"}) or {}
        low_stock_threshold = int(cfg.get("low_stock_threshold") or 10)

        if not products:
            raise HTTPException(400, "Belum ada produk. Tambahkan produk dulu untuk dapat insights.")

        # ─── Try Anthropic Claude first; fallback to local analytics if unavailable ───
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        mode = "ai"  # "ai" or "local"
        ai_error = None

        if api_key:
            try:
                prompt = _build_insight_prompt(products, orders, low_stock_threshold, period_label)
                raw_text = await _call_anthropic(prompt)
                clean_text = _strip_code_fence(raw_text)
                data = json.loads(clean_text)
                # Validate minimum schema
                for k in ("restock_suggestions", "demand_forecast", "key_insights", "action_items"):
                    data.setdefault(k, [] if k != "demand_forecast" else {})
            except (HTTPException, json.JSONDecodeError, Exception) as e:
                logger.warning(f"AI insights failed, falling back to local: {e}")
                ai_error = str(e)[:200]
                data = _generate_local_insights(products, orders, low_stock_threshold, period_label)
                mode = "local"
        else:
            # No API key — use local fallback (still useful!)
            ai_error = "ANTHROPIC_API_KEY belum di-set di Render. Pakai local analytics dulu."
            data = _generate_local_insights(products, orders, low_stock_threshold, period_label)
            mode = "local"

        cache_doc = {
            "_id": cache_key,
            "period": period,
            "period_label": period_label,
            "start": start,
            "end": end,
            "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "products_analyzed": len(products),
            "orders_analyzed": len(orders),
            "model": DEFAULT_MODEL if mode == "ai" else "local-analytics",
            "mode": mode,
        }
        await db.ai_insights_cache.replace_one({"_id": cache_key}, cache_doc, upsert=True)

        return {
            **data,
            "_cached": False,
            "_period": period,
            "_period_label": period_label,
            "_generated_at": cache_doc["created_at"],
            "_cache_age_minutes": 0,
            "_products_analyzed": len(products),
            "_orders_analyzed": len(orders),
            "_model": cache_doc["model"],
            "_mode": mode,
            "_ai_error": ai_error if mode == "local" else None,
        }

    @api_router.delete("/ai/insights/cache")
    async def clear_insights_cache(_auth: bool = Depends(require_seller)):
        r = await db.ai_insights_cache.delete_many({})
        return {"ok": True, "cleared": r.deleted_count}

    @api_router.get("/ai/insights/health")
    async def ai_health():
        """Quick health check: apakah API key di-set & API bisa diakses."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        return {
            "has_api_key": bool(api_key),
            "key_prefix": (api_key[:7] + "...") if api_key else None,
            "model": DEFAULT_MODEL,
            "endpoint": ANTHROPIC_API_URL,
        }
