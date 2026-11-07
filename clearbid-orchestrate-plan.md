# ClearBid Orchestrate ADK Plan

## Overview

Build all watsonx Orchestrate ADK artefacts for the `clearbid_review_agent` — synthetic demo data, a
deterministic Python review tool, the native agent YAML, pytest tests, and project docs. No changes to
`frontend/` or `backend/`.

---

## Sub-Task 1 — Synthetic demo data (`data/`)

**Intent**  
Create the four JSON files that drive all three demo scenarios. Data is synthetic, labelled as such, and
designed so every deterministic check in the brief fires exactly as specified.

**Expected Outcomes**  
- `data/vendors.json` — four vendor objects (A–D) with name, address, phone, bank_routing, bank_account,
  registration_date. Vendor B & C share the same address AND bank_routing + bank_account. Vendor C name is
  a deliberate near-match for an exclusions entry.
- `data/quotes.json` — three scenario arrays (`laptops-50`, `chairs-120`, `toner-400`) each listing
  vendor + item_description + quantity + unit_price. Vendor A laptop price is ~3.2× the median past award.
  Toner price is >25% above market (medium flag). Chairs are clean.
- `data/past_awards.json` — keyed by item category (`laptop`, `chair`, `toner`), 5–8 USAspending-style
  records each: award_id, awarding_agency, vendor, award_date, quantity, unit_price, total_value.
  Laptop median ≈ $1,220 (so Vendor A at $3,900 ≈ 3.2× triggers high price flag).
- `data/catalog.json` — market_price per item category. Laptop $1,400, chair $210, toner $42.
- `data/exclusions.json` — list of excluded vendor names; include "Vendore C Supplies LLC" as the
  near-match that fuzzy-matches Vendor C's actual registered name.
- `data/rules.json` — thresholds: price_medium_pct 25, price_high_pct 100, quote_minimum 3,
  quote_threshold 10000, supervisor_threshold 50000, collusion_spread_pct 3.

**Todo List**  
- [ ] Create `data/vendors.json`  
- [ ] Create `data/quotes.json`  
- [ ] Create `data/past_awards.json`  
- [ ] Create `data/catalog.json`  
- [ ] Create `data/exclusions.json`  
- [ ] Create `data/rules.json`  

**Relevant Context**  
Brief §Demo scenarios, §Checks, §Rules.

**Status** `[ ] pending`

---

## Sub-Task 2 — Review tool (`orchestrate/tools/review_tools.py`)

**Intent**  
Implement the single ADK tool `run_quote_review` that loads bundled data and executes every deterministic
check defined in the brief, returning exactly the review output contract plus a computed `risk_level`.

**Expected Outcomes**  
- File `orchestrate/tools/review_tools.py` decorated with `@tool` from
  `ibm_watsonx_orchestrate.agent_builder.tools`.
- Data is inlined as Python dicts inside the file (copied from `data/`) so the tool works with zero
  network/filesystem access inside Orchestrate.
- Function signature: `run_quote_review(scenario_id: str) -> dict`
- Checks implemented in plain Python:
  - **price** — compare unit_price vs median past_awards price and catalog price; >25% above median/catalog
    = medium, >100% above = high. Use the higher level if both fire.
  - **vendor** — fuzzy match (difflib.SequenceMatcher ratio ≥ 0.85) against exclusions list → flag level
    "medium", evidence says "possible match – verify".
  - **collusion (shared details)** — across all vendors in the scenario, flag any pair sharing address OR
    (bank_routing AND bank_account). Level "high".
  - **collusion (bid spread)** — all bids within 3% of each other = medium flag on every vendor.
  - **compliance** — total quote value ≥ $10,000 and fewer than 3 vendor quotes → high. Any vendor's line
    item value ≥ $50,000 and no supervisor_approval field → medium.
- `risk_level` computed from highest flag level across all vendors: any high → "high", any medium →
  "medium", else "low".
- Returns `{"summary": "...", "vendors": [...], "risk_level": "..."}`. The summary is a
  deterministically constructed sentence (not AI-generated at tool level).
- Unknown `scenario_id` returns `{"error": "Unknown scenario_id: <id>. Valid IDs: ..."}`.
- Docstring with Args/Returns section so the agent knows how to call it.

**Todo List**
- [ ] Copy data dicts into a `_DATA` constant block at the top of the file
- [ ] Implement helper: `_median(prices)` using statistics.median
- [ ] Implement helper: `_fuzzy_match(name, exclusions, threshold=0.85)`
- [ ] Implement `_check_price(vendor_name, unit_price, item_key)` → list of flag dicts
- [ ] Implement `_check_vendor(vendor_name)` → list of flag dicts
- [ ] Implement `_check_collusion(scenario_quotes)` → dict vendor_name → list of flag dicts
- [ ] Implement `_check_compliance(scenario_quotes, scenario_id)` → list of flag dicts (per vendor)
- [ ] Implement `_run_quote_review(scenario_id: str) -> dict` — plain Python function with all logic
- [ ] Wrap with `@tool` in a thin one-liner `run_quote_review` that delegates to `_run_quote_review`
- [ ] Compute `risk_level` and return final dict

**Relevant Context**
ADK import: `from ibm_watsonx_orchestrate.agent_builder.tools import tool`
Decorator usage: `@tool(name="run_quote_review", description="...")`
`statistics.median` from stdlib — no extra deps needed.
`difflib.SequenceMatcher` from stdlib — no extra deps needed.
**`@tool` decorator risk**: the decorator wraps the function in a `PythonTool` object — calling it in
pytest would hit the ADK runtime rather than the logic. Solution: implement all logic in `_run_quote_review`
(plain function, importable directly), and have `run_quote_review` (the `@tool`-decorated function) simply
call `return _run_quote_review(scenario_id)`. Tests import and call `_run_quote_review` only.

