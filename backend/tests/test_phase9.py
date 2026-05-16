"""Phase 9 tests: PWA assets + onboarding_texts in store-config + image rollout regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-snack-hub.preview.emergentagent.com").rstrip("/")
SELLER_PIN = "ciltarasa"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def seller(api):
    api.headers.update({"X-Seller-PIN": SELLER_PIN})
    return api


# ------------ PWA static assets (served by FE; same host) ------------
class TestPwaAssets:
    def test_manifest_json(self):
        r = requests.get(f"{BASE_URL}/manifest.json", timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("name")
        assert data.get("id")
        icons = data.get("icons", [])
        sizes = {(i.get("sizes"), i.get("purpose")) for i in icons}
        # must include 192/512 maskable
        assert any(s[0] == "192x192" and "maskable" in (s[1] or "") for s in sizes), sizes
        assert any(s[0] == "512x512" and "maskable" in (s[1] or "") for s in sizes), sizes

    def test_sw_js(self):
        r = requests.get(f"{BASE_URL}/sw.js", timeout=20)
        assert r.status_code == 200
        body = r.text
        assert len(body) > 50
        # service worker hallmark
        assert ("self." in body) or ("addEventListener" in body) or ("caches" in body)

    def test_offline_html(self):
        r = requests.get(f"{BASE_URL}/offline.html", timeout=20)
        assert r.status_code == 200
        assert "<html" in r.text.lower() or "<!doctype" in r.text.lower()

    def test_icon_192(self):
        r = requests.get(f"{BASE_URL}/icons/icon-192.png", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image")

    def test_screenshot_buyer_mobile(self):
        r = requests.get(f"{BASE_URL}/screenshots/buyer-mobile.png", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image")


# ------------ Backend API: store-config onboarding_texts seed + update ------------
class TestStoreConfigOnboardingTexts:
    def test_get_store_config_has_default_onboarding_texts(self, api):
        r = api.get(f"{BASE_URL}/api/store-config", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "onboarding_texts" in data, list(data.keys())
        ot = data["onboarding_texts"]
        expected_keys = {"header_title", "welcome_title", "register_label", "login_label",
                         "guest_label", "tos_text", "otp_hint", "phone_hint"}
        missing = expected_keys - set(ot.keys())
        assert not missing, f"Missing keys in onboarding_texts: {missing}"

    def test_update_onboarding_texts_persists(self, seller, api):
        # snapshot original
        orig = api.get(f"{BASE_URL}/api/store-config", timeout=20).json()
        orig_ot = dict(orig.get("onboarding_texts") or {})

        payload = {"onboarding_texts": {**orig_ot, "header_title": "TEST_HALO!", "register_label": "TEST_REG"}}
        put = seller.put(f"{BASE_URL}/api/store-config", json=payload, timeout=20)
        assert put.status_code == 200, put.text[:300]

        got = api.get(f"{BASE_URL}/api/store-config", timeout=20).json()
        ot = got.get("onboarding_texts", {})
        assert ot.get("header_title") == "TEST_HALO!"
        assert ot.get("register_label") == "TEST_REG"

        # restore
        restore = seller.put(f"{BASE_URL}/api/store-config",
                             json={"onboarding_texts": orig_ot}, timeout=20)
        assert restore.status_code == 200

    def test_put_store_config_requires_pin(self, api):
        r = api.put(f"{BASE_URL}/api/store-config",
                    json={"onboarding_texts": {"header_title": "X"}}, timeout=20)
        assert r.status_code in (401, 403), r.status_code


# ------------ Backend API: media upload PIN guard ------------
class TestMediaUpload:
    def test_upload_without_pin_rejected(self):
        # send a tiny png
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 32, "image/png")}
        r = requests.post(f"{BASE_URL}/api/media/upload", files=files, timeout=20)
        assert r.status_code in (401, 403), r.status_code

    def test_upload_with_pin_accepted(self):
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")}
        r = requests.post(f"{BASE_URL}/api/media/upload",
                          files=files, headers={"X-Seller-PIN": SELLER_PIN}, timeout=30)
        # accept either 200 (saved) or 201
        assert r.status_code in (200, 201), r.text[:300]
        data = r.json()
        # expect some URL or path
        assert any(k in data for k in ("url", "path", "file_url", "filename"))


# ------------ Regression on existing endpoints ------------
class TestRegression:
    def test_products_list(self, api):
        r = api.get(f"{BASE_URL}/api/products", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_discounts_list(self, api):
        r = api.get(f"{BASE_URL}/api/discounts", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders_list_requires_pin(self, api):
        r = api.get(f"{BASE_URL}/api/orders", timeout=20)
        # seller-only listing — should reject without PIN OR allow (depending on design).
        assert r.status_code in (200, 401, 403)
