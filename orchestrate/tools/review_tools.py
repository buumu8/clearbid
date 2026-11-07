"""
ClearBid deterministic quote-review tool for watsonx Orchestrate.

All demo data is synthetic and labelled as such.
No network or filesystem access is required at runtime — data is inlined below.
"""

import difflib
import statistics
from ibm_watsonx_orchestrate.agent_builder.tools import tool

# ---------------------------------------------------------------------------
# Bundled data (canonical source: data/*.json in the project root)
# test_data_sync in orchestrate/tests/test_review_tools.py asserts that
# these dicts stay in sync with those files.
# ---------------------------------------------------------------------------

_DATA = {
    "vendors": [
        {
            "id": "vendor-a",
            "name": "Apex Federal Solutions LLC",
            "address": "1200 Commerce Parkway, Suite 300, Arlington, VA 22201",
            "phone": "703-555-0142",
            "bank_routing": "021000021",
            "bank_account": "887643210",
            "registration_date": "2018-03-14",
        },
        {
            "id": "vendor-b",
            "name": "Bridgepoint Office Supplies Inc",
            "address": "47 Industrial Loop, Building B, Richmond, VA 23220",
            "phone": "804-555-0387",
            "bank_routing": "056073502",
            "bank_account": "334912087",
            "registration_date": "2015-07-22",
        },
        {
            "id": "vendor-c",
            "name": "Vendor C Supplies LLC",
            "address": "47 Industrial Loop, Building B, Richmond, VA 23220",
            "phone": "804-555-0412",
            "bank_routing": "056073502",
            "bank_account": "334912087",
            "registration_date": "2021-11-03",
        },
        {
            "id": "vendor-d",
            "name": "Cornerstone Tech Group",
            "address": "8900 Sunrise Blvd, Suite 12, Bethesda, MD 20814",
            "phone": "301-555-0271",
            "bank_routing": "054001725",
            "bank_account": "112038476",
            "registration_date": "2012-05-30",
        },
    ],
    "quotes": {
        "_note": "All data is synthetic and for demonstration purposes only.",
        "laptops-50": [
            {
                "vendor_id": "vendor-a",
                "vendor": "Apex Federal Solutions LLC",
                "item_description": "15-inch business laptop, Intel Core i7, 16GB RAM, 512GB SSD",
                "item_key": "laptop",
                "quantity": 50,
                "unit_price": 3900.00,
            },
            {
                "vendor_id": "vendor-b",
                "vendor": "Bridgepoint Office Supplies Inc",
                "item_description": "15-inch business laptop, Intel Core i7, 16GB RAM, 512GB SSD",
                "item_key": "laptop",
                "quantity": 50,
                "unit_price": 1180.00,
            },
            {
                "vendor_id": "vendor-c",
                "vendor": "Vendor C Supplies LLC",
                "item_description": "15-inch business laptop, Intel Core i7, 16GB RAM, 512GB SSD",
                "item_key": "laptop",
                "quantity": 50,
                "unit_price": 1195.00,
            },
            {
                "vendor_id": "vendor-d",
                "vendor": "Cornerstone Tech Group",
                "item_description": "15-inch business laptop, Intel Core i7, 16GB RAM, 512GB SSD",
                "item_key": "laptop",
                "quantity": 50,
                "unit_price": 1210.00,
            },
        ],
        "chairs-120": [
            {
                "vendor_id": "vendor-a",
                "vendor": "Apex Federal Solutions LLC",
                "item_description": "Ergonomic task chair, adjustable lumbar support, mesh back",
                "item_key": "chair",
                "quantity": 120,
                "unit_price": 198.00,
            },
            {
                "vendor_id": "vendor-b",
                "vendor": "Bridgepoint Office Supplies Inc",
                "item_description": "Ergonomic task chair, adjustable lumbar support, mesh back",
                "item_key": "chair",
                "quantity": 120,
                "unit_price": 205.00,
            },
            {
                "vendor_id": "vendor-d",
                "vendor": "Cornerstone Tech Group",
                "item_description": "Ergonomic task chair, adjustable lumbar support, mesh back",
                "item_key": "chair",
                "quantity": 120,
                "unit_price": 215.00,
            },
        ],
        "toner-400": [
            {
                "vendor_id": "vendor-a",
                "vendor": "Apex Federal Solutions LLC",
                "item_description": "High-yield laser toner cartridge, black, 6000 page yield",
                "item_key": "toner",
                "quantity": 400,
                "unit_price": 58.00,
            },
            {
                "vendor_id": "vendor-b",
                "vendor": "Bridgepoint Office Supplies Inc",
                "item_description": "High-yield laser toner cartridge, black, 6000 page yield",
                "item_key": "toner",
                "quantity": 400,
                "unit_price": 40.00,
            },
            {
                "vendor_id": "vendor-d",
                "vendor": "Cornerstone Tech Group",
                "item_description": "High-yield laser toner cartridge, black, 6000 page yield",
                "item_key": "toner",
                "quantity": 400,
                "unit_price": 41.00,
            },
        ],
    },
    "past_awards": {
        "_note": "All data is synthetic. Modelled on USAspending.gov award record structure.",
        "laptop": [
            {"award_id": "GS-35F-2024-001", "awarding_agency": "Department of Homeland Security", "vendor": "DataEdge Federal Partners", "award_date": "2024-02-14", "quantity": 200, "unit_price": 1180.00, "total_value": 236000.00},
            {"award_id": "VA-797-2023-118", "awarding_agency": "Department of Veterans Affairs", "vendor": "FedTech Procurement Group", "award_date": "2023-09-28", "quantity": 75, "unit_price": 1195.00, "total_value": 89625.00},
            {"award_id": "DOJ-FY24-0044", "awarding_agency": "Department of Justice", "vendor": "Capitol IT Solutions LLC", "award_date": "2024-01-07", "quantity": 150, "unit_price": 1210.00, "total_value": 181500.00},
            {"award_id": "GSA-FY24-LAPTOP-22", "awarding_agency": "General Services Administration", "vendor": "NovaStar Federal LLC", "award_date": "2024-04-19", "quantity": 300, "unit_price": 1220.00, "total_value": 366000.00},
            {"award_id": "HHS-FY23-IT-087", "awarding_agency": "Department of Health and Human Services", "vendor": "BlueRidge Tech Services", "award_date": "2023-11-02", "quantity": 50, "unit_price": 1240.00, "total_value": 62000.00},
            {"award_id": "DOE-FY24-0031", "awarding_agency": "Department of Energy", "vendor": "Meridian Federal Supply", "award_date": "2024-03-05", "quantity": 100, "unit_price": 1255.00, "total_value": 125500.00},
            {"award_id": "USDA-FY23-IT-199", "awarding_agency": "Department of Agriculture", "vendor": "Keystone Government Tech", "award_date": "2023-07-18", "quantity": 60, "unit_price": 1270.00, "total_value": 76200.00},
        ],
        "chair": [
            {"award_id": "PBS-FY24-FURN-011", "awarding_agency": "Public Buildings Service", "vendor": "OfficePro Federal", "award_date": "2024-01-22", "quantity": 500, "unit_price": 195.00, "total_value": 97500.00},
            {"award_id": "GSA-FY23-FURN-44", "awarding_agency": "General Services Administration", "vendor": "Capitol Furniture Group", "award_date": "2023-06-30", "quantity": 200, "unit_price": 200.00, "total_value": 40000.00},
            {"award_id": "DOT-FY24-0077", "awarding_agency": "Department of Transportation", "vendor": "NovaStar Federal LLC", "award_date": "2024-02-11", "quantity": 120, "unit_price": 205.00, "total_value": 24600.00},
            {"award_id": "DHS-FY23-FURN-09", "awarding_agency": "Department of Homeland Security", "vendor": "FedFurnish Solutions", "award_date": "2023-09-14", "quantity": 80, "unit_price": 210.00, "total_value": 16800.00},
            {"award_id": "DOD-FY24-FURN-033", "awarding_agency": "Department of Defense", "vendor": "BlueRidge Office Supply", "award_date": "2024-05-03", "quantity": 350, "unit_price": 215.00, "total_value": 75250.00},
            {"award_id": "VA-FY23-FURN-201", "awarding_agency": "Department of Veterans Affairs", "vendor": "Patriot Interiors LLC", "award_date": "2023-04-27", "quantity": 90, "unit_price": 220.00, "total_value": 19800.00},
        ],
        "toner": [
            {"award_id": "GSA-FY24-SUPP-088", "awarding_agency": "General Services Administration", "vendor": "FedSupply Direct", "award_date": "2024-03-17", "quantity": 1000, "unit_price": 38.00, "total_value": 38000.00},
            {"award_id": "EPA-FY23-SUPP-044", "awarding_agency": "Environmental Protection Agency", "vendor": "GreenOffice Federal", "award_date": "2023-10-08", "quantity": 500, "unit_price": 39.50, "total_value": 19750.00},
            {"award_id": "DOJ-FY24-SUPP-017", "awarding_agency": "Department of Justice", "vendor": "Capitol IT Solutions LLC", "award_date": "2024-01-29", "quantity": 600, "unit_price": 41.00, "total_value": 24600.00},
            {"award_id": "HHS-FY23-SUPP-112", "awarding_agency": "Department of Health and Human Services", "vendor": "Meridian Federal Supply", "award_date": "2023-08-15", "quantity": 800, "unit_price": 42.00, "total_value": 33600.00},
            {"award_id": "DHS-FY24-SUPP-029", "awarding_agency": "Department of Homeland Security", "vendor": "DataEdge Federal Partners", "award_date": "2024-04-02", "quantity": 400, "unit_price": 43.00, "total_value": 17200.00},
            {"award_id": "DOE-FY23-SUPP-066", "awarding_agency": "Department of Energy", "vendor": "Keystone Government Tech", "award_date": "2023-12-11", "quantity": 300, "unit_price": 44.50, "total_value": 13350.00},
        ],
    },
    "catalog": {
        "_note": "Market catalog prices per unit (synthetic reference data).",
        "laptop": 1400.00,
        "chair": 210.00,
        "toner": 42.00,
    },
    "exclusions": {
        "_note": "Excluded/debarred vendors list (synthetic). Contains deliberate near-match for Vendor C.",
        "excluded_vendors": [
            "Vendore C Supplies LLC",
            "FastBid Federal Group",
            "QuickQuote Gov Solutions",
            "Alliance Procurement Associates",
            "Delta Supply Network Inc",
        ],
    },
    "rules": {
        "_note": "Thresholds and rules for the ClearBid deterministic review engine.",
        "price_medium_pct": 25,
        "price_high_pct": 100,
        "quote_minimum": 3,
        "quote_threshold": 10000,
        "supervisor_threshold": 50000,
        "collusion_spread_pct": 3,
        "fuzzy_match_threshold": 0.85,
    },
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _median(prices: list) -> float:
    return statistics.median(prices)


def _fuzzy_match(name: str, exclusions: list, threshold: float = 0.85) -> str | None:
    """Return the best-matching exclusion entry if ratio >= threshold, else None."""
    name_lower = name.lower()
    best_ratio = 0.0
    best_match = None
    for entry in exclusions:
        ratio = difflib.SequenceMatcher(None, name_lower, entry.lower()).ratio()
        if ratio >= threshold and ratio > best_ratio:
            best_ratio = ratio
            best_match = entry
    return best_match


def _check_price(vendor_name: str, unit_price: float, item_key: str) -> list:
    """Return price flags for a single vendor quote line."""
    rules = _DATA["rules"]
    medium_pct = rules["price_medium_pct"] / 100
    high_pct = rules["price_high_pct"] / 100

    awards = _DATA["past_awards"].get(item_key, [])
    catalog_price = _DATA["catalog"].get(item_key)

    flags = []

    # Compare vs median past awards
    if awards:
        median_price = _median([a["unit_price"] for a in awards])
        pct_above_median = (unit_price - median_price) / median_price
        if pct_above_median > high_pct:
            flags.append({
                "type": "price",
                "level": "high",
                "evidence": (
                    f"Unit price ${unit_price:,.2f} is {pct_above_median:.0%} above the median "
                    f"past government award price of ${median_price:,.2f} for this item."
                ),
            })
        elif pct_above_median > medium_pct:
            flags.append({
                "type": "price",
                "level": "medium",
                "evidence": (
                    f"Unit price ${unit_price:,.2f} is {pct_above_median:.0%} above the median "
                    f"past government award price of ${median_price:,.2f} for this item."
                ),
            })

    # Compare vs catalog price (only flag if not already high from awards check)
    if catalog_price:
        pct_above_catalog = (unit_price - catalog_price) / catalog_price
        existing_high = any(f["level"] == "high" for f in flags)
        if pct_above_catalog > high_pct and not existing_high:
            flags.append({
                "type": "price",
                "level": "high",
                "evidence": (
                    f"Unit price ${unit_price:,.2f} is {pct_above_catalog:.0%} above the market "
                    f"catalog price of ${catalog_price:,.2f} for this item."
                ),
            })
        elif pct_above_catalog > medium_pct and not flags:
            flags.append({
                "type": "price",
                "level": "medium",
                "evidence": (
                    f"Unit price ${unit_price:,.2f} is {pct_above_catalog:.0%} above the market "
                    f"catalog price of ${catalog_price:,.2f} for this item."
                ),
            })

    return flags


def _check_vendor(vendor_name: str) -> list:
    """Return vendor exclusion flags for a single vendor."""
    exclusions = _DATA["exclusions"]["excluded_vendors"]
    threshold = _DATA["rules"]["fuzzy_match_threshold"]
    match = _fuzzy_match(vendor_name, exclusions, threshold)
    if match:
        return [{
            "type": "vendor",
            "level": "medium",
            "evidence": (
                f"Vendor name '{vendor_name}' is a possible match for excluded vendor "
                f"'{match}' — verify identity before proceeding."
            ),
        }]
    return []


def _check_collusion(scenario_quotes: list) -> dict:
    """
    Return a dict mapping vendor_name -> list of collusion flags.

    Two sub-checks:
    1. Shared address or (shared bank_routing AND bank_account) between any pair.
    2. All bids (>=3) fall within 3% of each other (min/max window).
    """
    vendor_map = {v["name"]: v for v in _DATA["vendors"]}
    rules = _DATA["rules"]
    spread_pct = rules["collusion_spread_pct"] / 100

    flags_by_vendor: dict = {q["vendor"]: [] for q in scenario_quotes}

    # --- Shared-details check ---
    flagged_pairs: set = set()
    for i, qi in enumerate(scenario_quotes):
        vi = vendor_map.get(qi["vendor"])
        if not vi:
            continue
        for qj in scenario_quotes[i + 1:]:
            vj = vendor_map.get(qj["vendor"])
            if not vj:
                continue
            pair_key = tuple(sorted([qi["vendor"], qj["vendor"]]))
            if pair_key in flagged_pairs:
                continue

            shared_address = vi["address"] == vj["address"]
            shared_bank = (
                vi["bank_routing"] == vj["bank_routing"]
                and vi["bank_account"] == vj["bank_account"]
            )

            if shared_address or shared_bank:
                flagged_pairs.add(pair_key)
                shared_fields = []
                if shared_address:
                    shared_fields.append("registered address")
                if shared_bank:
                    shared_fields.append("bank routing and account number")
                detail = " and ".join(shared_fields)
                evidence = (
                    f"'{qi['vendor']}' and '{qj['vendor']}' share the same {detail}, "
                    f"which may indicate a linked or shell entity."
                )
                flag = {"type": "collusion", "level": "high", "evidence": evidence}
                flags_by_vendor[qi["vendor"]].append(flag)
                flags_by_vendor[qj["vendor"]].append(flag)

    # --- Bid-spread check (all bids within 3%, minimum 3 vendors) ---
    if len(scenario_quotes) >= 3:
        prices = [q["unit_price"] for q in scenario_quotes]
        min_price = min(prices)
        max_price = max(prices)
        if (max_price - min_price) / min_price <= spread_pct:
            for q in scenario_quotes:
                flags_by_vendor[q["vendor"]].append({
                    "type": "collusion",
                    "level": "medium",
                    "evidence": (
                        f"All bids in this scenario fall within {rules['collusion_spread_pct']}% "
                        f"of each other (${min_price:,.2f} – ${max_price:,.2f}), "
                        f"which may indicate coordinated pricing."
                    ),
                })

    return flags_by_vendor


def _check_compliance(scenario_quotes: list, scenario_id: str) -> dict:
    """
    Return a dict mapping vendor_name -> list of compliance flags.

    Checks:
    - Total scenario value >= $10,000 and fewer than 3 vendor quotes → high flag on all vendors.
    - Any individual line item >= $50,000 → medium flag on that vendor.
    """
    rules = _DATA["rules"]
    quote_threshold = rules["quote_threshold"]
    supervisor_threshold = rules["supervisor_threshold"]
    quote_minimum = rules["quote_minimum"]

    flags_by_vendor: dict = {q["vendor"]: [] for q in scenario_quotes}

    total_value = sum(q["unit_price"] * q["quantity"] for q in scenario_quotes)
    num_vendors = len(scenario_quotes)

    if total_value >= quote_threshold and num_vendors < quote_minimum:
        evidence = (
            f"Scenario '{scenario_id}' has a total value of ${total_value:,.2f} "
            f"(above the ${quote_threshold:,.0f} threshold) but only {num_vendors} "
            f"vendor quote(s) were submitted; at least {quote_minimum} are required."
        )
        for q in scenario_quotes:
            flags_by_vendor[q["vendor"]].append({
                "type": "compliance",
                "level": "high",
                "evidence": evidence,
            })

    for q in scenario_quotes:
        line_value = q["unit_price"] * q["quantity"]
        if line_value >= supervisor_threshold:
            flags_by_vendor[q["vendor"]].append({
                "type": "compliance",
                "level": "medium",
                "evidence": (
                    f"Line item value ${line_value:,.2f} for '{q['vendor']}' meets or exceeds "
                    f"the ${supervisor_threshold:,.0f} supervisor-approval threshold."
                ),
            })

    return flags_by_vendor


# ---------------------------------------------------------------------------
# Plain Python core function (tested directly in pytest)
# ---------------------------------------------------------------------------

def _run_quote_review(scenario_id: str) -> dict:
    """
    Run all deterministic checks for a given scenario and return the review result.

    Args:
        scenario_id: One of "laptops-50", "chairs-120", or "toner-400".

    Returns:
        A dict matching the ClearBid review output contract:
        {
            "summary": str,           # one-sentence overview
            "vendors": [              # one entry per vendor in the scenario
                {
                    "vendor": str,
                    "unitPrice": float,
                    "flags": [
                        {
                            "type": "price|vendor|collusion|compliance",
                            "level": "low|medium|high",
                            "evidence": str
                        }
                    ]
                }
            ],
            "risk_level": "low|medium|high"  # highest flag level across all vendors
        }
        If scenario_id is unknown, returns {"error": str}.
    """
    valid_ids = [k for k in _DATA["quotes"] if not k.startswith("_")]
    if scenario_id not in valid_ids:
        return {"error": f"Unknown scenario_id: '{scenario_id}'. Valid IDs: {valid_ids}"}

    scenario_quotes = _DATA["quotes"][scenario_id]

    # Run all checks
    collusion_flags = _check_collusion(scenario_quotes)
    compliance_flags = _check_compliance(scenario_quotes, scenario_id)

    vendor_results = []
    for q in scenario_quotes:
        flags = []
        flags.extend(_check_price(q["vendor"], q["unit_price"], q["item_key"]))
        flags.extend(_check_vendor(q["vendor"]))
        flags.extend(collusion_flags.get(q["vendor"], []))
        flags.extend(compliance_flags.get(q["vendor"], []))
        vendor_results.append({
            "vendor": q["vendor"],
            "unitPrice": q["unit_price"],
            "flags": flags,
        })

    # Compute risk_level from highest flag level across all vendors
    all_levels = [f["level"] for vr in vendor_results for f in vr["flags"]]
    if "high" in all_levels:
        risk_level = "high"
    elif "medium" in all_levels:
        risk_level = "medium"
    else:
        risk_level = "low"

    total_flags = sum(len(vr["flags"]) for vr in vendor_results)
    flagged_vendors = [vr["vendor"] for vr in vendor_results if vr["flags"]]

    if total_flags == 0:
        summary = f"Scenario '{scenario_id}': all {len(scenario_quotes)} vendor quotes passed review with no flags."
    else:
        vendor_list = ", ".join(f"'{v}'" for v in flagged_vendors)
        summary = (
            f"Scenario '{scenario_id}': {total_flags} flag(s) found across "
            f"{len(flagged_vendors)} vendor(s) ({vendor_list}); overall risk level is {risk_level}."
        )

    return {
        "summary": summary,
        "vendors": vendor_results,
        "risk_level": risk_level,
    }


# ---------------------------------------------------------------------------
# ADK-decorated tool (thin wrapper — do NOT call in tests)
# ---------------------------------------------------------------------------

@tool(
    name="run_quote_review",
    description=(
        "Run a deterministic compliance review for a ClearBid procurement scenario. "
        "Checks vendor prices against past government awards and market catalog, "
        "screens for vendor exclusions, detects collusion signals, and verifies compliance rules. "
        "Returns a structured review result with per-vendor flags and an overall risk level."
    ),
)
def run_quote_review(scenario_id: str) -> dict:
    """
    Run a deterministic quote review for the given scenario.

    Args:
        scenario_id: The scenario to review. Valid values: "laptops-50", "chairs-120", "toner-400".

    Returns:
        A dict with keys: summary (str), vendors (list), risk_level (str).
        If the scenario_id is unknown, returns a dict with an "error" key.
    """
    return _run_quote_review(scenario_id)
