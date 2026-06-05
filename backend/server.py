from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Header, Depends, UploadFile, File
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
APP_URL = os.environ.get("APP_URL", "")

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
    sc = await db.store_config.find_one({"_id": "main"}, {"_id": 0})
    if not sc:
        return None, None, False
    return sc.get("fonnte_token"), sc.get("seller_notify_phone"), sc.get("wa_notif_enabled", True)

async def fonnte_send(target: str, message: str) -> Dict[str, Any]:
    """Send WhatsApp message via Fonnte API. Returns {ok, status, response}."""
    token, _, enabled = await get_fonnte_config()
    if not enabled:
        return {"ok": False, "skipped": True, "reason": "WA notif disabled in config"}
    if not token:
        return {"ok": False, "skipped": True, "reason": "Fonnte token not set"}
    target = normalize_phone(target)
    if not target or len(target) < 10:
        return {"ok": False, "skipped": True, "reason": "Invalid target phone"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                FONNTE_URL,
                headers={"Authorization": token},
                data={"target": target, "message": message, "countryCode": "62"},
            )
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            status_val = data.get("status", True)
            ok = r.status_code == 200 and status_val not in (False, "false", "False", 0, "0")
            return {"ok": ok, "status": r.status_code, "response": data}
    except Exception as e:
        logger.warning(f"Fonnte send failed to {target}: {e}")
        return {"ok": False, "error": str(e)}

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
    how_to_order_steps: Optional[List[Dict[str, Any]]] = None
    fonnte_token: Optional[str] = None
    seller_notify_phone: Optional[str] = None
    wa_notif_enabled: Optional[bool] = None
    low_stock_threshold: Optional[int] = None
    restock_safety_days: Optional[int] = None
    qris_image_url: Optional[str] = None
    payment_texts: Optional[Dict[str, str]] = None

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
    "seller_whatsapp": "6285249682337",
    "store_name": "Ciltarasa",
    "auto_whatsapp": True,
    "message_template": "PESANAN BARU - Ciltarasa\n\nOrder ID: #{order_id}\nPelanggan: {customer_name}\nNo. HP: {customer_phone}\nAlamat: {customer_address}\n\nDetail Pesanan:\n{items_detail}\n\nTotal: Rp {total}\nCatatan: {notes}\n\nSilakan konfirmasi pesanan ini di dashboard Ciltarasa."
}

