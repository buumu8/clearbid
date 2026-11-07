"""
Pytest tests for orchestrate/tools/review_tools.py.

All tests call _run_quote_review (plain Python function) directly,
bypassing the @tool ADK wrapper which would require the Orchestrate runtime.

test_data_sync is the only test that opens data/*.json files — it asserts
the bundled _DATA copy inside the tool stays in sync with the canonical files.
"""

import json
import pathlib
import sys

# Ensure the tool module is importable regardless of where pytest is invoked from.
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "orchestrate"))

from tools.review_tools import _run_quote_review, _DATA  # noqa: E402

_DATA_DIR = _REPO_ROOT / "data"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _flags_for(result: dict, vendor_name: str) -> list:
    """Return the flags list for a named vendor in a result dict."""
    for v in result["vendors"]:
        if v["vendor"] == vendor_name:
            return v["flags"]
    raise KeyError(f"Vendor '{vendor_name}' not found in result")


def _flag_types(flags: list) -> list:
    return [f["type"] for f in flags]


def _flag_levels(flags: list) -> list:
    return [f["level"] for f in flags]


# ---------------------------------------------------------------------------
# Scenario: laptops-50 (fraud case)
# ---------------------------------------------------------------------------

def test_laptops_vendor_a_has_high_price_flag():
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Apex Federal Solutions LLC")
    price_flags = [f for f in flags if f["type"] == "price"]
    assert price_flags, "Vendor A should have at least one price flag"
    assert any(f["level"] == "high" for f in price_flags), (
        "Vendor A price flag should be 'high' (unit price >100% above median)"
    )


def test_laptops_vendor_b_has_high_collusion_flag():
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Bridgepoint Office Supplies Inc")
    collusion_flags = [f for f in flags if f["type"] == "collusion"]
    assert collusion_flags, "Vendor B should have a collusion flag"
    assert any(f["level"] == "high" for f in collusion_flags), (
        "Vendor B collusion flag should be 'high' (shared address/bank with Vendor C)"
    )


def test_laptops_vendor_c_has_high_collusion_and_medium_vendor_flags():
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Vendor C Supplies LLC")
    collusion_flags = [f for f in flags if f["type"] == "collusion"]
    vendor_flags = [f for f in flags if f["type"] == "vendor"]
    assert any(f["level"] == "high" for f in collusion_flags), (
        "Vendor C should have a high collusion flag (shared address/bank with Vendor B)"
    )
    assert vendor_flags, "Vendor C should have a vendor exclusion flag"
    assert any(f["level"] == "medium" for f in vendor_flags), (
        "Vendor C exclusion flag should be 'medium'"
    )


def test_laptops_vendor_d_has_no_fraud_flags():
    """Vendor D is clean of fraud signals (price, vendor exclusion, collusion).
    A compliance/supervisor flag may fire because the line value exceeds $50k —
    that is a process requirement, not a fraud indicator."""
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Cornerstone Tech Group")
    fraud_flags = [f for f in flags if f["type"] in {"price", "vendor", "collusion"}]
    assert fraud_flags == [], f"Vendor D should have no fraud flags, got: {fraud_flags}"


def test_laptops_risk_level_is_high():
    result = _run_quote_review("laptops-50")
    assert result["risk_level"] == "high", (
        f"Expected risk_level 'high' for laptops-50, got '{result['risk_level']}'"
    )


def test_laptops_result_has_correct_contract_shape():
    result = _run_quote_review("laptops-50")
    assert "summary" in result
    assert "vendors" in result
    assert "risk_level" in result
    assert isinstance(result["summary"], str) and result["summary"]
    for v in result["vendors"]:
        assert "vendor" in v
        assert "unitPrice" in v
        assert "flags" in v
        for f in v["flags"]:
            assert f["type"] in {"price", "vendor", "collusion", "compliance"}
            assert f["level"] in {"low", "medium", "high"}
            assert isinstance(f["evidence"], str) and f["evidence"]


# ---------------------------------------------------------------------------
# Scenario: chairs-120 (clean case)
# ---------------------------------------------------------------------------

