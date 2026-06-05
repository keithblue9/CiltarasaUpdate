"""FASE 6 backend tests — Maintenance Mode + AI Insights + Modular routes."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
PIN_HEADER = {"X-Seller-PIN": "ciltarasa"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    yield sess
    # Teardown: restore maintenance enabled=false
    try:
        sess.put(f"{BASE_URL}/api/maintenance", json={"enabled": False}, headers=PIN_HEADER, timeout=15)
    except Exception:
        pass


# ============== Maintenance endpoints ==============
class TestMaintenance:
    def test_get_public_returns_full_config(self, s):
        r = s.get(f"{BASE_URL}/api/maintenance", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in [
            "enabled", "title", "message", "return_date", "return_time",
            "background_image_url", "show_contact_wa", "return_button_text",
        ]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["enabled"], bool)
        assert isinstance(d["show_contact_wa"], bool)

    def test_put_requires_pin(self, s):
        r = s.put(f"{BASE_URL}/api/maintenance", json={"enabled": True}, timeout=10)
        assert r.status_code == 401

    def test_put_partial_update_persists(self, s):
        # Enable + set wording
        payload = {
            "enabled": True,
            "title": "TEST_libur_dulu",
            "message": "Buka {return_date} jam {return_time}",
            "return_date": "2026-03-15",
            "return_time": "10:30",
        }
        r = s.put(f"{BASE_URL}/api/maintenance", json=payload, headers=PIN_HEADER, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is True
        assert body["title"] == "TEST_libur_dulu"
        # Verify persistence
        r2 = s.get(f"{BASE_URL}/api/maintenance", timeout=10)
        d = r2.json()
        assert d["enabled"] is True
        assert d["title"] == "TEST_libur_dulu"
        assert d["return_date"] == "2026-03-15"
        assert d["return_time"] == "10:30"

    def test_put_partial_does_not_wipe_other_fields(self, s):
        # Only update enabled — other fields should remain from previous test
        r = s.put(f"{BASE_URL}/api/maintenance", json={"enabled": False}, headers=PIN_HEADER, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is False
        assert d["title"] == "TEST_libur_dulu"  # preserved
        assert d["return_date"] == "2026-03-15"


# ============== AI Insights ==============
class TestAIInsights:
    def test_requires_pin(self, s):
        r = s.get(f"{BASE_URL}/api/ai/insights", timeout=10)
        assert r.status_code == 401

    def test_clear_cache_first(self, s):
        r = s.delete(f"{BASE_URL}/api/ai/insights/cache", headers=PIN_HEADER, timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_first_call_generates_fresh(self, s):
        """First call after cache clear → not cached, may take 10-15s for LLM."""
        r = s.get(f"{BASE_URL}/api/ai/insights", headers=PIN_HEADER, timeout=60)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        d = r.json()
        # Required keys
        for k in ["restock_suggestions", "demand_forecast", "key_insights", "action_items"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["restock_suggestions"], list)
        assert isinstance(d["key_insights"], list)
        assert isinstance(d["action_items"], list)
        # demand_forecast shape
        df = d["demand_forecast"]
        for k in ["next_7d_estimated_orders", "next_7d_estimated_revenue",
                  "top_3_predicted_sellers", "trend", "confidence"]:
            assert k in df, f"demand_forecast missing {k}"
        assert isinstance(df["top_3_predicted_sellers"], list)
        # Meta
        assert d.get("_cached") is False
        assert "_generated_at" in d
        assert d.get("_products_analyzed", 0) >= 1
        # restock items shape (if any)
        for it in d["restock_suggestions"][:1]:
            for k in ["product_name", "urgency", "reason", "suggested_qty", "days_until_stockout"]:
                assert k in it, f"restock item missing {k}"

    def test_second_call_returns_cached(self, s):
        r = s.get(f"{BASE_URL}/api/ai/insights", headers=PIN_HEADER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("_cached") is True
        assert "_cache_age_minutes" in d

    def test_force_bypass_cache(self, s):
        r = s.get(f"{BASE_URL}/api/ai/insights?force=true", headers=PIN_HEADER, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d.get("_cached") is False

    def test_clear_cache_endpoint(self, s):
        r = s.delete(f"{BASE_URL}/api/ai/insights/cache", headers=PIN_HEADER, timeout=10)
        assert r.status_code == 200
        assert r.json().get("cleared", 0) >= 0


# ============== Modular routes structure ==============
class TestModularRoutes:
    def test_routes_files_exist(self):
        for p in [
            "/app/backend/routes/__init__.py",
            "/app/backend/routes/maintenance.py",
            "/app/backend/routes/ai_insights.py",
        ]:
            assert os.path.exists(p), f"missing {p}"

    def test_endpoints_registered(self, s):
        # Sanity: both router endpoints respond (200 or 401, NOT 404)
        r1 = s.get(f"{BASE_URL}/api/maintenance", timeout=10)
        assert r1.status_code != 404
        r2 = s.get(f"{BASE_URL}/api/ai/insights", timeout=10)
        assert r2.status_code != 404  # 401 expected without PIN
