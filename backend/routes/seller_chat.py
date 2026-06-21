"""Asisten bisnis untuk seller — dipanggil "Juragan" (Claude Haiku).

Chat advisor terbuka: strategi penjualan, marketing, keuangan, copywriting,
ide judul/caption/nama produk, dll. Pengetahuan luas, tidak dibatasi toko ini.

Auth: butuh seller PIN (header X-Seller-PIN) lewat require_seller.
Butuh env ANTHROPIC_API_KEY (sama dengan ai_insights / buyer_chat).
"""
import os
import httpx
from typing import List, Dict, Any
from pydantic import BaseModel
from fastapi import Depends

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5-20251001"
HTTP_TIMEOUT = 45.0

JURAGAN_SYSTEM = (
    "Kamu adalah asisten bisnis pribadi yang cerdas untuk pemilik toko online. "
    "Panggil dia dengan sebutan 'Juragan'. Konteks: tokonya bernama Ciltarasa, jual "
    "frozen food premium & Bebek Pawon Ayu di Malang.\n\n"
    "Pengetahuanmu LUAS dan tidak dibatasi hanya toko ini: marketing, keuangan, "
    "operasional F&B, copywriting, strategi harga & promo, media sosial, branding, "
    "layanan pelanggan, dan topik bisnis apa pun. Boleh bahas hal di luar Ciltarasa "
    "kalau Juragan menanyakannya.\n\n"
    "Gaya bicara: ramah, praktis, langsung ke inti, bahasa Indonesia. Selalu sapa 'Juragan'.\n"
    "Aturan:\n"
    "- Kalau memberi strategi: kasih langkah konkret + jelaskan potensi keuntungan/dampaknya "
    "secara REALISTIS (jangan melebih-lebihkan, jangan menjanjikan angka pasti).\n"
    "- Kalau diminta ide judul/caption/nama produk/promo: kasih beberapa opsi.\n"
    "- Jawaban ringkas tapi padat dan bisa langsung dipakai. Boleh pakai poin-poin singkat.\n"
    "- Kamu bukan penasihat keuangan/hukum berlisensi; untuk keputusan besar, ingatkan "
    "Juragan mempertimbangkan kondisinya sendiri."
)

_DOWN = "Maaf Juragan, asistennya lagi ada kendala. Coba lagi sebentar ya 🙏"


class SellerChatReq(BaseModel):
    messages: List[Dict[str, Any]] = []


def setup(api_router, require_seller):
    @api_router.post("/seller/chat")
    async def seller_chat(req: SellerChatReq, _auth: bool = Depends(require_seller)):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return {"reply": "Halo Juragan! Fitur AI belum aktif — set ANTHROPIC_API_KEY "
                             "di Render → Environment dulu ya, lalu redeploy.", "ai": False}

        msgs = [
            {"role": ("assistant" if m.get("role") == "assistant" else "user"),
             "content": str(m.get("content", ""))[:4000]}
            for m in (req.messages or [])[-12:] if str(m.get("content", "")).strip()
        ]
        if not msgs:
            msgs = [{"role": "user", "content":
                     "(Juragan baru membuka asisten. Sapa hangat, perkenalkan diri sebagai "
                     "asisten bisnis pribadi, dan tanyakan ada yang bisa dibantu — misalnya "
                     "strategi jualan, ide promo, atau caption.)"}]

        body = {"model": MODEL, "max_tokens": 1200, "system": JURAGAN_SYSTEM, "messages": msgs}
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                r = await client.post(ANTHROPIC_API_URL, json=body, headers=headers)
            if r.status_code == 429:
                return {"reply": "Antrian AI lagi penuh, Juragan. Tunggu beberapa detik lalu coba lagi ya.", "ai": False}
            if r.status_code >= 400:
                return {"reply": _DOWN, "ai": False}
            data = r.json()
            parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
            reply = " ".join(p for p in parts if p).strip()
            return {"reply": reply or "Maaf Juragan, coba ketik ulang pertanyaannya ya.", "ai": bool(reply)}
        except Exception:
            return {"reply": _DOWN, "ai": False}
