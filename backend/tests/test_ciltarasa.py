"""Backend API tests for Ciltarasa frozen food store"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestProducts:
    """Product catalog tests"""

    def test_get_products_returns_12(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 12, f"Expected 12 products, got {len(data)}"

    def test_products_have_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        products = r.json()
        for p in products:
            assert "id" in p
            assert "name" in p
            assert "price" in p
            assert "category" in p
            assert "_id" not in p

    def test_products_categories(self):
        r = requests.get(f"{BASE_URL}/api/products")
        data = r.json()
        categories = set(p["category"] for p in data)
        assert "snack" in categories
        assert "bebek" in categories
        snacks = [p for p in data if p["category"] == "snack"]
        bebek = [p for p in data if p["category"] == "bebek"]
        assert len(snacks) == 8
        assert len(bebek) == 4


class TestOrders:
    """Order endpoints tests"""

    def test_get_orders(self):
        r = requests.get(f"{BASE_URL}/api/orders")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 5

    def test_get_orders_no_mongo_id(self):
        r = requests.get(f"{BASE_URL}/api/orders")
        for order in r.json():
            assert "_id" not in order

    def test_track_order_by_id(self):
        r = requests.get(f"{BASE_URL}/api/orders/track?order_id=ORD-001")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["order_number"] == "ORD-001"

    def test_track_order_by_phone(self):
        r = requests.get(f"{BASE_URL}/api/orders/track?phone=081234567890")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    def test_create_order(self):
        # Get a product first
        products = requests.get(f"{BASE_URL}/api/products").json()
        p = products[0]
        payload = {
            "customer_name": "TEST_User",
            "customer_phone": "081111111111",
            "customer_address": "Jl Test No 1",
            "delivery_method": "delivery",
            "items": [{"product_id": p["id"], "product_name": p["name"], "price": p["price"], "quantity": 1, "subtotal": p["price"]}],
            "subtotal": p["price"],
            "total": p["price"],
            "notes": "",
            "payment_method": "cod"
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "order_number" in data
        assert data["status"] == "menunggu"
        assert "_id" not in data

    def test_update_order_status(self):
        # Get ORD-001 id
        orders = requests.get(f"{BASE_URL}/api/orders").json()
        ord1 = next((o for o in orders if o["order_number"] == "ORD-001"), None)
        if not ord1:
            pytest.skip("ORD-001 not found")
        oid = ord1["id"]
        # Advance to diproses
        r = requests.put(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "diproses"})
        assert r.status_code == 200
        assert r.json()["status"] == "diproses"


class TestSettings:
    """Settings tests"""

    def test_get_settings(self):
        r = requests.get(f"{BASE_URL}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert data["seller_whatsapp"] == "6285249682337"
        assert "_id" not in data


class TestReports:
    """Sales report tests"""

    def test_sales_report_month(self):
        r = requests.get(f"{BASE_URL}/api/reports/sales?period=month")
        assert r.status_code == 200
        data = r.json()
        assert "total_revenue" in data
        assert "total_orders" in data
        assert "status_counts" in data

    def test_sales_report_week(self):
        r = requests.get(f"{BASE_URL}/api/reports/sales?period=week")
        assert r.status_code == 200

    def test_financial_report(self):
        r = requests.get(f"{BASE_URL}/api/reports/financial")
        assert r.status_code == 200
        data = r.json()
        assert "total_income" in data