**Status** `[ ] pending`

---

## Sub-Task 3 — Agent YAML (`orchestrate/agents/review_agent.yaml`)

**Intent**  
Define the native watsonx Orchestrate agent that wraps the tool and formats the response for the frontend.

**Expected Outcomes**  
- File `orchestrate/agents/review_agent.yaml`
- Fields: `spec_version: v1`, `kind: native`, `name: clearbid_review_agent`,
  `llm: watsonx/ibm/granite-3-8b-instruct`, `description`, `instructions` (≤12 lines),
  `tools: [run_quote_review]`
- Instructions tell the agent to: call `run_quote_review` exactly once with the provided `scenario_id`,
  then reply with ONLY valid JSON matching the contract, rewriting each evidence string as one plain-English
  sentence, writing the summary field. Never recommend awarding or rejecting a vendor. Never invent data
  not returned by the tool.

**Todo List**  
- [ ] Create `orchestrate/agents/review_agent.yaml` with all required fields  

**Relevant Context**  
Agent YAML schema: `spec_version`, `kind`, `name`, `description`, `llm`, `instructions`, `tools` (list of
tool name strings).

**Status** `[ ] pending`

---

## Sub-Task 4 — Pytest tests (`orchestrate/tests/test_review_tools.py`)

**Intent**  
Verify that every check fires (or does not fire) for each demo scenario, giving confidence in the tool
before deployment.

**Expected Outcomes**  
Tests pass with `pytest orchestrate/tests/` from project root (using the venv).

Scenario coverage:
- **laptops-50 (fraud)**: Vendor A has a high price flag; Vendor B & C share address → high collusion flag
  on both; Vendor C has a medium vendor exclusion flag; Vendor D has zero flags; `risk_level` is "high".
- **chairs-120 (clean)**: zero flags on all vendors; `risk_level` is "low".
- **toner-400 (single price flag)**: exactly one vendor has a price flag (medium); no collusion, no vendor
  exclusion, no compliance flags; `risk_level` is "medium".
- **unknown scenario**: returns a dict with an "error" key.

**Todo List**
- [ ] Create `orchestrate/tests/__init__.py` (empty)
- [ ] Write `test_laptops_fraud_flags` — assert A high price, B+C high collusion, C medium vendor, D clean
- [ ] Write `test_chairs_clean` — assert no flags on any vendor, risk_level == "low"
- [ ] Write `test_toner_price_flag` — assert exactly one price flag, medium level, risk_level == "medium"
- [ ] Write `test_unknown_scenario` — assert "error" key in result
- [ ] Write `test_data_sync` — load each `data/*.json` file and assert its contents equal the corresponding
  sub-dict inside `_DATA` in `review_tools.py`; fails if either copy is edited without updating the other

**Relevant Context**
Tests import and call `_run_quote_review` directly (plain Python function) — bypasses the `@tool` ADK
wrapper entirely. `run_quote_review` (the decorated version) is NOT called in tests.
`test_data_sync` is the only test that touches `data/*.json` files directly.

**Status** `[ ] pending`

---

## Sub-Task 5 — Requirements and README (`orchestrate/`)

**Intent**  
Give any developer the exact commands to install deps and import the tool into Orchestrate.

**Expected Outcomes**  
- `orchestrate/requirements.txt` — pinned to `ibm-watsonx-orchestrate` (already installed version), plus
  `pytest` for tests. No other runtime deps needed (only stdlib).
- `orchestrate/README.md` — explains project structure, venv setup, how to run tests, how to import the
  tool and agent into Orchestrate using the `orchestrate` CLI.

**Todo List**  
- [ ] Create `orchestrate/requirements.txt`  
- [ ] Create `orchestrate/README.md`  

**Status** `[ ] pending`

---

## File Map

```
data/
  vendors.json
  quotes.json
  past_awards.json
  catalog.json
  exclusions.json
  rules.json

orchestrate/
  requirements.txt
  README.md
  agents/
    review_agent.yaml
  tools/
    review_tools.py
  tests/
    __init__.py
    test_review_tools.py
```

---

## Key Design Decisions

1. **Data inlined into tool** — the brief prohibits network calls inside tools. Data is copied as Python
   dicts inside `_DATA` at the top of `review_tools.py`. The `data/` JSON files are the canonical source;
   `test_data_sync` asserts the two copies stay identical.
2. **`@tool` decorator isolation** — `@tool` returns a `PythonTool` object, not a callable Python function.
   All logic lives in `_run_quote_review` (plain function). `run_quote_review` is the thin decorated
   wrapper. Tests only ever call `_run_quote_review` to avoid hitting the ADK runtime.
3. **Fuzzy matching threshold 0.85** — `difflib.SequenceMatcher` with ratio ≥ 0.85 catches deliberate
   near-matches without false-positives on common words.
4. **Bid spread check** — fires only when ALL bids (≥3) in a scenario fall within 3% of each other
   (min/max ratio). Flag level: medium. No pairwise comparison — that would unfairly punish honest vendors
   whose price happens to be near a competitor's. Vendors B & C in laptops-50 are already caught by shared
   address and bank details.
5. **Compliance check scope** — the `$10k / 3 quotes` rule uses total scenario value. The `$50k supervisor`
   rule flags individual line items ≥ $50,000.
6. **risk_level** — derived purely in Python from flag levels; the AI agent never overrides it.
7. **Agent never awards/rejects** — enforced in instructions; the `@tool` decorator uses default
   `permission=ToolPermission.READ_ONLY`.
