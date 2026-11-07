"""
ClearBid deterministic quote-review tool for watsonx Orchestrate.

All demo data is synthetic and labelled as such.
No network or filesystem access is required at runtime — data is inlined below.
"""

import difflib
import re
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
            "name": "Northline Tech Partners",
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
            "name": "Apex Digital Solutions LLC",
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
                "vendor": "Northline Tech Partners",
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
                "vendor": "Apex Digital Solutions LLC",
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
                "vendor": "Northline Tech Partners",
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
                "vendor": "Northline Tech Partners",
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
            "Apex Digitel Solutions LLC",
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
        "quality_medium_threshold": 3.0,
        "quality_high_threshold": 2.5,
    },
    "reviews": {
        "_note": "Synthetic mock user review metrics. Keyed by vendor_id/item_key. All data is for demonstration purposes only.",
        "vendor-a/laptop": {
            "rating": 2.1,
            "review_count": 87,
            "snippets": [
                "Screen hinges broke within 3 months of deployment.",
                "Battery life far below advertised specs.",
                "Three units DOA out of the box.",
            ],
        },
        "vendor-b/laptop": {
            "rating": 4.4,
            "review_count": 312,
            "snippets": [
                "Excellent build quality, held up through heavy daily use.",
                "Battery lasts a full work day without issues.",
                "IT support found setup straightforward across the fleet.",
            ],
        },
        "vendor-c/laptop": {
            "rating": 3.8,
            "review_count": 156,
            "snippets": [
                "Solid performance for standard office workloads.",
                "Minor driver issues resolved with firmware update.",
                "Good value, no major complaints after six months.",
            ],
        },
        "vendor-d/laptop": {
            "rating": 4.7,
            "review_count": 428,
            "snippets": [
                "Best laptops we have purchased in five years.",
                "Zero hardware failures across 50 units after one year.",
                "Responsive vendor support when we needed it.",
            ],
        },
        "vendor-a/chair": {
            "rating": 4.1,
            "review_count": 204,
            "snippets": [
                "Comfortable for long work sessions, lumbar support works well.",
                "Assembly instructions were clear and quick.",
                "A few chairs had minor cosmetic scratches on delivery.",
            ],
        },
        "vendor-b/chair": {
            "rating": 4.3,
            "review_count": 318,
            "snippets": [
                "Staff reported noticeably less back pain after switch.",
                "Mesh back stays cool in summer.",
                "Durable after 18 months of daily use.",
            ],
        },
        "vendor-d/chair": {
            "rating": 3.9,
            "review_count": 141,
            "snippets": [
                "Decent quality for the price range.",
                "Armrest height adjustment is a bit stiff.",
                "Would purchase again for a budget refresh.",
            ],
        },
        "vendor-a/toner": {
            "rating": 2.6,
            "review_count": 93,
            "snippets": [
                "Cartridges leaked and damaged two printers.",
                "Page yield well below the stated 6000 pages.",
                "Inconsistent print quality across the batch.",
            ],
        },
        "vendor-b/toner": {
            "rating": 4.1,
            "review_count": 511,
            "snippets": [
                "Consistent print quality, no smearing or fading.",
                "Full yield as advertised on every cartridge.",
                "Easy to install, no printer errors.",
            ],
        },
        "vendor-d/toner": {
            "rating": 4.3,
            "review_count": 387,
            "snippets": [
                "Reliable output over hundreds of print jobs.",
                "No compatibility issues with our fleet of printers.",
                "Good value and consistent performance.",
            ],
        },
    },
}

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_LEGAL_SUFFIX_RE = re.compile(
    r"\b(llc|inc|corp|ltd|co|company|incorporated|limited|associates)\b",
    re.IGNORECASE,
)


def _normalize_name(name: str) -> str:
    """Lowercase, strip legal suffixes and punctuation for fuzzy comparison."""
    name = name.lower()
    name = _LEGAL_SUFFIX_RE.sub("", name)
    name = re.sub(r"[^\w\s]", "", name)   # remove punctuation
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _median(prices: list) -> float:
    return statistics.median(prices)


