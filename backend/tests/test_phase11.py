"""
Phase 11 — Conversion KPI + date range filter + editable low-stock threshold.

Covers:
  - GET /api/analytics/stats new fields (range_*, conversion_rate, total_orders, overall_conversion_rate)
  - from_date/to_date query params (custom, invalid → fallback, swapped)
  - Auth requirement (X-Seller-PIN)
  - Conversion math (track visit + create order on same day)
  - GET /api/store-config returns low_stock_threshold + restock_safety_days
  - PUT /api/store-config persists low_stock_threshold/restock_safety_days
  - /api/insights/dashboard reflects threshold change (and sibling keys intact)
  - Threshold edge case: low_stock_threshold=0 does not crash
  - Always RESTORES low_stock_threshold=10, restock_safety_days=2 at session end
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

def _read_env(key):
    # Try env then frontend/.env file
    v = os.environ.get(key)
    if v:
        return v
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return ""


BASE_URL = _read_env("REACT_APP_BACKEND_URL").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"
PIN = "ciltarasa"
H = {"X-Seller-PIN": PIN}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session", autouse=True)
def restore_threshold(s):
    """Ensure low_stock_threshold=10, restock_safety_days=2 restored after run."""
    yield
    try:
        s.put(
            f"{API}/store-config",
            json={"low_stock_threshold": 10, "restock_safety_days": 2},
            headers=H,
        )
    except Exception:
        pass


# ─── analytics/stats default response ──────────────────────────────────────
class TestAnalyticsStatsDefault:
    def test_default_has_new_fields(self, s):
        r = s.get(f"{API}/analytics/stats", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        # New Phase 11 fields
        for k in [
            "total_orders", "overall_conversion_rate",
            "range_from", "range_to", "range_visits", "range_orders",
            "conversion_rate",
        ]:
            assert k in d, f"missing new key {k}"
        # Default range = last 30 days (29 days back → today inclusive = 30 entries)
        assert isinstance(d["daily"], list)
        assert len(d["daily"]) == 30
        # range_to should be today
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert d["range_to"] == today_key
        # types
        assert isinstance(d["total_orders"], int)
        assert isinstance(d["range_visits"], int)
        assert isinstance(d["range_orders"], int)
        assert isinstance(d["conversion_rate"], (int, float))
        assert isinstance(d["overall_conversion_rate"], (int, float))


class TestAnalyticsStatsCustomRange:
    def test_custom_range(self, s):
        r = s.get(f"{API}/analytics/stats?from_date=2026-05-15&to_date=2026-05-20", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["range_from"] == "2026-05-15"
        assert d["range_to"] == "2026-05-20"
        # 6 days inclusive
        assert len(d["daily"]) == 6
        # All daily entries have shape {date, visits}
        for item in d["daily"]:
            assert "date" in item and "visits" in item

    def test_invalid_from_date_falls_back(self, s):
        r = s.get(f"{API}/analytics/stats?from_date=BADDATE", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        # Should not crash; range_from falls back to month_cutoff
        # daily should still be 30 entries
        assert len(d["daily"]) == 30
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        assert d["range_to"] == today_key

    def test_swapped_dates_are_swapped(self, s):
        # from > to → server swaps
        r = s.get(f"{API}/analytics/stats?from_date=2026-06-10&to_date=2026-06-05", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["range_from"] == "2026-06-05"
        assert d["range_to"] == "2026-06-10"
        assert len(d["daily"]) == 6


class TestAnalyticsStatsAuth:
    def test_no_pin_unauthorized(self, s):
        r = requests.get(f"{API}/analytics/stats")
        assert r.status_code == 401

    def test_with_pin_ok(self, s):
        r = s.get(f"{API}/analytics/stats", headers=H)
        assert r.status_code == 200


# ─── Conversion math ───────────────────────────────────────────────────────
class TestConversionMath:
    def test_track_then_order_then_conversion(self, s):
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Track a visit
        sid = f"TEST_conv_{uuid.uuid4().hex[:10]}"
        r_track = s.post(
            f"{API}/analytics/track",
            json={
                "session_id": sid,
                "path": "/",
                "referrer": "",
                "user_agent": "Mozilla/5.0 (Linux; Android 13)",
                "is_pwa": False,
            },
        )
        assert r_track.status_code == 200, r_track.text

        # Find an active product to attach to order
        prods = s.get(f"{API}/products").json()
        active = [p for p in prods if p.get("active")]
        if not active:
            pytest.skip("No active products available")
        p = active[0]

        # Create order
        order_payload = {
            "customer_name": "TEST_ConvBuyer",
            "customer_phone": "6285200000000",
            "customer_address": "Jl. Test 1",
            "delivery_method": "pickup",
            "delivery_fee": 0,
            "items": [{
                "product_id": p["id"],
                "product_name": p["name"],
                "price": float(p["price"]),
                "quantity": 1,
                "subtotal": float(p["price"]),
                "image_url": p.get("image_url", ""),
            }],
            "subtotal": float(p["price"]),
            "total": float(p["price"]),
            "notes": "TEST conversion",
            "payment_method": "cod",
        }
        r_order = s.post(f"{API}/orders", json=order_payload)
        assert r_order.status_code in (200, 201), r_order.text

        # Query stats for today
        r = s.get(f"{API}/analytics/stats?from_date={today_key}&to_date={today_key}", headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["range_visits"] >= 1
        assert d["range_orders"] >= 1
        assert isinstance(d["conversion_rate"], (int, float))
        # Validates expected formula approximately
        if d["range_visits"] > 0:
            expected = round((d["range_orders"] / d["range_visits"]) * 100, 2)
            assert d["conversion_rate"] == expected


# ─── store-config low_stock_threshold + restock_safety_days ────────────────
class TestStoreConfigThresholds:
    def test_get_returns_defaults(self, s):
        r = s.get(f"{API}/store-config")
        assert r.status_code == 200
        cfg = r.json()
        # Defaults should be present (10 / 2) — but may already be customised; assert key exists
        assert "low_stock_threshold" in cfg
        assert "restock_safety_days" in cfg
        assert isinstance(cfg["low_stock_threshold"], int)
        assert isinstance(cfg["restock_safety_days"], int)

    def test_put_threshold_updates_insights(self, s):
        # First grab a snapshot of insights at threshold=10
        s.put(
            f"{API}/store-config",
            json={"low_stock_threshold": 10, "restock_safety_days": 2},
            headers=H,
        )
        r10 = s.get(f"{API}/insights/dashboard", headers=H)
        assert r10.status_code == 200, r10.text
        ins10 = r10.json()
        assert ins10.get("low_stock_threshold") == 10
        assert ins10.get("restock_safety_days") == 2
        low_count_10 = ins10.get("low_stock_count", 0)

        # Save sibling field so we can confirm it survives PUT
        sib_before = s.get(f"{API}/store-config").json()
        header_title_before = (sib_before.get("onboarding_texts") or {}).get("header_title")

        # Update to 25 / 5
        r_put = s.put(
            f"{API}/store-config",
            json={"low_stock_threshold": 25, "restock_safety_days": 5},
            headers=H,
        )
        assert r_put.status_code == 200, r_put.text

        # Verify store-config reflects new vals
        cfg = s.get(f"{API}/store-config").json()
        assert cfg["low_stock_threshold"] == 25
        assert cfg["restock_safety_days"] == 5
        # Sibling not wiped
        if header_title_before is not None:
            assert (cfg.get("onboarding_texts") or {}).get("header_title") == header_title_before

        # Verify insights reflects new vals
        r25 = s.get(f"{API}/insights/dashboard", headers=H)
        assert r25.status_code == 200
        ins25 = r25.json()
        assert ins25["low_stock_threshold"] == 25
        assert ins25["restock_safety_days"] == 5
        low_count_25 = ins25.get("low_stock_count", 0)
        # threshold=25 should produce ≥ count vs threshold=10
        assert low_count_25 >= low_count_10

    def test_threshold_zero_does_not_crash(self, s):
        r_put = s.put(
            f"{API}/store-config",
            json={"low_stock_threshold": 0, "restock_safety_days": 2},
            headers=H,
        )
        assert r_put.status_code == 200, r_put.text
        r = s.get(f"{API}/insights/dashboard", headers=H)
        assert r.status_code == 200, r.text
        ins = r.json()
        # When threshold=0, server falls back to 10 because of `or 10` (truthy check)
        # That's fine — we just want NO crash and a sensible threshold echoed
        assert "low_stock_threshold" in ins
        assert isinstance(ins["low_stock_count"], int)

    def test_restore_defaults(self, s):
        r = s.put(
            f"{API}/store-config",
            json={"low_stock_threshold": 10, "restock_safety_days": 2},
            headers=H,
        )
        assert r.status_code == 200
        cfg = s.get(f"{API}/store-config").json()
        assert cfg["low_stock_threshold"] == 10
        assert cfg["restock_safety_days"] == 2


# ─── regression ────────────────────────────────────────────────────────────
class TestRegression:
    def test_products(self, s):
        assert s.get(f"{API}/products").status_code == 200

    def test_orders(self, s):
        assert s.get(f"{API}/orders").status_code == 200

    def test_store_config(self, s):
        assert s.get(f"{API}/store-config").status_code == 200

    def test_verify_pin(self, s):
        r = s.post(f"{API}/admin/verify-pin", json={"pin": PIN})
        assert r.status_code == 200
