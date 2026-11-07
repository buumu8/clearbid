# ClearBid Enhancement Plan — AI Recommendations, Transparency & User Reviews

## Overview

Two feature sets merged into one ordered plan:

**A — AI recommendation + transparency (5 sub-tasks)**  
Deterministic best-choice banner on Review/Decision pages, mandatory officer justification on deviation, full transparency on the Public Portal.

**B — User review sentiment (4 sub-tasks)**  
Mock satisfaction ratings per vendor × product keyed in `data/reviews.json` and inlined in the tool; `quality` flag type added to the tool check; star/snippet display in the frontend; satisfaction score on the Public Portal.

Sub-tasks are ordered so that B-1 (data) and B-2 (tool) can be done back-to-back, then A and B frontend work proceeds together.

---

## Sub-Task A-1 — Recommendation utility (`frontend/src/utils/recommendation.js`)

**Intent**  
Single source of truth for "which vendor does the AI recommend?" — used by Review, Decision, and indirectly by Report pages.

**Expected Outcomes**  
- New file `frontend/src/utils/recommendation.js` exports `getBestChoice(vendors)`.
- Algorithm (after filtering `type === 'compliance'` flags, as everywhere else):
  1. Prefer vendors with **zero** `high`-level flags (any type including `quality`).
  2. Among those, prefer vendors with **zero** `quality` flags at any level.
  3. Among those, pick **lowest `unitPrice`**.
  4. If no vendor is clean, relax to zero `high` flags only (may have `medium`) → `conditional: true`.
  5. If all vendors have `high` flags → pick lowest price → `fallback: true`.
- Returns `{ vendor, unitPrice, conditional, fallback, reason }` — never null.
- `reason` is a short deterministic string ("Lowest compliant bid with no unmanaged risks", "Conditional — unresolved medium flags", "All vendors have high-risk flags — manual review required").

**Todo List**  
- [ ] Create `frontend/src/utils/recommendation.js` with `getBestChoice(vendors)`

**Relevant Context**  
- `vendor` entries in the review result now also carry a `reviews` field (added by Sub-Task B-2).
- Quality flag tie-breaking uses `quality` type, not the `reviews.rating` number — keeps the logic in the tool, not scattered in JS.

**Status** `[ ] pending`

---

## Sub-Task A-2 — AI Recommendation Banner (ReviewPage + DecisionPage + CSS)

**Intent**  
Prominent green banner names the agent's best choice so the officer sees it before acting.

**Expected Outcomes**  
- `ReviewPage.jsx`: banner between the summary text and the "Compared N quotes" line.
- `DecisionPage.jsx`: banner between supervisor warning and the flag list card.
- Banner text: "Agent Best Choice: {vendor} — {reason}". Conditional/fallback variants shown.
- `frontend/src/index.css` gains `.notice-ok` class (same shape as `.warning`, green palette).

**Todo List**  
- [ ] Add `.notice-ok` to `frontend/src/index.css`
- [ ] Add `AiBanner` inline component to `ReviewPage.jsx`
- [ ] Add `AiBanner` inline component to `DecisionPage.jsx`

**Relevant Context**  
- `getBestChoice` imported from `frontend/src/utils/recommendation.js`.
- `vendorFlags()` filter already applied in both pages — pass filtered vendor list to `getBestChoice`.

**Status** `[ ] pending`

---

## Sub-Task A-3 — Mandatory justification + store it (DecisionPage + api.js + backend)

**Intent**  
Force a written justification when the officer deviates from the AI recommendation or awards a flagged vendor. Persist it for publication.

**Expected Outcomes**  
- `DecisionPage.jsx`: `awardRemark` state (string). Textarea appears when `vendor !== bestChoice.vendor || winnerHasAcceptedFlags`.
- `handleAward` blocks if textarea is required but empty.
- `api.award(id, vendor, awardRemark, aiRecommendation)` sends `{ vendor, awardRemark, aiRecommendation }`.
- `backend/src/server.js` `POST /api/purchases/:id/award` persists `p.awardRemark` and `p.aiRecommendation`.

