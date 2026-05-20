"""
Phase 10 — Editable Seller PIN + Visitor Analytics
Tests:
  - POST /api/admin/verify-pin (correct + wrong)
  - POST /api/admin/change-pin (success, wrong current, too short, same as current)
  - X-Seller-PIN header guard switches with new PIN
  - POST /api/analytics/track (idempotent per session_id)
  - GET /api/analytics/stats (auth-guarded + shape)
  - device parser + referrer parser correctness via integration
  - regression on PUT /api/store-config
At the end: restore PIN to default `ciltarasa`.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://frozen-snack-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
DEFAULT_PIN = "ciltarasa"
TEST_NEW_PIN = "tst_pin_9912"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session", autouse=True)
def restore_pin_after_session(s):
    """Always restore PIN back to default `ciltarasa` at end of run."""
    yield
    # Discover current PIN: try default, then TEST_NEW_PIN
    for candidate in [DEFAULT_PIN, TEST_NEW_PIN]:
        r = s.post(f"{API}/admin/verify-pin", json={"pin": candidate})
        if r.status_code == 200:
            current = candidate
            break
    else:
        return
    if current != DEFAULT_PIN:
        s.post(f"{API}/admin/change-pin", json={"current_pin": current, "new_pin": DEFAULT_PIN})


# ─── verify-pin ─────────────────────────────────────────────────────────────
class TestVerifyPin:
    def test_verify_pin_success(self, s):
        r = s.post(f"{API}/admin/verify-pin", json={"pin": DEFAULT_PIN})
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_verify_pin_wrong(self, s):
        r = s.post(f"{API}/admin/verify-pin", json={"pin": "wrong_pin_xx"})
        assert r.status_code == 401


# ─── change-pin (state-mutating; run in order) ─────────────────────────────
class TestChangePin:
    def test_change_pin_too_short(self, s):
        r = s.post(f"{API}/admin/change-pin", json={"current_pin": DEFAULT_PIN, "new_pin": "abc"})
        assert r.status_code == 400

    def test_change_pin_same_as_current(self, s):
        r = s.post(f"{API}/admin/change-pin", json={"current_pin": DEFAULT_PIN, "new_pin": DEFAULT_PIN})
        assert r.status_code == 400

    def test_change_pin_wrong_current(self, s):
        r = s.post(f"{API}/admin/change-pin", json={"current_pin": "not_the_pin", "new_pin": "anything9999"})
        assert r.status_code == 401

    def test_change_pin_success_and_old_invalidated(self, s):
        # Change to test pin
        r = s.post(f"{API}/admin/change-pin", json={"current_pin": DEFAULT_PIN, "new_pin": TEST_NEW_PIN})
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True
        # Old PIN must now fail
        r_old = s.post(f"{API}/admin/verify-pin", json={"pin": DEFAULT_PIN})
        assert r_old.status_code == 401
        # New PIN must succeed
        r_new = s.post(f"{API}/admin/verify-pin", json={"pin": TEST_NEW_PIN})
        assert r_new.status_code == 200

    def test_header_guard_switches_with_pin(self, s):
        # After change, store-config PUT with OLD pin → 401
        r_bad = s.put(f"{API}/store-config", json={"store_name": "Ciltarasa"}, headers={"X-Seller-PIN": DEFAULT_PIN})
        assert r_bad.status_code == 401
        # With NEW pin → 200
        r_ok = s.put(f"{API}/store-config", json={"store_name": "Ciltarasa"}, headers={"X-Seller-PIN": TEST_NEW_PIN})
        assert r_ok.status_code == 200, r_ok.text

    def test_change_pin_back_to_default(self, s):
        r = s.post(f"{API}/admin/change-pin", json={"current_pin": TEST_NEW_PIN, "new_pin": DEFAULT_PIN})
        assert r.status_code == 200
        # Verify restored
        r2 = s.post(f"{API}/admin/verify-pin", json={"pin": DEFAULT_PIN})
        assert r2.status_code == 200
        # And header guard with default works
        r3 = s.put(f"{API}/store-config", json={"store_name": "Ciltarasa"}, headers={"X-Seller-PIN": DEFAULT_PIN})
        assert r3.status_code == 200


# ─── analytics tracking ────────────────────────────────────────────────────
class TestAnalyticsTrack:
    def test_track_no_auth_required(self, s):
        sid = f"TEST_sess_{uuid.uuid4().hex[:10]}"
        body = {
            "session_id": sid,
            "path": "/",
            "referrer": "https://www.google.com/search?q=ciltarasa",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605",
            "is_pwa": False,
        }
        r = s.post(f"{API}/analytics/track", json=body)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

    def test_track_idempotent_same_session(self, s):
        sid = f"TEST_sess_{uuid.uuid4().hex[:10]}"
        body = {
            "session_id": sid,
            "path": "/",
            "referrer": "https://instagram.com/ciltarasa",
            "user_agent": "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit",
            "is_pwa": False,
        }
        # Fetch baseline total
        stats0 = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()
        # First track
        assert s.post(f"{API}/analytics/track", json=body).status_code == 200
        stats1 = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()
        assert stats1["total_visits"] == stats0["total_visits"] + 1
        # Second track with SAME session id — should NOT create new visit
        assert s.post(f"{API}/analytics/track", json=body).status_code == 200
        stats2 = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()
        assert stats2["total_visits"] == stats1["total_visits"], "Same session_id should not create new visit"
        # But total_hits should bump
        assert stats2["total_hits"] >= stats1["total_hits"] + 1

    def test_track_pwa_increments_pwa_counter(self, s):
        sid = f"TEST_pwa_{uuid.uuid4().hex[:10]}"
        before = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["pwa_visits"]
        r = s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "",
            "user_agent": "Mozilla/5.0 (iPhone)", "is_pwa": True,
        })
        assert r.status_code == 200
        after = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["pwa_visits"]
        assert after == before + 1


# ─── analytics stats ───────────────────────────────────────────────────────
class TestAnalyticsStats:
    def test_stats_requires_pin(self, s):
        r = requests.get(f"{API}/analytics/stats")
        assert r.status_code == 401

    def test_stats_wrong_pin(self, s):
        r = requests.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": "nope"})
        assert r.status_code == 401

    def test_stats_shape(self, s):
        r = s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_visits", "total_hits", "today_visits", "week_visits",
                  "month_visits", "pwa_visits", "daily", "sources", "devices"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["daily"], list)
        assert len(d["daily"]) == 30, f"daily must be 30 days, got {len(d['daily'])}"
        for item in d["daily"]:
            assert "date" in item and "visits" in item
        assert isinstance(d["sources"], list)
        assert isinstance(d["devices"], list)
        if d["sources"]:
            assert "source" in d["sources"][0] and "count" in d["sources"][0]
        if d["devices"]:
            assert "device" in d["devices"][0] and "count" in d["devices"][0]


# ─── parser correctness via integration ────────────────────────────────────
class TestParsers:
    def _seed_and_get_devices(self, s):
        return s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()

    def test_device_ios(self, s):
        sid = f"TEST_ios_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "",
            "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "is_pwa": False,
        })
        devs = {d["device"]: d["count"] for d in self._seed_and_get_devices(s)["devices"]}
        assert "ios" in devs and devs["ios"] >= 1

    def test_device_android(self, s):
        sid = f"TEST_and_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "",
            "user_agent": "Mozilla/5.0 (Linux; Android 13)", "is_pwa": False,
        })
        devs = {d["device"]: d["count"] for d in self._seed_and_get_devices(s)["devices"]}
        assert "android" in devs and devs["android"] >= 1

    def test_device_desktop(self, s):
        sid = f"TEST_dsk_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "is_pwa": False,
        })
        devs = {d["device"]: d["count"] for d in self._seed_and_get_devices(s)["devices"]}
        assert "desktop" in devs and devs["desktop"] >= 1

    def test_referrer_google(self, s):
        sid = f"TEST_gg_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "https://www.google.com/search?q=ciltarasa",
            "user_agent": "Mozilla/5.0", "is_pwa": False,
        })
        srcs = {x["source"]: x["count"] for x in s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["sources"]}
        assert "google" in srcs

    def test_referrer_instagram(self, s):
        sid = f"TEST_ig_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "https://instagram.com/ciltarasa",
            "user_agent": "Mozilla/5.0", "is_pwa": False,
        })
        srcs = {x["source"]: x["count"] for x in s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["sources"]}
        assert "instagram" in srcs

    def test_referrer_tiktok(self, s):
        sid = f"TEST_tt_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "https://tiktok.com/@ciltarasa",
            "user_agent": "Mozilla/5.0", "is_pwa": False,
        })
        srcs = {x["source"]: x["count"] for x in s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["sources"]}
        assert "tiktok" in srcs

    def test_referrer_direct(self, s):
        sid = f"TEST_dir_{uuid.uuid4().hex[:10]}"
        s.post(f"{API}/analytics/track", json={
            "session_id": sid, "path": "/", "referrer": "",
            "user_agent": "Mozilla/5.0", "is_pwa": False,
        })
        srcs = {x["source"]: x["count"] for x in s.get(f"{API}/analytics/stats", headers={"X-Seller-PIN": DEFAULT_PIN}).json()["sources"]}
        assert "direct" in srcs


# ─── regression ─────────────────────────────────────────────────────────────
class TestRegression:
    def test_store_config_get_still_works(self, s):
        r = s.get(f"{API}/store-config")
        assert r.status_code == 200

    def test_products_list_still_works(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_orders_list_still_works(self, s):
        r = s.get(f"{API}/orders")
        assert r.status_code == 200
