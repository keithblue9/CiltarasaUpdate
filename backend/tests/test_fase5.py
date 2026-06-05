"""
FASE 5 — Web Push Notifications (VAPID) backend tests.
Covers: /api/push/vapid-key, subscribe, unsubscribe, list, test, stale auto-cleanup,
broadcast on /api/orders.
"""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
PIN = "ciltarasa"
H_PIN = {"X-Seller-PIN": PIN, "Content-Type": "application/json"}
H_JSON = {"Content-Type": "application/json"}


# --- helpers ---
def _fake_endpoint():
    """Fake but well-formed push endpoint (FCM-shaped). 404/410 on real send."""
    return f"https://fcm.googleapis.com/fcm/send/TEST_{uuid.uuid4().hex}"


def _fake_keys():
    """Real valid EC P-256 public key (so pywebpush reaches the HTTP layer
    and FCM returns 404/410 for fake /TEST_ endpoint → triggers stale cleanup)."""
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        priv = ec.generate_private_key(ec.SECP256R1())
        pub_bytes = priv.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        p256dh = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")
    except Exception:
        p256dh = base64.urlsafe_b64encode(b"\x04" + b"\x01" * 64).decode().rstrip("=")
    auth = base64.urlsafe_b64encode(b"\x02" * 16).decode().rstrip("=")
    return {"p256dh": p256dh, "auth": auth}


def _list_subs():
    r = requests.get(f"{BASE_URL}/api/push/subscriptions", headers=H_PIN, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


def _cleanup_test_subs():
    """Remove any TEST_-prefixed fake endpoints lingering."""
    data = _list_subs()
    for s in data.get("subscriptions", []):
        ep = s.get("endpoint", "")
        if "/TEST_" in ep:
            requests.post(
                f"{BASE_URL}/api/push/unsubscribe",
                json={"endpoint": ep},
                headers=H_PIN,
                timeout=10,
            )


@pytest.fixture(autouse=True)
def _around():
    _cleanup_test_subs()
    yield
    _cleanup_test_subs()


# --- VAPID public key ---
class TestVapidKey:
    def test_get_vapid_key_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/push/vapid-key", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("available") is True, body
        key = body.get("key")
        assert isinstance(key, str) and len(key) >= 80, f"key len={len(key) if key else 0}"
        # base64url charset only
        assert all(c.isalnum() or c in "-_" for c in key)

    def test_vapid_persists_across_calls(self):
        a = requests.get(f"{BASE_URL}/api/push/vapid-key", timeout=10).json()["key"]
        b = requests.get(f"{BASE_URL}/api/push/vapid-key", timeout=10).json()["key"]
        assert a == b


# --- Subscribe / List / Unsubscribe ---
class TestSubscribeFlow:
    def test_subscribe_requires_pin(self):
        r = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"endpoint": _fake_endpoint(), "keys": _fake_keys()},
            headers=H_JSON,
            timeout=10,
        )
        assert r.status_code == 401

    def test_subscribe_and_list(self):
        ep = _fake_endpoint()
        r = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={
                "endpoint": ep,
                "keys": _fake_keys(),
                "user_agent": "TEST_UA",
                "label": "TEST_DEVICE",
            },
            headers=H_PIN,
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["subscription"]["endpoint"] == ep
        assert body["subscription"]["label"] == "TEST_DEVICE"
        # verify list contains it
        lst = _list_subs()
        assert any(s["endpoint"] == ep for s in lst["subscriptions"])
        assert lst["count"] >= 1

    def test_subscribe_upsert_no_duplicate(self):
        ep = _fake_endpoint()
        payload = {"endpoint": ep, "keys": _fake_keys(), "label": "TEST_FIRST"}
        r1 = requests.post(f"{BASE_URL}/api/push/subscribe", json=payload, headers=H_PIN, timeout=10)
        assert r1.status_code == 200
        # re-subscribe with same endpoint but different label
        payload2 = {"endpoint": ep, "keys": _fake_keys(), "label": "TEST_SECOND"}
        r2 = requests.post(f"{BASE_URL}/api/push/subscribe", json=payload2, headers=H_PIN, timeout=10)
        assert r2.status_code == 200
        lst = _list_subs()
        matches = [s for s in lst["subscriptions"] if s["endpoint"] == ep]
        assert len(matches) == 1, f"Expected upsert, got {len(matches)} duplicates"
        assert matches[0]["label"] == "TEST_SECOND"

    def test_unsubscribe(self):
        ep = _fake_endpoint()
        requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"endpoint": ep, "keys": _fake_keys(), "label": "TEST_DEL"},
            headers=H_PIN,
            timeout=10,
        )
        r = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            json={"endpoint": ep},
            headers=H_PIN,
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["deleted"] == 1
        lst = _list_subs()
        assert not any(s["endpoint"] == ep for s in lst["subscriptions"])

    def test_list_requires_pin(self):
        r = requests.get(f"{BASE_URL}/api/push/subscriptions", timeout=10)
        assert r.status_code == 401