**Todo List**  
- [ ] Add `awardRemark` state + conditional textarea to `DecisionPage.jsx`
- [ ] Add validation to `handleAward` in `DecisionPage.jsx`
- [ ] Update `api.award` in `frontend/src/api.js`
- [ ] Update `POST /award` in `backend/src/server.js` to persist both fields

**Relevant Context**  
- `aiRecommendation` stored as vendor name string (not full object).
- No new routes — extends existing award endpoint body.

**Status** `[ ] pending`

---

## Sub-Task A-4 — Internal memo + public summary (ReportPage)

**Intent**  
Bake AI recommendation and officer remark into both documents before the officer edits and publishes.

**Expected Outcomes**  
- `draftMemo` adds: "AI recommendation: {name}" and "Award justification: {remark}" (if present).
- `draftPublicSummary` adds a sentence when officer deviated: "The procurement officer selected {awardedVendor} over the AI-recommended {aiRecommendation}. Justification: {awardRemark}."
- If no deviation, public summary stays clean.

**Todo List**  
- [ ] Update `draftMemo` in `ReportPage.jsx`
- [ ] Update `draftPublicSummary` in `ReportPage.jsx`

**Status** `[ ] pending`

---

## Sub-Task A-5 — Public Portal transparency (backend + PublicPortal)

**Intent**  
Citizens can see the AI recommendation, whether the officer deviated, and the justification.

**Expected Outcomes**  
- `GET /api/public/purchases` projection adds `aiRecommendation`, `awardRemark`.
- `risksFlagged` fixed to count only vendor-risk flags (`type !== 'compliance'`).
- `DetailModal`: "Officer's justification" text block when `awardRemark` non-empty; "AI recommended" fact tile when `aiRecommendation !== awardedVendor`.
- `Tags` / `Thumb`: amber "Officer override" tag when `awardRemark` non-empty.

**Todo List**  
- [ ] Update `GET /api/public/purchases` projection in `backend/src/server.js`
- [ ] Update `DetailModal` in `PublicPortal.jsx`
- [ ] Update `Tags` in `PublicPortal.jsx`

**Status** `[ ] pending`

---

## Sub-Task B-1 — User review data (`data/reviews.json`)

**Intent**  
Synthetic but realistic satisfaction data for all vendor × product combinations, designed so demo scenarios make sense with quality flags.

**Expected Outcomes**  
- `data/reviews.json` — keyed by `"{vendor_id}/{item_key}"`. Each entry: `{ rating, review_count, snippets: [str, str, str] }`.
- Demo design:
  - `laptops-50`: Northline 2.1/5 → **high quality flag** (reinforces fraud signal); Bridgepoint 4.4/5 clean; Apex Digital 3.8/5 clean; Cornerstone 4.7/5 clean → recommended.
  - `chairs-120`: all ratings 3.9–4.5, no flags (scenario stays clean).
  - `toner-400`: Northline 2.6/5 → **medium quality flag** (compounds with price flag); Bridgepoint 4.1/5 clean; Cornerstone 4.3/5 clean.
- Snippet quotes are synthetic and realistic (IT admin / office manager voice).

**Todo List**  
- [ ] Create `data/reviews.json` with the above structure

**Status** `[ ] pending`

---

## Sub-Task B-2 — Quality check in review tool (`orchestrate/tools/review_tools.py`)

**Intent**  
Add `_check_quality` and wire it into `_run_quote_review`, including `reviews` data in `_DATA` and in the per-vendor result.

**Expected Outcomes**  
- `_DATA["reviews"]` mirrors `data/reviews.json` exactly.
- `_check_quality(vendor_id, item_key)` returns a `quality` flag:
  - `rating < 2.5` → `high`, evidence includes rating + worst snippet.
  - `rating < 3.0` → `medium`.
  - `rating >= 3.0` → no flag.
- Each vendor result gains a `"reviews"` field: `{ rating, review_count, snippets }` (always present, even if no flag).
- `_run_quote_review` assembles `vendor_id` from the quote's `vendor_id` field.
- `test_data_sync_reviews` added to pytest suite.
- Tool re-imported into Orchestrate after this change.

