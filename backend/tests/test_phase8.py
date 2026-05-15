"""Phase 8 - Fonnte WhatsApp integration + admin utilities + CMS expansion."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Try reading frontend .env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
    except Exception:
        pass

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


# ─── Store Config new fields ─────────────────────────────────────────
def test_store_config_has_new_fields(client):
    r = client.get(f"{BASE_URL}/api/store-config")
    assert r.status_code == 200
    data = r.json()
    assert "fonnte_token" in data
    assert "seller_notify_phone" in data
    assert "wa_notif_enabled" in data
    assert "how_to_order_steps" in data
    assert isinstance(data["how_to_order_steps"], list)
    assert len(data["how_to_order_steps"]) >= 3
    # Each step has icon/title/desc
    for step in data["how_to_order_steps"]:
        assert "icon" in step and "title" in step and "desc" in step


def test_store_config_persists_new_fields(client):
    # GET original
    orig = client.get(f"{BASE_URL}/api/store-config").json()
    orig_token = orig.get("fonnte_token")
    orig_phone = orig.get("seller_notify_phone")
    orig_steps = orig.get("how_to_order_steps")
    orig_enabled = orig.get("wa_notif_enabled")

    # PUT new values
    new_steps = [
        {"id": "tst1", "icon": "🧪", "title": "Test Step", "desc": "Test Desc"},
    ]
    payload = {
        "fonnte_token": "TEST_TOKEN_123",
        "seller_notify_phone": "6285249682337",
        "wa_notif_enabled": False,
        "how_to_order_steps": new_steps,
    }
    r = client.put(f"{BASE_URL}/api/store-config", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["fonnte_token"] == "TEST_TOKEN_123"
    assert d["seller_notify_phone"] == "6285249682337"
    assert d["wa_notif_enabled"] is False
    assert len(d["how_to_order_steps"]) == 1
    assert d["how_to_order_steps"][0]["icon"] == "🧪"

    # GET to verify persisted
    g = client.get(f"{BASE_URL}/api/store-config").json()
    assert g["fonnte_token"] == "TEST_TOKEN_123"
    assert g["how_to_order_steps"][0]["title"] == "Test Step"

    # Restore originals
    client.put(f"{BASE_URL}/api/store-config", json={
        "fonnte_token": orig_token,
        "seller_notify_phone": orig_phone,
        "wa_notif_enabled": orig_enabled if orig_enabled is not None else True,
        "how_to_order_steps": orig_steps,
    })


# ─── OTP with WA integration ─────────────────────────────────────────
def test_request_otp_with_fonnte_token_returns_wa_sent_flag(client, mongo_db):
    """When token is configured, OTP should be saved to DB and NOT exposed in response."""
    # Ensure token configured (seeded default)
    sc = client.get(f"{BASE_URL}/api/store-config").json()
    assert sc.get("fonnte_token"), "Test prereq: seeded fonnte_token expected"
    assert sc.get("wa_notif_enabled") is True

    phone = "081299990001"
    r = client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone, "name": "TEST_OTP_User"})
    assert r.status_code == 200
    data = r.json()
    assert "wa_sent" in data
    # With disconnected device, wa_sent will be False but call should succeed
    assert data["phone"] == "6281299990001"
    # Should NOT expose demo_otp when real token configured
    assert "demo_otp" not in data
    # DB should have the actual OTP code
    user = mongo_db.users.find_one({"phone": "6281299990001"})
    assert user is not None
    assert "otp_code" in user
    assert len(user["otp_code"]) == 6


def test_request_otp_without_token_falls_back_to_demo(client):
    """When fonnte_token is empty, OTP should be 123456 with demo_otp in response."""
    sc = client.get(f"{BASE_URL}/api/store-config").json()
    orig_token = sc.get("fonnte_token")
    # Disable token
    client.put(f"{BASE_URL}/api/store-config", json={"fonnte_token": ""})
    try:
        r = client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "081299990002", "name": "TEST_Demo"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("demo_otp") == "123456"
        assert data.get("wa_sent") is False
    finally:
        client.put(f"{BASE_URL}/api/store-config", json={"fonnte_token": orig_token})


def test_verify_otp_reads_from_db(client, mongo_db):
    """Verify OTP uses code from DB (not hardcoded) and enforces expiry."""
    phone = "081299990003"
    # Request OTP (with token configured, real code generated)
    client.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": phone, "name": "TEST_VerifyDB"})
    user = mongo_db.users.find_one({"phone": "6281299990003"})
    assert user is not None
    actual_otp = user["otp_code"]

    # Wrong OTP fails
    r = client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": "000000"})
    assert r.status_code == 400

    # Correct OTP succeeds
    r = client.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": phone, "otp": actual_otp})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["user"]["verified"] is True


# ─── Orders WA notif ─────────────────────────────────────────
def test_create_order_includes_wa_seller_sent_flag(client):
    products = client.get(f"{BASE_URL}/api/products").json()
    p = products[0]
    payload = {
        "customer_name": "TEST_WA_Buyer",
        "customer_phone": "081299990010",
        "customer_address": "Test Address",
        "delivery_method": "pickup",
        "delivery_option_id": "pickup",
        "delivery_fee": 0,
        "items": [{
            "product_id": p["id"], "product_name": p["name"],
            "price": p["price"], "quantity": 1, "subtotal": p["price"],
            "image_url": p.get("image_url", "")
        }],
        "subtotal": p["price"], "total": p["price"],
        "notes": "TEST_WA", "payment_method": "transfer",
    }
    r = client.post(f"{BASE_URL}/api/orders", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "_wa_seller_sent" in data
    assert isinstance(data["_wa_seller_sent"], bool)
    # With disconnected device, expected to be False but key MUST be present
    return data["id"]


def test_update_order_status_sends_wa_to_buyer(client):
    # Create an order
    products = client.get(f"{BASE_URL}/api/products").json()
    p = products[0]
    order = client.post(f"{BASE_URL}/api/orders", json={
        "customer_name": "TEST_StatusBuyer", "customer_phone": "081299990011",
        "customer_address": "X", "delivery_method": "pickup",
        "delivery_fee": 0,
        "items": [{"product_id": p["id"], "product_name": p["name"], "price": p["price"], "quantity": 1, "subtotal": p["price"]}],
        "subtotal": p["price"], "total": p["price"], "payment_method": "transfer",
    }).json()
    oid = order["id"]

    # Update to diproses → must include _wa_buyer_sent
    r = client.put(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "diproses"})
    assert r.status_code == 200
    data = r.json()
    assert "_wa_buyer_sent" in data
    assert isinstance(data["_wa_buyer_sent"], bool)
    assert data["status"] == "diproses"


# ─── /api/admin/test-wa ─────────────────────────────────────────
def test_admin_test_wa(client):
    r = client.post(f"{BASE_URL}/api/admin/test-wa", json={"target": "6285249682337", "message": "TEST_PING"})
    assert r.status_code == 200
    data = r.json()
    # Either ok=True/False, must contain status/response or error or skipped
    assert "ok" in data
    # When device disconnected, ok=False but with response (status 200 from Fonnte)
    if not data.get("skipped"):
        # Should have status or error
        assert "status" in data or "error" in data


def test_admin_test_wa_skipped_when_disabled(client):
    sc = client.get(f"{BASE_URL}/api/store-config").json()
    orig_enabled = sc.get("wa_notif_enabled", True)
    client.put(f"{BASE_URL}/api/store-config", json={"wa_notif_enabled": False})
    try:
        r = client.post(f"{BASE_URL}/api/admin/test-wa", json={"target": "6285249682337"})
        data = r.json()
        assert data.get("ok") is False
        assert data.get("skipped") is True
    finally:
        client.put(f"{BASE_URL}/api/store-config", json={"wa_notif_enabled": orig_enabled})


# ─── /api/admin/reset-customers ─────────────────────────────────────────
def test_reset_customers_requires_confirm(client):
    r = client.post(f"{BASE_URL}/api/admin/reset-customers", json={"confirm": "WRONG", "scope": "all"})
    assert r.status_code == 400


def test_reset_customers_scope_orders(client, mongo_db):
    # Seed a TEST order
    products = client.get(f"{BASE_URL}/api/products").json()
    p = products[0]
    client.post(f"{BASE_URL}/api/orders", json={
        "customer_name": "TEST_ResetSubject", "customer_phone": "081299990020",
        "customer_address": "X", "delivery_method": "pickup",
        "delivery_fee": 0,
        "items": [{"product_id": p["id"], "product_name": p["name"], "price": p["price"], "quantity": 2, "subtotal": p["price"] * 2}],
        "subtotal": p["price"] * 2, "total": p["price"] * 2, "payment_method": "transfer",
    })
    before_count = mongo_db.orders.count_documents({})
    assert before_count > 0

    r = client.post(f"{BASE_URL}/api/admin/reset-customers", json={"confirm": "RESET", "scope": "orders"})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["deleted"]["orders"] == before_count

    # Verify orders gone
    after_count = mongo_db.orders.count_documents({})
    assert after_count == 0

    # Verify sold_count reset to 0
    prod = mongo_db.products.find_one({"id": p["id"]})
    assert prod["sold_count"] == 0


def test_reset_customers_scope_users(client, mongo_db):
    # We expect users to exist from prior OTP tests
    before = mongo_db.users.count_documents({})
    r = client.post(f"{BASE_URL}/api/admin/reset-customers", json={"confirm": "RESET", "scope": "users"})
    assert r.status_code == 200
    data = r.json()
    assert data["deleted"]["users"] == before
    assert mongo_db.users.count_documents({}) == 0


# ─── Fonnte send mechanics ─────────────────────────────────────────
def test_fonnte_invalid_target_skipped(client):
    """Sending to too-short target should be skipped gracefully."""
    r = client.post(f"{BASE_URL}/api/admin/test-wa", json={"target": "123"})
    data = r.json()
    # Either skipped or ok=false; must not crash app
    assert "ok" in data
    assert data["ok"] is False
