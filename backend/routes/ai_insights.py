"""AI-powered Business Insights router.
- POST /api/ai/insights — generate restock suggestions + demand forecast via Claude Sonnet
- Cached 1 jam di db.ai_insights_cache untuk hemat token
- Force refresh via query param ?force=true
"""
from fastapi import Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import os
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 1


def _fmt_rp(n):
    return f"Rp {int(n):,}".replace(",", ".")


def _build_insight_prompt(products, orders_90d, low_stock_threshold):
    """Bangun prompt detail untuk Claude. Berikan data terstruktur dan minta JSON output."""
    # Hitung velocity per produk (qty terjual / hari, 90 hari terakhir)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=90)
    velocity = {}
    for o in orders_90d:
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

    # Build product summary
    summary_lines = []
    for p in products[:50]:  # cap 50 to manage token usage
        v_90d = velocity.get(p["id"], 0)
        v_daily = round(v_90d / 90.0, 2)
        days_left = round(p.get("stock", 0) / v_daily, 1) if v_daily > 0 else (999 if p.get("stock", 0) > 0 else 0)
        summary_lines.append(
            f"- {p['name']} | Kategori: {p.get('category', '-')} | "
            f"Stok: {p.get('stock', 0)} | Modal: {_fmt_rp(p.get('cost_price', 0))} | "
            f"Harga: {_fmt_rp(p.get('price', 0))} | Terjual 90 hari: {v_90d} | "
            f"Velocity: {v_daily}/hari | Stok cukup: {days_left} hari"
        )

    total_revenue = sum(o.get("total", 0) for o in orders_90d if o.get("status") != "dibatalkan")
    total_orders = len([o for o in orders_90d if o.get("status") != "dibatalkan"])
    cancelled = len([o for o in orders_90d if o.get("status") == "dibatalkan"])

    prompt = f"""Kamu adalah konsultan bisnis F&B untuk toko frozen food kecil-menengah di Indonesia. Analisis data berikut dan berikan insights actionable.

# Konteks Data (90 hari terakhir)
- Total Revenue: {_fmt_rp(total_revenue)}
- Total Order Valid: {total_orders}
- Order Dibatalkan: {cancelled}
- Threshold Stok Menipis: {low_stock_threshold} unit

# Daftar Produk
{chr(10).join(summary_lines)}

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


def setup(api_router, db, require_seller):
    """Register AI insights endpoints."""

    @api_router.get("/ai/insights")
    async def get_ai_insights(force: bool = Query(False), _auth: bool = Depends(require_seller)):
        """Get AI insights — restock suggestions + demand forecast.
        Cached 1 jam. Pass ?force=true untuk regenerate."""
        # Cek cache
        if not force:
            cached = await db.ai_insights_cache.find_one({"_id": "main"})
            if cached:
                try:
                    ts = datetime.fromisoformat(cached.get("created_at", "").replace("Z", "+00:00"))
                    if datetime.now(timezone.utc) - ts < timedelta(hours=CACHE_TTL_HOURS):
                        return {
                            **cached.get("data", {}),
                            "_cached": True,
                            "_generated_at": cached.get("created_at"),
                            "_cache_age_minutes": int((datetime.now(timezone.utc) - ts).total_seconds() / 60),
                        }
                except Exception:
                    pass

        # Cek emergent llm key
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(503, "EMERGENT_LLM_KEY tidak diset. Hubungi admin server.")

        # Load data
        products = await db.products.find({}, {"_id": 0}).to_list(200)
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        orders = await db.orders.find(
            {"created_at": {"$gte": cutoff.isoformat()}},
            {"_id": 0},
        ).to_list(2000)
        cfg = await db.store_config.find_one({"_id": "main"}) or {}
        low_stock_threshold = int(cfg.get("low_stock_threshold") or 10)

        if not products:
            raise HTTPException(400, "Belum ada produk. Tambahkan produk dulu untuk dapat insights.")

        # Build prompt & call LLM
        prompt = _build_insight_prompt(products, orders, low_stock_threshold)
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=api_key,
                session_id=f"ciltarasa-insights-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
                system_message="Kamu adalah konsultan bisnis F&B yang membantu UMKM Indonesia. Selalu output JSON valid sesuai schema yang diminta, tanpa text tambahan.",
            ).with_model("anthropic", "claude-sonnet-4-6")
            response = await chat.send_message(UserMessage(text=prompt))
        except Exception as e:
            logger.error(f"AI insights LLM call failed: {e}")
            raise HTTPException(502, f"AI service error: {str(e)[:200]}")

        # Parse JSON response
        raw_text = response.strip() if isinstance(response, str) else str(response).strip()
        # Cleanup any markdown wrapper
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text
            if raw_text.endswith("```"):
                raw_text = raw_text.rsplit("\n", 1)[0] if "\n" in raw_text else raw_text[:-3]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].lstrip()
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            logger.error(f"AI returned non-JSON: {raw_text[:500]}")
            raise HTTPException(502, f"AI response format error: {str(e)}")

        # Cache
        cache_doc = {
            "_id": "main",
            "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "products_analyzed": len(products),
            "orders_analyzed": len(orders),
        }
        await db.ai_insights_cache.replace_one({"_id": "main"}, cache_doc, upsert=True)

        return {
            **data,
            "_cached": False,
            "_generated_at": cache_doc["created_at"],
            "_cache_age_minutes": 0,
            "_products_analyzed": len(products),
            "_orders_analyzed": len(orders),
        }

    @api_router.delete("/ai/insights/cache")
    async def clear_insights_cache(_auth: bool = Depends(require_seller)):
        r = await db.ai_insights_cache.delete_many({})
        return {"ok": True, "cleared": r.deleted_count}
