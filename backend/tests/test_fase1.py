"""FASE 1 backend tests: Bug #11 stock restore, Fonnte status, WA diagnostics."""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://seller-app-hub.preview.emergentagent.com').rstrip('/')
PIN = "ciltarasa"
HEADERS_AUTH = {"X-Seller-PIN": PIN, "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_product():
    """Create a fresh test product with known stock."""
    payload = {
        "name": f"TEST_StockRestore_{uuid.uuid4().hex[:6]}",
        "description": "Test product for stock restore",
        "price": 10000,
        "cost_price": 5000,
        "category": "snack",
        "categories": ["snack"],
        "stock": 100,
        "unit": "pack",
    }
    r = requests.post(f"{BASE_URL}/api/products", json=payload, headers=HEADERS_AUTH, timeout=15)
    assert r.status_code == 200, f"Failed to create product: {r.text}"
    p = r.json()
    yield p
    # cleanup
    requests.delete(f"{BASE_URL}/api/products/{p['id']}", headers=HEADERS_AUTH, timeout=10)


class TestBug11StockRestore:
    """Bug #11: Stock restoration on order cancel."""

    def test_stock_decreases_on_order_create_then_restored_on_cancel(self, test_product):
        pid = test_product["id"]
        initial_stock = test_product["stock"]

        # CREATE order with quantity 3
        order_payload = {
            "customer_name": "TEST_Buyer",
            "customer_phone": "081234567890",
            "customer_address": "Test addr",
            "delivery_method": "pickup",
            "delivery_option_id": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": pid,
                "product_name": test_product["name"],
                "price": test_product["price"],
                "quantity": 3,
                "subtotal": 30000,
            }],
            "subtotal": 30000,
            "total": 30000,
            "payment_method": "cod",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=order_payload, timeout=15)
        assert r.status_code == 200, f"Order create failed: {r.text}"
        order = r.json()
        oid = order["id"]

        # Verify WA diagnostic fields exist on order create response (Bug #3 partial)
        assert "_wa_seller_sent" in order, "Missing _wa_seller_sent in create response"
        # Either it's False with reason, or True. Token is expired so usually False.
        if not order["_wa_seller_sent"]:
            assert "_wa_seller_reason" in order, "Failed WA send must include reason"
            print(f"WA seller reason: {order.get('_wa_seller_reason')}")

        # Verify stock decreased
        r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
        assert r.status_code == 200
        after_create = r.json()
        assert after_create["stock"] == initial_stock - 3, \
            f"Stock should be {initial_stock - 3} after order, got {after_create['stock']}"

        # CANCEL order
        r = requests.put(
            f"{BASE_URL}/api/orders/{oid}/status",
            json={"status": "dibatalkan"},
            headers=HEADERS_AUTH, timeout=15
        )
        assert r.status_code == 200, f"Cancel failed: {r.text}"
        cancelled = r.json()
        assert cancelled.get("stock_restored") is True, \
            f"Expected stock_restored=True after cancel, got {cancelled.get('stock_restored')}"

        # Verify WA buyer diagnostics on status update (Bug #3 partial)
        assert "_wa_buyer_sent" in cancelled, "Missing _wa_buyer_sent on status update"

        # Verify stock RESTORED
        r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
        restored = r.json()
        assert restored["stock"] == initial_stock, \
            f"Stock should be restored to {initial_stock}, got {restored['stock']}"

        # IDEMPOTENT: cancelling again should NOT double-restore
        r = requests.put(
            f"{BASE_URL}/api/orders/{oid}/status",
            json={"status": "dibatalkan"},
            headers=HEADERS_AUTH, timeout=10
        )
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/products/{pid}", timeout=10)
        final = r.json()
        assert final["stock"] == initial_stock, \
            f"Stock must remain at {initial_stock} after double-cancel, got {final['stock']}"


class TestFonnteStatusEndpoint:
    """New /api/admin/fonnte-status endpoint."""

    def test_requires_pin(self):
        r = requests.get(f"{BASE_URL}/api/admin/fonnte-status", timeout=15)
        assert r.status_code == 401, f"Should require PIN, got {r.status_code}"

    def test_returns_status_with_pin(self):
        r = requests.get(f"{BASE_URL}/api/admin/fonnte-status", headers=HEADERS_AUTH, timeout=15)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
        data = r.json()
        # Required keys
        for k in ["ok", "connected", "enabled", "seller_phone"]:
            assert k in data, f"Missing key '{k}' in response. Got: {data}"
        # Token is expired/invalid per user — connected likely False
        print(f"Fonnte status: connected={data.get('connected')}, status={data.get('status')}, reason={data.get('reason')}")


class TestWAOrderDiagnostics:
    """Bug #3: WA seller notif diagnostics on order create."""

    def test_order_create_includes_wa_diagnostics(self, test_product):
        pid = test_product["id"]
        payload = {
            "customer_name": "TEST_WA_Diag",
            "customer_phone": "081234500001",
            "customer_address": "x",
            "delivery_method": "pickup",
            "delivery_option_id": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": pid,
                "product_name": test_product["name"],
                "price": test_product["price"],
                "quantity": 1,
                "subtotal": test_product["price"],
            }],
            "subtotal": test_product["price"],
            "total": test_product["price"],
            "payment_method": "cod",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "_wa_seller_sent" in d
        assert isinstance(d["_wa_seller_sent"], bool)
        # cleanup
        requests.put(f"{BASE_URL}/api/orders/{d['id']}/status", json={"status": "dibatalkan"}, headers=HEADERS_AUTH)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