DEFAULT_STORE_CONFIG = {
    "_id": "main",
    "name": "Ciltarasa",
    "logo_url": "",
    "tagline": "Frozen Food Premium • Malang",
    "whatsapp": "6285249682337",
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
    "fonnte_token": "QyMJ55FmqmLQGUxmwsBw",
    "seller_notify_phone": "6285249682337",
    "wa_notif_enabled": True,
    "low_stock_threshold": 10,
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
        if backfill:
            await db.store_config.update_one({"_id": "main"}, {"$set": backfill})
            logger.info(f"Backfilled store_config: {list(backfill.keys())}")

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
    onum = await next_order_number()
    data = order.model_dump()
    data["customer_phone"] = normalize_phone(data["customer_phone"])
    doc = {
        "id": str(uuid.uuid4()), "order_number": onum,
        "status": "menunggu", "status_timestamps": {"menunggu": ts},
        "received": False,
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
    # WA notif to seller
    _, seller_phone, enabled = await get_fonnte_config()
    wa_sent = False
    wa_reason = None
    if enabled and seller_phone:
        res = await fonnte_send(seller_phone, build_seller_order_message(doc))
        wa_sent = res.get("ok", False)
        wa_reason = res.get("reason") or res.get("error") or (res.get("response") or {}).get("reason")
        if not wa_sent:
            logger.warning(f"WA seller notif failed for order {doc.get('order_number')}: {res}")
    elif not enabled:
        wa_reason = "WA notif disabled in config"
    elif not seller_phone:
        wa_reason = "seller_notify_phone empty in store_config"
    doc["_wa_seller_sent"] = wa_sent
    if wa_reason:
        doc["_wa_seller_reason"] = wa_reason
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
    # WA notif to buyer
    wa_sent = False
    wa_reason = None
    if new_status in STATUS_DESC and doc.get("customer_phone"):
        _, _, enabled = await get_fonnte_config()
        if enabled:
            res = await fonnte_send(doc["customer_phone"], build_buyer_status_message(doc, APP_URL))
            wa_sent = res.get("ok", False)
            wa_reason = res.get("reason") or res.get("error") or (res.get("response") or {}).get("reason")
    doc["_wa_buyer_sent"] = wa_sent
    if wa_reason:
        doc["_wa_buyer_reason"] = wa_reason
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
    return s or {}

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
    if not ua: return "unknown"
    u = ua.lower()
    if "iphone" in u or "ipad" in u or "ipod" in u: return "ios"
    if "android" in u: return "android"
    if "windows" in u or "macintosh" in u or "linux" in u: return "desktop"
    return "other"

def parse_referrer_source(ref: str) -> str:
    if not ref: return "direct"
    try:
        from urllib.parse import urlparse
        host = urlparse(ref).netloc.lower()
        if not host: return "direct"
        if "google" in host: return "google"
        if "instagram" in host or "ig" in host: return "instagram"
        if "facebook" in host or "fb.com" in host: return "facebook"
        if "tiktok" in host: return "tiktok"
        if "whatsapp" in host or "wa.me" in host: return "whatsapp"
        if "shopee" in host: return "shopee"
        if "ciltarasa" in host: return "internal"
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
    filtered = [o for o in all_orders if o.get("created_at", "") >= start.isoformat() and o.get("status") != "dibatalkan"]

    total_rev = sum(o["total"] for o in filtered)
    total_ord = len(filtered)
    avg_ord = total_rev / total_ord if total_ord else 0

    product_sales = {}
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pcat = {p["name"]: p["category"] for p in products}
    pstock = {p["name"]: p["stock"] for p in products}
    category_sales = {}

    for order in filtered:
        for item in order.get("items", []):
            pn = item["product_name"]
            if pn not in product_sales:
                product_sales[pn] = {"units": 0, "revenue": 0}
            product_sales[pn]["units"] += item["quantity"]
            product_sales[pn]["revenue"] += item["subtotal"]
            cat = pcat.get(pn, "lainnya")
            category_sales[cat] = category_sales.get(cat, 0) + item["subtotal"]

    best_seller = max(product_sales.items(), key=lambda x: x[1]["units"])[0] if product_sales else "N/A"

    daily = {}
    for order in filtered:
        day = order["created_at"][:10]
        daily[day] = daily.get(day, 0) + order["total"]

    status_counts = {}
    for order in all_orders:
        s = order.get("status", "menunggu")
        status_counts[s] = status_counts.get(s, 0) + 1

    product_perf = []
    for pn, stats in product_sales.items():
        product_perf.append({
            "name": pn, "units": stats["units"], "revenue": stats["revenue"],
            "stock": pstock.get(pn, 0),
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
    total_income = sum(o["total"] for o in completed)

    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    pmap = {p["name"]: p for p in products}
    total_cogs = 0
    for order in completed:
        for item in order.get("items", []):
            p = pmap.get(item["product_name"])
            if p:
                total_cogs += p.get("cost_price", 0) * item["quantity"]

    gross_profit = total_income - total_cogs
    entries = await db.financial_entries.find({"type": "expense"}, {"_id": 0}).to_list(1000)
    total_expenses = sum(e["amount"] for e in entries)
    net_profit = gross_profit - total_expenses
    margin = (net_profit / total_income * 100) if total_income > 0 else 0

    monthly = {}
    for order in completed:
        month = order["created_at"][:7]
        if month not in monthly:
            monthly[month] = {"income": 0, "cogs": 0, "profit": 0}
        monthly[month]["income"] += order["total"]
        for item in order.get("items", []):
            p = pmap.get(item["product_name"])
            if p:
                monthly[month]["cogs"] += p.get("cost_price", 0) * item["quantity"]
    for m in monthly:
        monthly[m]["profit"] = monthly[m]["income"] - monthly[m]["cogs"]

    return {
        "total_income": total_income, "total_cogs": total_cogs,
        "gross_profit": gross_profit, "total_expenses": total_expenses,
        "net_profit": net_profit, "margin": margin,
        "monthly": monthly, "transactions": completed[:50],
        "expense_entries": entries,
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
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
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