**Todo List**  
- [ ] Add `"reviews"` block to `_DATA` in `review_tools.py` (mirroring `data/reviews.json`)
- [ ] Implement `_check_quality(vendor_id, item_key)` helper
- [ ] Wire `_check_quality` into `_run_quote_review` loop; attach `"reviews"` to each vendor result
- [ ] Update `test_data_sync_reviews` and a `test_quality_flags` test in `orchestrate/tests/test_review_tools.py`
- [ ] Re-import tool and agent into Orchestrate

**Relevant Context**  
- `vendor_id` is available on each quote dict (`q["vendor_id"]`).
- The `reviews` field must NOT include raw review text that could inflate token usage — keep snippets short (max 10 words each).
- Contract change: each vendor entry now has an optional `"reviews"` key — the `validateReview` function in `backend/src/orchestrate.js` validates the required fields only (`vendor`, `unitPrice`, `flags`), so no backend change needed there.

**Status** `[ ] pending`

---

## Sub-Task B-3 — User reviews panel in frontend (ReviewPage + DecisionPage)

**Intent**  
Show satisfaction rating and snippets in the Evidence aside when a vendor is selected, and in the Decision page vendor list.

**Expected Outcomes**  
- `ReviewPage.jsx` Evidence aside: below the flag list, a "User satisfaction" section shows star score (rendered as "★★★★☆ 4.4 / 5 · 312 reviews") and the 2–3 snippets as blockquotes.
- `DecisionPage.jsx` vendor radio list: add inline rating score badge next to vendor name (e.g. "⭐ 4.7").
- No new component files — inline JSX in both pages.
- Keys on all maps use composite `key={...}`.

**Todo List**  
- [ ] Add `ReviewsPanel` inline component to `ReviewPage.jsx`
- [ ] Add inline rating display to vendor radio list in `DecisionPage.jsx`

**Relevant Context**  
- `v.reviews` is present on each vendor from the tool response.
- Stars rendered as unicode filled (★) / empty (☆) based on `Math.round(rating)`.

**Status** `[ ] pending`

---

## Sub-Task B-4 — Satisfaction score on Public Portal

**Intent**  
Citizens can see the awarded vendor's product satisfaction score.

**Expected Outcomes**  
- `GET /api/public/purchases` projection adds `awardedVendorRating` (float or null) — extracted from `p.review.vendors.find(awardedVendor).reviews?.rating`.
- `DetailModal` shows a "User rating" fact tile.
- `Thumb` card shows star score if available.

**Todo List**  
- [ ] Add `awardedVendorRating` to `GET /api/public/purchases` projection in `backend/src/server.js`
- [ ] Add "User rating" fact tile to `DetailModal` in `PublicPortal.jsx`
- [ ] Add star score to `Thumb` in `PublicPortal.jsx`

**Relevant Context**  
- Sub-Task A-5 and B-4 both touch `server.js` public projection and `PublicPortal.jsx` — implement them together in one pass.

**Status** `[ ] pending`

---

## Execution order

1. B-1 (data file)
2. B-2 (tool + tests — re-import Orchestrate)
3. A-1 (recommendation utility)
4. A-2 (banners + CSS)
5. A-3 (justification + backend award endpoint)
6. A-4 (report page)
7. A-5 + B-4 together (backend public projection + PublicPortal)
8. B-3 (reviews panel in ReviewPage + DecisionPage)

---

## Key design decisions

1. `reviews` data keyed by `vendor_id/item_key` (not vendor name) — stable across name changes.
2. Quality flag threshold: `< 2.5` = high, `< 3.0` = medium (tighter than the brief's `< 3.0` for medium — ensures Northline laptop at 2.1 gets `high`).
3. `getBestChoice` prioritises: (1) zero high flags, (2) zero quality flags of any level, (3) lowest price — quality data reinforces, not duplicates, the flag logic.
4. `reviews` field always present in the tool response — frontend never needs a null check beyond `v.reviews?.rating`.
5. A-5 and B-4 implemented together to avoid two separate passes on the same two files.
6. Token budget: snippets capped at 10 words each, 3 per vendor. `review_count` is a number only (no list of full reviews).
7. `validateReview` in `orchestrate.js` not changed — `reviews` is additive and optional per the contract.
