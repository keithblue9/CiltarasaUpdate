"""Backend API tests for Ciltarasa Phase 1-5 (auth, store-config, discounts, reviews, products, orders)"""
import pytest
import requests
import os

from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

TEST_PHONE = "081912853950"
NORMALIZED_PHONE = "6281912853950"


# ── Auth (simulated OTP) ─────────────────────────────────────────────────────
class TestAuth:
    def test_request_otp_returns_demo_code(self):
        r = requests.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE, "name": "Bunda Tester"})
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["demo_otp"] == "123456"
        assert d["phone"] == NORMALIZED_PHONE

    def test_request_otp_invalid_phone(self):
        r = requests.post(f"{API}/auth/request-otp", json={"phone": "123"})
        assert r.status_code == 400

    def test_verify_otp_correct(self):
        requests.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE, "name": "Bunda Tester"})
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": TEST_PHONE, "otp": "123456", "name": "Bunda Tester"})
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert "token" in d
        assert d["user"]["phone"] == NORMALIZED_PHONE
        assert d["user"]["verified"] is True
        pytest.token = d["token"]

    def test_verify_otp_wrong(self):
        requests.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE})
        r = requests.post(f"{API}/auth/verify-otp", json={"phone": TEST_PHONE, "otp": "999999"})
        assert r.status_code == 400

    def test_auth_me_returns_user(self):
        requests.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE, "name": "Bunda Tester"})
        v = requests.post(f"{API}/auth/verify-otp", json={"phone": TEST_PHONE, "otp": "123456"})
        token = v.json()["token"]
        r = requests.get(f"{API}/auth/me", params={"token": token})
        assert r.status_code == 200
        assert r.json()["phone"] == NORMALIZED_PHONE