def test_chairs_all_vendors_have_no_flags():
    result = _run_quote_review("chairs-120")
    for v in result["vendors"]:
        assert v["flags"] == [], (
            f"Vendor '{v['vendor']}' should have no flags in chairs-120, got: {v['flags']}"
        )


def test_chairs_risk_level_is_low():
    result = _run_quote_review("chairs-120")
    assert result["risk_level"] == "low", (
        f"Expected risk_level 'low' for chairs-120, got '{result['risk_level']}'"
    )


# ---------------------------------------------------------------------------
# Scenario: toner-400 (single price flag)
# ---------------------------------------------------------------------------

def test_toner_exactly_one_vendor_has_price_flag():
    result = _run_quote_review("toner-400")
    vendors_with_price_flags = [
        v for v in result["vendors"]
        if any(f["type"] == "price" for f in v["flags"])
    ]
    assert len(vendors_with_price_flags) == 1, (
        f"Expected exactly 1 vendor with a price flag in toner-400, "
        f"got {len(vendors_with_price_flags)}: {[v['vendor'] for v in vendors_with_price_flags]}"
    )


def test_toner_price_flag_is_medium():
    result = _run_quote_review("toner-400")
    for v in result["vendors"]:
        for f in v["flags"]:
            if f["type"] == "price":
                assert f["level"] == "medium", (
                    f"Expected medium price flag for toner-400, got '{f['level']}' "
                    f"for vendor '{v['vendor']}'"
                )


def test_toner_no_collusion_no_vendor_no_compliance_flags():
    result = _run_quote_review("toner-400")
    for v in result["vendors"]:
        non_price = [f for f in v["flags"] if f["type"] != "price"]
        assert non_price == [], (
            f"Vendor '{v['vendor']}' in toner-400 should have no non-price flags, got: {non_price}"
        )


def test_toner_risk_level_is_medium():
    result = _run_quote_review("toner-400")
    assert result["risk_level"] == "medium", (
        f"Expected risk_level 'medium' for toner-400, got '{result['risk_level']}'"
    )


# ---------------------------------------------------------------------------
# Unknown scenario
# ---------------------------------------------------------------------------

def test_unknown_scenario_returns_error():
    result = _run_quote_review("nonexistent-999")
    assert "error" in result, f"Expected 'error' key for unknown scenario, got: {result}"
    assert "nonexistent-999" in result["error"]


# ---------------------------------------------------------------------------
# Data sync: _DATA inside the tool must match data/*.json canonical files
# ---------------------------------------------------------------------------

def test_data_sync_vendors():
    with open(_DATA_DIR / "vendors.json") as f:
        canonical = json.load(f)
    assert _DATA["vendors"] == canonical, (
        "Bundled _DATA['vendors'] does not match data/vendors.json — update one to match the other."
    )


def test_data_sync_quotes():
    with open(_DATA_DIR / "quotes.json") as f:
        canonical = json.load(f)
    assert _DATA["quotes"] == canonical, (
        "Bundled _DATA['quotes'] does not match data/quotes.json — update one to match the other."
    )


def test_data_sync_past_awards():
    with open(_DATA_DIR / "past_awards.json") as f:
        canonical = json.load(f)
    assert _DATA["past_awards"] == canonical, (
        "Bundled _DATA['past_awards'] does not match data/past_awards.json — update one to match the other."
    )


def test_data_sync_catalog():
    with open(_DATA_DIR / "catalog.json") as f:
        canonical = json.load(f)
    assert _DATA["catalog"] == canonical, (
        "Bundled _DATA['catalog'] does not match data/catalog.json — update one to match the other."
    )


def test_data_sync_exclusions():
    with open(_DATA_DIR / "exclusions.json") as f:
        canonical = json.load(f)
    assert _DATA["exclusions"] == canonical, (
        "Bundled _DATA['exclusions'] does not match data/exclusions.json — update one to match the other."
    )


def test_data_sync_rules():
    with open(_DATA_DIR / "rules.json") as f:
        canonical = json.load(f)
    assert _DATA["rules"] == canonical, (
        "Bundled _DATA['rules'] does not match data/rules.json — update one to match the other."
    )
