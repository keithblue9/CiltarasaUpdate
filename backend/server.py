from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
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

# ─── WebSocket Manager ───────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WS connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_text(json.dumps(message))
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

manager = ConnectionManager()

# ─── Pydantic Models ─────────────────────────────────────────────────────────
class OrderItemModel(BaseModel):
    product_id: str
    product_name: str
    price: float
    quantity: int
    subtotal: float

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    cost_price: float = 0
    category: str
    stock: int
    active: bool = True
    image_url: str = ""

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost_price: Optional[float] = None
    category: Optional[str] = None
    stock: Optional[int] = None
    active: Optional[bool] = None
    image_url: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_address: str = ""
    delivery_method: str
    items: List[OrderItemModel]
    subtotal: float
    total: float
    notes: str = ""
    payment_method: str

class OrderStatusUpdate(BaseModel):
    status: str

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

# ─── Helpers ─────────────────────────────────────────────────────────────────
def now_iso():
    return datetime.now(timezone.utc).isoformat()

async def next_order_number():
    count = await db.orders.count_documents({})
    return f"ORD-{str(count + 1).zfill(3)}"

# ─── Default Data ─────────────────────────────────────────────────────────────
DEFAULT_PRODUCTS = [
    {"name": "Risoles Frozen (isi 10)", "description": "Risoles renyah dengan isi ragout sayur dan telur, dibalut tepung roti sempurna.", "price": 35000, "cost_price": 18000, "category": "snack", "stock": 50, "active": True, "image_url": "https://picsum.photos/seed/risoles/400/300"},
    {"name": "Lumpia Frozen (isi 10)", "description": "Lumpia isi rebung dan ayam, kulit crispy khas Semarang.", "price": 30000, "cost_price": 15000, "category": "snack", "stock": 40, "active": True, "image_url": "https://picsum.photos/seed/lumpia/400/300"},
    {"name": "Pastel Frozen (isi 10)", "description": "Pastel goreng isi wortel, kentang, dan telur puyuh.", "price": 28000, "cost_price": 14000, "category": "snack", "stock": 35, "active": True, "image_url": "https://picsum.photos/seed/pastel/400/300"},
    {"name": "Cireng Frozen (isi 15)", "description": "Cireng aci goreng bumbu rujak pedas manis, camilan khas Bandung.", "price": 20000, "cost_price": 9000, "category": "snack", "stock": 60, "active": True, "image_url": "https://picsum.photos/seed/cireng/400/300"},
    {"name": "Tahu Isi Frozen (isi 10)", "description": "Tahu goreng berisi sayur segar, mudah digoreng langsung dari freezer.", "price": 25000, "cost_price": 12000, "category": "snack", "stock": 45, "active": True, "image_url": "https://picsum.photos/seed/tahu/400/300"},
    {"name": "Nugget Ayam Homemade (250gr)", "description": "Nugget ayam kampung homemade tanpa pengawet, crispy di luar lembut di dalam.", "price": 40000, "cost_price": 22000, "category": "snack", "stock": 30, "active": True, "image_url": "https://picsum.photos/seed/nugget/400/300"},
    {"name": "Siomay Frozen (isi 10)", "description": "Siomay ikan tenggiri asli Bandung, nikmati dengan bumbu kacang.", "price": 32000, "cost_price": 17000, "category": "snack", "stock": 25, "active": True, "image_url": "https://picsum.photos/seed/siomay/400/300"},
    {"name": "Bakwan Frozen (isi 10)", "description": "Bakwan jagung manis dan sayur, goreng langsung dari freezer.", "price": 22000, "cost_price": 10000, "category": "snack", "stock": 55, "active": True, "image_url": "https://picsum.photos/seed/bakwan/400/300"},
    {"name": "Bebek Utuh Pawon Ayu", "description": "Bebek utuh asap Pawon Ayu, bumbu rempah khas Malang, tinggal goreng atau panggang.", "price": 85000, "cost_price": 50000, "category": "bebek", "stock": 20, "active": True, "image_url": "https://picsum.photos/seed/bebek1/400/300"},
    {"name": "Setengah Bebek Pawon Ayu", "description": "Setengah ekor bebek asap Pawon Ayu, porsi pas untuk 2 orang.", "price": 45000, "cost_price": 28000, "category": "bebek", "stock": 25, "active": True, "image_url": "https://picsum.photos/seed/bebek2/400/300"},
    {"name": "Bebek Potongan Paha (2pcs)", "description": "Paha bebek asap Pawon Ayu 2 potong, bumbu meresap sempurna.", "price": 35000, "cost_price": 20000, "category": "bebek", "stock": 30, "active": True, "image_url": "https://picsum.photos/seed/bebek3/400/300"},
    {"name": "Paket Bebek Keluarga (2 ekor)", "description": "2 ekor bebek asap Pawon Ayu, cocok untuk keluarga atau acara spesial.", "price": 160000, "cost_price": 95000, "category": "bebek", "stock": 10, "active": True, "image_url": "https://picsum.photos/seed/bebek4/400/300"},
]

