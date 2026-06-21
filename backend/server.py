from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Header, Depends, UploadFile, File, Query
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import random
import secrets
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

# ─── Web Push (VAPID) ───
try:
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    import base64 as _b64
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Schema version — bump to force re-seed
SCHEMA_VERSION = "v2.4.1"

SELLER_PIN_DEFAULT = os.environ.get("SELLER_PIN", "ciltarasa")
APP_URL = os.environ.get("APP_URL", "")          # Legacy fallback
FRONTEND_URL = os.environ.get("FRONTEND_URL") or APP_URL or "https://ciltarasa.online"
BACKEND_URL  = os.environ.get("BACKEND_URL") or os.environ.get("RENDER_EXTERNAL_URL") or APP_URL or ""

# Fonnte WhatsApp token — dibaca dari Environment Variable (rahasia, JANGAN hardcode di repo).
# Set di Render → Environment → FONNTE_TOKEN = <token dari fonnte.com>
FONNTE_TOKEN_DEFAULT = os.environ.get("FONNTE_TOKEN", "")

async def get_active_pin() -> str:
    """Return current seller PIN — DB override if set, else env default."""
    doc = await db.auth_config.find_one({"_id": "main"})
    if doc and doc.get("seller_pin"):
        return doc["seller_pin"]
    return SELLER_PIN_DEFAULT

async def require_seller(x_seller_pin: Optional[str] = Header(None)):
    active = await get_active_pin()
    if x_seller_pin != active:
        raise HTTPException(401, "Akses ditolak. Seller PIN diperlukan.")
    return True

# ─── WebSocket Manager ───────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_text(json.dumps(message, default=str))
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

manager = ConnectionManager()

# ─── Helpers ─────────────────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def next_order_number():
    count = await db.orders.count_documents({})
    return f"ORD-{str(count + 1).zfill(4)}"

def normalize_phone(phone: str) -> str:
    """Normalize Indonesian phone to start with 62."""
    p = re.sub(r"\D", "", phone or "")
    if p.startswith("0"):
        p = "62" + p[1:]
    if p and not p.startswith("62"):
        p = "62" + p
    return p

def gdrive_to_direct(url: str) -> str:
    """Convert Google Drive share link to direct view link."""
    if not url:
        return url
    m = re.search(r"drive\.google\.com/file/d/([^/]+)/", url)
    if m:
        return f"https://drive.google.com/uc?export=view&id={m.group(1)}"
    m = re.search(r"[?&]id=([^&]+)", url)
    if m and "drive.google.com" in url:
        return f"https://drive.google.com/uc?export=view&id={m.group(1)}"
    return url

# ─── Fonnte WhatsApp Helper ──────────────────────────────────────────────────
FONNTE_URL = "https://api.fonnte.com/send"

async def get_fonnte_config():
    """Get Fonnte config with auto-heal from DEFAULT_STORE_CONFIG if missing/empty.

    Root-cause fixes for "seller not getting WA":
    1. If seller_notify_phone is missing/empty in DB → use default and PERSIST
    2. If fonnte_token is missing/empty → use default and PERSIST
    3. Always log warnings if config is invalid so it's visible in Render logs
    """
    sc = await db.store_config.find_one({"_id": "main"}, {"_id": 0})
    if not sc:
        logger.warning("[fonnte] store_config 'main' missing entirely — using defaults")
        return DEFAULT_STORE_CONFIG.get("fonnte_token"), DEFAULT_STORE_CONFIG.get("seller_notify_phone"), True

    token = (sc.get("fonnte_token") or "").strip()
    phone_raw = (sc.get("seller_notify_phone") or "").strip()
    phone = normalize_phone(phone_raw) if phone_raw else ""
    enabled = sc.get("wa_notif_enabled", True)

    # ─── AUTO-HEAL: persist defaults back if anything missing ───
    heal_updates = {}
    if not token:
        token = DEFAULT_STORE_CONFIG.get("fonnte_token", "")
        if token:
            heal_updates["fonnte_token"] = token
            logger.warning(f"[fonnte] token missing in DB, auto-healing with default")
    if not phone or len(phone) < 10:
        default_phone = DEFAULT_STORE_CONFIG.get("seller_notify_phone", "")
        phone = normalize_phone(default_phone) if default_phone else ""
        if phone:
            heal_updates["seller_notify_phone"] = phone
            logger.warning(f"[fonnte] seller_notify_phone invalid ({phone_raw!r}), auto-healing with default {phone}")
    if "wa_notif_enabled" not in sc:
        heal_updates["wa_notif_enabled"] = True
    if heal_updates:
        try:
            await db.store_config.update_one({"_id": "main"}, {"$set": heal_updates}, upsert=True)
            logger.info(f"[fonnte] auto-healed store_config: {list(heal_updates.keys())}")
        except Exception as e:
            logger.warning(f"[fonnte] auto-heal write failed: {e}")

    return token, phone, enabled

async def fonnte_send(target: str, message: str) -> Dict[str, Any]:
    """Send WhatsApp message via Fonnte API. Returns {ok, status, response, reason}.
    Adds detailed logging so Render logs show exactly why a send fails.
    """
    token, _, enabled = await get_fonnte_config()
    if not enabled:
        logger.info(f"[fonnte] skipped: WA notif disabled in store_config")
        return {"ok": False, "skipped": True, "reason": "WA notif disabled in config"}
    if not token:
        logger.warning(f"[fonnte] skipped: token still empty even after auto-heal")
        return {"ok": False, "skipped": True, "reason": "Fonnte token not set"}
    target_norm = normalize_phone(target)
    if not target_norm or len(target_norm) < 10:
        logger.warning(f"[fonnte] skipped: invalid target phone {target!r} → normalized {target_norm!r}")
        return {"ok": False, "skipped": True, "reason": f"Invalid target phone: {target!r}"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                FONNTE_URL,
                headers={"Authorization": token},
                data={"target": target_norm, "message": message, "countryCode": "62"},
            )
            try:
                data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            except Exception:
                data = {"raw": r.text[:500]}
            status_val = data.get("status", True)
            ok = r.status_code == 200 and status_val not in (False, "false", "False", 0, "0")
            if not ok:
                # Surface the actual Fonnte reason for debugging
                fonnte_reason = data.get("reason") or data.get("message") or f"HTTP {r.status_code}"
                logger.warning(f"[fonnte] send to {target_norm} returned not-ok: status={r.status_code}, reason={fonnte_reason}, full={str(data)[:300]}")
                return {"ok": False, "status": r.status_code, "response": data, "reason": str(fonnte_reason)}
            logger.info(f"[fonnte] sent to {target_norm}: id={data.get('id')}, quota={data.get('quota')}")
            return {"ok": True, "status": r.status_code, "response": data}
    except httpx.TimeoutException:
        logger.warning(f"[fonnte] TIMEOUT after 15s sending to {target_norm}")
        return {"ok": False, "error": "Timeout 15s — Fonnte API tidak respond", "reason": "Fonnte timeout"}
    except Exception as e:
        logger.warning(f"[fonnte] send failed to {target_norm}: {type(e).__name__}: {e}")
        return {"ok": False, "error": str(e), "reason": f"{type(e).__name__}: {str(e)[:100]}"}

def fmt_rp_id(n) -> str:
    return f"Rp {int(n):,}".replace(",", ".")

def build_seller_order_message(order: dict) -> str:
    items_lines = []
    for it in order.get("items", []):
        items_lines.append(f"• {it['product_name']} × {it['quantity']} = {fmt_rp_id(it['subtotal'])}")
    items_text = "\n".join(items_lines) if items_lines else "-"
    ts = datetime.now(timezone(timedelta(hours=7))).strftime("%d %b %Y, %H:%M WIB")
    delivery = order.get("delivery_method", "-")
    if order.get("delivery_option_id"):
        delivery = f"{delivery} ({order['delivery_option_id']})"
    return (
        f"🛒 PESANAN BARU - Ciltarasa\n\n"
        f"Order ID: #{order.get('order_number', order.get('id', ''))}\n"
        f"👤 Pelanggan: {order.get('customer_name', '-')}\n"
        f"📱 No. HP: +{order.get('customer_phone', '-')}\n"
        f"📍 Alamat: {order.get('customer_address', '-')}\n"
        f"🚚 Pengiriman: {delivery}\n\n"
        f"📦 Detail Pesanan:\n{items_text}\n\n"
        f"💰 Total: {fmt_rp_id(order.get('total', 0))}\n"
        f"📝 Catatan: {order.get('notes', '') or '-'}\n"
        f"⏰ Waktu: {ts}\n\n"
        f"Silakan konfirmasi di dashboard Ciltarasa ✅"
    )

STATUS_EMOJI = {"menunggu": "⏳", "diproses": "👨‍🍳", "siap": "📦", "selesai": "✅", "dibatalkan": "❌"}
STATUS_LABEL = {"menunggu": "Menunggu Konfirmasi", "diproses": "Diproses", "siap": "Siap Diambil/Dikirim", "selesai": "Selesai", "dibatalkan": "Dibatalkan"}
STATUS_DESC = {
    "diproses": "Pesanan kamu sedang kami siapkan dengan penuh cinta 🍱",
    "siap": "Pesanan siap! Segera dikirim/diambil ya 🚀",
    "selesai": "Pesanan sudah sampai! Jangan lupa kasih review ya ⭐",
    "dibatalkan": "Maaf, pesanan dibatalkan. Hubungi kami untuk info lebih lanjut 🙏",
}
STATUS_KEYS = ["menunggu", "diproses", "siap", "selesai", "dibatalkan"]

def render_chat_template(tpl: str, order: dict, store_name: str = "Ciltarasa", app_url: str = "", bank_accounts: list = None) -> str:
    """Render auto-chat template dengan placeholder dari order. Mendukung: {order_id}, {customer_name}, {customer_phone}, {customer_address}, {delivery}, {items_detail}, {total}, {subtotal}, {notes}, {status}, {status_desc}, {status_emoji}, {store_name}, {timestamp}, {app_url}, {track_link}, {payment_method}, {payment_account}."""
    if not tpl:
        return ""
    items_lines = []
    for it in order.get("items", []):
        items_lines.append(f"• {it.get('product_name', '-')} × {it.get('quantity', 0)} = {fmt_rp_id(it.get('subtotal', 0))}")
    items_text = "\n".join(items_lines) if items_lines else "-"
    delivery = order.get("delivery_method", "-")
    if order.get("delivery_option_id"):
        delivery = f"{delivery} ({order['delivery_option_id']})"
    ts = datetime.now(timezone(timedelta(hours=7))).strftime("%d %b %Y, %H:%M WIB")
    status = order.get("status", "menunggu")
    order_num = order.get("order_number", order.get("id", ""))

    # ─── Resolve payment method label + account info ───
    PAYMENT_LABELS = {
        "transfer": "Transfer Bank",
        "qris": "QRIS",
        "cod": "COD (Bayar di Tempat)",
        "cash": "Tunai",
    }
    pm_id = order.get("payment_method", "")
    pm_label = PAYMENT_LABELS.get(pm_id, pm_id.upper() if pm_id else "-")

    # Build payment_account: bank name + rekening number, or "-"
    pm_bank_id = order.get("payment_method_id") or order.get("payment_bank_id") or ""
    pm_account = "-"
    if pm_id == "transfer" and pm_bank_id and bank_accounts:
        for b in bank_accounts:
            if b.get("id") == pm_bank_id:
                # ✅ Field names: `bank` (BCA/Mandiri), `name` (holder), `number` (rekening)
                bank_name = b.get("bank") or b.get("bank_name") or "Bank"
                acc_num = b.get("number") or b.get("account_number") or ""
                acc_holder = b.get("name") or b.get("account_holder") or ""
                pm_account = f"{bank_name} {acc_num}" + (f" a.n. {acc_holder}" if acc_holder else "")
                break
    elif pm_id == "qris":
        pm_account = "QRIS (scan)"
    elif pm_id == "cod":
        pm_account = "Bayar tunai saat ambil/terima"

    repl = {
        "{order_id}": str(order_num),
        "{customer_name}": order.get("customer_name", "-"),
        "{customer_phone}": "+" + str(order.get("customer_phone", "-")),
        "{customer_address}": order.get("customer_address", "-") or "Ambil Sendiri",
        "{delivery}": delivery,
        "{items_detail}": items_text,
        "{total}": fmt_rp_id(order.get("total", 0)),
        "{subtotal}": fmt_rp_id(order.get("subtotal", 0)),
        "{notes}": order.get("notes", "") or "-",
        "{status}": STATUS_LABEL.get(status, status),
        "{status_desc}": STATUS_DESC.get(status, ""),
        "{status_emoji}": STATUS_EMOJI.get(status, "📦"),
        "{store_name}": store_name,
        "{timestamp}": ts,
        "{app_url}": app_url or "",
        "{track_link}": f"{app_url}/#/buyer/track?order={order_num}" if app_url else f"/buyer/track?order={order_num}",
        "{payment_method}": pm_label,
        "{payment_account}": pm_account,
    }
    out = tpl
    for k, v in repl.items():
        out = out.replace(k, str(v))
    return out

def build_buyer_status_message(order: dict, app_url: str = "") -> str:
    status = order.get("status", "menunggu")
    return (
        f"📦 Update Pesanan Ciltarasa\n\n"
        f"Halo {order.get('customer_name', 'Bunda')}! 👋\n"
        f"Order #{order.get('order_number', '')} kamu:\n\n"
        f"Status: {STATUS_EMOJI.get(status, '📦')} {STATUS_LABEL.get(status, status)}\n\n"
        f"{STATUS_DESC.get(status, '')}\n\n"
        f"_Lacak pesanan: {app_url}/#/buyer → Lacak Pesanan → {order.get('order_number','')}_\n\n"
        f"Terima kasih sudah belanja di Ciltarasa! 🧡"
    )

def build_otp_message(code: str) -> str:
    return (
        f"🔐 *Ciltarasa - Kode Verifikasi*\n\n"
        f"Kode OTP kamu adalah: *{code}*\n\n"
        f"Jangan kasih kode ini ke siapa pun ya, termasuk admin Ciltarasa.\n"
        f"Kode berlaku 5 menit.\n\n"
        f"Terima kasih sudah belanja di Ciltarasa! 🧡"
    )

# ─── Pydantic Models ─────────────────────────────────────────────────────────
class OTPRequest(BaseModel):
    phone: str
    name: Optional[str] = None

