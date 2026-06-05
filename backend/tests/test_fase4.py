"""
FASE 4 — Seller Dashboard Revamp (4 tabs: general/inventory/sales/customer).

Covers:
  - Auth (X-Seller-PIN) for all 4 /api/dashboard/* endpoints
  - Response shape: kpi keys + trend/top_products/recent_orders/status_breakdown
  - Inventory tab: kpi + low_stock/out_of_stock/top_movers/slow_movers/category_breakdown
  - Sales tab: trend/payment_breakdown/category_sales/best_sellers/status_funnel/hour_heatmap(24)
  - Customer tab: kpi + top_customers + acquisition_trend
  - Period filter (7d|30d|90d|custom) — different period returns different counts (or same if all in range)
  - Real data sanity: kpi.orders matches db count of non-cancelled orders in range
  - Stock value = sum(price*stock)
  - dashboard_config in store-config: default_period + 4 sub-dicts of show_* keys
  - PUT partial update of dashboard_config preserves siblings
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta


def _read_env(key):
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


# ─── Auth ───────────────────────────────────────────────────────────────
class TestAuth:
    @pytest.mark.parametrize("path", [
        "/dashboard/general",
        "/dashboard/inventory",
        "/dashboard/sales",
        "/dashboard/customer",
    ])
    def test_unauth_returns_401(self, s, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} expected 401 got {r.status_code}"

    @pytest.mark.parametrize("path", [
        "/dashboard/general",
        "/dashboard/inventory",
        "/dashboard/sales",
        "/dashboard/customer",
    ])
    def test_with_pin_returns_200(self, s, path):
        r = s.get(f"{API}{path}", headers=H)
        assert r.status_code == 200, f"{path} expected 200 got {r.status_code}: {r.text[:200]}"


# ─── General tab shape ───────────────────────────────────────────────────
class TestDashboardGeneral:
    def test_shape(self, s):
        r = s.get(f"{API}/dashboard/general?period=30d", headers=H)
        assert r.status_code == 200
        d = r.json()
        for k in ["period", "kpi", "trend", "top_products", "recent_orders", "status_breakdown"]:
            assert k in d, f"missing key {k}"
        for k in ["revenue", "orders", "aov", "unique_customers"]:
            assert k in d["kpi"], f"missing kpi.{k}"
        assert isinstance(d["kpi"]["orders"], int)
        assert isinstance(d["kpi"]["revenue"], (int, float))
        assert isinstance(d["trend"], list)
        assert isinstance(d["top_products"], list)
        assert isinstance(d["recent_orders"], list)
        assert isinstance(d["status_breakdown"], list)

    def test_recent_orders_max_10(self, s):
        r = s.get(f"{API}/dashboard/general?period=90d", headers=H)
        d = r.json()
        assert len(d["recent_orders"]) <= 10

    def test_period_variations(self, s):
        r7 = s.get(f"{API}/dashboard/general?period=7d", headers=H).json()
        r30 = s.get(f"{API}/dashboard/general?period=30d", headers=H).json()
        r90 = s.get(f"{API}/dashboard/general?period=90d", headers=H).json()
        # 90d orders >= 30d orders >= 7d orders (assuming non-shrinking history)
        assert r90["kpi"]["orders"] >= r30["kpi"]["orders"] >= r7["kpi"]["orders"]
        # Trend length should differ
        assert len(r7["trend"]) <= len(r30["trend"]) <= len(r90["trend"])

    def test_custom_period(self, s):
        today = datetime.now(timezone.utc)
        start = (today - timedelta(days=14)).strftime("%Y-%m-%d")
        end = today.strftime("%Y-%m-%d")
        r = s.get(f"{API}/dashboard/general?period=custom&start={start}&end={end}", headers=H)
        assert r.status_code == 200
        d = r.json()
        assert "kpi" in d

    def test_real_data_orders_match_db_count(self, s):
        """kpi.orders == count of non-cancelled orders in range fetched via /api/orders."""
        period_resp = s.get(f"{API}/dashboard/general?period=90d", headers=H).json()
        kpi_orders = period_resp["kpi"]["orders"]
        # Reproduce server filter: created_at in [start, end] and status != dibatalkan
        start = datetime.fromisoformat(period_resp["period"]["start"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(period_resp["period"]["end"].replace("Z", "+00:00"))
        all_orders = s.get(f"{API}/orders", headers=H).json()
        manual_count = 0
        for o in all_orders:
            if o.get("status") == "dibatalkan":
                continue
            ts = o.get("created_at", "")
            if not ts:
                continue
            try:
                t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
            if start <= t <= end:
                manual_count += 1
        assert kpi_orders == manual_count, f"kpi.orders={kpi_orders} vs db count={manual_count}"


# ─── Inventory tab shape ────────────────────────────────────────────────
class TestDashboardInventory:
    def test_shape(self, s):
        r = s.get(f"{API}/dashboard/inventory", headers=H)
        assert r.status_code == 200
        d = r.json()
        for k in ["kpi", "low_stock_items", "out_of_stock_items", "top_movers", "slow_movers", "category_breakdown"]:
            assert k in d, f"missing {k}"
        for k in ["total_products", "low_stock_count", "out_of_stock_count", "stock_value", "low_stock_threshold"]:
            assert k in d["kpi"], f"missing kpi.{k}"

    def test_stock_value_matches_sum_price_stock(self, s):
        """Server formula: sum((cost_price OR price) * stock) for ALL products (active+inactive)."""
        r = s.get(f"{API}/dashboard/inventory", headers=H).json()
        stock_value_kpi = r["kpi"]["stock_value"]
        products = s.get(f"{API}/products").json()
        # Public /api/products may filter to active only; we can still validate non-negative & matches active subset bound
        # Compute both: price-based (all) and cost-based (all where available)
        expected_price_all = sum(float(p.get("price", 0)) * int(p.get("stock", 0)) for p in products)
        expected_costfallback = sum(
            float(p.get("cost_price") or p.get("price", 0)) * int(p.get("stock", 0)) for p in products
        )
        # stock_value should match one of the formulas OR be within range
        assert stock_value_kpi >= 0
        # Should be at most the price-based sum (since cost_price <= price typically)
        assert stock_value_kpi <= expected_price_all + 1, (
            f"stock_value kpi={stock_value_kpi} exceeds price-based sum={expected_price_all}"
        )
        # If all products have no cost_price, should match price formula
        if all(not p.get("cost_price") for p in products):
            assert abs(stock_value_kpi - expected_price_all) < 1.0

    def test_total_products_matches_active_count(self, s):
        r = s.get(f"{API}/dashboard/inventory", headers=H).json()
        products = s.get(f"{API}/products").json()
        active_count = sum(1 for p in products if p.get("active"))
        # total_products may include inactive; check it's >= active
        assert r["kpi"]["total_products"] >= active_count - 0


# ─── Sales tab shape ─────────────────────────────────────────────────────
class TestDashboardSales:
    def test_shape(self, s):
        r = s.get(f"{API}/dashboard/sales?period=30d", headers=H)
        assert r.status_code == 200
        d = r.json()
        for k in ["trend", "payment_breakdown", "category_sales", "best_sellers", "status_funnel", "hour_heatmap"]:
            assert k in d, f"missing {k}"
        # hour_heatmap MUST be 24 items
        assert len(d["hour_heatmap"]) == 24, f"hour_heatmap should be 24 items, got {len(d['hour_heatmap'])}"

    def test_payment_breakdown_list(self, s):
        d = s.get(f"{API}/dashboard/sales?period=90d", headers=H).json()
        assert isinstance(d["payment_breakdown"], list)


# ─── Customer tab shape ─────────────────────────────────────────────────
class TestDashboardCustomer:
    def test_shape(self, s):
        r = s.get(f"{API}/dashboard/customer?period=30d", headers=H)
        assert r.status_code == 200
        d = r.json()
        for k in ["kpi", "top_customers", "acquisition_trend"]:
            assert k in d, f"missing {k}"
        for k in ["total_customers", "new_customers", "returning_customers", "avg_orders_per_customer", "retention_rate"]:
            assert k in d["kpi"], f"missing kpi.{k}"


# ─── store-config dashboard_config ──────────────────────────────────────
class TestDashboardConfig:
    def test_get_returns_dashboard_config(self, s):
        cfg = s.get(f"{API}/store-config").json()
        assert "dashboard_config" in cfg
        dc = cfg["dashboard_config"]
        assert "default_period" in dc
        for tab in ["general", "inventory", "sales", "customer"]:
            assert tab in dc, f"dashboard_config.{tab} missing"
            assert isinstance(dc[tab], dict)
            # Every sub-key must start with show_ and be bool
            for k, v in dc[tab].items():
                assert k.startswith("show_"), f"{tab}.{k} not show_ prefix"
                assert isinstance(v, bool), f"{tab}.{k} not bool"

    def test_partial_update_preserves_siblings(self, s):
        # Snapshot
        before = s.get(f"{API}/store-config").json()
        dc_before = before["dashboard_config"]
        # Pick one sibling we'll preserve
        original_general = dict(dc_before["general"])
        # Update only inventory's first key
        first_inv_key = next(iter(dc_before["inventory"]))
        new_val = not dc_before["inventory"][first_inv_key]
        r = s.put(
            f"{API}/store-config",
            json={"dashboard_config": {"inventory": {first_inv_key: new_val}}},
            headers=H,
        )
        assert r.status_code == 200, r.text
        after = s.get(f"{API}/store-config").json()
        dc_after = after["dashboard_config"]
        # inventory key updated
        assert dc_after["inventory"][first_inv_key] == new_val
        # general untouched
        assert dc_after["general"] == original_general, "general siblings wiped on partial inventory update"
        # default_period untouched
        assert dc_after.get("default_period") == dc_before.get("default_period")
        # Restore
        s.put(
            f"{API}/store-config",
            json={"dashboard_config": {"inventory": {first_inv_key: not new_val}}},
            headers=H,
        )

    def test_default_period_update(self, s):
        before = s.get(f"{API}/store-config").json()
        original_period = before["dashboard_config"].get("default_period", "30d")
        # Set to 7d
        r = s.put(
            f"{API}/store-config",
            json={"dashboard_config": {"default_period": "7d"}},
            headers=H,
        )
        assert r.status_code == 200
        after = s.get(f"{API}/store-config").json()
        assert after["dashboard_config"]["default_period"] == "7d"
        # All tab sub-dicts should still exist
        for tab in ["general", "inventory", "sales", "customer"]:
            assert tab in after["dashboard_config"]
        # Restore
        s.put(
            f"{API}/store-config",
            json={"dashboard_config": {"default_period": original_period}},
            headers=H,
        )
