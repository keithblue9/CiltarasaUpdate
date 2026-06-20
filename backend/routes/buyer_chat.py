"""Acil Tata — buyer-facing chat assistant (Claude Haiku).

Lightweight proxy to the Anthropic Messages API. The ORDER itself is built
deterministically on the frontend via clickable buttons (so prices, stock, and
the cart are never hallucinated). This endpoint only powers Acil Tata's warm
greeting + short conversational replies.

Requires env var ANTHROPIC_API_KEY (already used by ai_insights). If it's not
set or the API errors, we fall back to a friendly static line so the chat widget
keeps working — the buyer can always order via the buttons.
"""
import os
import httpx
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5-20251001"
HTTP_TIMEOUT = 25.0

ACIL_TATA_SYSTEM = (
    "Kamu adalah \"Acil Tata\", asisten belanja yang ramah dari toko frozen food "
    "Ciltarasa (Malang). Gaya bicara: hangat, santai, bahasa Indonesia sehari-hari, "
    "ramah khas 'acil' (tante baik hati). Boleh sedikit emoji secukupnya.\n\n"
    "Tugasmu: menyapa pembeli dengan hangat dan bantu mereka memesan.\n\n"
    "ATURAN PENTING:\n"
    "- Jawaban SELALU singkat (maksimal 2-3 kalimat) karena ini bubble chat kecil.\n"
    "- Proses pesan dilakukan lewat TOMBOL yang muncul di chat. Kalau pembeli bingung "
    "atau cuma menyapa, arahkan dengan ramah untuk klik tombol produk yang muncul.\n"
    "- JANGAN PERNAH mengarang nama produk, harga, stok, atau nomor rekening. "
    "Kalau ditanya hal spesifik yang tidak ada di data, bilang saja seller akan bantu "
    "infokan atau arahkan klik tombol.\n"
    "- Jangan menjanjikan apa pun soal harga/ongkir/pengiriman yang tidak ada di data."
)


class BuyerChatReq(BaseModel):
    messages: List[Dict[str, Any]] = []   # [{role:'user'|'assistant', content:str}]
    products_hint: Optional[str] = ""      # short product/price summary for context


_FALLBACK = ("Halo, aku Acil Tata! 😊 Mau pesan apa hari ini? "
             "Tinggal klik produk di bawah ya, nanti Acil bantu sampai selesai.")


def setup(api_router):
    @api_router.post("/buyer/chat")
    async def buyer_chat(req: BuyerChatReq):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return {"reply": _FALLBACK, "ai": False}

        system = ACIL_TATA_SYSTEM
        if req.products_hint:
            system += "\n\nDaftar produk toko saat ini (untuk konteks saja):\n" + req.products_hint[:1500]

        msgs = [
            {"role": ("assistant" if m.get("role") == "assistant" else "user"),
             "content": str(m.get("content", ""))[:1000]}
            for m in (req.messages or [])[-8:] if str(m.get("content", "")).strip()
        ]
        if not msgs:
            msgs = [{"role": "user", "content":
                     "(Pembeli baru membuka toko. Sapa dengan hangat, perkenalkan diri "
                     "sebagai Acil Tata, dan tawarkan bantuan memesan.)"}]

        body = {"model": MODEL, "max_tokens": 300, "system": system, "messages": msgs}
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.post(ANTHROPIC_API_URL, json=body, headers=headers)
            if r.status_code >= 400:
                return {"reply": _FALLBACK, "ai": False}
            data = r.json()
            parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
            reply = " ".join(p for p in parts if p).strip()
            return {"reply": reply or _FALLBACK, "ai": bool(reply)}
        except Exception:
            return {"reply": _FALLBACK, "ai": False}