DEFAULT_SETTINGS = {
    "seller_whatsapp": "6285249682337",
    "store_name": "Ciltarasa",
    "auto_whatsapp": True,
    "message_template": "PESANAN BARU - Ciltarasa\n\nOrder ID: #{order_id}\nPelanggan: {customer_name}\nNo. HP: {customer_phone}\nAlamat: {customer_address}\n\nDetail Pesanan:\n{items_detail}\n\nTotal: Rp {total}\nCatatan: {notes}\n\nSilakan konfirmasi pesanan ini di dashboard Ciltarasa."
}

async def seed_database():
    if await db.products.count_documents({}) == 0:
        ts = now_iso()
        for p in DEFAULT_PRODUCTS:
            await db.products.insert_one({"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts, **p})
        logger.info(f"Seeded {len(DEFAULT_PRODUCTS)} products")

    if await db.settings.count_documents({}) == 0:
        await db.settings.insert_one({"_id": "main", **DEFAULT_SETTINGS})
        logger.info("Seeded settings")

    if await db.orders.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(100)
        pmap = {p["name"]: p["id"] for p in products}
        now = datetime.now(timezone.utc)

        sample_orders = [
            {
                "customer_name": "Siti Rahayu", "customer_phone": "081234567890",
                "customer_address": "Jl. Kawi No. 15, Malang", "delivery_method": "delivery",
                "items": [{"product_name": "Risoles Frozen (isi 10)", "price": 35000, "quantity": 2, "subtotal": 70000},
                          {"product_name": "Lumpia Frozen (isi 10)", "price": 30000, "quantity": 1, "subtotal": 30000}],
                "subtotal": 100000, "total": 100000, "notes": "Tolong packing rapi ya",
                "payment_method": "transfer", "status": "menunggu", "days_ago": 0
            },
            {
                "customer_name": "Budi Santoso", "customer_phone": "082345678901",
                "customer_address": "Jl. Ijen No. 8, Malang", "delivery_method": "delivery",
                "items": [{"product_name": "Bebek Utuh Pawon Ayu", "price": 85000, "quantity": 1, "subtotal": 85000},
                          {"product_name": "Cireng Frozen (isi 15)", "price": 20000, "quantity": 2, "subtotal": 40000}],
                "subtotal": 125000, "total": 125000, "notes": "",
                "payment_method": "cod", "status": "diproses", "days_ago": 1
            },
            {
                "customer_name": "Dewi Lestari", "customer_phone": "083456789012",
                "customer_address": "Jl. Sulfat No. 22, Malang", "delivery_method": "pickup",
                "items": [{"product_name": "Paket Bebek Keluarga (2 ekor)", "price": 160000, "quantity": 1, "subtotal": 160000}],
                "subtotal": 160000, "total": 160000, "notes": "Ambil jam 4 sore",
                "payment_method": "qris", "status": "siap", "days_ago": 2
            },
            {
                "customer_name": "Ahmad Fauzi", "customer_phone": "084567890123",
                "customer_address": "Jl. Simpang Balapan No. 5, Malang", "delivery_method": "delivery",
                "items": [{"product_name": "Nugget Ayam Homemade (250gr)", "price": 40000, "quantity": 3, "subtotal": 120000},
                          {"product_name": "Tahu Isi Frozen (isi 10)", "price": 25000, "quantity": 2, "subtotal": 50000}],
                "subtotal": 170000, "total": 170000, "notes": "",
                "payment_method": "transfer", "status": "selesai", "days_ago": 3
            },
            {
                "customer_name": "Rina Wati", "customer_phone": "085678901234",
                "customer_address": "Jl. Arjuno No. 11, Malang", "delivery_method": "delivery",
                "items": [{"product_name": "Siomay Frozen (isi 10)", "price": 32000, "quantity": 1, "subtotal": 32000}],
                "subtotal": 32000, "total": 32000, "notes": "Stok masih ada?",
                "payment_method": "cod", "status": "dibatalkan", "days_ago": 4
            },
        ]

        for i, o in enumerate(sample_orders):
            order_dt = now - timedelta(days=o["days_ago"])
            order_ts = order_dt.isoformat()
            items = [{"product_id": pmap.get(item["product_name"], ""), **item} for item in o["items"]]
            s = o["status"]
            status_ts = {"menunggu": order_ts}
            prog = ["menunggu", "diproses", "siap", "selesai"]
            if s in prog:
                for st in prog:
                    status_ts[st] = order_ts
                    if st == s:
                        break
            if s == "dibatalkan":
                status_ts["dibatalkan"] = order_ts

            await db.orders.insert_one({
                "id": str(uuid.uuid4()), "order_number": f"ORD-{str(i+1).zfill(3)}",
                "customer_name": o["customer_name"], "customer_phone": o["customer_phone"],
                "customer_address": o["customer_address"], "delivery_method": o["delivery_method"],
                "items": items, "subtotal": o["subtotal"], "total": o["total"],
                "notes": o["notes"], "payment_method": o["payment_method"],
                "status": s, "status_timestamps": status_ts,
                "created_at": order_ts, "updated_at": order_ts
            })
        logger.info("Seeded 5 sample orders")

# ─── Product Endpoints ────────────────────────────────────────────────────────
@api_router.get("/products")
async def get_products():
    return await db.products.find({}, {"_id": 0}).to_list(1000)

@api_router.post("/products")
async def create_product(p: ProductCreate):
    ts = now_iso()
    doc = {"id": str(uuid.uuid4()), "created_at": ts, "updated_at": ts, **p.model_dump()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast({"type": "product_updated", "data": doc})
    return doc

@api_router.put("/products/{pid}")
async def update_product(pid: str, update: ProductUpdate):
    upd = update.model_dump(exclude_unset=True)
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
async def get_orders(status: Optional[str] = None):
    query = {} if not status else {"status": status}
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/orders/track")
async def track_orders(order_id: Optional[str] = None, phone: Optional[str] = None):
    if order_id:
        query = {"$or": [{"id": order_id}, {"order_number": order_id.upper()}]}
    elif phone:
        query = {"customer_phone": phone}
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
    doc = {
        "id": str(uuid.uuid4()), "order_number": onum,
        "status": "menunggu", "status_timestamps": {"menunggu": ts},
        "created_at": ts, "updated_at": ts,
        **order.model_dump()
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    for item in order.items:
        if item.product_id:
            await db.products.update_one({"id": item.product_id}, {"$inc": {"stock": -item.quantity}})
    await manager.broadcast({"type": "order_created", "data": doc})
    return doc

@api_router.put("/orders/{oid}/status")
async def update_order_status(oid: str, update: OrderStatusUpdate):
    ts = now_iso()
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        return {"error": "Not found"}
    status_ts = order.get("status_timestamps", {})
    status_ts[update.status] = ts
    await db.orders.update_one({"id": oid}, {"$set": {"status": update.status, "status_timestamps": status_ts, "updated_at": ts}})
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    await manager.broadcast({"type": "order_updated", "data": doc})
    return doc

# ─── Settings Endpoints ───────────────────────────────────────────────────────
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

# ─── Financial Endpoints ──────────────────────────────────────────────────────
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
    category_sales = {"snack": 0, "bebek": 0}

    for order in filtered:
        for item in order.get("items", []):
            pn = item["product_name"]
            if pn not in product_sales:
                product_sales[pn] = {"units": 0, "revenue": 0}
            product_sales[pn]["units"] += item["quantity"]
            product_sales[pn]["revenue"] += item["subtotal"]
            cat = pcat.get(pn, "snack")
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

# ─── Root & Health ────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Ciltarasa API is running"}

# ─── WebSocket ────────────────────────────────────────────────────────────────
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

# ─── App Setup ────────────────────────────────────────────────────────────────
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
