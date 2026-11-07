# ClearBid – Orchestrate ADK

watsonx Orchestrate ADK artefacts for the ClearBid procurement review agent.

---

## Structure

```
orchestrate/
  requirements.txt        # Python deps
  agents/
    review_agent.yaml     # Native agent definition
  tools/
    review_tools.py       # Deterministic review tool (@tool decorated)
  tests/
    test_review_tools.py  # Pytest suite (19 tests)

data/
  vendors.json            # Canonical vendor master (synthetic)
  quotes.json             # Quotes for each demo scenario (synthetic)
  past_awards.json        # USAspending-style historical awards (synthetic)
  catalog.json            # Market price catalog (synthetic)
  exclusions.json         # Excluded/debarred vendor list (synthetic)
  rules.json              # Thresholds and rule parameters
```

All data is synthetic and for demonstration purposes only.

---

## Prerequisites

- Python 3.12+
- A watsonx Orchestrate instance (for deployment)
- The `orchestrate` CLI (included with `ibm-watsonx-orchestrate`)

---

## Setup

```bash
# From the project root
python -m venv orchestrate/.venv
source orchestrate/.venv/bin/activate        # Windows: orchestrate\.venv\Scripts\activate
pip install -r orchestrate/requirements.txt
```

---

## Run tests

```bash
# From the project root (venv active)
pytest orchestrate/tests/ -v
```

Expected: 19 tests pass.

---

## Deploy to watsonx Orchestrate

Log in and select your environment first:

```bash
orchestrate env add my-env --url <ORCHESTRATE_URL>
orchestrate login -u <USERID> -p <PASSWORD> -e my-env
```

Import the tool:

```bash
orchestrate tools import -k python -f orchestrate/tools/review_tools.py
```

Import the agent:

```bash
orchestrate agents import -f orchestrate/agents/review_agent.yaml
```

Verify the agent is available:

```bash
orchestrate agents list
```

---

## Design notes

- **No network calls in the tool** — all data is inlined in `_DATA` inside `review_tools.py`.
  The `data/` JSON files are the canonical source; `test_data_sync` assertions catch drift.

- **`@tool` decorator isolation** — all review logic lives in `_run_quote_review` (plain function).
  `run_quote_review` is the thin `@tool`-decorated wrapper. Tests call `_run_quote_review` only.

- **Bid-spread collusion** — fires only when ALL bids (≥3) in a scenario fall within 3% of each
  other. Individual pair comparisons are not performed to avoid false-positives on honest competition.

- **Agent never awards or rejects** — enforced in the agent instructions and by the tool's
  `READ_ONLY` permission. The agent formats and explains; a human officer decides.
