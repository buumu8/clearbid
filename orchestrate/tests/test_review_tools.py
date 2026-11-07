"""
Pytest tests for orchestrate/tools/review_tools.py.

All tests call _run_quote_review (plain Python function) directly,
bypassing the @tool ADK wrapper which would require the Orchestrate runtime.

test_data_sync_* are the only tests that open data/*.json files — they assert
the bundled _DATA copy inside the tool stays in sync with the canonical files.
"""

import json
import pathlib
import sys

# Ensure the tool module is importable regardless of where pytest is invoked from.
_REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "orchestrate"))

from tools.review_tools import _run_quote_review, _DATA, _fuzzy_match, _normalize_name  # noqa: E402

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
    flags = _flags_for(result, "Northline Tech Partners")
    price_flags = [f for f in flags if f["type"] == "price"]
    assert price_flags, "Vendor A should have at least one price flag"
    assert any(f["level"] == "high" for f in price_flags), (
        "Vendor A price flag should be 'high' (unit price >100% above reference)"
    )


def test_laptops_vendor_a_price_evidence_mentions_both_references():
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Northline Tech Partners")
    price_flags = [f for f in flags if f["type"] == "price"]
    assert price_flags, "Vendor A should have a price flag"
    evidence = price_flags[0]["evidence"]
    assert "median past award" in evidence, (
        f"Price evidence should mention 'median past award', got: {evidence}"
    )
    assert "market catalog" in evidence, (
        f"Price evidence should mention 'market catalog', got: {evidence}"
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
    flags = _flags_for(result, "Apex Digital Solutions LLC")
    collusion_flags = [f for f in flags if f["type"] == "collusion"]
    vendor_flags = [f for f in flags if f["type"] == "vendor"]
    assert any(f["level"] == "high" for f in collusion_flags), (
        "Vendor C should have a high collusion flag (shared address/bank with Vendor B)"
    )
    assert vendor_flags, "Vendor C should have a vendor exclusion flag"
    assert any(f["level"] == "medium" for f in vendor_flags), (
        "Vendor C exclusion flag should be 'medium'"
    )


def test_laptops_vendor_d_has_zero_flags():
    """Vendor D (Cornerstone Tech Group) must have no flags of any kind.
    The $50k supervisor threshold is now a top-level field, not a vendor flag."""
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Cornerstone Tech Group")
    assert flags == [], f"Vendor D should have zero flags, got: {flags}"


def test_laptops_requires_supervisor_approval_is_true():
    """laptops-50 has line totals >= $50,000, so supervisor approval is required."""
    result = _run_quote_review("laptops-50")
    assert result["requires_supervisor_approval"] is True, (
        "laptops-50 should require supervisor approval (line totals exceed $50,000)"
    )


def test_laptops_risk_level_is_high():
    result = _run_quote_review("laptops-50")
    assert result["risk_level"] == "high", (
        f"Expected risk_level 'high' for laptops-50, got '{result['risk_level']}'"
    )


def test_laptops_result_has_correct_contract_shape():
    result = _run_quote_review("laptops-50")
    assert "summary" in result
    assert "vendors" in result
    assert "purchase_flags" in result
    assert "requires_supervisor_approval" in result
    assert "risk_level" in result
    assert isinstance(result["summary"], str) and result["summary"]
    assert isinstance(result["purchase_flags"], list)
    assert isinstance(result["requires_supervisor_approval"], bool)
    for v in result["vendors"]:
        assert "vendor" in v
        assert "unitPrice" in v
        assert "flags" in v
        for f in v["flags"]:
            assert f["type"] in {"price", "vendor", "collusion", "compliance", "quality"}
            assert f["level"] in {"low", "medium", "high"}
            assert isinstance(f["evidence"], str) and f["evidence"]


def test_laptops_summary_does_not_contain_scenario_id():
    result = _run_quote_review("laptops-50")
    assert "laptops-50" not in result["summary"], (
        f"Summary should not contain the scenario ID, got: {result['summary']}"
    )


# ---------------------------------------------------------------------------
# Scenario: chairs-120 (clean case)
# ---------------------------------------------------------------------------

def test_chairs_all_vendors_have_no_flags():
    result = _run_quote_review("chairs-120")
    for v in result["vendors"]:
        assert v["flags"] == [], (
            f"Vendor '{v['vendor']}' should have no flags in chairs-120, got: {v['flags']}"
        )


def test_chairs_purchase_flags_is_empty():
    result = _run_quote_review("chairs-120")
    assert result["purchase_flags"] == [], (
        f"chairs-120 should have no purchase_flags, got: {result['purchase_flags']}"
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


def test_toner_northline_has_quality_flag():
    """Northline toner rating is 2.6 — between 2.5 and 3.0 → medium quality flag."""
    result = _run_quote_review("toner-400")
    flags = _flags_for(result, "Northline Tech Partners")
    quality_flags = [f for f in flags if f["type"] == "quality"]
    assert quality_flags, "Northline should have a quality flag on toner (rating 2.6)"
    assert quality_flags[0]["level"] == "medium", (
        f"Expected medium quality flag for Northline toner, got '{quality_flags[0]['level']}'"
    )


def test_toner_non_northline_vendors_have_no_quality_flags():
    result = _run_quote_review("toner-400")
    for v in result["vendors"]:
        if v["vendor"] == "Northline Tech Partners":
            continue
        non_price_non_quality = [
            f for f in v["flags"] if f["type"] not in {"price", "quality"}
        ]
        assert non_price_non_quality == [], (
            f"Vendor '{v['vendor']}' in toner-400 should have no collusion/vendor/compliance flags, "
            f"got: {non_price_non_quality}"
        )
        quality_flags = [f for f in v["flags"] if f["type"] == "quality"]
        assert quality_flags == [], (
            f"Vendor '{v['vendor']}' in toner-400 should have no quality flags (rating >= 3.0), "
            f"got: {quality_flags}"
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
# Exclusion list: only the intended vendor triggers the fuzzy match
# ---------------------------------------------------------------------------

def test_only_vendor_c_matches_exclusion_list():
    """Apex Digital Solutions LLC should match Apex Digitel Solutions LLC.
    No other vendor in any scenario should trigger the exclusion check."""
    exclusions = _DATA["exclusions"]["excluded_vendors"]
    threshold = _DATA["rules"]["fuzzy_match_threshold"]

    # Collect all unique vendor names across all scenarios
    all_vendors = {
        q["vendor"]
        for scenario in _DATA["quotes"].values()
        if isinstance(scenario, list)
        for q in scenario
    }

    matched = {
        name: _fuzzy_match(name, exclusions, threshold)
        for name in all_vendors
        if _fuzzy_match(name, exclusions, threshold) is not None
    }

    assert set(matched.keys()) == {"Apex Digital Solutions LLC"}, (
        f"Expected only 'Apex Digital Solutions LLC' to match the exclusions list, "
        f"but these vendors matched: {matched}"
    )


# ---------------------------------------------------------------------------
# Quality flags
# ---------------------------------------------------------------------------

def test_laptops_northline_has_high_quality_flag():
    """Northline laptop rating is 2.1 — below 2.5 → high quality flag."""
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Northline Tech Partners")
    quality_flags = [f for f in flags if f["type"] == "quality"]
    assert quality_flags, "Northline should have a quality flag on laptops (rating 2.1)"
    assert quality_flags[0]["level"] == "high", (
        f"Expected high quality flag for Northline laptop, got '{quality_flags[0]['level']}'"
    )


def test_laptops_cornerstone_has_no_quality_flag():
    """Cornerstone laptop rating is 4.7 — well above threshold, no quality flag."""
    result = _run_quote_review("laptops-50")
    flags = _flags_for(result, "Cornerstone Tech Group")
    quality_flags = [f for f in flags if f["type"] == "quality"]
    assert quality_flags == [], (
        f"Cornerstone should have no quality flags (rating 4.7), got: {quality_flags}"
    )


def test_vendor_results_have_reviews_field():
    """Every vendor entry in the result must have a reviews dict with rating, review_count, snippets."""
    result = _run_quote_review("laptops-50")
    for v in result["vendors"]:
        assert "reviews" in v, f"Vendor '{v['vendor']}' missing 'reviews' field"
        r = v["reviews"]
        assert isinstance(r.get("rating"), float), f"reviews.rating should be a float for '{v['vendor']}'"
        assert isinstance(r.get("review_count"), int), f"reviews.review_count should be an int"
        assert isinstance(r.get("snippets"), list), f"reviews.snippets should be a list"


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


def test_data_sync_reviews():
    with open(_DATA_DIR / "reviews.json") as f:
        canonical = json.load(f)
    assert _DATA["reviews"] == canonical, (
        "Bundled _DATA['reviews'] does not match data/reviews.json — update one to match the other."
    )