def _fuzzy_match(name: str, exclusions: list, threshold: float = 0.85) -> str | None:
    """Return the best-matching exclusion entry if normalized ratio >= threshold, else None."""
    norm_name = _normalize_name(name)
    best_ratio = 0.0
    best_match = None
    for entry in exclusions:
        ratio = difflib.SequenceMatcher(None, norm_name, _normalize_name(entry)).ratio()
        if ratio >= threshold and ratio > best_ratio:
            best_ratio = ratio
            best_match = entry
    return best_match


def _check_price(vendor_name: str, unit_price: float, item_key: str) -> list:
    """Return price flags for a single vendor quote line.

    Compares unit_price against max(median past award price, catalog price).
    Evidence mentions both reference prices.
    """
    rules = _DATA["rules"]
    medium_pct = rules["price_medium_pct"] / 100
    high_pct = rules["price_high_pct"] / 100

    awards = _DATA["past_awards"].get(item_key, [])
    catalog_price = _DATA["catalog"].get(item_key)

    if not awards and not catalog_price:
        return []

    median_price = _median([a["unit_price"] for a in awards]) if awards else None
    reference_price = max(p for p in [median_price, catalog_price] if p is not None)

    pct_above = (unit_price - reference_price) / reference_price
    if pct_above <= medium_pct:
        return []

    level = "high" if pct_above > high_pct else "medium"

    median_part = f"median past award ${median_price:,.2f}" if median_price is not None else None
    catalog_part = f"market catalog ${catalog_price:,.2f}" if catalog_price is not None else None
    ref_parts = ", ".join(p for p in [median_part, catalog_part] if p)

    evidence = (
        f"Unit price ${unit_price:,.2f} is {pct_above:.0%} above the reference price "
        f"(${reference_price:,.2f}); reference is the higher of {ref_parts}."
    )
    return [{"type": "price", "level": level, "evidence": evidence}]


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
                        f"All bids fall within {rules['collusion_spread_pct']}% "
                        f"of each other (${min_price:,.2f} – ${max_price:,.2f}), "
                        f"which may indicate coordinated pricing."
                    ),
                })

    return flags_by_vendor


def _check_quality(vendor_id: str, item_key: str) -> list:
    """Return a quality flag if user satisfaction rating is below threshold."""
    rules = _DATA["rules"]
    review_key = f"{vendor_id}/{item_key}"
    review_data = _DATA["reviews"].get(review_key)
    if not review_data:
        return []

    rating = review_data["rating"]
    high_threshold = rules["quality_high_threshold"]
    medium_threshold = rules["quality_medium_threshold"]

    if rating >= medium_threshold:
        return []

    level = "high" if rating < high_threshold else "medium"
    worst_snippet = review_data["snippets"][0] if review_data["snippets"] else ""
    evidence = (
        f"User satisfaction rating is {rating}/5 based on {review_data['review_count']} reviews "
        f"(threshold: {medium_threshold}/5). Buyer feedback: \"{worst_snippet}\""
    )
    return [{"type": "quality", "level": level, "evidence": evidence}]


