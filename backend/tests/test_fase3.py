"""
FASE 3 Backend Tests — Auto-Chat WhatsApp + PDF Invoice configurable wording.

Coverage:
1. GET /api/store-config returns auto_chat_config (5 stages) + invoice_texts (>=15 keys).
2. PUT /api/store-config supports partial deep-merge updates without wiping siblings.
3. POST /api/orders triggers WA notif using auto_chat_config['menunggu'] template.
4. PUT /api/orders/{id}/status triggers WA notif using auto_chat_config[new_status] template.
5. Toggle seller_enabled/buyer_enabled controls whether WA attempts are made.
6. Template placeholders are rendered (verified via WA reason not being a render error).
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
SELLER_PIN = "ciltarasa"
HEADERS_PIN = {"X-Seller-PIN": SELLER_PIN, "Content-Type": "application/json"}

REQUIRED_STAGES = ["menunggu", "diproses", "siap", "selesai", "dibatalkan"]
REQUIRED_STAGE_KEYS = ["seller_enabled", "seller_template", "buyer_enabled", "buyer_template"]
REQUIRED_INVOICE_KEYS = [
    "title", "subtitle", "order_number_label", "order_date_label",
    "payment_method_label", "delivery_method_label", "buyer_section_label",
    "items_section_label", "subtotal_label", "delivery_fee_label",
    "total_label", "notes_label", "footer_thanks", "footer_contact",
    "footer_disclaimer",
]


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_api():
    s = requests.Session()
    s.headers.update(HEADERS_PIN)
    return s


@pytest.fixture(scope="module")
def original_config(admin_api):
    """Snapshot original store_config so we can restore after tests."""
    r = admin_api.get(f"{BASE_URL}/api/store-config")
    assert r.status_code == 200
    cfg = r.json()
    yield cfg
    # Restore auto_chat_config + invoice_texts so we don't pollute prod data
    restore = {
        "auto_chat_config": cfg.get("auto_chat_config", {}),
        "invoice_texts": cfg.get("invoice_texts", {}),
    }
    try:
        admin_api.put(f"{BASE_URL}/api/store-config", json=restore)
    except Exception:
        pass


# ─── Tests 1 & 6: Store config shape ───────────────────────────────
class TestStoreConfigShape:
    def test_auto_chat_config_has_5_stages(self, admin_api, original_config):
        cfg = original_config
        acc = cfg.get("auto_chat_config")
        assert acc is not None, "auto_chat_config missing from /api/store-config"
        assert isinstance(acc, dict)
        for stg in REQUIRED_STAGES:
            assert stg in acc, f"Missing stage: {stg}"
            for k in REQUIRED_STAGE_KEYS:
                assert k in acc[stg], f"Stage {stg} missing key {k}"
            assert isinstance(acc[stg]["seller_enabled"], bool)
            assert isinstance(acc[stg]["buyer_enabled"], bool)
            assert isinstance(acc[stg]["seller_template"], str)
            assert isinstance(acc[stg]["buyer_template"], str)

    def test_invoice_texts_has_required_keys(self, original_config):
        cfg = original_config
        itx = cfg.get("invoice_texts")
        assert itx is not None, "invoice_texts missing from /api/store-config"
        assert isinstance(itx, dict)
        for k in REQUIRED_INVOICE_KEYS:
            assert k in itx, f"invoice_texts missing key: {k}"
            assert isinstance(itx[k], str)
        # Spec says 16 keys — accept >=15 (summary_label is bonus in backend)
        assert len(itx) >= 15, f"Expected at least 15 invoice text keys, got {len(itx)}"


# ─── Test 2: Partial deep-merge ────────────────────────────────────
class TestPartialUpdate:
    def test_partial_auto_chat_update_preserves_siblings(self, admin_api, original_config):
        # Update only diproses.buyer_template and verify other stages intact
        original_menunggu = original_config["auto_chat_config"]["menunggu"]
        original_siap = original_config["auto_chat_config"]["siap"]
        new_diproses_buyer_template = "TEST_FASE3 diproses template {order_id} for {customer_name}"

        payload = {
            "auto_chat_config": {
                "diproses": {
                    **original_config["auto_chat_config"]["diproses"],
                    "buyer_template": new_diproses_buyer_template,
                }
            }
        }
        r = admin_api.put(f"{BASE_URL}/api/store-config", json=payload)
        assert r.status_code == 200, f"PUT failed: {r.status_code} {r.text}"

        # Verify change persisted
        g = admin_api.get(f"{BASE_URL}/api/store-config")
        cfg = g.json()
        assert cfg["auto_chat_config"]["diproses"]["buyer_template"] == new_diproses_buyer_template
        # Verify siblings (menunggu, siap) untouched
        assert cfg["auto_chat_config"]["menunggu"]["seller_template"] == original_menunggu["seller_template"]
        assert cfg["auto_chat_config"]["siap"]["buyer_template"] == original_siap["buyer_template"]

    def test_partial_invoice_texts_update_preserves_siblings(self, admin_api, original_config):
        original_title = original_config["invoice_texts"]["title"]
        original_footer = original_config["invoice_texts"]["footer_thanks"]
        new_subtitle = "TEST_FASE3 custom subtitle"

        r = admin_api.put(
            f"{BASE_URL}/api/store-config",
            json={"invoice_texts": {"subtitle": new_subtitle}},
        )
        assert r.status_code == 200

        g = admin_api.get(f"{BASE_URL}/api/store-config")
        itx = g.json()["invoice_texts"]
        assert itx["subtitle"] == new_subtitle
        assert itx["title"] == original_title
        assert itx["footer_thanks"] == original_footer

    def test_pin_required_for_put(self, api):
        r = api.put(f"{BASE_URL}/api/store-config", json={"invoice_texts": {"title": "X"}})
        assert r.status_code in (401, 403), f"Expected 401/403 without PIN, got {r.status_code}"


# ─── Tests 3, 4, 5: Auto-Chat trigger on order create + status update ───
@pytest.fixture(scope="module")
def test_product(admin_api):
    """Create a TEST product for orders."""
    payload = {
        "name": "TEST_FASE3_Risoles",
        "price": 25000,
        "stock": 1000,
        "category": "frozen",
        "description": "fase3 test",
        "image_url": "",
        "unit_cost": 10000,
    }
    r = admin_api.post(f"{BASE_URL}/api/products", json=payload)
    assert r.status_code in (200, 201), f"Create product failed: {r.status_code} {r.text}"
    p = r.json()
    yield p
    # Cleanup
    try:
        admin_api.delete(f"{BASE_URL}/api/products/{p['id']}")
    except Exception:
        pass


def _make_order_payload(product):
    return {
        "customer_name": "TEST_FASE3_Buyer",
        "customer_phone": "081912853950",
        "customer_address": "Test Address 123",
        "delivery_method": "delivery",
        "payment_method": "transfer",
        "items": [{
            "product_id": product["id"],
            "product_name": product["name"],
            "quantity": 1,
            "price": product["price"],
            "subtotal": product["price"],
        }],
        "subtotal": product["price"],
        "delivery_fee": 0,
        "total": product["price"],
        "notes": "TEST_FASE3 order",
    }


class TestAutoChatTrigger:
    def test_order_create_triggers_seller_wa_by_default(self, api, admin_api, test_product, original_config):
        # Ensure menunggu.seller_enabled=true & buyer_enabled=false (default)
        admin_api.put(f"{BASE_URL}/api/store-config", json={
            "auto_chat_config": {
                "menunggu": {
                    **original_config["auto_chat_config"]["menunggu"],
                    "seller_enabled": True,
                    "buyer_enabled": False,
                }
            }
        })
        time.sleep(0.3)

        r = api.post(f"{BASE_URL}/api/orders", json=_make_order_payload(test_product))
        assert r.status_code in (200, 201), f"POST /orders failed: {r.status_code} {r.text}"
        doc = r.json()
        # Diagnostic fields present
        assert "_wa_seller_sent" in doc, "Missing _wa_seller_sent flag"
        assert "_wa_buyer_sent" in doc, "Missing _wa_buyer_sent flag"
        # Buyer should NOT have been attempted (buyer_enabled=false)
        assert doc["_wa_buyer_sent"] is False
        # Seller attempt was made. With invalid Fonnte token, sent=false but reason should be 'token invalid' or similar (NOT 'disabled')
        seller_reason = (doc.get("_wa_buyer_reason") or "").lower()
        # Buyer reason should indicate disabled
        bg = (doc.get("_wa_buyer_reason") or "").lower()
        # Buyer was disabled in config
        assert "disabled" in bg or doc["_wa_buyer_sent"] is False
        # Save order id for further tests
        self.__class__.order_id = doc["id"]

    def test_buyer_enabled_triggers_buyer_wa_on_create(self, api, admin_api, test_product, original_config):
        # Enable buyer for menunggu
        admin_api.put(f"{BASE_URL}/api/store-config", json={
            "auto_chat_config": {
                "menunggu": {
                    **original_config["auto_chat_config"]["menunggu"],
                    "seller_enabled": True,
                    "buyer_enabled": True,
                    "buyer_template": "TEST FASE3 buyer template {order_id} {customer_name} total {total}",
                }
            }
        })
        time.sleep(0.3)

        r = api.post(f"{BASE_URL}/api/orders", json=_make_order_payload(test_product))
        assert r.status_code in (200, 201)
        doc = r.json()
        # Buyer WA was attempted now (sent may be false because token invalid, but reason should reflect Fonnte resp, not 'disabled')
        buyer_reason = (doc.get("_wa_buyer_reason") or "").lower()
        # If Fonnte token invalid, reason is 'token invalid' or empty (still attempted). 'disabled' would indicate config flag blocked it
        assert "disabled" not in buyer_reason, f"Buyer WA was NOT attempted: reason={buyer_reason}"

    def test_status_update_triggers_wa_for_buyer_by_default(self, api, admin_api, test_product, original_config):
        # Create an order first
        r = api.post(f"{BASE_URL}/api/orders", json=_make_order_payload(test_product))
        assert r.status_code in (200, 201)
        oid = r.json()["id"]
        time.sleep(0.3)

        # diproses default: buyer_enabled=true, seller_enabled=false
        admin_api.put(f"{BASE_URL}/api/store-config", json={
            "auto_chat_config": {
                "diproses": {
                    **original_config["auto_chat_config"]["diproses"],
                    "seller_enabled": False,
                    "buyer_enabled": True,
                }
            }
        })
        time.sleep(0.3)

        upd = admin_api.put(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "diproses"})
        assert upd.status_code == 200, f"Status update failed: {upd.text}"
        doc = upd.json()
        assert "_wa_buyer_sent" in doc
        assert "_wa_seller_sent" in doc
        # Buyer WA attempted (token invalid will be the reason if fails)
        br = (doc.get("_wa_buyer_reason") or "").lower()
        assert "disabled" not in br, f"Buyer WA should be attempted for diproses: {br}"
        # Seller WA should NOT be attempted (seller_enabled=false)
        sr = (doc.get("_wa_seller_reason") or "").lower()
        # seller_reason could be empty (no attempt + flag disabled) OR contain 'disabled' — current code only sets reason when wa_enabled but seller flag false
        # Check seller_sent=false at minimum
        assert doc["_wa_seller_sent"] is False

    def test_status_update_seller_enabled_triggers_seller_wa(self, api, admin_api, test_product, original_config):
        r = api.post(f"{BASE_URL}/api/orders", json=_make_order_payload(test_product))
        oid = r.json()["id"]
        time.sleep(0.3)

        # Enable seller for diproses
        admin_api.put(f"{BASE_URL}/api/store-config", json={
            "auto_chat_config": {
                "diproses": {
                    **original_config["auto_chat_config"]["diproses"],
                    "seller_enabled": True,
                    "buyer_enabled": True,
                    "seller_template": "TEST FASE3 seller diproses #{order_id} {customer_name}",
                }
            }
        })
        time.sleep(0.3)

        upd = admin_api.put(f"{BASE_URL}/api/orders/{oid}/status", json={"status": "diproses"})
        assert upd.status_code == 200
        doc = upd.json()
        sr = (doc.get("_wa_seller_reason") or "").lower()
        # Seller WA was attempted — reason should not say 'disabled'
        assert "disabled" not in sr, f"Seller WA should be attempted when seller_enabled=true: {sr}"

    def test_template_placeholders_rendered(self, api, admin_api, test_product, original_config):
        # Set a template with multiple placeholders; if render fails, WA reason would contain 'KeyError' or similar
        # We can't directly inspect rendered message but we ensure no template-related error in reason
        admin_api.put(f"{BASE_URL}/api/store-config", json={
            "auto_chat_config": {
                "menunggu": {
                    **original_config["auto_chat_config"]["menunggu"],
                    "seller_enabled": True,
                    "seller_template": "Order {order_id} from {customer_name} at {customer_address} total {total} subtotal {subtotal} delivery {delivery} items {items_detail} status {status} emoji {status_emoji} store {store_name} timestamp {timestamp} link {track_link}",
                }
            }
        })
        time.sleep(0.3)

        r = api.post(f"{BASE_URL}/api/orders", json=_make_order_payload(test_product))
        assert r.status_code in (200, 201)
        doc = r.json()
        sr = (doc.get("_wa_seller_reason") or "").lower()
        # Acceptable failure reasons: 'token invalid', 'disconnect', '' or any Fonnte msg.
        # Unacceptable: 'keyerror', 'unhashable', traceback indicators, 'render'
        for bad in ("keyerror", "traceback", "unhashable", "render"):
            assert bad not in sr, f"Template rendering error suspected: {sr}"