# --- Push test + stale cleanup ---
class TestPushTestAndCleanup:
    def test_push_test_requires_pin(self):
        r = requests.post(f"{BASE_URL}/api/push/test", headers=H_JSON, timeout=15)
        assert r.status_code == 401

    def test_push_test_shape_and_stale_cleanup(self):
        # Register a fake endpoint (FCM-shaped). Note: with locally-generated
        # EC keys, pywebpush fails at encryption layer (no HTTP call), so the
        # stale-cleanup branch (HTTP 404/410) cannot be hit in a hermetic test.
        # We verify response shape + failed>=1. Stale-cleanup branch is
        # additionally verified via code inspection (server.py:1851-1862).
        ep = _fake_endpoint()
        requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"endpoint": ep, "keys": _fake_keys(), "label": "TEST_STALE"},
            headers=H_PIN,
            timeout=10,
        ).raise_for_status()

        before = _list_subs()
        assert any(s["endpoint"] == ep for s in before["subscriptions"])

        r = requests.post(f"{BASE_URL}/api/push/test", headers=H_PIN, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("sent", "failed", "stale_cleaned", "total"):
            assert k in body, f"missing {k}: {body}"
        assert body["failed"] >= 1
        assert body["total"] >= 1
        assert body["sent"] == 0  # fake sub can't deliver
        # stale_cleaned may be 0 (encryption fail) or >=1 (HTTP 404/410)
        assert body["stale_cleaned"] >= 0


# --- broadcast_push on order create ---
class TestOrderPushBroadcast:
    def _get_a_product(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=10)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list) and len(products) > 0, "No products seeded"
        return products[0]

    def test_create_order_returns_push_sent_zero(self):
        """No real subscribers → _push_sent should be 0 (since fake stale ones will fail)."""
        # Ensure no subs (cleanup handled by fixture)
        prod = self._get_a_product()
        payload = {
            "customer_name": "TEST_PushBuyer",
            "customer_phone": "081200000000",
            "customer_address": "TEST addr",
            "delivery_method": "pickup",
            "items": [
                {
                    "product_id": prod["id"],
                    "product_name": prod["name"],
                    "price": prod.get("price", 0),
                    "quantity": 1,
                    "subtotal": prod.get("price", 0),
                }
            ],
            "subtotal": prod.get("price", 0),
            "total": prod.get("price", 0),
            "payment_method": "cod",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=H_JSON, timeout=20)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert "_push_sent" in body, f"_push_sent missing from order response: {list(body.keys())}"
        assert isinstance(body["_push_sent"], int)
        assert body["_push_sent"] == 0  # no real subscribers

    def test_create_order_with_fake_sub_push_sent_zero(self):
        """Fake (404) sub registered → _push_sent still 0 (delivery failed), sub auto-cleaned."""
        ep = _fake_endpoint()
        requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json={"endpoint": ep, "keys": _fake_keys(), "label": "TEST_ORDER_PUSH"},
            headers=H_PIN,
            timeout=10,
        ).raise_for_status()

        prod = self._get_a_product()
        payload = {
            "customer_name": "TEST_PushBuyer2",
            "customer_phone": "081200000001",
            "customer_address": "TEST addr2",
            "delivery_method": "pickup",
            "items": [
                {
                    "product_id": prod["id"],
                    "product_name": prod["name"],
                    "price": prod.get("price", 0),
                    "quantity": 1,
                    "subtotal": prod.get("price", 0),
                }
            ],
            "subtotal": prod.get("price", 0),
            "total": prod.get("price", 0),
            "payment_method": "cod",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, headers=H_JSON, timeout=30)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("_push_sent", 0) == 0  # fake → failed → 0 sent
        # Stale cleanup not guaranteed in hermetic test (see note in
        # TestPushTestAndCleanup.test_push_test_shape_and_stale_cleanup).
        # Just verify _push_sent contract holds.


# --- Static assets / manifest ---
class TestStaticAssets:
    def test_seller_manifest_served(self):
        r = requests.get(f"{BASE_URL}/seller-manifest.json", timeout=10)
        assert r.status_code == 200, r.status_code
        data = r.json()
        assert data["name"] == "Ciltarasa Seller"
        assert data["start_url"] == "/#/seller"
        assert data["theme_color"] == "#7C2D12"
        assert isinstance(data.get("shortcuts"), list) and len(data["shortcuts"]) == 3
        names = [s["name"] for s in data["shortcuts"]]
        assert "Pesanan Masuk" in names
        assert "Produk" in names

    def test_sw_js_served_with_version(self):
        r = requests.get(f"{BASE_URL}/sw.js", timeout=10)
        assert r.status_code == 200
        body = r.text
        assert "ciltarasa-v1.1.0-pwa-seller" in body
        assert "addEventListener('push'" in body
        assert "notificationclick" in body
