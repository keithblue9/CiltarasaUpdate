"""FASE 2 - Payment Flow Revamp tests.
Tests:
- OrderCreate accepts payment_bank_id, payment_type, payment_proof_url
- StoreConfig: qris_image_url + payment_texts (14 keys) get/update with backfill
- Media upload .jpg/.png/.webp, 5MB limit, GET returns image
"""
import os
import io
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://seller-app-hub.preview.emergentagent.com").rstrip("/")
SELLER_PIN = os.environ.get("SELLER_PIN", "ciltarasa")
HDR = {"X-Seller-PIN": SELLER_PIN}

EXPECTED_PAYMENT_TEXT_KEYS = {
    "bank_transfer_title", "bank_transfer_instructions",
    "pay_now_label", "pay_now_desc",
    "pay_later_label", "pay_later_desc",
    "upload_proof_label", "upload_proof_hint",
    "qris_title", "qris_instructions",
    "qris_paid_label", "qris_cancel_label",
    "qris_upload_label", "no_qris_image_warning",
}


# ── StoreConfig: defaults & backfill ──
class TestStoreConfigPaymentTexts:
    def test_get_store_config_has_qris_and_payment_texts(self):
        r = requests.get(f"{BASE_URL}/api/store-config", timeout=15)
        assert r.status_code == 200
        cfg = r.json()
        assert "qris_image_url" in cfg, "qris_image_url missing from store_config"
        assert "payment_texts" in cfg, "payment_texts missing from store_config"
        assert isinstance(cfg["payment_texts"], dict)
        missing = EXPECTED_PAYMENT_TEXT_KEYS - set(cfg["payment_texts"].keys())
        assert not missing, f"Missing payment_texts keys: {missing}"

    def test_update_qris_image_url(self):
        new_url = "https://example.com/test-qris.png"
        r = requests.put(
            f"{BASE_URL}/api/store-config",
            json={"qris_image_url": new_url},
            headers=HDR,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("qris_image_url") == new_url
        # Persisted
        r2 = requests.get(f"{BASE_URL}/api/store-config", timeout=15)
        assert r2.json().get("qris_image_url") == new_url

    def test_update_payment_texts_partial_does_not_wipe_siblings(self):
        # Update only 1 key. Other keys must still be present (deep merge).
        r = requests.put(
            f"{BASE_URL}/api/store-config",
            json={"payment_texts": {"qris_title": "TEST_QRIS_TITLE"}},
            headers=HDR,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        pt = r.json().get("payment_texts", {})
        assert pt.get("qris_title") == "TEST_QRIS_TITLE"
        # Sibling keys still present
        assert pt.get("bank_transfer_title")
        assert pt.get("pay_now_label")
        # restore default
        requests.put(
            f"{BASE_URL}/api/store-config",
            json={"payment_texts": {"qris_title": "Scan QRIS"}},
            headers=HDR,
            timeout=15,
        )

    def test_update_requires_seller_pin(self):
        r = requests.put(
            f"{BASE_URL}/api/store-config",
            json={"qris_image_url": "x"},
            timeout=15,
        )
        assert r.status_code == 401


# ── Media Upload ──
class TestMediaUpload:
    def _tiny_jpg(self) -> bytes:
        # Minimal valid JPEG (1x1 white)
        return bytes.fromhex(
            "FFD8FFE000104A46494600010100000100010000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFC0000B080001000101011100FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFDA0008010100003F00FB000FFFD9"
        )

    def test_upload_jpg_returns_url(self):
        files = {"file": ("test.jpg", self._tiny_jpg(), "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/media/upload", files=files, headers=HDR, timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "url" in j and j["url"].startswith("/api/media/")
        assert "id" in j
        assert j["content_type"] == "image/jpeg"
        # GET back the image
        get_url = f"{BASE_URL}{j['url']}"
        r2 = requests.get(get_url, timeout=15)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert "max-age" in r2.headers.get("cache-control", "").lower()

    def test_upload_rejects_unsupported_mime(self):
        files = {"file": ("test.txt", b"hello", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/media/upload", files=files, headers=HDR, timeout=15)
        assert r.status_code == 400

    def test_upload_requires_seller_pin(self):
        files = {"file": ("test.jpg", self._tiny_jpg(), "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/media/upload", files=files, timeout=15)
        assert r.status_code == 401


# ── Order creation with FASE 2 fields ──
class TestOrderCreateWithPaymentFields:
    def _get_first_product(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert products, "No products seeded"
        return products[0]

    def _get_bank_id(self):
        r = requests.get(f"{BASE_URL}/api/store-config", timeout=15)
        banks = r.json().get("bank_accounts", [])
        assert banks, "No bank_accounts seeded"
        return banks[0]["id"]

    def test_order_bank_transfer_pay_now_with_proof(self):
        p = self._get_first_product()
        bank_id = self._get_bank_id()
        payload = {
            "customer_name": "TEST_FASE2_PayNow",
            "customer_phone": "081234567899",
            "customer_address": "Jl. Test 123",
            "delivery_method": "pickup",
            "delivery_option_id": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": p["id"],
                "product_name": p["name"],
                "price": p["price"],
                "quantity": 1,
                "subtotal": p["price"],
                "image_url": p.get("image_url", ""),
            }],
            "subtotal": p["price"],
            "total": p["price"],
            "notes": "TEST_FASE2",
            "payment_method": "transfer",
            "payment_method_id": "transfer",
            "payment_bank_id": bank_id,
            "payment_type": "now",
            "payment_proof_url": "/api/media/test-proof-xyz",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("payment_bank_id") == bank_id
        assert order.get("payment_type") == "now"
        assert order.get("payment_proof_url") == "/api/media/test-proof-xyz"
        # GET back to confirm persistence
        g = requests.get(f"{BASE_URL}/api/orders/{order['id']}", timeout=15)
        assert g.status_code == 200
        fetched = g.json()
        assert fetched["payment_bank_id"] == bank_id
        assert fetched["payment_type"] == "now"
        assert fetched["payment_proof_url"] == "/api/media/test-proof-xyz"

    def test_order_bank_transfer_pay_later_no_proof(self):
        p = self._get_first_product()
        bank_id = self._get_bank_id()
        payload = {
            "customer_name": "TEST_FASE2_PayLater",
            "customer_phone": "081234567898",
            "customer_address": "Jl. Test 456",
            "delivery_method": "pickup",
            "delivery_option_id": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": p["id"], "product_name": p["name"],
                "price": p["price"], "quantity": 1, "subtotal": p["price"],
            }],
            "subtotal": p["price"], "total": p["price"], "notes": "TEST_FASE2",
            "payment_method": "transfer", "payment_method_id": "transfer",
            "payment_bank_id": bank_id, "payment_type": "later",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order.get("payment_type") == "later"
        assert order.get("payment_bank_id") == bank_id
        assert order.get("payment_proof_url") is None

    def test_order_qris_with_proof(self):
        p = self._get_first_product()
        payload = {
            "customer_name": "TEST_FASE2_QRIS",
            "customer_phone": "081234567897",
            "customer_address": "",
            "delivery_method": "pickup",
            "delivery_option_id": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": p["id"], "product_name": p["name"],
                "price": p["price"], "quantity": 1, "subtotal": p["price"],
            }],
            "subtotal": p["price"], "total": p["price"], "notes": "TEST_FASE2",
            "payment_method": "qris", "payment_method_id": "qris",
            "payment_proof_url": "/api/media/qris-proof-xyz",
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("payment_proof_url") == "/api/media/qris-proof-xyz"