# ── Products: new fields ─────────────────────────────────────────────────────
class TestProducts:
    def test_get_products_has_new_fields(self):
        r = requests.get(f"{API}/products")
        assert r.status_code == 200
        ps = r.json()
        assert len(ps) >= 12
        p = ps[0]
        for k in ["final_price", "discount", "rating_avg", "rating_count", "sold_count", "media_urls", "categories", "active"]:
            assert k in p, f"missing field {k}"
        assert "_id" not in p

    def test_create_product_with_gdrive_conversion(self):
        payload = {
            "name": "TEST_GdriveProduct",
            "description": "test",
            "price": 10000,
            "cost_price": 5000,
            "category": "snack",
            "categories": ["snack"],
            "stock": 5,
            "unit": "pack",
            "weight": 0.3,
            "media_urls": ["https://drive.google.com/file/d/ABCDEF123/view?usp=sharing"],
        }
        r = requests.post(f"{API}/products", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["media_urls"][0].startswith("https://drive.google.com/uc?export=view&id=ABCDEF123")
        assert d["image_url"].startswith("https://drive.google.com/uc?export=view&id=ABCDEF123")
        pytest.created_pid = d["id"]

    def test_update_product_gdrive(self):
        pid = getattr(pytest, "created_pid", None)
        if not pid:
            pytest.skip("no product created")
        r = requests.put(f"{API}/products/{pid}", json={"media_urls": ["https://drive.google.com/file/d/XYZ999/view"]})
        assert r.status_code == 200
        assert "XYZ999" in r.json()["media_urls"][0]

    def test_delete_test_product(self):
        pid = getattr(pytest, "created_pid", None)
        if not pid:
            pytest.skip("no product created")
        r = requests.delete(f"{API}/products/{pid}")
        assert r.status_code == 200


# ── Store Config ─────────────────────────────────────────────────────────────
class TestStoreConfig:
    def test_get_store_config(self):
        r = requests.get(f"{API}/store-config")
        assert r.status_code == 200
        d = r.json()
        for k in ["name", "cerita", "categories", "delivery_options", "payment_methods", "bank_accounts", "gmaps_review_url"]:
            assert k in d, f"missing {k}"
        assert d["gmaps_review_url"] == "https://maps.app.goo.gl/W8noqRWBkVsMESbHA"
        assert len(d["categories"]) >= 2

    def test_update_store_config(self):
        r = requests.put(f"{API}/store-config", json={"tagline": "TEST_TAG_UPDATED"})
        assert r.status_code == 200
        assert r.json()["tagline"] == "TEST_TAG_UPDATED"
        # restore
        requests.put(f"{API}/store-config", json={"tagline": "Frozen Food Premium • Malang"})


# ── Discounts CRUD ───────────────────────────────────────────────────────────
class TestDiscounts:
    def test_get_discounts(self):
        r = requests.get(f"{API}/discounts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_discount_crud(self):
        c = requests.post(f"{API}/discounts", json={"name": "TEST_disc", "type": "percent", "value": 15, "product_ids": [], "active": True})
        assert c.status_code == 200
        did = c.json()["id"]
        u = requests.put(f"{API}/discounts/{did}", json={"value": 25})
        assert u.status_code == 200
        assert u.json()["value"] == 25
        d = requests.delete(f"{API}/discounts/{did}")
        assert d.status_code == 200


# ── Reviews ──────────────────────────────────────────────────────────────────
class TestReviews:
    def test_create_review_updates_product_aggregation(self):
        ps = requests.get(f"{API}/products").json()
        p = ps[0]
        before = p["rating_count"]
        # Get any order
        orders = requests.get(f"{API}/orders").json()
        oid = orders[0]["id"] if orders else "dummy"
        r = requests.post(f"{API}/reviews", json={
            "order_id": oid, "product_id": p["id"], "user_name": "TEST_Reviewer",
            "rating": 5, "text": "TEST review", "photos": []
        })
        assert r.status_code == 200
        # GET reviews filter
        gr = requests.get(f"{API}/reviews", params={"product_id": p["id"]})
        assert gr.status_code == 200
        assert any(rev["text"] == "TEST review" for rev in gr.json())
        # Verify rating aggregation
        ps2 = requests.get(f"{API}/products").json()
        p2 = next(x for x in ps2 if x["id"] == p["id"])
        assert p2["rating_count"] == before + 1


# ── Orders: received + normalization ─────────────────────────────────────────
class TestOrders:
    def test_create_order_normalizes_phone(self):
        ps = requests.get(f"{API}/products").json()
        p = ps[0]
        payload = {
            "customer_name": "TEST_Customer",
            "customer_phone": "081234999888",
            "customer_address": "Jl Test",
            "delivery_method": "delivery",
            "items": [{"product_id": p["id"], "product_name": p["name"], "price": p["price"], "quantity": 1, "subtotal": p["price"]}],
            "subtotal": p["price"], "total": p["price"] + 10000,
            "delivery_fee": 10000, "payment_method": "cod"
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["customer_phone"] == "6281234999888"
        assert d["received"] is False
        pytest.test_oid = d["id"]

    def test_track_by_old_phone_format(self):
        # Track with leading 0 should still find the order (stored as 62)
        r = requests.get(f"{API}/orders/track", params={"phone": "081234999888"})
        assert r.status_code == 200
        assert any(o["customer_phone"] == "6281234999888" for o in r.json())

    def test_track_by_62_format(self):
        r = requests.get(f"{API}/orders/track", params={"phone": "6281234999888"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_mark_order_received(self):
        oid = getattr(pytest, "test_oid", None)
        if not oid:
            pytest.skip()
        r = requests.put(f"{API}/orders/{oid}/received", json={"received": True})
        assert r.status_code == 200
        d = r.json()
        assert d["received"] is True
        assert "diterima" in d.get("status_timestamps", {})

    def test_demo_ord_0004_received(self):
        # Sample order with received=True should exist
        all_orders = requests.get(f"{API}/orders").json()
        ord4 = next((o for o in all_orders if o["order_number"] == "ORD-0004"), None)
        assert ord4 is not None
        assert ord4["received"] is True
        assert ord4["status"] == "selesai"