class OTPVerify(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class OrderItemModel(BaseModel):
    product_id: str
    product_name: str
    price: float
    quantity: int
    subtotal: float
    image_url: Optional[str] = ""

class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: float
    cost_price: float = 0
    category: str = "snack"
    categories: List[str] = []
    stock: int = 0
    unit: str = "pack"
    weight: float = 0
    active: bool = True
    image_url: str = ""
    media_urls: List[str] = []
    discount_id: Optional[str] = None
    sold_count: int = 0

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    category: Optional[str] = None
    categories: Optional[List[str]] = None
    stock: Optional[int] = None
    unit: Optional[str] = None
    weight: Optional[float] = None
    active: Optional[bool] = None
    image_url: Optional[str] = None
    media_urls: Optional[List[str]] = None
    discount_id: Optional[str] = None
    sold_count: Optional[int] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_address: str = ""
    delivery_method: str
    delivery_option_id: Optional[str] = None
    delivery_fee: float = 0
    items: List[OrderItemModel]
    subtotal: float
    total: float
    notes: str = ""
    payment_method: str
    payment_method_id: Optional[str] = None
    payment_bank_id: Optional[str] = None
    payment_type: Optional[str] = None  # 'now' | 'later'
    payment_proof_url: Optional[str] = None
    user_id: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str
    delivery_fee: Optional[float] = None  # FASE 7: ongkir input saat siap kirim (delivery only)

class OrderReceivedUpdate(BaseModel):
    received: bool

class SettingsUpdate(BaseModel):
    seller_whatsapp: Optional[str] = None
    store_name: Optional[str] = None
    auto_whatsapp: Optional[bool] = None
    message_template: Optional[str] = None

class FinancialEntryCreate(BaseModel):
    type: str
    description: str
    amount: float
    category: str
    date: str

class ReviewCreate(BaseModel):
    order_id: str
    product_id: str
    user_id: Optional[str] = None
    user_name: str
    rating: int = Field(ge=1, le=5)
    text: str = ""
    photos: List[str] = []

class StoreConfigUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    operating_hours: Optional[str] = None
    cerita: Optional[str] = None
    gmaps_review_url: Optional[str] = None
    bank_accounts: Optional[List[Dict[str, Any]]] = None
    categories: Optional[List[Dict[str, Any]]] = None
    delivery_options: Optional[List[Dict[str, Any]]] = None
    payment_methods: Optional[List[Dict[str, Any]]] = None
    social_links: Optional[Dict[str, str]] = None
    homepage_texts: Optional[Dict[str, str]] = None
    onboarding_texts: Optional[Dict[str, str]] = None
    hero_slides: Optional[List[Dict[str, Any]]] = None
    fun_facts: Optional[List[Dict[str, Any]]] = None
    fun_facts_meta: Optional[Dict[str, Any]] = None
    how_to_order_steps: Optional[List[Dict[str, Any]]] = None
    fonnte_token: Optional[str] = None
    seller_notify_phone: Optional[str] = None
    wa_notif_enabled: Optional[bool] = None
    low_stock_threshold: Optional[int] = None
    restock_safety_days: Optional[int] = None
    qris_image_url: Optional[str] = None
    payment_texts: Optional[Dict[str, str]] = None
    auto_chat_config: Optional[Dict[str, Any]] = None
    invoice_texts: Optional[Dict[str, str]] = None
    receipt_texts: Optional[Dict[str, str]] = None
    pwa_install: Optional[Dict[str, Any]] = None
    dashboard_config: Optional[Dict[str, Any]] = None
    maintenance_mode: Optional[Dict[str, Any]] = None
    seo: Optional[Dict[str, Any]] = None
    theme: Optional[Dict[str, Any]] = None

class PurchaseItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_cost: float
    subtotal: float

class PurchaseCreate(BaseModel):
    items: List[PurchaseItem]
    supplier: str = ""
    ordered_at: str  # ISO date
    notes: str = ""

class PurchaseUpdate(BaseModel):
    items: Optional[List[PurchaseItem]] = None
    supplier: Optional[str] = None
    ordered_at: Optional[str] = None
    received_at: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class DiscountCreate(BaseModel):
    name: str
    type: str  # "percent" or "fixed"
    value: float
    product_ids: List[str] = []
    active: bool = True
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_flash_sale: bool = False

class DiscountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    product_ids: Optional[List[str]] = None
    active: Optional[bool] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_flash_sale: Optional[bool] = None

# ─── Default Data ─────────────────────────────────────────────────────────────
DEFAULT_PRODUCTS = [
    {"name": "Risoles Frozen (isi 10)", "description": "Risoles renyah dengan isi ragout sayur dan telur, dibalut tepung roti sempurna. Cocok untuk camilan keluarga atau bekal anak sekolah.", "price": 35000, "cost_price": 18000, "category": "snack", "categories": ["snack", "kekinian"], "stock": 50, "unit": "pack", "weight": 0.4, "image_url": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&q=80", "media_urls": ["https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&q=80"], "sold_count": 142},
    {"name": "Lumpia Frozen (isi 10)", "description": "Lumpia isi rebung dan ayam, kulit crispy khas Semarang. Goreng sebentar langsung gurih.", "price": 30000, "cost_price": 15000, "category": "snack", "categories": ["snack"], "stock": 40, "unit": "pack", "weight": 0.35, "image_url": "https://images.unsplash.com/photo-1606503153255-59d8b8b27a45?w=600&q=80", "sold_count": 98},
    {"name": "Pastel Frozen (isi 10)", "description": "Pastel goreng isi wortel, kentang, dan telur puyuh. Renyah di luar, padat di dalam.", "price": 28000, "cost_price": 14000, "category": "snack", "categories": ["snack"], "stock": 35, "unit": "pack", "weight": 0.35, "image_url": "https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=600&q=80", "sold_count": 76},
    {"name": "Cireng Frozen (isi 15)", "description": "Cireng aci goreng bumbu rujak pedas manis, camilan khas Bandung yang viral!", "price": 20000, "cost_price": 9000, "category": "snack", "categories": ["snack", "viral"], "stock": 60, "unit": "pack", "weight": 0.5, "image_url": "https://images.unsplash.com/photo-1626202373052-9d6d5b9bca5b?w=600&q=80", "sold_count": 215},
    {"name": "Tahu Isi Frozen (isi 10)", "description": "Tahu goreng berisi sayur segar, mudah digoreng langsung dari freezer.", "price": 25000, "cost_price": 12000, "category": "snack", "categories": ["snack"], "stock": 45, "unit": "pack", "weight": 0.4, "image_url": "https://images.unsplash.com/photo-1572448862527-d3c904757de6?w=600&q=80", "sold_count": 64},
    {"name": "Nugget Ayam Homemade (250gr)", "description": "Nugget ayam kampung homemade tanpa pengawet, crispy di luar lembut di dalam. Anak-anak suka!", "price": 40000, "cost_price": 22000, "category": "snack", "categories": ["snack", "anak"], "stock": 30, "unit": "pack", "weight": 0.25, "image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80", "sold_count": 187},
    {"name": "Siomay Frozen (isi 10)", "description": "Siomay ikan tenggiri asli Bandung, nikmati dengan bumbu kacang.", "price": 32000, "cost_price": 17000, "category": "snack", "categories": ["snack"], "stock": 25, "unit": "pack", "weight": 0.4, "image_url": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&q=80", "sold_count": 53},
    {"name": "Bakwan Frozen (isi 10)", "description": "Bakwan jagung manis dan sayur, goreng langsung dari freezer.", "price": 22000, "cost_price": 10000, "category": "snack", "categories": ["snack"], "stock": 55, "unit": "pack", "weight": 0.4, "image_url": "https://images.unsplash.com/photo-1601001435957-74f0958a93c5?w=600&q=80", "sold_count": 41},
    {"name": "Bebek Utuh Pawon Ayu", "description": "Bebek utuh asap Pawon Ayu, bumbu rempah khas Malang, tinggal goreng atau panggang. Premium signature kami.", "price": 85000, "cost_price": 50000, "category": "bebek", "categories": ["bebek", "premium"], "stock": 20, "unit": "ekor", "weight": 1.2, "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80", "sold_count": 89},
    {"name": "Setengah Bebek Pawon Ayu", "description": "Setengah ekor bebek asap Pawon Ayu, porsi pas untuk 2 orang.", "price": 45000, "cost_price": 28000, "category": "bebek", "categories": ["bebek"], "stock": 25, "unit": "ekor", "weight": 0.6, "image_url": "https://images.unsplash.com/photo-1432139509613-5c4255815697?w=600&q=80", "sold_count": 67},
    {"name": "Bebek Potongan Paha (2pcs)", "description": "Paha bebek asap Pawon Ayu 2 potong, bumbu meresap sempurna.", "price": 35000, "cost_price": 20000, "category": "bebek", "categories": ["bebek"], "stock": 30, "unit": "pack", "weight": 0.35, "image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80", "sold_count": 45},
    {"name": "Paket Bebek Keluarga (2 ekor)", "description": "2 ekor bebek asap Pawon Ayu, cocok untuk keluarga atau acara spesial. Hemat dan istimewa.", "price": 160000, "cost_price": 95000, "category": "bebek", "categories": ["bebek", "premium", "paket"], "stock": 10, "unit": "paket", "weight": 2.4, "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80", "sold_count": 32},
]

DEFAULT_SETTINGS = {
    "seller_whatsapp": "6285190884129",
    "store_name": "Ciltarasa",
    "auto_whatsapp": True,
    "message_template": "PESANAN BARU - Ciltarasa\n\nOrder ID: #{order_id}\nPelanggan: {customer_name}\nNo. HP: {customer_phone}\nAlamat: {customer_address}\n\nDetail Pesanan:\n{items_detail}\n\nTotal: Rp {total}\nCatatan: {notes}\n\nSilakan konfirmasi pesanan ini di dashboard Ciltarasa."
}

DEFAULT_STORE_CONFIG = {
    "_id": "main",
    "name": "Ciltarasa",
    "logo_url": "",
    "tagline": "Frozen Food Premium • Malang",
    "whatsapp": "6285190884129",
    "address": "Jl. Kawi No. 15, Malang, Jawa Timur",
    "operating_hours": "Setiap Hari • 08.00 - 21.00 WIB",
    "cerita": "Ciltarasa lahir dari dapur kecil di Malang tahun 2020. Bermula dari pesanan tetangga yang suka risoles homemade buatan Bunda, kini kami sudah melayani ribuan keluarga di seluruh Malang Raya.\n\nKami percaya makanan beku berkualitas itu bukan instant—tiap produk dibuat fresh tiap hari, dibekukan dengan blast freezer, dan dikirim langsung ke rumah Anda. Tanpa pengawet, tanpa MSG berlebih, hanya rasa autentik yang bikin keluarga ketagihan.\n\nSpesialisasi kami: aneka frozen snack (risoles, lumpia, pastel, cireng) dan Bebek Asap Pawon Ayu—signature dish dengan bumbu rempah Jawa yang sudah turun-temurun.",
    "gmaps_review_url": "https://maps.app.goo.gl/W8noqRWBkVsMESbHA",
    "bank_accounts": [
        {"id": str(uuid.uuid4()), "bank": "BCA", "name": "Ciltarasa Malang", "number": "1234567890"},
        {"id": str(uuid.uuid4()), "bank": "Mandiri", "name": "Ciltarasa Malang", "number": "9876543210"},
    ],
    "categories": [
        {"id": "snack", "name": "Frozen Snack", "icon": "🥟"},
        {"id": "bebek", "name": "Bebek Pawon Ayu", "icon": "🦆"},
        {"id": "viral", "name": "Lagi Viral", "icon": "🔥"},
        {"id": "anak", "name": "Favorit Anak", "icon": "👶"},
        {"id": "premium", "name": "Premium", "icon": "⭐"},
        {"id": "paket", "name": "Paket Hemat", "icon": "📦"},
    ],
    "delivery_options": [
        {"id": "pickup", "name": "Ambil Sendiri", "description": "Ambil langsung di toko, gratis ongkir", "fee": 0, "active": True},
        {"id": "kurir_toko", "name": "Kurir Toko (Malang Kota)", "description": "Diantar kurir toko, area Malang kota", "fee": 10000, "active": True},
        {"id": "gosend", "name": "GoSend / GrabExpress", "description": "Ongkir sesuai aplikasi, bayar kurir", "fee": 0, "active": True},
        {"id": "jne_jnt", "name": "JNE / J&T (luar kota)", "description": "Untuk luar Malang, estimasi 1-3 hari", "fee": 25000, "active": True},
    ],
    "payment_methods": [
        {"id": "transfer", "name": "Transfer Bank", "type": "transfer", "details": "BCA / Mandiri", "active": True},
        {"id": "qris", "name": "QRIS", "type": "qris", "details": "Scan QRIS, semua e-wallet", "active": True},
        {"id": "cod", "name": "COD (Bayar di Tempat)", "type": "cod", "details": "Hanya area Malang kota", "active": True},
    ],
    "social_links": {
        "instagram": "https://instagram.com/ciltarasa",
        "tiktok": "https://tiktok.com/@ciltarasa",
        "shopee": "",
    },
    "homepage_texts": {
        "viral_pill": "Lagi Viral di Malang 🔥",
        "hero_title_1": "Cemilan Frozen",
        "hero_title_2": "Yang Bikin Nagih",
        "hero_subtitle": "Frozen snack premium & Bebek Pawon Ayu khas Malang. Tinggal goreng, anak-anak langsung suka! ✨",
        "hero_cta_primary": "Belanja Sekarang",
        "hero_cta_secondary": "Lacak Pesananku",
        "social_proof_text": "1.200+ keluarga di Malang sudah berlangganan",
        "how_to_order_title": "Cara Pesan",
        "how_to_order_subtitle": "Mudah, cepat, dan praktis",
        "catalog_section_title": "Lagi Viral Bulan Ini 🔥",
        "catalog_section_subtitle": "Pilihan frozen food premium untuk keluarga",
        "tab_menu_label": "🍽️ Menu Kami",
        "tab_about_label": "✨ Tentang Kami",
    },
    "hero_slides": [
        {"id": "slide-1", "image_url": "https://static.prod-images.emergentagent.com/jobs/fa7f3ba8-8537-4e4d-b681-0c7370599acf/images/3fd09d3c0fc14b6148e6065a022d94002c52a9aafb799d7dda170d7445053fd9.png", "duration_ms": 5000, "active": True},
        {"id": "slide-2", "image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=1600&q=80", "duration_ms": 5000, "active": True},
        {"id": "slide-3", "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80", "duration_ms": 5000, "active": True},
    ],
    "fun_facts": [
        {"id": "ff-1", "image_url": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=600&q=80", "title": "Risoles Bunda Itu Resep Turunan", "text": "Resep risoles kami sudah turun-temurun sejak 1985. Isiannya pakai ragout ayam asli, bukan tepung doang. Itulah kenapa anak-anak suka banget!"},
        {"id": "ff-2", "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80", "title": "Bebek Pawon Ayu Direndam 6 Jam", "text": "Bumbu rempah kami direndam ke bebek selama 6 jam sebelum diasap pakai kayu kelapa. Rasanya beneran beda dari bebek instan."},
        {"id": "ff-3", "image_url": "https://images.unsplash.com/photo-1626202373052-9d6d5b9bca5b?w=600&q=80", "title": "Tanpa Pengawet, Beneran!", "text": "Semua frozen food kami dibekukan dengan blast freezer dalam 30 menit. Jadi awet tanpa perlu bahan pengawet kimia. Aman buat keluarga."},
        {"id": "ff-4", "image_url": "https://images.unsplash.com/photo-1606503153255-59d8b8b27a45?w=600&q=80", "title": "Cireng Viral Karena TikTok", "text": "Cireng bumbu rujak kami sempat viral di TikTok awal 2025. Sekarang ribuan ibu-ibu Malang pesan tiap minggu buat camilan anak."},
        {"id": "ff-5", "image_url": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80", "title": "Nugget Tanpa MSG", "text": "Nugget ayam homemade kami pakai daging ayam kampung asli, tanpa MSG, tanpa pewarna. Anak-anak SD suka dipakai bekal sekolah."},
    ],
    "how_to_order_steps": [
        {"id": "s1", "icon": "🛒", "title": "Pilih Produk", "desc": "Pilih frozen snack atau bebek favoritmu dari katalog kami."},
        {"id": "s2", "icon": "📝", "title": "Isi Data Pesanan", "desc": "Lengkapi nama, nomor HP, dan alamat pengiriman."},
        {"id": "s3", "icon": "🎉", "title": "Pesanan Dikirim", "desc": "Kami proses dan kirim langsung ke pintumu!"},
    ],
    "onboarding_texts": {
        "header_title": "Halo, Bunda! 🦆",
        "header_subtitle": "Frozen Food premium yang lagi viral di Malang",
        "welcome_title": "Yuk, mulai belanja!",
        "welcome_subtitle": "Daftar dulu untuk akses promo eksklusif & tracking pesanan yang gampang banget ✨",
        "register_label": "Daftar Sekarang",
        "register_subtitle": "Dapatkan poin & promo special",
        "login_label": "Masuk",
        "login_subtitle": "Sudah punya akun? Masuk yuk",
        "guest_label": "Lanjut sebagai Tamu",
        "guest_subtitle": "Belanja tanpa daftar (no promo)",
        "tos_text": "Dengan melanjutkan, kamu setuju dengan syarat & ketentuan Ciltarasa",
        "otp_hint": "📱 Cek WhatsApp kamu untuk lihat kode OTP yang dikirim",
        "phone_hint": "💡 Pastikan nomor WhatsApp aktif untuk terima kode OTP",
    },
    "fonnte_token": FONNTE_TOKEN_DEFAULT,
    "seller_notify_phone": "6285190884129",
    "wa_notif_enabled": True,
    "low_stock_threshold": 10,
    "pwa_install": {
        "buyer_enabled": True,
        "buyer_delay_seconds": 30,
        "buyer_linger_seconds": 5,
        "seller_enabled": True,
        "seller_delay_seconds": 10,
    },
    "restock_safety_days": 2,
    "qris_image_url": "",
    "payment_texts": {
        "bank_transfer_title": "Transfer Bank",
        "bank_transfer_instructions": "Silakan transfer ke salah satu rekening berikut, lalu pilih cara bayar:",
        "pay_now_label": "Bayar Sekarang",
        "pay_now_desc": "Transfer sekarang & upload bukti bayar",
        "pay_later_label": "Bayar Nanti (COD)",
        "pay_later_desc": "Bayar saat pesanan sampai/diambil",
        "upload_proof_label": "Upload Bukti Transfer",
        "upload_proof_hint": "Format JPG/PNG, max 5MB. Pastikan foto jelas terbaca.",
        "qris_title": "Scan QRIS",
        "qris_instructions": "Scan QR di bawah pakai e-wallet kamu (GoPay/OVO/Dana/ShopeePay). Klik 'Telah Bayar' setelah transfer berhasil.",
        "qris_paid_label": "Telah Bayar",
        "qris_cancel_label": "Batalkan",
        "qris_upload_label": "Upload Bukti Pembayaran QRIS",
        "no_qris_image_warning": "Seller belum upload QR. Hubungi seller via WhatsApp untuk minta QR.",
    },
    "auto_chat_config": {
        # Stage 'menunggu' = saat order baru dibuat (POST /api/orders)
        "menunggu": {
            "seller_enabled": True,
            "seller_template": "🛒 *PESANAN BARU - {store_name}*\n\nOrder ID: #{order_id}\n👤 Pelanggan: {customer_name}\n📱 No. HP: {customer_phone}\n📍 Alamat: {customer_address}\n🚚 Pengiriman: {delivery}\n\n📦 Detail:\n{items_detail}\n\n💰 Total: {total}\n📝 Catatan: {notes}\n⏰ {timestamp}\n\nSilakan konfirmasi di dashboard ✅",
            "buyer_enabled": False,
            "buyer_template": "Halo {customer_name}! 👋\n\nTerima kasih sudah pesan di {store_name}!\nOrder #{order_id} kamu sedang menunggu konfirmasi dari seller.\n\n💰 Total: {total}\n\nKami akan kabari segera. 🧡",
        },
        "diproses": {
            "seller_enabled": False,
            "seller_template": "📬 Order #{order_id} ({customer_name}) - status: Diproses",
            "buyer_enabled": True,
            "buyer_template": "📦 *Update Pesanan {store_name}*\n\nHalo {customer_name}! 👋\nOrder #{order_id} kamu:\n\nStatus: {status_emoji} {status}\n\n{status_desc}\n\n_Lacak: {track_link}_\n\nTerima kasih! 🧡",
        },
        "siap": {
            "seller_enabled": False,
            "seller_template": "📦 Order #{order_id} - status: Siap",
            "buyer_enabled": True,
            "buyer_template": "📦 *Update Pesanan {store_name}*\n\nHalo {customer_name}! 👋\nOrder #{order_id} kamu:\n\nStatus: {status_emoji} {status}\n\n{status_desc}\n\n_Lacak: {track_link}_\n\nTerima kasih! 🧡",
        },
        "selesai": {
            "seller_enabled": False,
            "seller_template": "🎉 Order #{order_id} ({customer_name}) - SELESAI. Total: {total}",
            "buyer_enabled": True,
            "buyer_template": "🎉 *Pesanan Selesai - {store_name}*\n\nHalo {customer_name}!\nOrder #{order_id} kamu sudah selesai 🎊\n\n{status_desc}\n\n_Lacak/Review: {track_link}_\n\nTerima kasih sudah belanja! 🧡",
        },
        "dibatalkan": {
            "seller_enabled": False,
            "seller_template": "❌ Order #{order_id} dibatalkan",
            "buyer_enabled": True,
            "buyer_template": "❌ *Pesanan Dibatalkan*\n\nHalo {customer_name},\nMaaf, order #{order_id} kamu dibatalkan.\n\n{status_desc}\n\nHubungi kami via WhatsApp untuk info lebih lanjut. 🙏",
        },
    },
    "invoice_texts": {
        "title": "INVOICE / STRUK PEMBELIAN",
        "subtitle": "Terima kasih telah berbelanja di Ciltarasa",
        "buyer_section_label": "DITAGIH KEPADA",
        "items_section_label": "RINCIAN PESANAN",
        "subtotal_label": "Subtotal",
        "delivery_fee_label": "Ongkir",
        "total_label": "TOTAL",
        "notes_label": "Catatan",
        "footer_thanks": "Terima kasih telah mempercayai kami 🧡",
        "footer_contact": "Hubungi kami via WhatsApp jika ada keluhan",
        "footer_disclaimer": "Struk ini adalah bukti pembayaran sah. Simpan untuk klaim garansi.",
        "order_number_label": "No. Pesanan",
        "order_date_label": "Tanggal",
        "payment_method_label": "Metode Bayar",
        "delivery_method_label": "Pengiriman",
    },
    "dashboard_config": {
        "default_period": "30d",  # 7d | 30d | 90d
        "general": {
            "show_revenue_kpi": True,
            "show_orders_kpi": True,
            "show_aov_kpi": True,
            "show_customers_kpi": True,
            "show_ai_insights": True,
            "show_revenue_chart": True,
            "show_top_products": True,
            "show_recent_orders": True,
            "show_status_breakdown": True,
        },
        "inventory": {
            "show_total_products_kpi": True,
            "show_low_stock_kpi": True,
            "show_out_of_stock_kpi": True,
            "show_stock_value_kpi": True,
            "show_low_stock_table": True,
            "show_top_movers": True,
            "show_slow_movers": True,
            "show_category_breakdown": True,
        },
        "sales": {
            "show_revenue_trend": True,
            "show_payment_pie": True,
            "show_category_bar": True,
            "show_best_sellers_table": True,
            "show_status_funnel": True,
            "show_hour_heatmap": True,
        },
        "customer": {
            "show_total_customers_kpi": True,
            "show_new_customers_kpi": True,
            "show_returning_kpi": True,
            "show_avg_orders_kpi": True,
            "show_top_customers": True,
            "show_acquisition_chart": True,
        },
    },
    "maintenance_mode": {
        "enabled": False,
        "title": "Maaf, Ciltarasa libur dulu ya 🧡",
        "message": "Kami sedang libur sebentar untuk recharge & siapkan menu fresh untuk kamu. Kami akan kembali pada {return_date} pukul {return_time}. Terima kasih atas pengertiannya!",
        "return_date": "",
        "return_time": "08:00",
        "background_image_url": "",
        "show_contact_wa": True,
        "return_button_text": "Hubungi Seller via WhatsApp",
    },
}

DEFAULT_DISCOUNTS = [
    {"id": str(uuid.uuid4()), "name": "Promo Bulan Ini", "type": "percent", "value": 10, "product_ids": [], "active": True, "starts_at": None, "ends_at": None, "is_flash_sale": False, "created_at": now_iso()},
]


async def seed_database():
    """Seed DB and reset if SCHEMA_VERSION changed."""
    meta = await db.system_meta.find_one({"_id": "schema"})
    if not meta or meta.get("version") != SCHEMA_VERSION:
        logger.info(f"Schema version mismatch ({meta.get('version') if meta else 'none'} → {SCHEMA_VERSION}). Resetting DB.")
        for c in ["products", "orders", "settings", "financial_entries", "store_config", "discounts", "reviews", "users", "purchases"]:
            await db[c].drop()
        await db.system_meta.update_one({"_id": "schema"}, {"$set": {"version": SCHEMA_VERSION, "updated_at": now_iso()}}, upsert=True)

    # Products
    if await db.products.count_documents({}) == 0:
        ts = now_iso()
        for p in DEFAULT_PRODUCTS:
            doc = {"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts,
                   "media_urls": p.get("media_urls", [p["image_url"]]),
                   "discount_id": None, "active": True, **p}
            await db.products.insert_one(doc)
        logger.info(f"Seeded {len(DEFAULT_PRODUCTS)} products")

    # Settings
    if await db.settings.count_documents({}) == 0:
        await db.settings.insert_one({"_id": "main", **DEFAULT_SETTINGS})

    # StoreConfig
    if await db.store_config.count_documents({}) == 0:
        await db.store_config.insert_one(DEFAULT_STORE_CONFIG)
        logger.info("Seeded store config")
    else:
        # Backfill new fields (FASE 2 - payment_texts & qris_image_url) without wiping existing config
        existing = await db.store_config.find_one({"_id": "main"}) or {}
        backfill = {}
        if "qris_image_url" not in existing:
            backfill["qris_image_url"] = DEFAULT_STORE_CONFIG.get("qris_image_url", "")
        if "payment_texts" not in existing or not existing.get("payment_texts"):
            backfill["payment_texts"] = DEFAULT_STORE_CONFIG.get("payment_texts", {})
        else:
            # Merge missing keys in payment_texts
            for k, v in DEFAULT_STORE_CONFIG.get("payment_texts", {}).items():
                if k not in existing["payment_texts"]:
                    backfill[f"payment_texts.{k}"] = v
        # FASE 3 backfill
        if "auto_chat_config" not in existing or not existing.get("auto_chat_config"):
            backfill["auto_chat_config"] = DEFAULT_STORE_CONFIG.get("auto_chat_config", {})
        else:
            for sk, sv in DEFAULT_STORE_CONFIG.get("auto_chat_config", {}).items():
                if sk not in existing["auto_chat_config"]:
                    backfill[f"auto_chat_config.{sk}"] = sv
        if "invoice_texts" not in existing or not existing.get("invoice_texts"):
            backfill["invoice_texts"] = DEFAULT_STORE_CONFIG.get("invoice_texts", {})
        else:
            for k, v in DEFAULT_STORE_CONFIG.get("invoice_texts", {}).items():
                if k not in existing["invoice_texts"]:
                    backfill[f"invoice_texts.{k}"] = v
        # FASE 4 backfill
        if "dashboard_config" not in existing or not existing.get("dashboard_config"):
            backfill["dashboard_config"] = DEFAULT_STORE_CONFIG.get("dashboard_config", {})
        else:
            for sk, sv in DEFAULT_STORE_CONFIG.get("dashboard_config", {}).items():
                if sk not in existing["dashboard_config"]:
                    backfill[f"dashboard_config.{sk}"] = sv
        # FASE 6 backfill: maintenance_mode
        if "maintenance_mode" not in existing or not existing.get("maintenance_mode"):
            backfill["maintenance_mode"] = DEFAULT_STORE_CONFIG.get("maintenance_mode", {})
        else:
            for k, v in DEFAULT_STORE_CONFIG.get("maintenance_mode", {}).items():
                if k not in existing["maintenance_mode"]:
                    backfill[f"maintenance_mode.{k}"] = v
        if backfill:
            await db.store_config.update_one({"_id": "main"}, {"$set": backfill})
            logger.info(f"Backfilled store_config: {list(backfill.keys())}")


        # ─── MIGRATION: Fix seller_notify_phone, fonnte_token, and wa_notif_enabled ───
        # Multiple scenarios handled:
        # 1. Wrong hardcoded phone from old code (WRONG_PHONE)
        # 2. Empty/None/missing seller_notify_phone — auto-set from default
        # 3. Empty/None/missing fonnte_token — auto-set from default
        # 4. wa_notif_enabled missing — set to True
        WRONG_PHONE = "6285249682337"
        CORRECT_PHONE = DEFAULT_STORE_CONFIG.get("seller_notify_phone", "6285190884129")
        DEFAULT_TOKEN = DEFAULT_STORE_CONFIG.get("fonnte_token", "")
        phone_fix = {}

        # Fix wrong WhatsApp number in display config
        if existing.get("whatsapp") == WRONG_PHONE:
            phone_fix["whatsapp"] = CORRECT_PHONE

        # Fix seller_notify_phone — handle wrong, empty, None, or missing
        current_seller_phone = (existing.get("seller_notify_phone") or "").strip()
        if current_seller_phone == WRONG_PHONE or not current_seller_phone or len(current_seller_phone) < 10:
            phone_fix["seller_notify_phone"] = CORRECT_PHONE
            logger.info(f"Migration: seller_notify_phone {current_seller_phone!r} → {CORRECT_PHONE}")

        # Fix fonnte_token — handle empty/missing (token revocation needs manual update via UI)
        current_token = (existing.get("fonnte_token") or "").strip()
        if not current_token and DEFAULT_TOKEN:
            phone_fix["fonnte_token"] = DEFAULT_TOKEN
            logger.info(f"Migration: fonnte_token was empty, restored from default")

        # Ensure wa_notif_enabled exists
        if "wa_notif_enabled" not in existing:
            phone_fix["wa_notif_enabled"] = True
            logger.info("Migration: wa_notif_enabled missing → set True")

        # Ensure auto_chat_config.menunggu.seller_enabled is True (most common cause of silent failure)
        ac = existing.get("auto_chat_config") or {}
        menunggu_cfg = ac.get("menunggu") or {}
        if menunggu_cfg and menunggu_cfg.get("seller_enabled") is False:
            phone_fix["auto_chat_config.menunggu.seller_enabled"] = True
            logger.info("Migration: auto_chat_config.menunggu.seller_enabled was False → forced True")

        if phone_fix:
            await db.store_config.update_one({"_id": "main"}, {"$set": phone_fix})
            logger.info(f"Migrated store_config: {list(phone_fix.keys())}")

        existing_settings = await db.settings.find_one({"_id": "main"}) or {}
        if existing_settings.get("seller_whatsapp") == WRONG_PHONE or not existing_settings.get("seller_whatsapp"):
            await db.settings.update_one(
                {"_id": "main"},
                {"$set": {"seller_whatsapp": CORRECT_PHONE}},
                upsert=True,
            )
            logger.info("Migrated seller_whatsapp in settings collection")

    # ─── FASE 5: VAPID keys (Web Push) ───
    if WEBPUSH_AVAILABLE:
        existing_vapid = await db.auth_config.find_one({"_id": "vapid"})
        if not existing_vapid:
            # Generate VAPID key pair
            vapid = Vapid()
            vapid.generate_keys()
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as tf:
                priv_path = tf.name
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pem', delete=False) as tf:
                pub_path = tf.name
            try:
                vapid.save_key(priv_path)
                vapid.save_public_key(pub_path)
                with open(priv_path, 'r') as f:
                    priv_pem = f.read()
                with open(pub_path, 'r') as f:
                    pub_pem = f.read()
                # Public key in base64url for browser (uncompressed EC point)
                pub_b64 = _b64.urlsafe_b64encode(
                    vapid.public_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.UncompressedPoint)
                ).decode('ascii').rstrip('=')
                await db.auth_config.insert_one({
                    "_id": "vapid",
                    "private_pem": priv_pem,
                    "public_pem": pub_pem,
                    "public_b64": pub_b64,
                    "subject": os.environ.get("VAPID_SUBJECT", "mailto:admin@ciltarasa.online"),
                    "created_at": now_iso(),
                })
                logger.info("Generated VAPID keys (Web Push enabled)")
            finally:
                try:
                    os.unlink(priv_path)
                except OSError:
                    pass
                try:
                    os.unlink(pub_path)
                except OSError:
                    pass

        # ─── MIGRATION: fix invalid VAPID subject ('.local' is rejected by Apple/iOS Web Push) ───
        good_subject = os.environ.get("VAPID_SUBJECT") or "mailto:admin@ciltarasa.online"
        cur_vapid = await db.auth_config.find_one({"_id": "vapid"}, {"subject": 1})
        cur_subject = (cur_vapid or {}).get("subject", "")
        if (not cur_subject) or (".local" in cur_subject):
            await db.auth_config.update_one({"_id": "vapid"}, {"$set": {"subject": good_subject}})
            logger.info(f"Migrated VAPID subject {cur_subject!r} -> {good_subject}")

    # Discounts
    if await db.discounts.count_documents({}) == 0:
        for d in DEFAULT_DISCOUNTS:
            await db.discounts.insert_one(d)
        # Seed an active 24-hour Flash Sale for viral products
        now_dt = datetime.now(timezone.utc)
        flash_id = str(uuid.uuid4())
        await db.discounts.insert_one({
            "id": flash_id,
            "name": "⚡ Flash Sale Hari Ini",
            "type": "percent",
            "value": 25,
            "product_ids": [],
            "active": True,
            "is_flash_sale": True,
            "starts_at": now_dt.isoformat(),
            "ends_at": (now_dt + timedelta(hours=24)).isoformat(),
            "created_at": now_iso(),
        })
        # Apply to top 4 viral products (by sold_count)
        all_p = await db.products.find({}, {"_id": 0}).sort("sold_count", -1).to_list(4)
        for p in all_p:
            await db.products.update_one({"id": p["id"]}, {"$set": {"discount_id": flash_id}})
        logger.info(f"Seeded Flash Sale applied to {len(all_p)} products")

    # Orders (demo)
    if await db.orders.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(100)
        pmap = {p["name"]: p for p in products}
        now = datetime.now(timezone.utc)

        sample_orders = [
            {
                "customer_name": "Siti Rahayu", "customer_phone": "6281234567890",
                "customer_address": "Jl. Kawi No. 15, Malang", "delivery_method": "delivery",
                "delivery_option_id": "kurir_toko", "delivery_fee": 10000,
                "items": [("Risoles Frozen (isi 10)", 2), ("Lumpia Frozen (isi 10)", 1)],
                "notes": "Tolong packing rapi ya",
                "payment_method": "transfer", "status": "menunggu", "days_ago": 0
            },
            {
                "customer_name": "Budi Santoso", "customer_phone": "6282345678901",
                "customer_address": "Jl. Ijen No. 8, Malang", "delivery_method": "delivery",
                "delivery_option_id": "kurir_toko", "delivery_fee": 10000,
                "items": [("Bebek Utuh Pawon Ayu", 1), ("Cireng Frozen (isi 15)", 2)],
                "notes": "",
                "payment_method": "cod", "status": "diproses", "days_ago": 1
            },
            {
                "customer_name": "Dewi Lestari", "customer_phone": "6283456789012",
                "customer_address": "Jl. Sulfat No. 22, Malang", "delivery_method": "pickup",
                "delivery_option_id": "pickup", "delivery_fee": 0,
                "items": [("Paket Bebek Keluarga (2 ekor)", 1)],
                "notes": "Ambil jam 4 sore",
                "payment_method": "qris", "status": "siap", "days_ago": 2
            },
            {
                "customer_name": "Ahmad Fauzi", "customer_phone": "6284567890123",
                "customer_address": "Jl. Simpang Balapan No. 5, Malang", "delivery_method": "delivery",
                "delivery_option_id": "kurir_toko", "delivery_fee": 10000,
                "items": [("Nugget Ayam Homemade (250gr)", 3), ("Tahu Isi Frozen (isi 10)", 2)],
                "notes": "",
                "payment_method": "transfer", "status": "selesai", "days_ago": 3,
                "received": True,
            },
            {
                "customer_name": "Rina Wati", "customer_phone": "6285678901234",
                "customer_address": "Jl. Arjuno No. 11, Malang", "delivery_method": "delivery",
                "delivery_option_id": "kurir_toko", "delivery_fee": 10000,
                "items": [("Siomay Frozen (isi 10)", 1)],
                "notes": "Stok masih ada?",
                "payment_method": "cod", "status": "dibatalkan", "days_ago": 4
            },
        ]

        for i, o in enumerate(sample_orders):
            order_dt = now - timedelta(days=o["days_ago"])
            order_ts = order_dt.isoformat()
            items = []
            subtotal = 0
            for name, qty in o["items"]:
                p = pmap.get(name)
                if not p:
                    continue
                sub = p["price"] * qty
                subtotal += sub
                items.append({
                    "product_id": p["id"], "product_name": name,
                    "price": p["price"], "quantity": qty, "subtotal": sub,
                    "image_url": p.get("image_url", "")
                })

            total = subtotal + o["delivery_fee"]
            s = o["status"]
            status_ts = {}
            prog = ["menunggu", "diproses", "siap", "selesai"]
            if s in prog:
                for st in prog:
                    status_ts[st] = order_ts
                    if st == s:
                        break
            elif s == "dibatalkan":
                status_ts = {"menunggu": order_ts, "dibatalkan": order_ts}

            await db.orders.insert_one({
                "id": str(uuid.uuid4()), "order_number": f"ORD-{str(i+1).zfill(4)}",
                "customer_name": o["customer_name"], "customer_phone": o["customer_phone"],
                "customer_address": o["customer_address"], "delivery_method": o["delivery_method"],
                "delivery_option_id": o.get("delivery_option_id"), "delivery_fee": o["delivery_fee"],
                "items": items, "subtotal": subtotal, "total": total,
                "notes": o["notes"], "payment_method": o["payment_method"],
                "payment_method_id": o["payment_method"],
                "status": s, "status_timestamps": status_ts,
                "received": o.get("received", False),
                "user_id": None,
                "created_at": order_ts, "updated_at": order_ts
            })
        logger.info("Seeded sample orders")

# ─── Auth Endpoints (Simulated OTP) ──────────────────────────────────────────
@api_router.post("/auth/request-otp")
async def request_otp(req: OTPRequest):
    phone = normalize_phone(req.phone)
    if len(phone) < 10:
        raise HTTPException(400, "Nomor HP tidak valid")
    # Generate 6-digit OTP. If WA notif is enabled and token configured, send real OTP.
    token, _, enabled = await get_fonnte_config()
    use_real = bool(token and enabled)
    otp_code = f"{secrets.randbelow(900000) + 100000}" if use_real else "123456"
    ts = now_iso()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    await db.users.update_one(
        {"phone": phone},
        {"$set": {"otp_code": otp_code, "otp_expires_at": expires, "updated_at": ts},
         "$setOnInsert": {"id": str(uuid.uuid4()), "phone": phone, "name": req.name or "", "verified": False, "created_at": ts}},
        upsert=True
    )
    # Try send via Fonnte
    wa_result = {"ok": False}
    if use_real:
        wa_result = await fonnte_send(phone, build_otp_message(otp_code))
    response = {
        "success": True,
        "phone": phone,
        "wa_sent": wa_result.get("ok", False),
        "message": "Kode OTP terkirim via WhatsApp. Cek WA kamu ya!" if wa_result.get("ok") else "Kode OTP berhasil dibuat.",
    }
    if not use_real:
        response["demo_otp"] = otp_code
        response["message"] = "Mode simulasi aktif. Pakai kode 123456."
    return response

@api_router.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify):
    phone = normalize_phone(req.phone)
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Nomor HP belum terdaftar. Silakan request OTP dulu.")
    # Check expiry
    exp = user.get("otp_expires_at")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(400, "Kode OTP sudah kadaluarsa. Request ulang ya.")
        except ValueError:
            pass
    expected = user.get("otp_code") or "123456"
    if req.otp != expected:
        raise HTTPException(400, "Kode OTP salah.")
    upd = {"verified": True, "updated_at": now_iso()}
    if req.name:
        upd["name"] = req.name
    await db.users.update_one({"phone": phone}, {"$set": upd, "$unset": {"otp_code": "", "otp_expires_at": ""}})
    user = await db.users.find_one({"phone": phone}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0})
    return {"success": True, "user": user, "token": user["id"]}

@api_router.get("/auth/me")
async def auth_me(token: str):
    user = await db.users.find_one({"id": token}, {"_id": 0, "otp_code": 0, "otp_expires_at": 0})
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    return user

# ─── Product Endpoints ────────────────────────────────────────────────────────
@api_router.get("/products")
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    # Attach discount info — only active and within time window
    now = datetime.now(timezone.utc).isoformat()
    discounts = await db.discounts.find({"active": True}, {"_id": 0}).to_list(100)
    def in_window(d):
        s = d.get("starts_at")
        e = d.get("ends_at")
        if s and now < s:
            return False
        if e and now > e:
            return False
        return True
    discounts = [d for d in discounts if in_window(d)]
    dmap = {d["id"]: d for d in discounts}
    for p in products:
        d = dmap.get(p.get("discount_id"))
        if d:
            p["discount"] = {
                "name": d["name"], "type": d["type"], "value": d["value"],
                "is_flash_sale": d.get("is_flash_sale", False),
                "ends_at": d.get("ends_at"), "starts_at": d.get("starts_at"),
            }
            if d["type"] == "percent":
                p["final_price"] = round(p["price"] * (1 - d["value"] / 100))
            else:
                p["final_price"] = max(0, p["price"] - d["value"])
        else:
            p["discount"] = None
            p["final_price"] = p["price"]
    # Review aggregation
    pipeline = [{"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    stats = {r["_id"]: r async for r in db.reviews.aggregate(pipeline)}
    for p in products:
        s = stats.get(p["id"])
        p["rating_avg"] = round(s["avg"], 1) if s else 0
        p["rating_count"] = s["count"] if s else 0
    return products

@api_router.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    return p

@api_router.post("/products")
async def create_product(p: ProductCreate, _auth: bool = Depends(require_seller)):
    ts = now_iso()
    data = p.model_dump()
    data["media_urls"] = [gdrive_to_direct(u) for u in (data.get("media_urls") or []) if u]
    if data.get("image_url"):
        data["image_url"] = gdrive_to_direct(data["image_url"])
    elif data["media_urls"]:
        data["image_url"] = data["media_urls"][0]
    doc = {"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts, **data}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "product_updated", "data": doc})
    return doc

@api_router.put("/products/{pid}")
async def update_product(pid: str, update: ProductUpdate, _auth: bool = Depends(require_seller)):
    upd = update.model_dump(exclude_unset=True)
    if "media_urls" in upd and upd["media_urls"] is not None:
        upd["media_urls"] = [gdrive_to_direct(u) for u in upd["media_urls"] if u]
        if upd["media_urls"] and not upd.get("image_url"):
            upd["image_url"] = upd["media_urls"][0]
    if "image_url" in upd and upd["image_url"]:
        upd["image_url"] = gdrive_to_direct(upd["image_url"])
    upd["updated_at"] = now_iso()
    await db.products.update_one({"id": pid}, {"$set": upd})
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if doc:
        await manager.broadcast({"type": "product_updated", "data": doc})
    return doc

@api_router.delete("/products/{pid}")
async def delete_product(pid: str, _auth: bool = Depends(require_seller)):
    await db.products.delete_one({"id": pid})
    await manager.broadcast({"type": "product_deleted", "data": {"id": pid}})
    return {"success": True}

# ─── Order Endpoints ──────────────────────────────────────────────────────────
@api_router.get("/orders")
async def get_orders(status: Optional[str] = None, user_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/orders/track")
async def track_orders(order_id: Optional[str] = None, phone: Optional[str] = None):
    if order_id:
        query = {"$or": [{"id": order_id}, {"order_number": order_id.upper()}]}
    elif phone:
        np = normalize_phone(phone)
        query = {"customer_phone": {"$in": [phone, np]}}
    else:
        return []
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(10)

@api_router.get("/orders/{oid}")
async def get_order(oid: str):
    return await db.orders.find_one({"$or": [{"id": oid}, {"order_number": oid.upper()}]}, {"_id": 0})

@api_router.post("/orders")
async def create_order(order: OrderCreate):
    ts = now_iso()
    # ✅ Validate stock availability BEFORE creating order — prevent negative stock
    for item in order.items:
        if not item.product_id:
            continue
        p = await db.products.find_one({"id": item.product_id}, {"_id": 0, "stock": 1, "name": 1})
        if not p:
            raise HTTPException(400, f"Produk tidak ditemukan: {item.product_name or item.product_id}")
        cur_stock = int(p.get("stock") or 0)
        if cur_stock < int(item.quantity):
            raise HTTPException(
                400,
                f"Stok '{p.get('name', item.product_name)}' tidak cukup. Tersisa {cur_stock}, diminta {item.quantity}."
            )

    onum = await next_order_number()
    data = order.model_dump()
    data["customer_phone"] = normalize_phone(data["customer_phone"])
    doc = {
        "id": str(uuid.uuid4()), "order_number": onum,
        "status": "menunggu", "status_timestamps": {"menunggu": ts},
        "received": False,
        "stock_restored": False,  # ✅ explicit flag, will flip True if cancelled later
        "created_at": ts, "updated_at": ts,
        **data
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    for item in order.items:
        if item.product_id:
            await db.products.update_one(
                {"id": item.product_id},
                {"$inc": {"stock": -item.quantity, "sold_count": item.quantity}}
            )
    await manager.broadcast({"type": "order_created", "data": doc})
    # ─── FASE 3: Auto-Chat with configurable templates per stage ───
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    auto_chat = (cfg.get("auto_chat_config") or {}).get("menunggu", {})
    store_name = cfg.get("name") or "Ciltarasa"
    bank_accounts = cfg.get("bank_accounts") or []
    token, seller_phone, enabled = await get_fonnte_config()
    wa_seller_sent = False
    wa_seller_reason = None
    wa_buyer_sent = False
    wa_buyer_reason = None
    if enabled:
        # Seller notif
        if auto_chat.get("seller_enabled", True) and seller_phone:
            tpl = auto_chat.get("seller_template") or ""
            msg = render_chat_template(tpl, doc, store_name, FRONTEND_URL, bank_accounts) if tpl else build_seller_order_message(doc)
            res = await fonnte_send(seller_phone, msg)
            wa_seller_sent = res.get("ok", False)
            wa_seller_reason = res.get("reason") or res.get("error") or (res.get("response") or {}).get("reason")
            if not wa_seller_sent:
                logger.warning(f"WA seller notif failed for order {doc.get('order_number')}: {res}")
        elif not auto_chat.get("seller_enabled", True):
            wa_seller_reason = "Auto-chat seller disabled for 'menunggu'"
        elif not seller_phone:
            wa_seller_reason = "seller_notify_phone empty in store_config"
        # Buyer notif on order created (opsional)
        if auto_chat.get("buyer_enabled", False) and doc.get("customer_phone"):
            tpl_b = auto_chat.get("buyer_template") or ""
            if tpl_b:
                msg_b = render_chat_template(tpl_b, doc, store_name, FRONTEND_URL, bank_accounts)
                res_b = await fonnte_send(doc["customer_phone"], msg_b)
                wa_buyer_sent = res_b.get("ok", False)
                wa_buyer_reason = res_b.get("reason") or res_b.get("error") or (res_b.get("response") or {}).get("reason")
    else:
        wa_seller_reason = "WA notif disabled in config"
        wa_buyer_reason = "WA notif disabled in config"
    doc["_wa_seller_sent"] = wa_seller_sent
    if wa_seller_reason:
        doc["_wa_seller_reason"] = wa_seller_reason
    doc["_wa_buyer_sent"] = wa_buyer_sent
    if wa_buyer_reason:
        doc["_wa_buyer_reason"] = wa_buyer_reason
    # ─── FASE 5: Web Push notification ke semua seller device subscribers ───
    try:
        items_short = ", ".join([f"{it.get('product_name','')} x{it.get('quantity',0)}" for it in (doc.get('items') or [])[:3]])
        if len(doc.get('items') or []) > 3:
            items_short += f" +{len(doc['items'])-3} lainnya"
        push_res = await broadcast_push({
            "title": f"🛒 Pesanan Baru #{doc.get('order_number','')}",
            "body": f"{doc.get('customer_name','-')}\n{items_short}\n💰 Total: {fmt_rp_id(doc.get('total',0))}",
            "tag": f"order-{doc.get('id')}",
            "url": "/#/seller",
            "order_number": doc.get('order_number'),
            "alert_type": "order",
            "requireInteraction": True,  # keeps notification visible until tapped
        })
        doc["_push_sent"] = push_res.get("sent", 0)
    except Exception as e:
        logger.warning(f"Push broadcast failed for order {doc.get('order_number')}: {e}")
        doc["_push_sent"] = 0
    return doc

class PaymentProofSubmit(BaseModel):
    proof_url: str


@api_router.post("/orders/{oid}/payment-proof")
async def submit_payment_proof(oid: str, body: PaymentProofSubmit):
    """Buyer submit bukti transfer setelah pesanan siap kirim. Forward foto ke seller via Fonnte."""
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if not body.proof_url:
        raise HTTPException(400, "proof_url wajib diisi")
    ts = now_iso()
    await db.orders.update_one(
        {"id": oid},
        {"$set": {
            "payment_proof_url": body.proof_url,
            "payment_proof_submitted_at": ts,
            "payment_proof_submitted": True,
            "updated_at": ts,
        }},
    )
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    await manager.broadcast({"type": "payment_proof_submitted", "data": doc})
    # Forward bukti ke seller via Fonnte (sebagai message + image URL)
    token, seller_phone, enabled = await get_fonnte_config()
    proof_full_url = body.proof_url if body.proof_url.startswith("http") else f"{BACKEND_URL}{body.proof_url}"
    wa_sent = False
    wa_reason = None
    if enabled and seller_phone:
        msg = (
            f"💰 *BUKTI PEMBAYARAN BARU*\n\n"
            f"Order: #{doc.get('order_number')}\n"
            f"Pelanggan: {doc.get('customer_name')}\n"
            f"Total: {fmt_rp_id(doc.get('total', 0))}\n\n"
            f"Bukti transfer:\n{proof_full_url}\n\n"
            f"Mohon dicek & konfirmasi 🙏"
        )
        try:
            # Fonnte supports `file` param for media attachment
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    FONNTE_URL,
                    headers={"Authorization": token},
                    data={"target": seller_phone, "message": msg, "url": proof_full_url, "filename": "bukti-bayar.jpg"},
                )
                res = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
                wa_sent = bool(res.get("status"))
                wa_reason = res.get("reason") or res.get("message")
        except Exception as e:
            wa_reason = f"Send error: {str(e)[:120]}"
            logger.warning(f"Payment proof WA failed for {oid}: {e}")
    else:
        wa_reason = "WA disabled or seller_notify_phone empty"
    doc["_wa_seller_sent"] = wa_sent
    if wa_reason:
        doc["_wa_seller_reason"] = wa_reason

    # ─── Web Push: notify seller that payment proof was submitted ───
    try:
        push_res = await broadcast_push({
            "title": f"💰 Bukti Bayar Masuk #{doc.get('order_number','')}",
            "body": f"{doc.get('customer_name','-')} kirim bukti transfer. Total: {fmt_rp_id(doc.get('total', 0))}",
            "tag": f"payment-{doc.get('id')}",
            "url": "/#/seller",
            "order_number": doc.get('order_number'),
            "alert_type": "payment",
            "requireInteraction": True,
        })
        doc["_push_sent"] = push_res.get("sent", 0)
    except Exception as e:
        logger.warning(f"Payment-proof push failed for {oid}: {e}")
        doc["_push_sent"] = 0

    return doc


@api_router.put("/orders/{oid}/status")
async def update_order_status(oid: str, update: OrderStatusUpdate, _auth: bool = Depends(require_seller)):
    ts = now_iso()
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    prev_status = order.get("status")
    new_status = update.status
    status_ts = order.get("status_timestamps", {})
    status_ts[new_status] = ts
    update_fields = {"status": new_status, "status_timestamps": status_ts, "updated_at": ts}

    # ─── FASE 7: Ongkir saat seller mark siap (delivery + delivery_fee provided) ───
    if new_status == "siap" and update.delivery_fee is not None and update.delivery_fee > 0:
        delivery_fee = float(update.delivery_fee)
        subtotal = order.get("subtotal", 0)
        new_total = subtotal + delivery_fee
        update_fields["delivery_fee"] = delivery_fee
        update_fields["total"] = new_total

    # ─── BUG FIX #11: Restore stock saat order dibatalkan ───
    # Hanya restore jika transisi dari status non-cancelled ke cancelled & belum direstore
    stock_restored = order.get("stock_restored", False)
    if new_status == "dibatalkan" and prev_status != "dibatalkan" and not stock_restored:
        for item in order.get("items", []):
            if item.get("product_id"):
                await db.products.update_one(
                    {"id": item["product_id"]},
                    {"$inc": {"stock": int(item.get("quantity", 0)), "sold_count": -int(item.get("quantity", 0))}}
                )
        update_fields["stock_restored"] = True

    await db.orders.update_one({"id": oid}, {"$set": update_fields})
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    await manager.broadcast({"type": "order_updated", "data": doc})
    # ─── FASE 3: Auto-Chat per stage (seller + buyer configurable) ───
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    auto_chat = (cfg.get("auto_chat_config") or {}).get(new_status, {})
    store_name = cfg.get("name") or "Ciltarasa"
    bank_accounts = cfg.get("bank_accounts") or []
    token, seller_phone, enabled = await get_fonnte_config()
    wa_buyer_sent = False
    wa_buyer_reason = None
    wa_seller_sent = False
    wa_seller_reason = None
    if enabled:
        # Buyer notif
        if auto_chat.get("buyer_enabled", True) and doc.get("customer_phone"):
            tpl = auto_chat.get("buyer_template") or ""
            msg = render_chat_template(tpl, doc, store_name, FRONTEND_URL, bank_accounts) if tpl else build_buyer_status_message(doc, FRONTEND_URL)
            res = await fonnte_send(doc["customer_phone"], msg)
            wa_buyer_sent = res.get("ok", False)
            wa_buyer_reason = res.get("reason") or res.get("error") or (res.get("response") or {}).get("reason")
        elif not auto_chat.get("buyer_enabled", True):
            wa_buyer_reason = f"Auto-chat buyer disabled for '{new_status}'"
        # Seller notif
        if auto_chat.get("seller_enabled", False) and seller_phone:
            tpl_s = auto_chat.get("seller_template") or ""
            if tpl_s:
                msg_s = render_chat_template(tpl_s, doc, store_name, FRONTEND_URL, bank_accounts)
                res_s = await fonnte_send(seller_phone, msg_s)
                wa_seller_sent = res_s.get("ok", False)
                wa_seller_reason = res_s.get("reason") or res_s.get("error") or (res_s.get("response") or {}).get("reason")
    else:
        wa_buyer_reason = "WA notif disabled in config"
        wa_seller_reason = "WA notif disabled in config"
    doc["_wa_buyer_sent"] = wa_buyer_sent
    if wa_buyer_reason:
        doc["_wa_buyer_reason"] = wa_buyer_reason
    doc["_wa_seller_sent"] = wa_seller_sent
    if wa_seller_reason:
        doc["_wa_seller_reason"] = wa_seller_reason
    return doc

@api_router.put("/orders/{oid}/received")
async def update_order_received(oid: str, update: OrderReceivedUpdate):
    ts = now_iso()
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    status_ts = order.get("status_timestamps", {})
    if update.received:
        status_ts["diterima"] = ts
    await db.orders.update_one(
        {"id": oid},
        {"$set": {"received": update.received, "status_timestamps": status_ts, "updated_at": ts}}
    )
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    await manager.broadcast({"type": "order_updated", "data": doc})

    # ─── Notify seller via WA when buyer reports NOT received ───
    if not update.received:
        token, seller_phone, enabled = await get_fonnte_config()
        if enabled and seller_phone:
            msg = (
                f"⚠️ *PESANAN BELUM DITERIMA*\n\n"
                f"Order: #{doc.get('order_number')}\n"
                f"Pelanggan: {doc.get('customer_name')}\n"
                f"No. HP: +{doc.get('customer_phone')}\n"
                f"Total: {fmt_rp_id(doc.get('total', 0))}\n\n"
                f"Buyer melaporkan pesanan belum sampai 😟\n"
                f"Mohon segera ditindaklanjuti 🙏"
            )
            try:
                await fonnte_send(seller_phone, msg)
            except Exception as e:
                logger.warning(f"Failed to notify seller about not-received order {oid}: {e}")

    return doc

# ─── Settings ────────────────────────────────────────────────────────────────
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "main"}, {"_id": 0})
    return s or DEFAULT_SETTINGS

@api_router.put("/settings")
async def update_settings(update: SettingsUpdate, _auth: bool = Depends(require_seller)):
    upd = update.model_dump(exclude_unset=True)
    await db.settings.update_one({"_id": "main"}, {"$set": upd}, upsert=True)
    s = await db.settings.find_one({"_id": "main"}, {"_id": 0})
    await manager.broadcast({"type": "settings_updated", "data": s})
    return s

# ─── Store Config ────────────────────────────────────────────────────────────
@api_router.get("/store-config")
async def get_store_config():
    s = await db.store_config.find_one({"_id": "main"}, {"_id": 0})
    if not s:
        return {}
    # ─── Backfill defaults for delivery options ───
    if isinstance(s.get("delivery_options"), list):
        for d in s["delivery_options"]:
            if not isinstance(d, dict):
                continue
            if "is_pickup" not in d:
                d["is_pickup"] = (
                    (d.get("id") or "").lower() == "pickup"
                    or bool(re.search(r"(ambil|sendiri|pickup)", (d.get("name") or ""), re.I))
                )
            # New fields (with smart defaults)
            d.setdefault("requires_address", not d["is_pickup"])
            d.setdefault("needs_ongkir_input", False)
            d.setdefault("emoji", "🏠" if d["is_pickup"] else "🚚")
            d.setdefault("free_label", "Gratis")
    # ─── Backfill per-option (payment × delivery) config ───
    # Each payment_method.by_delivery = { [delivery_option_id]: { available, timing } }
    # Backfill missing entries from old globals (available_for_delivery/pickup, delivery_timing/pickup_timing)
    delivery_opts = s.get("delivery_options") or []
    if isinstance(s.get("payment_methods"), list):
        for pm in s["payment_methods"]:
            if not isinstance(pm, dict):
                continue
            # Keep global defaults for backward compat
            pm.setdefault("available_for_delivery", True)
            pm.setdefault("available_for_pickup", True)
            pm.setdefault("delivery_timing", "later")
            pm.setdefault("pickup_timing", "both")
            # Per-option map
            by_d = dict(pm.get("by_delivery") or {})
            for d in delivery_opts:
                if not isinstance(d, dict):
                    continue
                d_id = d.get("id")
                if not d_id or d_id in by_d:
                    continue
                d_pickup = d.get("is_pickup") is True
                fallback_avail = pm["available_for_pickup"] if d_pickup else pm["available_for_delivery"]
                fallback_timing = pm["pickup_timing"] if d_pickup else pm["delivery_timing"]
                by_d[d_id] = {"available": fallback_avail, "timing": fallback_timing}
            pm["by_delivery"] = by_d

    # ─── Backfill SEO + Theme defaults ───
    s.setdefault("seo", {})
    s["seo"].setdefault("title", "Ciltarasa - Homemade Premium Frozen Food")
    s["seo"].setdefault("description", "Frozen food premium homemade. Bekal dan camilan praktis berkualitas.")
    s["seo"].setdefault("og_image_url", "")
    s["seo"].setdefault("theme_color", "#D97706")
    s.setdefault("theme", {})
    t = s["theme"]
    t.setdefault("primary_color", "#D97706")
    t.setdefault("primary_hover", "#B45309")
    t.setdefault("secondary_color", "#F97316")
    t.setdefault("bg_color", "#FDF8F0")
    t.setdefault("text_color", "#451A03")
    t.setdefault("heading_color", "#78350F")
    t.setdefault("accent_color", "#FED7AA")
    t.setdefault("font_family", "system")
    t.setdefault("font_size_base", 16)
    return s

@api_router.put("/store-config")
async def update_store_config(update: StoreConfigUpdate, _auth: bool = Depends(require_seller)):
    upd = update.model_dump(exclude_unset=True)
    # Deep-merge: for dict fields, expand to dot-notation so we don't wipe sibling keys
    set_ops = {"updated_at": now_iso()}
    for k, v in upd.items():
        if isinstance(v, dict):
            for sk, sv in v.items():
                set_ops[f"{k}.{sk}"] = sv
        else:
            set_ops[k] = v
    await db.store_config.update_one({"_id": "main"}, {"$set": set_ops}, upsert=True)
    s = await db.store_config.find_one({"_id": "main"}, {"_id": 0})
    await manager.broadcast({"type": "store_config_updated", "data": s})
    return s

# ─── Admin Utilities ────────────────────────────────────────────────────────
class TestWAReq(BaseModel):
    target: str
    message: Optional[str] = None

@api_router.post("/admin/test-wa")
async def test_wa(req: TestWAReq, _auth: bool = Depends(require_seller)):
    msg = req.message or "🔔 Tes notifikasi dari dashboard Ciltarasa. Jika kamu menerima ini, integrasi Fonnte sukses! ✅"
    res = await fonnte_send(req.target, msg)
    return res

@api_router.get("/admin/wa-diagnostic")
async def wa_diagnostic(_auth: bool = Depends(require_seller)):
    """One-shot diagnostic showing EVERYTHING that affects WhatsApp seller notifications.
    Use this when notif tidak masuk — kasih tau exactly apa yang missing/salah.
    """
    sc = await db.store_config.find_one({"_id": "main"}, {"_id": 0}) or {}
    token, seller_phone, enabled = await get_fonnte_config()

    # Inspect auto_chat for menunggu (the new-order trigger)
    ac = sc.get("auto_chat_config") or {}
    menunggu = ac.get("menunggu") or {}

    checks = {
        "store_config_exists": bool(sc),
        "fonnte_token_set": bool(token),
        "fonnte_token_preview": (token[:6] + "..." + token[-4:]) if token and len(token) > 10 else None,
        "seller_notify_phone_set": bool(seller_phone),
        "seller_notify_phone": seller_phone,
        "seller_notify_phone_raw_in_db": sc.get("seller_notify_phone"),
        "wa_notif_enabled": enabled,
        "auto_chat_menunggu_seller_enabled": menunggu.get("seller_enabled", True),
        "auto_chat_menunggu_seller_template_set": bool(menunggu.get("seller_template")),
        "default_seller_phone_const": DEFAULT_STORE_CONFIG.get("seller_notify_phone"),
        "default_fonnte_token_set_in_code": bool(DEFAULT_STORE_CONFIG.get("fonnte_token")),
    }

    # Live device check
    device_status = None
    if token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    "https://api.fonnte.com/device",
                    headers={"Authorization": token},
                )
                try:
                    device_status = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
                except Exception:
                    device_status = {"raw": r.text[:300]}
                device_status["_http_status"] = r.status_code
        except Exception as e:
            device_status = {"error": str(e)}

    # Build diagnosis verdict
    issues = []
    if not checks["fonnte_token_set"]:
        issues.append("❌ Fonnte token KOSONG. Buka Admin → Auto-Chat & isi token. Default seharusnya restore otomatis tapi gagal.")
    if not checks["seller_notify_phone_set"]:
        issues.append("❌ seller_notify_phone KOSONG. Isi di Admin → Auto-Chat WhatsApp.")
    if not checks["wa_notif_enabled"]:
        issues.append("⚠️ wa_notif_enabled OFF. Aktifkan di Admin → Auto-Chat.")
    if not checks["auto_chat_menunggu_seller_enabled"]:
        issues.append("⚠️ Auto-chat 'menunggu' untuk seller DIMATIKAN. Aktifkan di Admin → Auto-Chat WhatsApp.")
    if device_status and isinstance(device_status, dict):
        ds = str(device_status.get("status", "")).lower()
        if ds in ("disconnect", "disconnected", ""):
            issues.append(f"❌ Fonnte device DISCONNECTED ({ds!r}). Buka https://fonnte.com → Devices → scan QR ulang dari WhatsApp HP seller.")
        elif device_status.get("quota") == 0 or device_status.get("quota") == "0":
            issues.append("❌ Quota Fonnte HABIS. Top-up di fonnte.com.")

    verdict = "✅ Konfigurasi OK — kemungkinan notif sampai." if not issues else "⚠️ Ditemukan " + str(len(issues)) + " masalah:"

    return {
        "verdict": verdict,
        "issues": issues,
        "checks": checks,
        "fonnte_device_live_status": device_status,
        "tip": "Setelah perbaiki issue, coba bikin order test dari sisi buyer. Cek Render logs untuk lihat '[fonnte] sent to ...' atau warning detail.",
    }

@api_router.post("/admin/wa-autoheal")
async def wa_autoheal(_auth: bool = Depends(require_seller)):
    """Manually trigger auto-heal of seller_notify_phone, fonnte_token, wa_notif_enabled
    using DEFAULT_STORE_CONFIG values. Use this if migration didn't fire (e.g. fields
    set to empty string instead of missing).
    """
    sc = await db.store_config.find_one({"_id": "main"}, {"_id": 0}) or {}
    fixes = {}

    current_phone = (sc.get("seller_notify_phone") or "").strip()
    if not current_phone or len(current_phone) < 10:
        fixes["seller_notify_phone"] = DEFAULT_STORE_CONFIG.get("seller_notify_phone")

    if not (sc.get("fonnte_token") or "").strip():
        fixes["fonnte_token"] = DEFAULT_STORE_CONFIG.get("fonnte_token")

    if "wa_notif_enabled" not in sc or sc.get("wa_notif_enabled") is None:
        fixes["wa_notif_enabled"] = True

    # Force-enable auto_chat menunggu seller
    ac = sc.get("auto_chat_config") or {}
    menunggu = ac.get("menunggu") or {}
    if not menunggu.get("seller_enabled", True):
        fixes["auto_chat_config.menunggu.seller_enabled"] = True

    if fixes:
        await db.store_config.update_one({"_id": "main"}, {"$set": fixes}, upsert=True)
        logger.info(f"[wa-autoheal] applied: {list(fixes.keys())}")

    return {"ok": True, "applied": fixes, "no_changes_needed": not fixes}

@api_router.get("/admin/fonnte-status")
async def fonnte_device_status(_auth: bool = Depends(require_seller)):
    """Real-time check Fonnte device status (connected/disconnected). Push aktual, bukan static."""
    token, seller_phone, enabled = await get_fonnte_config()
    if not token:
        return {"ok": False, "connected": False, "reason": "Token Fonnte belum diisi"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.fonnte.com/device",
                headers={"Authorization": token},
            )
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            # Fonnte returns { device: "...", status: "connect"/"disconnect", quota: N, ... }
            status_val = (data.get("status") or "").lower() if isinstance(data.get("status"), str) else ""
            connected = status_val in ("connect", "connected", "active")
            # Surface error reason to top-level for UI clarity
            reason = None
            if not connected:
                reason = data.get("reason") or data.get("message") or (status_val if status_val else "Device disconnected")
            return {
                "ok": True,
                "connected": connected,
                "status": status_val or "unknown",
                "device": data.get("device") or data.get("name") or "-",
                "quota": data.get("quota"),
                "messages": data.get("messages"),
                "enabled": enabled,
                "seller_phone": seller_phone,
                "reason": reason,
                "raw": data,
            }
    except Exception as e:
        logger.warning(f"Fonnte device status check failed: {e}")
        return {"ok": False, "connected": False, "reason": f"Error: {str(e)}"}

class ResetCustomersReq(BaseModel):
    confirm: str  # must equal "RESET"
    scope: str = "all"  # all | orders | users | both

@api_router.post("/admin/reset-customers")
async def reset_customers(req: ResetCustomersReq, _auth: bool = Depends(require_seller)):
    if req.confirm != "RESET":
        raise HTTPException(400, "Konfirmasi tidak valid. Kirim {confirm: 'RESET'} untuk lanjut.")
    deleted = {"orders": 0, "users": 0, "reviews": 0}
    if req.scope in ("all", "orders", "both"):
        r = await db.orders.delete_many({})
        deleted["orders"] = r.deleted_count
        r = await db.reviews.delete_many({})
        deleted["reviews"] = r.deleted_count
        # Reset sold_count on products too
        await db.products.update_many({}, {"$set": {"sold_count": 0}})
    if req.scope in ("all", "users", "both"):
        r = await db.users.delete_many({})
        deleted["users"] = r.deleted_count
    await manager.broadcast({"type": "data_reset", "data": deleted})
    return {"success": True, "deleted": deleted}

# ─── Seller Auth: Verify PIN + Change PIN ───────────────────────────────────
class PinVerifyReq(BaseModel):
    pin: str

@api_router.post("/admin/verify-pin")
async def verify_pin(req: PinVerifyReq):
    """Public endpoint — verify current PIN. Used by SellerLogin."""
    active = await get_active_pin()
    if req.pin != active:
        raise HTTPException(401, "PIN salah")
    return {"success": True}

class ChangePinReq(BaseModel):
    current_pin: str
    new_pin: str

@api_router.post("/admin/change-pin")
async def change_pin(req: ChangePinReq):
    """Change seller PIN. Validates current PIN, requires new PIN min 4 chars."""
    active = await get_active_pin()
    if req.current_pin != active:
        raise HTTPException(401, "PIN saat ini salah")
    new_pin = (req.new_pin or "").strip()
    if len(new_pin) < 4 or len(new_pin) > 32:
        raise HTTPException(400, "PIN baru harus 4-32 karakter")
    if new_pin == active:
        raise HTTPException(400, "PIN baru harus berbeda dari PIN saat ini")
    await db.auth_config.update_one(
        {"_id": "main"},
        {"$set": {"seller_pin": new_pin, "updated_at": now_iso()}},
        upsert=True
    )
    return {"success": True, "message": "PIN berhasil diubah. Gunakan PIN baru untuk login berikutnya."}

# ─── Analytics / Visitor Tracking ────────────────────────────────────────────
class TrackVisitReq(BaseModel):
    session_id: str
    path: Optional[str] = "/"
    referrer: Optional[str] = ""
    user_agent: Optional[str] = ""
    screen: Optional[str] = ""
    is_pwa: Optional[bool] = False

def parse_device(ua: str) -> str:
    if not ua:
        return "unknown"
    u = ua.lower()
    if "iphone" in u or "ipad" in u or "ipod" in u:
        return "ios"
    if "android" in u:
        return "android"
    if "windows" in u or "macintosh" in u or "linux" in u:
        return "desktop"
    return "other"

def parse_referrer_source(ref: str) -> str:
    if not ref:
        return "direct"
    try:
        from urllib.parse import urlparse
        host = urlparse(ref).netloc.lower()
        if not host:
            return "direct"
        if "google" in host:
            return "google"
        if "instagram" in host or "ig" in host:
            return "instagram"
        if "facebook" in host or "fb.com" in host:
            return "facebook"
        if "tiktok" in host:
            return "tiktok"
        if "whatsapp" in host or "wa.me" in host:
            return "whatsapp"
        if "shopee" in host:
            return "shopee"
        if "ciltarasa" in host:
            return "internal"
        return host
    except Exception:
        return "other"

@api_router.post("/analytics/track")
async def track_visit(req: TrackVisitReq):
    """Public endpoint — log a visitor session. No PII collected beyond UA."""
    ts = now_iso()
    today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    device = parse_device(req.user_agent or "")
    source = parse_referrer_source(req.referrer or "")
    # Upsert by session_id: first hit creates doc, subsequent hits bump hit_count + last_seen
    await db.analytics_visits.update_one(
        {"session_id": req.session_id},
        {
            "$setOnInsert": {
                "session_id": req.session_id,
                "first_seen": ts,
                "first_path": req.path or "/",
                "device": device,
                "source": source,
                "referrer": req.referrer or "",
                "user_agent": (req.user_agent or "")[:300],
                "screen": req.screen or "",
                "is_pwa": bool(req.is_pwa),
                "first_day": today_key,
            },
            "$set": {"last_seen": ts, "last_path": req.path or "/"},
            "$inc": {"hit_count": 1},
        },
        upsert=True
    )
    return {"success": True}

@api_router.get("/analytics/stats")
async def analytics_stats(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    _auth: bool = Depends(require_seller),
):
    """Analytics stats. Optional from_date/to_date (YYYY-MM-DD) for chart + range KPIs.
    Default: last 30 days incl today."""
    now = datetime.now(timezone.utc)
    today_key = now.strftime("%Y-%m-%d")
    week_cutoff = (now - timedelta(days=6)).strftime("%Y-%m-%d")
    month_cutoff = (now - timedelta(days=29)).strftime("%Y-%m-%d")

    # Parse range params (default last 30 days)
    def _safe_date(s, default):
        try:
            datetime.strptime(s, "%Y-%m-%d")
            return s
        except Exception:
            return default

    range_from = _safe_date(from_date, month_cutoff) if from_date else month_cutoff
    range_to = _safe_date(to_date, today_key) if to_date else today_key
    if range_from > range_to:
        range_from, range_to = range_to, range_from

    pipeline_total = [{"$group": {"_id": None, "visits": {"$sum": 1}, "hits": {"$sum": "$hit_count"}}}]
    tot_doc = await db.analytics_visits.aggregate(pipeline_total).to_list(1)
    total_visits = tot_doc[0]["visits"] if tot_doc else 0
    total_hits = tot_doc[0]["hits"] if tot_doc else 0

    today_visits = await db.analytics_visits.count_documents({"first_day": today_key})
    week_visits = await db.analytics_visits.count_documents({"first_day": {"$gte": week_cutoff}})
    month_visits = await db.analytics_visits.count_documents({"first_day": {"$gte": month_cutoff}})
    pwa_visits = await db.analytics_visits.count_documents({"is_pwa": True})

    # Visits within selected range
    range_visits = await db.analytics_visits.count_documents(
        {"first_day": {"$gte": range_from, "$lte": range_to}}
    )

    # Daily trend within selected range
    daily_pipeline = [
        {"$match": {"first_day": {"$gte": range_from, "$lte": range_to}}},
        {"$group": {"_id": "$first_day", "visits": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    daily_docs = await db.analytics_visits.aggregate(daily_pipeline).to_list(370)
    daily_map = {d["_id"]: d["visits"] for d in daily_docs}

    # Fill missing days with 0
    start_dt = datetime.strptime(range_from, "%Y-%m-%d")
    end_dt = datetime.strptime(range_to, "%Y-%m-%d")
    days_span = (end_dt - start_dt).days
    filled = []
    for i in range(days_span + 1):
        day = (start_dt + timedelta(days=i)).strftime("%Y-%m-%d")
        filled.append({"date": day, "visits": daily_map.get(day, 0)})

    # Source breakdown (within range)
    src_pipeline = [
        {"$match": {"first_day": {"$gte": range_from, "$lte": range_to}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    src_docs = await db.analytics_visits.aggregate(src_pipeline).to_list(20)
    sources = [{"source": s["_id"] or "direct", "count": s["count"]} for s in src_docs]

    # Device breakdown (within range)
    dev_pipeline = [
        {"$match": {"first_day": {"$gte": range_from, "$lte": range_to}}},
        {"$group": {"_id": "$device", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    dev_docs = await db.analytics_visits.aggregate(dev_pipeline).to_list(10)
    devices = [{"device": d["_id"] or "unknown", "count": d["count"]} for d in dev_docs]

    # Orders within range (using created_at YYYY-MM-DD prefix)
    range_orders = await db.orders.count_documents({
        "status": {"$nin": ["dibatalkan"]},
        "created_at": {"$gte": f"{range_from}T00:00:00", "$lte": f"{range_to}T23:59:59.999999"},
    })
    total_orders = await db.orders.count_documents({"status": {"$nin": ["dibatalkan"]}})

    conv_rate = round((range_orders / range_visits) * 100, 2) if range_visits > 0 else 0
    overall_conv_rate = round((total_orders / total_visits) * 100, 2) if total_visits > 0 else 0

    return {
        # Overall (all-time)
        "total_visits": total_visits,
        "total_hits": total_hits,
        "pwa_visits": pwa_visits,
        "total_orders": total_orders,
        "overall_conversion_rate": overall_conv_rate,
        # Standard windows
        "today_visits": today_visits,
        "week_visits": week_visits,
        "month_visits": month_visits,
        # Selected range
        "range_from": range_from,
        "range_to": range_to,
        "range_visits": range_visits,
        "range_orders": range_orders,
        "conversion_rate": conv_rate,
        # Breakdowns (within range)
        "daily": filled,
        "sources": sources,
        "devices": devices,
    }


# ─── Purchases (Restock) ─────────────────────────────────────────────────────
@api_router.get("/purchases")
async def get_purchases(status: Optional[str] = None):
    q = {} if not status else {"status": status}
    return await db.purchases.find(q, {"_id": 0}).sort("ordered_at", -1).to_list(500)

@api_router.post("/purchases")
async def create_purchase(p: PurchaseCreate, _auth: bool = Depends(require_seller)):
    ts = now_iso()
    total = sum(i.subtotal for i in p.items)
    doc = {
        "id": str(uuid.uuid4()),
        "purchase_number": f"PO-{str(await db.purchases.count_documents({}) + 1).zfill(4)}",
        "items": [i.model_dump() for i in p.items],
        "supplier": p.supplier,
        "ordered_at": p.ordered_at,
        "received_at": None,
        "status": "ordered",  # ordered | received
        "notes": p.notes,
        "total": total,
        "created_at": ts, "updated_at": ts,
    }
    await db.purchases.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "purchase_updated", "data": doc})
    return doc

@api_router.put("/purchases/{pid}")
async def update_purchase(pid: str, update: PurchaseUpdate, _auth: bool = Depends(require_seller)):
    upd = update.model_dump(exclude_unset=True)
    if "items" in upd and upd["items"] is not None:
        upd["total"] = sum(i["subtotal"] for i in upd["items"])
    upd["updated_at"] = now_iso()
    await db.purchases.update_one({"id": pid}, {"$set": upd})
    doc = await db.purchases.find_one({"id": pid}, {"_id": 0})
    await manager.broadcast({"type": "purchase_updated", "data": doc})
    return doc

@api_router.post("/purchases/{pid}/receive")
async def receive_purchase(pid: str, received_at: Optional[str] = None, _auth: bool = Depends(require_seller)):
    ts = received_at or now_iso()
    p = await db.purchases.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pembelian tidak ditemukan")
    if p.get("status") == "received":
        raise HTTPException(400, "Pembelian sudah diterima sebelumnya")
    # Increment stock + update cost_price per product
    for item in p.get("items", []):
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock": item["quantity"]},
             "$set": {"cost_price": item["unit_cost"], "updated_at": now_iso()}}
        )
    await db.purchases.update_one({"id": pid}, {"$set": {"status": "received", "received_at": ts, "updated_at": now_iso()}})
    doc = await db.purchases.find_one({"id": pid}, {"_id": 0})
    await manager.broadcast({"type": "purchase_updated", "data": doc})
    # Broadcast updated products too
    for item in p.get("items", []):
        prod = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if prod:
            await manager.broadcast({"type": "product_updated", "data": prod})
    return doc

@api_router.delete("/purchases/{pid}")
async def delete_purchase(pid: str, _auth: bool = Depends(require_seller)):
    await db.purchases.delete_one({"id": pid})
    await manager.broadcast({"type": "purchase_deleted", "data": {"id": pid}})
    return {"success": True}

# ─── Smart Insights ──────────────────────────────────────────────────────────
@api_router.get("/insights/dashboard")
async def insights_dashboard():
    """Returns top sellers, restock alerts with avg lead time + recommended qty."""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    orders = await db.orders.find({"status": {"$nin": ["dibatalkan"]}}, {"_id": 0}).to_list(1000)
    purchases = await db.purchases.find({"status": "received"}, {"_id": 0}).to_list(1000)
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    low_stock_threshold = int(cfg.get("low_stock_threshold") or 10)
    safety_days = int(cfg.get("restock_safety_days") or 2)

    now = datetime.now(timezone.utc)
    # 30-day sales velocity per product (units/day)
    velocity = {}  # product_id -> units/day
    cutoff = now - timedelta(days=30)
    for o in orders:
        try:
            ts = datetime.fromisoformat(o.get("created_at", "").replace("Z", "+00:00"))
        except Exception:
            continue
        if ts < cutoff:
            continue
        for item in o.get("items", []):
            velocity[item["product_id"]] = velocity.get(item["product_id"], 0) + item["quantity"]
    for k in velocity:
        velocity[k] = velocity[k] / 30.0  # units per day

    # Average lead time per product (days between ordered_at and received_at)
    lead_time = {}  # product_id -> avg days
    lead_counts = {}
    for p in purchases:
        try:
            o_dt = datetime.fromisoformat(p["ordered_at"].replace("Z", "+00:00"))
            r_dt = datetime.fromisoformat(p["received_at"].replace("Z", "+00:00"))
            days = (r_dt - o_dt).total_seconds() / 86400.0
        except Exception:
            continue
        for item in p.get("items", []):
            pid = item["product_id"]
            lead_time[pid] = lead_time.get(pid, 0) + days
            lead_counts[pid] = lead_counts.get(pid, 0) + 1
    for k in lead_time:
        lead_time[k] = lead_time[k] / max(1, lead_counts[k])

    # Top sellers (by sold_count desc)
    top_sellers = sorted(products, key=lambda p: p.get("sold_count", 0), reverse=True)[:5]
    top_sellers = [{
        "id": p["id"], "name": p["name"], "image_url": p.get("image_url", ""),
        "sold_count": p.get("sold_count", 0), "stock": p.get("stock", 0),
        "velocity": round(velocity.get(p["id"], 0), 2),
    } for p in top_sellers]

    # Restock alerts: products where stock < velocity * (lead_time or default 3 days) + safety buffer
    alerts = []
    for p in products:
        v = velocity.get(p["id"], 0)
        lt = lead_time.get(p["id"], 3)  # default 3 days
        days_left = (p.get("stock", 0) / v) if v > 0 else 999
        threshold_days = lt + safety_days  # configurable safety buffer
        if v > 0 and days_left < threshold_days:
            # Suggested restock qty: cover 30 days + buffer
            suggested_qty = max(int((30 + lt) * v - p.get("stock", 0)), 5)
            alerts.append({
                "id": p["id"], "name": p["name"], "image_url": p.get("image_url", ""),
                "stock": p.get("stock", 0),
                "velocity": round(v, 2),
                "avg_lead_days": round(lt, 1),
                "days_left": round(days_left, 1),
                "suggested_qty": suggested_qty,
                "last_cost": p.get("cost_price", 0),
                "urgency": "high" if days_left < lt else "medium",
            })
        elif p.get("stock", 0) < low_stock_threshold:
            alerts.append({
                "id": p["id"], "name": p["name"], "image_url": p.get("image_url", ""),
                "stock": p.get("stock", 0),
                "velocity": round(v, 2),
                "avg_lead_days": round(lt, 1),
                "days_left": round(days_left, 1),
                "suggested_qty": max(20, int(30 * max(v, 0.5))),
                "last_cost": p.get("cost_price", 0),
                "urgency": "low",
            })
    alerts.sort(key=lambda a: (a["urgency"] != "high", a["urgency"] != "medium", a["days_left"]))

    return {
        "top_sellers": top_sellers,
        "restock_alerts": alerts[:10],
        "total_products": len(products),
        "low_stock_count": len([p for p in products if p.get("stock", 0) < low_stock_threshold]),
        "low_stock_threshold": low_stock_threshold,
        "restock_safety_days": safety_days,
    }

# ─── Recommendations ─────────────────────────────────────────────────────────
@api_router.get("/recommendations")
async def get_recommendations(user_id: Optional[str] = None, phone: Optional[str] = None, limit: int = 8):
    """Repeat order + similar-category recommendations for a buyer."""
    products = await db.products.find({"active": True}, {"_id": 0}).to_list(1000)
    user_orders = []
    if user_id:
        user_orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    if not user_orders and phone:
        p = normalize_phone(phone)
        user_orders = await db.orders.find({"customer_phone": {"$in": [phone, p]}}, {"_id": 0}).to_list(100)

    # Most bought by user
    bought_count = {}
    bought_categories = set()
    for o in user_orders:
        for item in o.get("items", []):
            bought_count[item["product_id"]] = bought_count.get(item["product_id"], 0) + item["quantity"]
    pmap = {p["id"]: p for p in products}
    for pid in bought_count:
        p = pmap.get(pid)
        if p:
            bought_categories.add(p.get("category"))
            for c in p.get("categories", []):
                bought_categories.add(c)

    repeat_orders = sorted(
        [{"product": pmap[pid], "times_bought": cnt} for pid, cnt in bought_count.items() if pid in pmap],
        key=lambda x: -x["times_bought"]
    )[:limit]

    similar = []
    if bought_categories:
        for p in products:
            if p["id"] in bought_count:
                continue
            if p.get("category") in bought_categories or any(c in bought_categories for c in p.get("categories", [])):
                similar.append(p)
        similar = sorted(similar, key=lambda p: -p.get("sold_count", 0))[:limit]
    else:
        # New user → return top selling products
        similar = sorted(products, key=lambda p: -p.get("sold_count", 0))[:limit]

    return {
        "repeat_orders": repeat_orders,
        "similar_products": similar,
        "has_history": len(user_orders) > 0,
    }

# ─── Discounts ───────────────────────────────────────────────────────────────
@api_router.get("/discounts")
async def get_discounts():
    return await db.discounts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.post("/discounts")
async def create_discount(d: DiscountCreate, _auth: bool = Depends(require_seller)):
    ts = now_iso()
    doc = {"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts, **d.model_dump()}
    await db.discounts.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "discount_updated", "data": doc})
    return doc

@api_router.put("/discounts/{did}")
async def update_discount(did: str, update: DiscountUpdate, _auth: bool = Depends(require_seller)):
    upd = update.model_dump(exclude_unset=True)
    upd["updated_at"] = now_iso()
    await db.discounts.update_one({"id": did}, {"$set": upd})
    doc = await db.discounts.find_one({"id": did}, {"_id": 0})
    await manager.broadcast({"type": "discount_updated", "data": doc})
    return doc

@api_router.delete("/discounts/{did}")
async def delete_discount(did: str, _auth: bool = Depends(require_seller)):
    await db.discounts.delete_one({"id": did})
    await manager.broadcast({"type": "discount_deleted", "data": {"id": did}})
    return {"success": True}

# ─── FASE 5: Web Push Notifications (VAPID) ──────────────────────────────
class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]
    user_agent: Optional[str] = None
    label: Optional[str] = None  # e.g. "iPhone Andi", "Laptop Toko"


async def _get_vapid():
    # _id is a fixed string ("vapid"), not ObjectId — safe to return as-is, but strip _id key to be defensive
    doc = await db.auth_config.find_one({"_id": "vapid"}, {"_id": 0})
    return doc


@api_router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Public VAPID key (browser-readable). Tidak butuh auth."""
    if not WEBPUSH_AVAILABLE:
        return {"available": False, "key": None}
    v = await _get_vapid()
    if not v:
        return {"available": False, "key": None}
    return {"available": True, "key": v.get("public_b64", "")}


@api_router.post("/push/subscribe")
async def push_subscribe(sub: PushSubscription, x_seller_pin: Optional[str] = Header(None)):
    """Seller subscribe ke push notif (butuh PIN)."""
    pin = await get_active_pin()
    if x_seller_pin != pin:
        raise HTTPException(401, "PIN salah")
    if not WEBPUSH_AVAILABLE:
        raise HTTPException(501, "Web Push tidak tersedia di server")
    sub_id = str(uuid.uuid4())
    doc = {
        "id": sub_id,
        "endpoint": sub.endpoint,
        "keys": sub.keys,
        "user_agent": sub.user_agent or "",
        "label": sub.label or "Device",
        "created_at": now_iso(),
        "last_seen": now_iso(),
    }
    # Upsert by endpoint (1 device = 1 subscription)
    await db.push_subscriptions.update_one(
        {"endpoint": sub.endpoint},
        {"$set": doc},
        upsert=True,
    )
    saved = await db.push_subscriptions.find_one({"endpoint": sub.endpoint}, {"_id": 0})
    return {"ok": True, "subscription": saved}


@api_router.post("/push/unsubscribe")
async def push_unsubscribe(payload: Dict[str, str], _auth: bool = Depends(require_seller)):
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "endpoint required")
    r = await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"ok": True, "deleted": r.deleted_count}


@api_router.get("/push/subscriptions")
async def list_push_subscriptions(_auth: bool = Depends(require_seller)):
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    return {"count": len(subs), "subscriptions": subs}


@api_router.post("/push/test")
async def push_test(_auth: bool = Depends(require_seller)):
    """Kirim test push ke semua subscriber."""
    if not WEBPUSH_AVAILABLE:
        raise HTTPException(501, "Web Push tidak tersedia")
    r = await broadcast_push({
        "title": "🔔 Tes Push Ciltarasa",
        "body": "Push notification berfungsi! Order baru akan auto-notify di sini.",
        "tag": "test",
        "url": "/#/seller",
    })
    return r


def _vapid_send_key(v: dict):
    """pywebpush cannot reliably load a PEM *string* as vapid_private_key
    (raises 'Could not deserialize key data'). Convert the stored PEM to the
    raw base64url scalar, which pywebpush accepts. Works for keys already
    saved as PEM, so existing subscriptions stay valid (no re-subscribe needed)."""
    if not v:
        return None
    raw = v.get("private_raw_b64")
    if raw:
        return raw
    pem = v.get("private_pem")
    if not pem:
        return None
    try:
        import base64
        from cryptography.hazmat.primitives import serialization
        key = serialization.load_pem_private_key(pem.encode(), password=None)
        val = key.private_numbers().private_value
        return base64.urlsafe_b64encode(val.to_bytes(32, "big")).decode().rstrip("=")
    except Exception as e:
        logger.warning(f"[push] cannot derive VAPID send key from PEM: {e}")
        return None


async def broadcast_push(payload: dict):
    """Send push ke SEMUA active subscriptions. Auto-clean stale 410/404 subs."""
    if not WEBPUSH_AVAILABLE:
        return {"sent": 0, "failed": 0, "reason": "Web Push unavailable"}
    v = await _get_vapid()
    if not v:
        return {"sent": 0, "failed": 0, "reason": "VAPID keys not generated"}
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(500)
    sent = 0
    failed = 0
    stale = []
    first_error = None
    vapid_sub = v.get("subject") or "mailto:admin@ciltarasa.online"
    send_key = _vapid_send_key(v)
    if not send_key:
        return {"sent": 0, "failed": len(subs), "total": len(subs),
                "first_error": "VAPID private key tidak bisa dimuat dari DB"}
    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=json.dumps(payload),
                vapid_private_key=send_key,
                vapid_claims={"sub": vapid_sub},
                ttl=60 * 60 * 24,
            )
            sent += 1
        except WebPushException as e:
            code = getattr(e.response, "status_code", None) if hasattr(e, "response") and e.response else None
            if code in (404, 410):
                stale.append(sub["endpoint"])
            failed += 1
            if first_error is None:
                first_error = f"code={code}: {str(e)[:200]}"
            logger.warning(f"Push fail {sub.get('label')} (code={code}): {e}")
        except Exception as e:
            failed += 1
            if first_error is None:
                first_error = f"{type(e).__name__}: {str(e)[:200]}"
            logger.warning(f"Push error: {e}")
    if stale:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": stale}})
        logger.info(f"Removed {len(stale)} stale push subscriptions")
    result = {"sent": sent, "failed": failed, "stale_cleaned": len(stale), "total": len(subs)}
    if first_error:
        result["first_error"] = first_error
    return result


# ─── FASE 4: Dashboard Analytics (4 tabs) ────────────────────────────────
def _parse_period(period: str, start: Optional[str] = None, end: Optional[str] = None):
    """Return (start_dt, end_dt) UTC. Period: today|7d|14d|30d|90d|365d|custom"""
    now = datetime.now(timezone.utc)
    if period == "custom" and start and end:
        try:
            s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc) if "T" not in start else datetime.fromisoformat(start.replace("Z", "+00:00"))
            e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) if "T" not in end else datetime.fromisoformat(end.replace("Z", "+00:00"))
            # Ensure end_dt covers full day
            if e.hour == 0 and e.minute == 0:
                e = e + timedelta(days=1, seconds=-1)
            return s, e
        except Exception:
            pass
    if period == "today":
        # WIB midnight to now
        wib_now = now + timedelta(hours=7)
        midnight = wib_now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=7)
        return midnight, now
    days = {"7d": 7, "14d": 14, "30d": 30, "90d": 90, "365d": 365, "1y": 365}.get(period, 30)
    return now - timedelta(days=days), now


def _in_range(ts_str: str, start: datetime, end: datetime) -> bool:
    if not ts_str:
        return False
    try:
        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return start <= ts <= end
    except Exception:
        return False


@api_router.get("/dashboard/general")
async def dashboard_general(period: str = "30d", start: Optional[str] = None, end: Optional[str] = None, _auth: bool = Depends(require_seller)):
    """KPI ringkasan: revenue, orders, AOV, customers + trend chart + top products + recent activity."""
    s, e = _parse_period(period, start, end)
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["id"]: p for p in products}

    in_range = [o for o in orders if _in_range(o.get("created_at", ""), s, e) and o.get("status") != "dibatalkan"]
    revenue = sum(o.get("total", 0) for o in in_range)
    order_count = len(in_range)
    aov = revenue / order_count if order_count > 0 else 0
    unique_customers = len({(o.get("customer_phone") or "").strip() for o in in_range if o.get("customer_phone")})

    # Daily revenue trend
    daily = {}
    cursor_dt = s
    while cursor_dt <= e:
        daily[cursor_dt.strftime("%Y-%m-%d")] = {"date": cursor_dt.strftime("%Y-%m-%d"), "revenue": 0, "orders": 0}
        cursor_dt += timedelta(days=1)
    for o in in_range:
        try:
            d = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d")
            if d in daily:
                daily[d]["revenue"] += o.get("total", 0)
                daily[d]["orders"] += 1
        except Exception:
            continue
    trend = sorted(daily.values(), key=lambda x: x["date"])

    # Top products (by quantity sold in range)
    prod_sold = {}
    for o in in_range:
        for item in o.get("items", []):
            pid = item.get("product_id")
            prod_sold.setdefault(pid, {"product_id": pid, "name": item.get("product_name", "-"), "image_url": item.get("image_url", ""), "qty": 0, "revenue": 0})
            prod_sold[pid]["qty"] += item.get("quantity", 0)
            prod_sold[pid]["revenue"] += item.get("subtotal", 0)
    top_products = sorted(prod_sold.values(), key=lambda x: -x["revenue"])[:5]
    for tp in top_products:
        p = pmap.get(tp["product_id"])
        if p and not tp.get("image_url"):
            tp["image_url"] = p.get("image_url", "")

    # Recent orders (last 10) — used by "Pesanan Terbaru" widget (incl cancelled, for visibility)
    recent = sorted([o for o in orders], key=lambda o: o.get("created_at", ""), reverse=True)[:10]
    recent_summary = [{
        "id": o.get("id"), "order_number": o.get("order_number"),
        "customer_name": o.get("customer_name"), "customer_phone": o.get("customer_phone"),
        "total": o.get("total", 0),
        "status": o.get("status"), "created_at": o.get("created_at"),
    } for o in recent]

    # ✅ ALL valid orders in range — used by KPI detail modals so they MATCH KPI numbers exactly
    valid_orders_summary = [{
        "id": o.get("id"), "order_number": o.get("order_number"),
        "customer_name": o.get("customer_name"), "customer_phone": o.get("customer_phone"),
        "total": o.get("total", 0),
        "status": o.get("status"), "created_at": o.get("created_at"),
    } for o in sorted(in_range, key=lambda o: o.get("created_at", ""), reverse=True)]

    # ✅ Unique customer aggregation across ALL in-range valid orders (matches kpi.unique_customers exactly)
    by_phone_in_range = {}
    for o in in_range:
        ph = (o.get("customer_phone") or "").strip()
        if not ph:
            continue
        if ph not in by_phone_in_range:
            by_phone_in_range[ph] = {"name": o.get("customer_name", "-"), "phone": ph, "orders": 0, "total": 0}
        by_phone_in_range[ph]["orders"] += 1
        by_phone_in_range[ph]["total"] += float(o.get("total") or 0)
    valid_customers_summary = sorted(by_phone_in_range.values(), key=lambda x: -x["total"])

    # Status breakdown
    status_break = {}
    for o in in_range:
        st = o.get("status", "unknown")
        status_break[st] = status_break.get(st, 0) + 1

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat(), "key": period},
        "kpi": {
            "revenue": revenue, "orders": order_count, "aov": aov,
            "unique_customers": unique_customers,
        },
        "trend": trend,
        "top_products": top_products,
        "recent_orders": recent_summary,
        "valid_orders": valid_orders_summary,           # ✅ ALL valid orders for detail modals
        "valid_customers": valid_customers_summary,      # ✅ Unique customers for detail modal
        "status_breakdown": [{"status": k, "count": v} for k, v in status_break.items()],
    }


@api_router.get("/dashboard/inventory")
async def dashboard_inventory(_auth: bool = Depends(require_seller)):
    """Inventory health: total products, low stock, OOS, stock value, movers, category breakdown."""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    orders = await db.orders.find({"status": {"$nin": ["dibatalkan"]}}, {"_id": 0}).to_list(5000)
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    low_stock_threshold = int(cfg.get("low_stock_threshold") or 10)
    # ─── Categories sync (Task 3): lookup id→name from store_config.categories ───
    cat_list = cfg.get("categories") or []
    cat_name_map = {}
    for c in cat_list:
        if isinstance(c, dict):
            cat_name_map[c.get("id", "")] = c.get("name", c.get("id", "Lainnya"))
            cat_name_map[c.get("name", "")] = c.get("name", "")

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)
    velocity = {}
    for o in orders:
        try:
            ts = datetime.fromisoformat(o.get("created_at", "").replace("Z", "+00:00"))
        except Exception:
            continue
        if ts < cutoff_30:
            continue
        for it in o.get("items", []):
            velocity[it["product_id"]] = velocity.get(it["product_id"], 0) + it.get("quantity", 0)

    total = len(products)
    low_stock = [p for p in products if 0 < p.get("stock", 0) <= low_stock_threshold]
    out_of_stock = [p for p in products if p.get("stock", 0) <= 0]
    stock_value = sum((p.get("cost_price") or p.get("price", 0)) * p.get("stock", 0) for p in products)

    top_movers = sorted(products, key=lambda p: -velocity.get(p["id"], 0))[:5]
    slow_movers = [p for p in products if velocity.get(p["id"], 0) == 0 and p.get("stock", 0) > 0]
    slow_movers = sorted(slow_movers, key=lambda p: -p.get("stock", 0))[:5]

    cat_break = {}
    for p in products:
        raw_cat = p.get("category") or "Lainnya"
        cat = cat_name_map.get(raw_cat, raw_cat)  # resolve id→name; else use as-is
        cat_break.setdefault(cat, {"category": cat, "count": 0, "stock": 0, "value": 0})
        cat_break[cat]["count"] += 1
        cat_break[cat]["stock"] += p.get("stock", 0)
        cat_break[cat]["value"] += (p.get("cost_price") or p.get("price", 0)) * p.get("stock", 0)

    def _strip(p):
        return {
            "id": p["id"], "name": p["name"], "image_url": p.get("image_url", ""),
            "stock": p.get("stock", 0), "price": p.get("price", 0),
            "cost_price": p.get("cost_price", 0), "sold_count": p.get("sold_count", 0),
            "category": p.get("category"), "velocity_30d": round(velocity.get(p["id"], 0) / 30.0, 2),
        }

    return {
        "kpi": {
            "total_products": total,
            "low_stock_count": len(low_stock),
            "out_of_stock_count": len(out_of_stock),
            "stock_value": stock_value,
            "low_stock_threshold": low_stock_threshold,
        },
        "low_stock_items": [_strip(p) for p in sorted(low_stock, key=lambda p: p.get("stock", 0))],
        "out_of_stock_items": [_strip(p) for p in out_of_stock],
        "top_movers": [_strip(p) for p in top_movers],
        "slow_movers": [_strip(p) for p in slow_movers],
        "category_breakdown": sorted(cat_break.values(), key=lambda x: -x["value"]),
    }


@api_router.get("/dashboard/sales")
async def dashboard_sales(period: str = "30d", start: Optional[str] = None, end: Optional[str] = None, _auth: bool = Depends(require_seller)):
    """Sales analytics: revenue trend, payment breakdown, category sales, best sellers, status funnel, hour heatmap."""
    s, e = _parse_period(period, start, end)
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["id"]: p for p in products}

    valid = [o for o in orders if _in_range(o.get("created_at", ""), s, e) and o.get("status") != "dibatalkan"]

    # Daily trend
    daily = {}
    cursor_dt = s
    while cursor_dt <= e:
        daily[cursor_dt.strftime("%Y-%m-%d")] = {"date": cursor_dt.strftime("%Y-%m-%d"), "revenue": 0, "orders": 0}
        cursor_dt += timedelta(days=1)
    for o in valid:
        try:
            d = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d")
            if d in daily:
                daily[d]["revenue"] += o.get("total", 0)
                daily[d]["orders"] += 1
        except Exception:
            continue
    trend = sorted(daily.values(), key=lambda x: x["date"])

    # Payment breakdown
    pay = {}
    for o in valid:
        m = o.get("payment_method", "unknown")
        pay.setdefault(m, {"method": m, "count": 0, "revenue": 0})
        pay[m]["count"] += 1
        pay[m]["revenue"] += o.get("total", 0)
    payment_breakdown = sorted(pay.values(), key=lambda x: -x["revenue"])

    # Category sales — sync nama dari store_config.categories.
    # Orphan categories (not configured) di-group jadi "Lainnya" untuk konsistensi.
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    cat_list = cfg.get("categories") or []
    valid_cat_keys = set()  # id + name of configured categories (lowercased)
    cat_name_map = {}       # raw_value (lower) → display name
    for c in cat_list:
        if isinstance(c, dict):
            cid = (c.get("id") or "").strip().lower()
            cname = c.get("name") or c.get("id") or ""
            if cid:
                valid_cat_keys.add(cid)
                cat_name_map[cid] = cname
            if cname:
                valid_cat_keys.add(cname.lower())
                cat_name_map[cname.lower()] = cname
        elif isinstance(c, str):
            valid_cat_keys.add(c.lower())
            cat_name_map[c.lower()] = c
    cat_sales = {}
    for o in valid:
        for it in o.get("items", []):
            p = pmap.get(it.get("product_id"))
            raw_cat = (p.get("category") if p else None) or ""
            raw_lower = raw_cat.strip().lower() if raw_cat else ""
            # Only include if configured; orphans → "Lainnya"
            if raw_lower and raw_lower in valid_cat_keys:
                cat = cat_name_map.get(raw_lower, raw_cat)
            else:
                cat = "Lainnya"
            cat_sales.setdefault(cat, {"category": cat, "qty": 0, "revenue": 0})
            cat_sales[cat]["qty"] += it.get("quantity", 0)
            cat_sales[cat]["revenue"] += it.get("subtotal", 0)
    category_sales = sorted(cat_sales.values(), key=lambda x: -x["revenue"])

    # Best sellers
    prod_sales = {}
    for o in valid:
        for it in o.get("items", []):
            pid = it.get("product_id")
            prod_sales.setdefault(pid, {"product_id": pid, "name": it.get("product_name", "-"), "image_url": it.get("image_url", ""), "qty": 0, "revenue": 0})
            prod_sales[pid]["qty"] += it.get("quantity", 0)
            prod_sales[pid]["revenue"] += it.get("subtotal", 0)
    best_sellers = sorted(prod_sales.values(), key=lambda x: -x["revenue"])[:10]
    for bs in best_sellers:
        p = pmap.get(bs["product_id"])
        if p and not bs.get("image_url"):
            bs["image_url"] = p.get("image_url", "")

    # Status funnel (all orders in range, incl dibatalkan)
    in_range_all = [o for o in orders if _in_range(o.get("created_at", ""), s, e)]
    funnel = {}
    for o in in_range_all:
        st = o.get("status", "unknown")
        funnel[st] = funnel.get(st, 0) + 1
    funnel_arr = [{"status": k, "count": v} for k, v in funnel.items()]

    # Hour heatmap (0..23) — only valid orders
    hours = [{"hour": h, "orders": 0, "revenue": 0} for h in range(24)]
    for o in valid:
        try:
            ts = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
            # Convert to WIB
            wib = ts + timedelta(hours=7)
            h = wib.hour
            hours[h]["orders"] += 1
            hours[h]["revenue"] += o.get("total", 0)
        except Exception:
            continue

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat(), "key": period},
        "trend": trend,
        "payment_breakdown": payment_breakdown,
        "category_sales": category_sales,
        "best_sellers": best_sellers,
        "status_funnel": funnel_arr,
        "hour_heatmap": hours,
    }


@api_router.get("/dashboard/customer")
async def dashboard_customer(period: str = "30d", start: Optional[str] = None, end: Optional[str] = None, _auth: bool = Depends(require_seller)):
    """Customer insights: unique/new/returning, top customers, acquisition trend."""
    s, e = _parse_period(period, start, end)
    orders = await db.orders.find({}, {"_id": 0}).to_list(5000)

    # Map phone → list of orders (sorted by created_at)
    by_phone = {}
    for o in orders:
        ph = (o.get("customer_phone") or "").strip()
        if not ph:
            continue
        by_phone.setdefault(ph, []).append(o)
    for ph in by_phone:
        by_phone[ph].sort(key=lambda x: x.get("created_at", ""))

    # KPI dalam range
    in_range_orders = [o for o in orders if _in_range(o.get("created_at", ""), s, e) and o.get("status") != "dibatalkan"]
    in_range_phones = {(o.get("customer_phone") or "").strip() for o in in_range_orders if o.get("customer_phone")}
    total_customers_in_range = len(in_range_phones)

    # New customers: pertama beli dalam range
    new_phones = set()
    for ph in in_range_phones:
        first = by_phone.get(ph, [])
        if first and _in_range(first[0].get("created_at", ""), s, e):
            new_phones.add(ph)

    returning_phones = in_range_phones - new_phones
    avg_orders = sum(len(by_phone.get(ph, [])) for ph in in_range_phones) / total_customers_in_range if total_customers_in_range > 0 else 0

    # Top customers (lifetime by spend, top 10) — with margin
    # Build product cost map for COGS calculation
    products_list = await db.products.find({}, {"_id": 0, "id": 1, "cost_price": 1}).to_list(5000)
    product_cost_map = {p["id"]: float(p.get("cost_price") or 0) for p in products_list}

    top_customers = []
    for ph, ords in by_phone.items():
        valid_ords = [o for o in ords if o.get("status") != "dibatalkan"]
        if not valid_ords:
            continue
        total_spent = sum(o.get("total", 0) for o in valid_ords)
        # COGS per customer = sum across all their valid orders' items
        total_cogs = 0.0
        for o in valid_ords:
            for it in (o.get("items") or []):
                pid = it.get("product_id")
                qty = float(it.get("quantity") or 0)
                cost = product_cost_map.get(pid, 0.0)
                total_cogs += cost * qty
        # Note: total_spent includes delivery_fee; margin should subtract that to reflect only product margin
        total_delivery = sum(float(o.get("delivery_fee") or 0) for o in valid_ords)
        revenue_products = total_spent - total_delivery
        margin_rp = revenue_products - total_cogs
        margin_pct = (margin_rp / revenue_products * 100) if revenue_products > 0 else 0
        last_order = max(o.get("created_at", "") for o in valid_ords)
        top_customers.append({
            "phone": ph,
            "name": valid_ords[-1].get("customer_name", "-"),
            "orders_count": len(valid_ords),
            "total_spent": total_spent,
            "total_margin": round(margin_rp, 2),
            "margin_pct": round(margin_pct, 1),
            "last_order_at": last_order,
        })
    top_customers = sorted(top_customers, key=lambda x: -x["total_spent"])[:10]

    # Daily new customer acquisition
    daily = {}
    cursor_dt = s
    while cursor_dt <= e:
        daily[cursor_dt.strftime("%Y-%m-%d")] = {"date": cursor_dt.strftime("%Y-%m-%d"), "new": 0, "returning": 0}
        cursor_dt += timedelta(days=1)
    for o in in_range_orders:
        ph = (o.get("customer_phone") or "").strip()
        if not ph:
            continue
        try:
            d = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00")).strftime("%Y-%m-%d")
        except Exception:
            continue
        if d not in daily:
            continue
        first_dt = by_phone[ph][0].get("created_at", "")
        if first_dt == o.get("created_at"):
            daily[d]["new"] += 1
        else:
            daily[d]["returning"] += 1
    acquisition = sorted(daily.values(), key=lambda x: x["date"])

    # ✅ Customers IN-RANGE — for KPI detail modals (must match kpi.total_customers exactly)
    customers_in_range_map = {}
    new_phones_set = new_phones
    for o in in_range_orders:
        ph = (o.get("customer_phone") or "").strip()
        if not ph:
            continue
        if ph not in customers_in_range_map:
            customers_in_range_map[ph] = {
                "phone": ph,
                "name": o.get("customer_name", "-"),
                "orders_count": 0,
                "total_spent": 0.0,
                "is_new": ph in new_phones_set,
                "last_order_at": o.get("created_at", ""),
            }
        c = customers_in_range_map[ph]
        c["orders_count"] += 1
        c["total_spent"] += float(o.get("total") or 0)
        if o.get("created_at", "") > c["last_order_at"]:
            c["last_order_at"] = o.get("created_at", "")
    customers_in_range = sorted(customers_in_range_map.values(), key=lambda x: -x["total_spent"])

    return {
        "period": {"start": s.isoformat(), "end": e.isoformat(), "key": period},
        "kpi": {
            "total_customers": total_customers_in_range,
            "new_customers": len(new_phones),
            "returning_customers": len(returning_phones),
            "avg_orders_per_customer": round(avg_orders, 2),
            "retention_rate": round((len(returning_phones) / total_customers_in_range * 100), 1) if total_customers_in_range > 0 else 0,
        },
        "top_customers": top_customers,                  # lifetime top 10 (with margin) for the main table
        "customers_in_range": customers_in_range,         # ✅ ALL customers in range — for KPI detail modals
        "acquisition_trend": acquisition,
    }


# ─── Reviews ─────────────────────────────────────────────────────────────────
@api_router.get("/reviews")
async def get_reviews(product_id: Optional[str] = None, order_id: Optional[str] = None):
    q = {}
    if product_id:
        q["product_id"] = product_id
    if order_id:
        q["order_id"] = order_id
    return await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api_router.post("/reviews")
async def create_review(r: ReviewCreate):
    ts = now_iso()
    doc = {"id": str(uuid.uuid4()), "created_at": ts, **r.model_dump()}
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "review_created", "data": doc})
    return doc

# ─── Financial ────────────────────────────────────────────────────────────────
@api_router.get("/financial-entries")
async def get_financial_entries():
    return await db.financial_entries.find({}, {"_id": 0}).sort("date", -1).to_list(1000)

@api_router.post("/financial-entries")
async def create_financial_entry(entry: FinancialEntryCreate, _auth: bool = Depends(require_seller)):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **entry.model_dump()}
    await db.financial_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/financial-entries/{eid}")
async def delete_financial_entry(eid: str, _auth: bool = Depends(require_seller)):
    await db.financial_entries.delete_one({"id": eid})
    return {"success": True}

# ─── Reports ──────────────────────────────────────────────────────────────────
@api_router.get("/reports/sales")
async def get_sales_report(period: str = "month"):
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=365)

    all_orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    # ✅ Filter pesanan valid (bukan dibatalkan) untuk hitung revenue
    filtered = [o for o in all_orders if o.get("created_at", "") >= start.isoformat() and o.get("status") != "dibatalkan"]

    total_rev = sum(o.get("total", 0) for o in filtered)
    total_ord = len(filtered)
    avg_ord = total_rev / total_ord if total_ord else 0

    product_sales = {}
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    # Lookup by id (primary) + name (fallback)
    pinfo_id = {p.get("id"): p for p in products}
    pinfo_name = {p.get("name"): p for p in products}
    category_sales = {}

    for order in filtered:
        for item in order.get("items", []):
            pid = item.get("product_id")
            pn = item.get("product_name", "-")
            # Resolve product: prefer id, fallback to name
            p = pinfo_id.get(pid) or pinfo_name.get(pn)
            # Use canonical name from product (if found) so renames don't fragment data
            key_name = (p.get("name") if p else pn) or "-"
            if key_name not in product_sales:
                product_sales[key_name] = {"units": 0, "revenue": 0}
            product_sales[key_name]["units"] += item.get("quantity", 0)
            product_sales[key_name]["revenue"] += item.get("subtotal", 0)
            cat = (p.get("category") if p else None) or "lainnya"
            category_sales[cat] = category_sales.get(cat, 0) + item.get("subtotal", 0)

    best_seller = max(product_sales.items(), key=lambda x: x[1]["units"])[0] if product_sales else "N/A"

    daily = {}
    for order in filtered:
        day = (order.get("created_at") or "")[:10]
        if day:
            daily[day] = daily.get(day, 0) + order.get("total", 0)

    status_counts = {}
    for order in all_orders:
        s = order.get("status", "menunggu")
        status_counts[s] = status_counts.get(s, 0) + 1

    product_perf = []
    for pn, stats in product_sales.items():
        # Resolve canonical product for stock
        p = pinfo_name.get(pn)
        product_perf.append({
            "name": pn, "units": stats["units"], "revenue": stats["revenue"],
            "stock": (p.get("stock") if p else 0),
            "pct": round(stats["revenue"] / total_rev * 100, 1) if total_rev else 0
        })
    product_perf.sort(key=lambda x: x["revenue"], reverse=True)

    return {
        "total_revenue": total_rev, "total_orders": total_ord, "avg_order": avg_ord,
        "best_seller": best_seller, "category_sales": category_sales,
        "daily_revenue": daily, "status_counts": status_counts,
        "product_performance": product_perf, "all_orders_count": len(all_orders),
    }

@api_router.get("/reports/financial")
async def get_financial_report():
    completed = await db.orders.find({"status": "selesai"}, {"_id": 0}).to_list(1000)
    total_income = sum(o.get("total", 0) for o in completed)
    total_delivery = sum(float(o.get("delivery_fee") or 0) for o in completed)
    # Product revenue = total - delivery (so margin% reflects actual product margin)
    product_revenue = total_income - total_delivery

    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    # Lookup by id (primary) and name (fallback for legacy orders)
    pmap_id = {p.get("id"): p for p in products}
    pmap_name = {p.get("name"): p for p in products}

    def lookup_product(item):
        return pmap_id.get(item.get("product_id")) or pmap_name.get(item.get("product_name"))

    total_cogs = 0
    for order in completed:
        for item in order.get("items", []):
            p = lookup_product(item)
            if p:
                total_cogs += float(p.get("cost_price") or 0) * float(item.get("quantity") or 0)

    gross_profit = product_revenue - total_cogs
    entries = await db.financial_entries.find({"type": "expense"}, {"_id": 0}).to_list(1000)
    total_expenses = sum(e["amount"] for e in entries)
    net_profit = gross_profit - total_expenses
    # Margin% computed against product revenue (excluding ongkir which is pass-through)
    margin = (net_profit / product_revenue * 100) if product_revenue > 0 else 0

    monthly = {}
    for order in completed:
        month = order.get("created_at", "")[:7]
        if not month:
            continue
        if month not in monthly:
            monthly[month] = {"income": 0, "cogs": 0, "profit": 0, "delivery": 0}
        sub = float(order.get("subtotal") or 0)
        dlv = float(order.get("delivery_fee") or 0)
        monthly[month]["income"] += sub  # produk revenue only
        monthly[month]["delivery"] += dlv
        for item in order.get("items", []):
            p = lookup_product(item)
            if p:
                monthly[month]["cogs"] += float(p.get("cost_price") or 0) * float(item.get("quantity") or 0)
    for m in monthly:
        monthly[m]["profit"] = monthly[m]["income"] - monthly[m]["cogs"]

    return {
        "total_income": total_income,
        "product_revenue": product_revenue,
        "total_delivery": total_delivery,
        "total_cogs": total_cogs,
        "gross_profit": gross_profit,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "margin": margin,
        "monthly": monthly,
        "transactions": completed[:50],
        "expense_entries": entries,
    }


# ─── Cashbook (Catatan Pemasukan per Metode Bayar) ───────────────────────────
@api_router.get("/reports/cashbook")
async def get_cashbook_report(
    start: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
    status_filter: str = Query("paid", description="'paid' = selesai+siap with proof; 'all' = all non-cancelled"),
):
    """Cashbook: catatan pemasukan dengan kolom per metode bayar (Tunai, BCA, Mandiri, QRIS, dll).
    Frontend pakai untuk reconciliation harian."""
    # Build query
    q: dict = {"status": {"$ne": "dibatalkan"}}
    if status_filter == "paid":
        # "Uang masuk" = order selesai, OR siap+diproses dengan bukti bayar terupload
        q = {"$or": [
            {"status": "selesai"},
            {"status": {"$in": ["siap", "diproses"]}, "payment_proof_url": {"$nin": [None, ""]}},
        ]}
    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lte"] = end + "T23:59:59"  # inclusive
        q["created_at"] = date_q

    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)

    # Build column list from store config
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    bank_accounts = cfg.get("bank_accounts") or []
    payment_methods = cfg.get("payment_methods") or []

    columns = [{"key": "tunai", "label": "💵 Tunai", "type": "cash"}]
    # Add a column per bank account
    for b in bank_accounts:
        if not isinstance(b, dict):
            continue
        bid = b.get("id")
        if not bid:
            continue
        bank_name = b.get("bank") or b.get("bank_name") or "Bank"
        bank_num = b.get("number") or b.get("account_number") or ""
        label = f"🏦 {bank_name}"
        if bank_num:
            label += f" · {bank_num[-4:]}"  # last 4 digits for compactness
        columns.append({"key": f"bank:{bid}", "label": label, "type": "bank", "bank_id": bid, "bank_name": bank_name, "bank_number": bank_num})

    # Detect if any orders used QRIS / pay_later — add columns conditionally
    has_qris = False
    has_later = False
    for o in orders:
        pm = (o.get("payment_method") or "").lower()
        if pm == "qris":
            has_qris = True
        elif pm == "pay_later" or pm == "later":
            has_later = True
        # Also check payment_method configured as type qris
        pm_cfg = next((p for p in payment_methods if p.get("id") == pm), None)
        if pm_cfg and pm_cfg.get("type") == "qris":
            has_qris = True
    if has_qris:
        columns.append({"key": "qris", "label": "📱 QRIS", "type": "qris"})
    if has_later:
        columns.append({"key": "later", "label": "🕒 Bayar Nanti", "type": "later"})

    # Always include "lainnya" at the end (placeholder for unknown payment methods)
    columns.append({"key": "lainnya", "label": "❓ Lainnya", "type": "other"})

    # Resolve each order to a column_key
    def resolve_column(order: dict) -> str:
        pm_id = (order.get("payment_method") or "").lower()
        pm_bank_id = order.get("payment_method_id") or order.get("payment_bank_id") or ""
        # Bank transfer with bank_id
        if pm_id == "transfer" and pm_bank_id:
            for c in columns:
                if c.get("bank_id") == pm_bank_id:
                    return c["key"]
        # Check by payment method config type
        pm_cfg = next((p for p in payment_methods if p.get("id") == pm_id), None)
        pm_type = (pm_cfg.get("type") if pm_cfg else pm_id) or ""
        pm_type = pm_type.lower()
        if pm_type in ("cod", "cash") or pm_id in ("cod", "cash", "tunai"):
            return "tunai"
        if pm_type == "qris" or pm_id == "qris":
            return "qris"
        if pm_id in ("pay_later", "later"):
            return "later"
        return "lainnya"

    # Build rows
    rows = []
    totals = {c["key"]: 0 for c in columns}
    for o in orders:
        col_key = resolve_column(o)
        if col_key not in totals:
            col_key = "lainnya"
        amount = float(o.get("total") or 0)
        totals[col_key] += amount
        rows.append({
            "order_id": o.get("id"),
            "order_number": o.get("order_number") or "",
            "date": (o.get("created_at") or "")[:10],
            "datetime": o.get("created_at") or "",
            "customer_name": o.get("customer_name") or "-",
            "customer_phone": o.get("customer_phone") or "",
            "status": o.get("status"),
            "amount": amount,
            "column_key": col_key,
            "payment_method": o.get("payment_method") or "",
        })

    # Remove columns with zero total (except keep 'tunai' as it's always meaningful)
    columns_with_data = [c for c in columns if c["key"] == "tunai" or totals.get(c["key"], 0) > 0]
    # Also keep all bank columns even if zero (for consistency / future use)
    columns_with_data = [c for c in columns if c["type"] in ("cash", "bank") or totals.get(c["key"], 0) > 0]

    grand_total = sum(totals.values())

    return {
        "columns": columns_with_data,
        "rows": rows,
        "totals": {c["key"]: totals.get(c["key"], 0) for c in columns_with_data},
        "grand_total": grand_total,
        "row_count": len(rows),
        "filter": {"start": start, "end": end, "status_filter": status_filter},
    }

# ─── Media Upload ────────────────────────────────────────────────────────────
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB

@api_router.post("/media/upload")
async def media_upload(file: UploadFile = File(...), _auth: bool = Depends(require_seller)):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Format tidak didukung. Gunakan JPG/PNG/WEBP/GIF.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"Ukuran maksimal 5 MB. File kamu {round(len(data)/1024/1024,1)} MB.")
    import base64
    mid = str(uuid.uuid4())
    await db.media.insert_one({
        "id": mid,
        "filename": file.filename or "upload",
        "content_type": file.content_type,
        "size": len(data),
        "data_b64": base64.b64encode(data).decode("ascii"),
        "created_at": now_iso(),
    })
    # Build public URL
    return {"id": mid, "url": f"/api/media/{mid}", "size": len(data), "content_type": file.content_type}

@api_router.post("/media/upload-proof")
async def media_upload_proof(file: UploadFile = File(...)):
    """Public endpoint untuk buyer upload bukti bayar (.jpg/.png/.webp). Tidak butuh auth — image-only, size-limited, tagged sebagai 'proof' untuk audit."""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, "Format tidak didukung. Gunakan JPG/PNG/WEBP.")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, f"Ukuran maksimal 5 MB. File kamu {round(len(data)/1024/1024,1)} MB.")
    import base64
    mid = str(uuid.uuid4())
    await db.media.insert_one({
        "id": mid,
        "filename": file.filename or "proof",
        "content_type": file.content_type,
        "size": len(data),
        "data_b64": base64.b64encode(data).decode("ascii"),
        "kind": "proof",
        "created_at": now_iso(),
    })
    return {"id": mid, "url": f"/api/media/{mid}", "size": len(data), "content_type": file.content_type}

@api_router.get("/media/{mid}")
async def media_get(mid: str):
    doc = await db.media.find_one({"id": mid})
    if not doc:
        raise HTTPException(404, "Not found")
    import base64
    data = base64.b64decode(doc["data_b64"])
    return Response(
        content=data,
        media_type=doc.get("content_type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=31536000"},
    )

# ─── Root ────────────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Ciltarasa API is running", "version": SCHEMA_VERSION}

# ─── Maintenance: scan & fix orphan product categories ───────────────────────
@api_router.get("/admin/categories/orphans")
async def list_orphan_categories(_auth: bool = Depends(require_seller)):
    """List products whose category isn't defined in store_config.categories."""
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    cat_list = cfg.get("categories") or []
    valid = set()
    for c in cat_list:
        if isinstance(c, dict):
            if c.get("id"): valid.add(c["id"].strip().lower())
            if c.get("name"): valid.add(c["name"].strip().lower())
        elif isinstance(c, str):
            valid.add(c.strip().lower())
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "category": 1}).to_list(1000)
    orphans = []
    for p in products:
        raw = (p.get("category") or "").strip().lower()
        if raw and raw not in valid:
            orphans.append({"id": p.get("id"), "name": p.get("name"), "category": p.get("category")})
    return {"orphans": orphans, "count": len(orphans), "valid_categories": sorted(valid)}

@api_router.post("/admin/categories/fix-orphans")
async def fix_orphan_categories(_auth: bool = Depends(require_seller)):
    """Reset orphan-category products to 'Lainnya'."""
    cfg = await db.store_config.find_one({"_id": "main"}) or {}
    cat_list = cfg.get("categories") or []
    valid = set()
    for c in cat_list:
        if isinstance(c, dict):
            if c.get("id"): valid.add(c["id"].strip().lower())
            if c.get("name"): valid.add(c["name"].strip().lower())
        elif isinstance(c, str):
            valid.add(c.strip().lower())
    products = await db.products.find({}, {"_id": 0, "id": 1, "category": 1}).to_list(1000)
    fixed = 0
    for p in products:
        raw = (p.get("category") or "").strip().lower()
        if raw and raw not in valid:
            await db.products.update_one({"id": p["id"]}, {"$set": {"category": "Lainnya"}})
            fixed += 1
    return {"fixed": fixed, "valid_categories": sorted(valid)}

# ─── WebSocket ───────────────────────────────────────────────────────────────
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# ─── App Setup ───────────────────────────────────────────────────────────────
# ─── Modular routes (FASE 6) — register endpoints sebelum app.include_router ───
from routes import maintenance as maintenance_route
from routes import ai_insights as ai_insights_route
from routes import buyer_chat as buyer_chat_route
from routes import seller_chat as seller_chat_route
maintenance_route.setup(api_router, db, require_seller, manager)
ai_insights_route.setup(api_router, db, require_seller)
buyer_chat_route.setup(api_router)
seller_chat_route.setup(api_router, require_seller)

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await seed_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