def _check_compliance(scenario_quotes: list) -> tuple[list, bool]:
    """
    Return (purchase_flags, requires_supervisor_approval).

    purchase_flags: scenario-level compliance issues (e.g. too few quotes).
    requires_supervisor_approval: True if any line item total >= $50,000.
    """
    rules = _DATA["rules"]
    quote_threshold = rules["quote_threshold"]
    supervisor_threshold = rules["supervisor_threshold"]
    quote_minimum = rules["quote_minimum"]

    purchase_flags = []
    total_value = sum(q["unit_price"] * q["quantity"] for q in scenario_quotes)
    num_vendors = len(scenario_quotes)

    if total_value >= quote_threshold and num_vendors < quote_minimum:
        purchase_flags.append({
            "type": "compliance",
            "level": "high",
            "evidence": (
                f"Total quoted value is ${total_value:,.2f} "
                f"(above the ${quote_threshold:,.0f} threshold) but only {num_vendors} "
                f"vendor quote(s) were submitted; at least {quote_minimum} are required."
            ),
        })

    requires_supervisor = any(
        q["unit_price"] * q["quantity"] >= supervisor_threshold
        for q in scenario_quotes
    )
    return purchase_flags, requires_supervisor


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
            "summary": str,                        # plain-English overview (no scenario ID)
            "vendors": [                           # one entry per vendor
                {
                    "vendor": str,
                    "unitPrice": float,
                    "flags": [
                        {
                            "type": "price|vendor|collusion|compliance|quality",
                            "level": "low|medium|high",
                            "evidence": str
                        }
                    ]
                }
            ],
            "purchase_flags": [                    # scenario-level compliance issues
                {"type": "compliance", "level": str, "evidence": str}
            ],
            "requires_supervisor_approval": bool,  # true if any line >= $50,000
            "risk_level": "low|medium|high"        # highest flag level across all checks
        }
        If scenario_id is unknown, returns {"error": str}.
    """
    valid_ids = [k for k in _DATA["quotes"] if not k.startswith("_")]
    if scenario_id not in valid_ids:
        return {"error": f"Unknown scenario_id: '{scenario_id}'. Valid IDs: {valid_ids}"}

    scenario_quotes = _DATA["quotes"][scenario_id]

    # Run all checks
    collusion_flags = _check_collusion(scenario_quotes)
    purchase_flags, requires_supervisor = _check_compliance(scenario_quotes)

    vendor_results = []
    for q in scenario_quotes:
        flags = []
        flags.extend(_check_price(q["vendor"], q["unit_price"], q["item_key"]))
        flags.extend(_check_vendor(q["vendor"]))
        flags.extend(_check_quality(q["vendor_id"], q["item_key"]))
        flags.extend(collusion_flags.get(q["vendor"], []))
        # Attach review data so the frontend can display ratings and snippets
        review_key = f"{q['vendor_id']}/{q['item_key']}"
        review_data = _DATA["reviews"].get(review_key, {})
        vendor_results.append({
            "vendor": q["vendor"],
            "unitPrice": q["unit_price"],
            "flags": flags,
            "reviews": {
                "rating": review_data.get("rating"),
                "review_count": review_data.get("review_count"),
                "snippets": review_data.get("snippets", []),
            },
        })

    # Compute risk_level from highest flag level across vendor flags and purchase_flags
    all_levels = (
        [f["level"] for vr in vendor_results for f in vr["flags"]]
        + [f["level"] for f in purchase_flags]
    )
    if "high" in all_levels:
        risk_level = "high"
    elif "medium" in all_levels:
        risk_level = "medium"
    else:
        risk_level = "low"

    total_vendor_flags = sum(len(vr["flags"]) for vr in vendor_results)
    flagged_vendors = [vr["vendor"] for vr in vendor_results if vr["flags"]]
    item_desc = scenario_quotes[0]["item_description"].split(",")[0].lower()

    if total_vendor_flags == 0 and not purchase_flags:
        summary = (
            f"All {len(scenario_quotes)} vendor quotes for {item_desc} passed review "
            f"with no flags."
        )
    else:
        parts = []
        if flagged_vendors:
            vendor_list = ", ".join(f"'{v}'" for v in flagged_vendors)
            parts.append(
                f"{total_vendor_flags} flag(s) found across "
                f"{len(flagged_vendors)} vendor(s) ({vendor_list})"
            )
        if purchase_flags:
            parts.append(f"{len(purchase_flags)} purchase-level compliance issue(s)")
        summary = (
            "; ".join(parts)
            + f"; overall risk level is {risk_level}."
        )

    return {
        "summary": summary,
        "vendors": vendor_results,
        "purchase_flags": purchase_flags,
        "requires_supervisor_approval": requires_supervisor,
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
        "Returns a structured review result with per-vendor flags, purchase-level flags, "
        "supervisor approval requirement, and an overall risk level."
    ),
)
def run_quote_review(scenario_id: str) -> dict:
    """
    Run a deterministic quote review for the given scenario.

    Args:
        scenario_id: The scenario to review. Valid values: "laptops-50", "chairs-120", "toner-400".

    Returns:
        A dict with keys: summary (str), vendors (list), purchase_flags (list),
        requires_supervisor_approval (bool), risk_level (str).
        If the scenario_id is unknown, returns a dict with an "error" key.
    """
    return _run_quote_review(scenario_id)
