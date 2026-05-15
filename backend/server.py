from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
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
SCHEMA_VERSION = "v2.1.1"

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
    "seller_whatsapp": "6281912853950",
    "store_name": "Ciltarasa",
    "auto_whatsapp": True,
    "message_template": "PESANAN BARU - Ciltarasa\n\nOrder ID: #{order_id}\nPelanggan: {customer_name}\nNo. HP: {customer_phone}\nAlamat: {customer_address}\n\nDetail Pesanan:\n{items_detail}\n\nTotal: Rp {total}\nCatatan: {notes}\n\nSilakan konfirmasi pesanan ini di dashboard Ciltarasa."
}

DEFAULT_STORE_CONFIG = {
    "_id": "main",
    "name": "Ciltarasa",
    "logo_url": "",
    "tagline": "Frozen Food Premium • Malang",
    "whatsapp": "6281912853950",
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
    }
}

DEFAULT_DISCOUNTS = [
    {"id": str(uuid.uuid4()), "name": "Promo Bulan Ini", "type": "percent", "value": 10, "product_ids": [], "active": True, "starts_at": None, "ends_at": None, "is_flash_sale": False, "created_at": now_iso()},
]


async def seed_database():
    """Seed DB and reset if SCHEMA_VERSION changed."""
    meta = await db.system_meta.find_one({"_id": "schema"})
    if not meta or meta.get("version") != SCHEMA_VERSION:
        logger.info(f"Schema version mismatch ({meta.get('version') if meta else 'none'} → {SCHEMA_VERSION}). Resetting DB.")
        for c in ["products", "orders", "settings", "financial_entries", "store_config", "discounts", "reviews", "users"]:
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
    # Simulated: OTP is always 123456
    ts = now_iso()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    await db.users.update_one(
        {"phone": phone},
        {"$set": {"otp_code": "123456", "otp_expires_at": expires, "updated_at": ts},
         "$setOnInsert": {"id": str(uuid.uuid4()), "phone": phone, "name": req.name or "", "verified": False, "created_at": ts}},
        upsert=True
    )
    return {"success": True, "phone": phone, "demo_otp": "123456", "message": "OTP terkirim via WhatsApp (simulasi). Gunakan kode 123456."}

@api_router.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify):
    phone = normalize_phone(req.phone)
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(404, "Nomor HP belum terdaftar. Silakan request OTP dulu.")
    if req.otp != "123456":
        raise HTTPException(400, "Kode OTP salah. Gunakan 123456 (simulasi).")
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
async def create_product(p: ProductCreate):
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
async def update_product(pid: str, update: ProductUpdate):
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
async def delete_product(pid: str):
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
    return doc

@api_router.put("/orders/{oid}/status")
async def update_order_status(oid: str, update: OrderStatusUpdate):
    ts = now_iso()
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    status_ts = order.get("status_timestamps", {})
    status_ts[update.status] = ts
    await db.orders.update_one({"id": oid}, {"$set": {"status": update.status, "status_timestamps": status_ts, "updated_at": ts}})
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    await manager.broadcast({"type": "order_updated", "data": doc})
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
async def update_settings(update: SettingsUpdate):
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
async def update_store_config(update: StoreConfigUpdate):
    upd = update.model_dump(exclude_unset=True)
    upd["updated_at"] = now_iso()
    await db.store_config.update_one({"_id": "main"}, {"$set": upd}, upsert=True)
    s = await db.store_config.find_one({"_id": "main"}, {"_id": 0})
    await manager.broadcast({"type": "store_config_updated", "data": s})
    return s

# ─── Discounts ───────────────────────────────────────────────────────────────
@api_router.get("/discounts")
async def get_discounts():
    return await db.discounts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.post("/discounts")
async def create_discount(d: DiscountCreate):
    ts = now_iso()
    doc = {"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts, **d.model_dump()}
    await db.discounts.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "discount_updated", "data": doc})
    return doc

@api_router.put("/discounts/{did}")
async def update_discount(did: str, update: DiscountUpdate):
    upd = update.model_dump(exclude_unset=True)
    upd["updated_at"] = now_iso()
    await db.discounts.update_one({"id": did}, {"$set": upd})
    doc = await db.discounts.find_one({"id": did}, {"_id": 0})
    await manager.broadcast({"type": "discount_updated", "data": doc})
    return doc

@api_router.delete("/discounts/{did}")
async def delete_discount(did: str):
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
async def create_financial_entry(entry: FinancialEntryCreate):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **entry.model_dump()}
    await db.financial_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/financial-entries/{eid}")
async def delete_financial_entry(eid: str):
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
