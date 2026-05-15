"""Backend tests for Ciltarasa Phase 7: CMS homepage texts, hero slides, fun facts,
Purchases/Restock CRUD + receive, Smart Insights, Recommendations."""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv('/app/frontend/.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

TEST_PHONE = "081912853950"
NORMALIZED_PHONE = "6281912853950"


# ── Store Config: new CMS fields ─────────────────────────────────────────────
class TestStoreConfigNewFields:
    def test_get_store_config_has_phase7_fields(self):
        r = requests.get(f"{API}/store-config")
        assert r.status_code == 200
        d = r.json()
        assert "homepage_texts" in d
        assert "hero_slides" in d
        assert "fun_facts" in d
        ht = d["homepage_texts"]
        expected_keys = [
            "viral_pill", "hero_title_1", "hero_title_2", "hero_subtitle",
            "hero_cta_primary", "hero_cta_secondary", "social_proof_text",
            "how_to_order_title", "how_to_order_subtitle",
            "catalog_section_title", "catalog_section_subtitle",
            "tab_menu_label", "tab_about_label",
        ]
        for k in expected_keys:
            assert k in ht, f"homepage_texts missing key: {k}"
        assert len(ht) >= 13
        # Hero slides default = 3
        assert isinstance(d["hero_slides"], list)
        assert len(d["hero_slides"]) == 3
        for slide in d["hero_slides"]:
            for k in ["id", "image_url", "duration_ms", "active"]:
                assert k in slide
        # Fun facts default = 5
        assert isinstance(d["fun_facts"], list)
        assert len(d["fun_facts"]) == 5
        for ff in d["fun_facts"]:
            for k in ["id", "image_url", "title", "text"]:
                assert k in ff

    def test_update_homepage_texts(self):
        # Save current to restore later
        original = requests.get(f"{API}/store-config").json()["homepage_texts"]
        new_text = "TEST_HERO_TITLE_UPDATED"
        modified = {**original, "hero_title_1": new_text}
        r = requests.put(f"{API}/store-config", json={"homepage_texts": modified})
        assert r.status_code == 200
        g = requests.get(f"{API}/store-config").json()
        assert g["homepage_texts"]["hero_title_1"] == new_text
        # Restore original fully
        requests.put(f"{API}/store-config", json={"homepage_texts": original})

    def test_update_hero_slides(self):
        original = requests.get(f"{API}/store-config").json()["hero_slides"]
        slides = [
            {"id": "test-s1", "image_url": "https://example.com/a.jpg", "duration_ms": 4000, "active": True},
            {"id": "test-s2", "image_url": "https://example.com/b.jpg", "duration_ms": 6000, "active": False},
        ]
        r = requests.put(f"{API}/store-config", json={"hero_slides": slides})
        assert r.status_code == 200
        g = requests.get(f"{API}/store-config").json()
        assert len(g["hero_slides"]) == 2
        assert g["hero_slides"][0]["id"] == "test-s1"
        assert g["hero_slides"][1]["active"] is False
        # Restore
        requests.put(f"{API}/store-config", json={"hero_slides": original})

    def test_update_fun_facts(self):
        original = requests.get(f"{API}/store-config").json()["fun_facts"]
        facts = [
            {"id": "tf-1", "image_url": "https://example.com/1.jpg", "title": "TEST Fact 1", "text": "lorem"},
            {"id": "tf-2", "image_url": "https://example.com/2.jpg", "title": "TEST Fact 2", "text": "ipsum"},
        ]
        r = requests.put(f"{API}/store-config", json={"fun_facts": facts})
        assert r.status_code == 200
        g = requests.get(f"{API}/store-config").json()
        assert len(g["fun_facts"]) == 2
        assert g["fun_facts"][0]["title"] == "TEST Fact 1"
        # Restore
        requests.put(f"{API}/store-config", json={"fun_facts": original})


# ── Purchases CRUD + Receive (stock increment) ───────────────────────────────
class TestPurchases:
    def test_create_purchase_auto_po_number(self):
        ps = requests.get(f"{API}/products").json()
        assert len(ps) > 0
        p = ps[0]
        before_stock = p["stock"]
        before_cost = p.get("cost_price", 0)

        payload = {
            "items": [{
                "product_id": p["id"],
                "product_name": p["name"],
                "quantity": 10,
                "unit_cost": 12345.0,
                "subtotal": 123450.0,
            }],
            "supplier": "TEST_Supplier_Phase7",
            "ordered_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
            "notes": "TEST PO",
        }
        r = requests.post(f"{API}/purchases", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "ordered"
        assert d["purchase_number"].startswith("PO-")
        assert len(d["purchase_number"]) == 7  # PO-0001 format
        assert d["total"] == 123450.0
        assert d["received_at"] is None
        # Stock should NOT change yet
        ps2 = requests.get(f"{API}/products").json()
        p2 = next(x for x in ps2 if x["id"] == p["id"])
        assert p2["stock"] == before_stock, "Stock changed prematurely on PO create"
        pytest.po_id = d["id"]
        pytest.po_pid = p["id"]
        pytest.po_before_stock = before_stock
        pytest.po_before_cost = before_cost

    def test_get_purchases_list(self):
        r = requests.get(f"{API}/purchases")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(x["id"] == getattr(pytest, "po_id", None) for x in items)
        # Ensure no MongoDB _id leak
        if items:
            assert "_id" not in items[0]

    def test_update_purchase(self):
        pid = getattr(pytest, "po_id", None)
        if not pid:
            pytest.skip("no po")
        r = requests.put(f"{API}/purchases/{pid}", json={"notes": "TEST PO updated", "supplier": "Sup2"})
        assert r.status_code == 200
        d = r.json()
        assert d["notes"] == "TEST PO updated"
        assert d["supplier"] == "Sup2"

    def test_receive_purchase_increments_stock_and_cost(self):
        pid = getattr(pytest, "po_id", None)
        product_id = getattr(pytest, "po_pid", None)
        if not pid:
            pytest.skip("no po")
        r = requests.post(f"{API}/purchases/{pid}/receive")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "received"
        assert d["received_at"] is not None
        # Verify stock + cost on product
        ps = requests.get(f"{API}/products").json()
        prod = next(x for x in ps if x["id"] == product_id)
        assert prod["stock"] == pytest.po_before_stock + 10
        assert prod["cost_price"] == 12345.0

    def test_receive_twice_fails(self):
        pid = getattr(pytest, "po_id", None)
        if not pid:
            pytest.skip()
        r = requests.post(f"{API}/purchases/{pid}/receive")
        assert r.status_code == 400

    def test_filter_purchases_by_status(self):
        r = requests.get(f"{API}/purchases", params={"status": "received"})
        assert r.status_code == 200
        for item in r.json():
            assert item["status"] == "received"

    def test_delete_purchase(self):
        pid = getattr(pytest, "po_id", None)
        if not pid:
            pytest.skip()
        r = requests.delete(f"{API}/purchases/{pid}")
        assert r.status_code == 200
        # Ensure gone
        items = requests.get(f"{API}/purchases").json()
        assert not any(x["id"] == pid for x in items)


# ── Smart Insights ───────────────────────────────────────────────────────────
class TestInsights:
    def test_insights_dashboard_structure(self):
        r = requests.get(f"{API}/insights/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "top_sellers" in d
        assert "restock_alerts" in d
        assert "total_products" in d
        assert "low_stock_count" in d
        assert isinstance(d["top_sellers"], list)
        assert len(d["top_sellers"]) <= 5
        if d["top_sellers"]:
            t0 = d["top_sellers"][0]
            for k in ["id", "name", "sold_count", "stock", "velocity"]:
                assert k in t0
        if d["restock_alerts"]:
            a0 = d["restock_alerts"][0]
            for k in ["id", "name", "stock", "velocity", "avg_lead_days", "days_left", "suggested_qty", "urgency"]:
                assert k in a0
            assert a0["urgency"] in ["high", "medium", "low"]


# ── Recommendations ──────────────────────────────────────────────────────────
class TestRecommendations:
    def _get_token_and_user(self):
        requests.post(f"{API}/auth/request-otp", json={"phone": TEST_PHONE, "name": "Bunda Tester"})
        v = requests.post(f"{API}/auth/verify-otp", json={"phone": TEST_PHONE, "otp": "123456", "name": "Bunda Tester"}).json()
        return v["token"], v["user"]

    def test_recommendations_by_phone_works_for_guest(self):
        # Use a phone that has historical orders (test phone from previous tests)
        r = requests.get(f"{API}/recommendations", params={"phone": TEST_PHONE})
        assert r.status_code == 200
        d = r.json()
        assert "repeat_orders" in d
        assert "similar_products" in d
        assert "has_history" in d
        assert isinstance(d["repeat_orders"], list)
        assert isinstance(d["similar_products"], list)

    def test_recommendations_new_user_returns_top_selling(self):
        # Random phone with no orders → similar_products = top sellers
        r = requests.get(f"{API}/recommendations", params={"phone": "62999000111222"})
        assert r.status_code == 200
        d = r.json()
        assert d["has_history"] is False
        assert len(d["similar_products"]) > 0

    def test_recommendations_by_user_id(self):
        _, user = self._get_token_and_user()
        # Place a guest order first so phone-history works (user_id may be empty on guest orders)
        ps = requests.get(f"{API}/products").json()
        p = ps[0]
        requests.post(f"{API}/orders", json={
            "customer_name": "TEST_RecCustomer",
            "customer_phone": TEST_PHONE,
            "customer_address": "Jl Test",
            "delivery_method": "delivery",
            "items": [{"product_id": p["id"], "product_name": p["name"], "price": p["price"], "quantity": 2, "subtotal": p["price"] * 2}],
            "subtotal": p["price"] * 2, "total": p["price"] * 2 + 10000,
            "delivery_fee": 10000, "payment_method": "cod"
        })
        # phone-based recs
        r = requests.get(f"{API}/recommendations", params={"phone": TEST_PHONE})
        assert r.status_code == 200
        d = r.json()
        assert d["has_history"] is True
        # Repeat orders should contain the product just bought
        ids = [ro["product"]["id"] for ro in d["repeat_orders"]]
        assert p["id"] in ids
