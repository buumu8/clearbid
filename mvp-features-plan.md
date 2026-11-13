# ClearBid MVP Features Plan

## Top-Level Overview

Implement three demo-ready features on top of the existing ClearBid codebase without introducing new paid services or rewriting existing code:

1. **A — Quotation PDF checks**: server-side upload route with file-signature validation, SHA-256 hashing, metadata recording, and optional text-extraction comparison against entered quote data.
2. **B — Tamper-evident public report history**: versioned publication (corrections create a new version, old ones are retained), enriched audit events (hash chaining), and a history/verification panel in the Public Portal.
3. **C — ClearBid Assistant**: compact chat widget available on the Review and Decision pages, calling a new `/api/assistant` backend route that uses the existing watsonx Orchestrate integration when configured, or falls back to clearly-labelled demo responses.

### Key constraints established by research
- **No database** — backend uses an in-memory `Map` and array. Versioning is therefore session-scoped (resets on server restart). The plan notes this limitation explicitly in UI copy.
- **No PDF libraries installed** — `pdf-parse` or similar must be added to `backend/package.json`. If the user refuses, only validation + hashing is implemented; text comparison is skipped.
- **No test framework on backend/frontend** — the existing test suite lives only in `orchestrate/` (pytest). New backend tests will use Node's built-in `node:test` module (zero deps). Frontend tests are deferred.
- **Demo mode (GitHub Pages)** must keep working. The static demo bypasses the backend entirely via `mockApi.js`. All new features degrade gracefully in demo mode.
- **watsonx Orchestrate** env vars (`WXO_API_KEY`, `WXO_INSTANCE_URL`, `WXO_REVIEW_AGENT_ID`) are present in `.env.example` but not confirmed live. The assistant will check at startup whether they are configured and use a clearly-labelled fallback if not.

---

## Sub-Tasks

---

### Sub-task 1 — PDF Upload Endpoint

**Status:** `[ ] pending`

**Intent**
Replace the current zero-bytes approach (only `fileName` and `size` are stored) with a real multipart upload. The new `POST /api/purchases/:id/upload-quote` route accepts PDF files, validates them (magic-bytes + MIME + 10 MB size cap), calculates a SHA-256 hash, persists metadata, and returns clear warnings — without claiming authenticity.

**Expected Outcomes**
- `POST /api/purchases/:id/upload-quote` accepts `multipart/form-data` with one `file` field.
- Non-PDF files (by magic bytes `%PDF` or MIME) are rejected with a 400 and a clear message.
- Files over 10 MB are rejected with a 400.
- Accepted files are saved to `backend/uploads/<purchaseId>/` using the original filename; if a file with the same name already exists, the new copy is saved as `<name>-v2.pdf`, `<name>-v3.pdf`, etc. (no silent overwrite).
- A quote record `{ fileName, originalName, size, sha256, uploadedAt, version }` is appended to `purchase.quotes` and an `upload` audit event is logged (purchaseId, actor: "officer", action: "quote_uploaded", details: { fileName, sha256, version }).
- GET `/api/purchases/:id/quote-checks` returns the stored quote metadata and check results (validation warnings, hash). Text extraction/comparison is included if `pdf-parse` is available; otherwise the response includes `{ textExtraction: false, reason: "pdf-parse not installed" }`.
- The endpoint is **not** called from the demo/mock path; demo mode continues to work unchanged.

**Todo List**
1. Install `multer` and `pdf-parse` as backend dependencies (add to `backend/package.json`).
2. Create `backend/src/uploadQuote.js` — exports `uploadQuoteRoute(app)`:
   - Configure `multer` with `dest: 'uploads/'`, `limits.fileSize: 10 * 1024 * 1024`, and a `fileFilter` that rejects non-PDF MIME types early.
   - On receipt: read the saved file, check magic bytes (`%PDF` = `25 50 44 46`), compute SHA-256 with `node:crypto`, attempt `pdf-parse` extraction (try/catch — if it throws, set `textExtracted: false`).
   - Build versioned filename: list existing files in `backend/uploads/<purchaseId>/`, find the highest version suffix for the same base name, write the file there.
   - Push quote record to `purchase.quotes`, call `logEvent`.
   - Return `{ fileName, sha256, version, textExtracted, warnings: [] }`.
3. Add a `GET /api/purchases/:id/quote-checks` route in `server.js` that returns `purchase.quotes` with their stored metadata.
4. Register the upload route in `server.js` (call `uploadQuoteRoute(app)` before the error handler).
5. Write `backend/tests/uploadQuote.test.js` using `node:test` + `node:assert` covering: PDF accepted, non-PDF rejected, oversized rejected, magic-byte mismatch rejected, versioning works for duplicate names.

**Relevant Context**
- `backend/src/store.js` → `getPurchase`, `logEvent` — reuse as-is.
- `backend/src/server.js` line 24–26 — existing `POST /api/purchases` pattern to follow.
- `backend/package.json` currently has only `cors`, `dotenv`, `express`.
- Uploads directory: `backend/uploads/` (create on first use; add to `.gitignore`).

---

### Sub-task 2 — Frontend Upload UI Integration

**Status:** `[ ] pending`

**Intent**
Change `UploadPage.jsx` to actually upload PDF bytes to the new backend endpoint instead of only sending metadata. Add a small upload-status panel that shows the hash, version, and any warnings for each uploaded file. Degrade gracefully in demo mode.

**Expected Outcomes**
- After `createPurchase` succeeds, `UploadPage` posts each selected file to `POST /api/purchases/:id/upload-quote` using `fetch` with `FormData` (no `Content-Type: application/json` header — let the browser set multipart boundary).
- Validation errors from the server (non-PDF, too large, magic byte fail) are displayed per-file as inline warnings, not a page-level error.
- Each uploaded file shows its SHA-256 hash and version in a small status list labelled "File checks (for officer review — not a fraud proof)".
- Text-extraction warnings (if any) are shown with a "⚠ Warning (requires human review)" prefix.
- In demo mode (`IS_DEMO === true`) the upload step is skipped silently and the existing flow continues unchanged.
- The file `accept` attribute and client-side extension check remain as a first-line hint; server validation is authoritative.

**Todo List**
1. Add `uploadQuote(purchaseId, file)` to `realApi` in `frontend/src/api.js` — uses `fetch` with `FormData`, no JSON headers.
2. In `UploadPage.jsx`, after `createPurchase` and before `startReview`: loop through files, call `api.uploadQuote(purchase.id, file)` for each (only in non-demo mode), collect results.
3. Add a `quoteChecks` state variable; render a small results list under the file input showing hash, version, and warnings per file.
4. Wrap upload errors in per-file state so one bad file does not block the others; display all warnings before proceeding.
5. The "Run agentic review" button remains; upload warnings do not block submission (they require human review).

**Relevant Context**
- `frontend/src/api.js` line 4–26 — `realApi` object; `IS_DEMO` export.
- `frontend/src/pages/UploadPage.jsx` line 54–73 — `handleSubmit` to extend.
- `frontend/src/index.css` — existing `.muted`, `.error`, `.tag`, `.tag-amber`, `.warning` classes.
- Demo mode check: `import { IS_DEMO } from '../api.js'`.

---

### Sub-task 3 — Report Versioning and Enriched Audit Events

**Status:** `[ ] pending`

**Intent**
Make the `publish` route support corrections: calling it again on an already-published purchase creates a new version instead of overwriting. Store `publishHistory` on each purchase so every version is retained. Enrich audit events with document hashes where applicable. Expose a `GET /api/purchases/:id/history` route for the UI.

**Expected Outcomes**
- `POST /api/purchases/:id/publish` on an already-published purchase: pushes the current `publicSummary` + `publishedAt` + `version` onto `purchase.publishHistory`, increments `purchase.publishVersion`, sets the new summary and timestamp, and logs a `report_corrected` audit event (with previous hash and new hash in details).
- First publication works exactly as before (backward-compatible); `publishVersion` defaults to 1 and `publishHistory` to `[]`.
- Audit events for `awarded` and `report_published` / `report_corrected` include `docHash` in details when a quote has been uploaded.
- `GET /api/purchases/:id/history` returns `{ id, publishVersion, publishedAt, publicSummary, publishHistory: [{ version, publishedAt, publicSummary, auditRef }] }` — `auditRef` is the SHA-256 of the previous event's JSON string (tamper-evident chain). Response omits all private quote data.
- `GET /api/public/purchases` already strips private fields; no change needed there.
- A new `GET /api/public/purchases/:id/history` route (no auth required) exposes the same history for the public panel.
- The UI limitation note is added: "History is session-scoped — it resets if the server restarts. A production deployment would use a database."

**Todo List**
1. In `backend/src/store.js`:
   - Add `hashEvent(eventJson)` helper (SHA-256 of a JSON string, `node:crypto`).
   - Enrich `logEvent` to compute and store `prevHash` (hash of the last event in `auditLog`, or `"genesis"` for the first).
   - Add `getPublicHistory(id)` that maps `purchase.publishHistory` to safe public fields.
2. In `backend/src/server.js`, modify `POST /api/purchases/:id/publish`:
   - If `p.status === 'published'` already, do NOT call `moveStatus` (it would throw); instead push to `p.publishHistory`, increment `p.publishVersion`, update `p.publicSummary` and `p.publishedAt`, and log `report_corrected`.
   - On first publish: set `p.publishVersion = 1`, `p.publishHistory = []`, log `report_published` with a `summaryHash` in details.
3. Add `GET /api/purchases/:id/history` (officer-only, no auth yet — just the route).
4. Add `GET /api/public/purchases/:id/history` (public-safe fields only).
5. Update `mockApi.js` in the frontend demo to mirror `publishVersion` and `publishHistory` fields in `publish()` and `createPurchase` so demo mode stays consistent.
6. Write `backend/tests/reportHistory.test.js` covering: first publish sets version 1, correction increments version and retains history, `prevHash` chain is non-empty after two events, public history omits private fields.

**Relevant Context**
- `backend/src/store.js` lines 1–50 — entire file; `logEvent`, `moveStatus`.
- `backend/src/server.js` lines 75–82 — existing publish route.
- `frontend/src/demo/mockApi.js` lines 86–92 — `publish` function.
- The `TRANSITIONS` FSM in `store.js` currently does not allow re-publishing. The correction path bypasses `moveStatus` deliberately.

---

### Sub-task 4 — Report History Panel in Public Portal

**Status:** `[ ] pending`

**Intent**
Add a "Version history & verification" collapsible section inside the `DetailModal` in `PublicPortal.jsx`. Shows each published version, its timestamp, and its audit reference (hash). Fetches from the new public history endpoint. Applies the same demo-mode fallback.

**Expected Outcomes**
- `DetailModal` gains a "Version history" accordion section that fetches `/api/public/purchases/:id/history` on open.
- Each row: version number, publication date/time, first 12 chars of `auditRef` (hash fingerprint).
- A note below: "This record is tamper-evident but not immutable — an administrator with server access can modify the underlying store."
- In demo mode, mock history is returned from `mockApi` with one entry and a placeholder hash.
- Loading and error states are handled; empty history shows "No history available."
- No private quote data or personal information is included.

**Todo List**
1. Add `publicPurchaseHistory(id)` to `realApi` in `frontend/src/api.js` calling `GET /api/public/purchases/:id/history`.
2. Add `publicPurchaseHistory(id)` stub to `mockApi.js` returning one mock version entry.
3. Create `frontend/src/components/ReportHistory.jsx` — a small component that accepts `{ purchaseId }`, fetches history on mount, renders an accordion/collapsible list.
4. Import and render `<ReportHistory purchaseId={p.id} />` inside `DetailModal` in `PublicPortal.jsx`, after the override justification block.
5. Add minimal CSS to `index.css` for `.history-panel`, `.history-row`, `.hash-ref` (style consistent with `.facts` block).

**Relevant Context**
- `frontend/src/pages/PublicPortal.jsx` lines 80–119 — `DetailModal` component.
- `frontend/src/api.js` — `realApi` and `mockApi` exports.
- `frontend/src/index.css` — `.facts`, `.fact`, `.muted`, `.small` classes to reuse.

---

### Sub-task 5 — ClearBid Assistant Backend Route

**Status:** `[ ] pending`

**Intent**
Add a `POST /api/assistant` route that accepts a structured message (intent + purchase context) and returns an assistant response. Uses watsonx Orchestrate when configured, otherwise returns a clearly-labelled demo fallback. Never exposes API keys or makes protected calls from the browser.

**Expected Outcomes**
- `POST /api/assistant` accepts `{ intent, purchaseId?, context? }` where `intent` is one of `"start_review"`, `"explain_flag"`, `"draft_summary"`.
- If `WXO_API_KEY` and `WXO_INSTANCE_URL` and `WXO_REVIEW_AGENT_ID` are set, the route delegates to the existing `fetchAgentReview` / `orchestrateRequest` path in `orchestrate.js`. (For this MVP, the assistant response is built from the existing review result + a simple template — not a separate agent call, to avoid new API costs.)
- If watsonx is not configured (`USE_MOCK_AGENTS=true` or env vars missing), the route returns a `{ source: "demo", message: "...", disclaimer: "Demo response — not from a live AI model." }` shaped response.
- Timeout and error handling: on `fetch` error, return `{ error: "Assistant unavailable", retry: true }` with a 503.
- The route does NOT make or publish decisions; it returns text suggestions only.
- Logging: `logEvent(purchaseId, 'assistant', 'assistant_query', { intent })` for auditability.

**Todo List**
1. Create `backend/src/assistant.js` — exports `assistantRoute(app)`:
   - Checks env vars to determine live vs demo mode.
   - Implements the three intent handlers:
     - `start_review`: returns a prompt-style checklist for the officer (uses `purchase.review.summary` if already analyzed, otherwise a generic guide).
     - `explain_flag`: accepts `{ vendor, flagType, evidence }` in context, returns a plain-English explanation of the flag and what the officer should check.
     - `draft_summary`: uses `purchase.publicSummary` draft and returns an improved version with a clear note it must be reviewed before publish.
   - In live mode: wraps the response in a simple watsonx Orchestrate message (uses existing `orchestrateRequest` helper); falls back to demo if the call fails.
   - In demo mode: constructs the response locally from templates.
2. Register the route in `server.js` (import and call `assistantRoute(app)`).
3. Write `backend/tests/assistant.test.js` using `node:test` covering: demo fallback returns correct shape, `explain_flag` with unknown intent returns 400, error from orchestrate triggers demo fallback.

**Relevant Context**
- `backend/src/orchestrate.js` — `orchestrateRequest`, `fetchAgentReview`, `getIamToken` exports.
- `backend/src/review.js` — `runReview`, `MOCK_REVIEW` for template data.
- `backend/src/store.js` — `getPurchase`, `logEvent`.
- `backend/src/server.js` — existing route pattern for error handling.
- Env var check pattern: already used in `review.js` (`process.env.USE_MOCK_AGENTS === 'true'`).

---

### Sub-task 6 — ClearBid Assistant Frontend Widget

**Status:** `[ ] pending`

**Intent**
Add a compact, collapsible chat-style assistant panel to `ReviewPage.jsx` and `DecisionPage.jsx`. The panel calls `POST /api/assistant` via the existing `api` object. In demo mode, calls `mockApi.assistant()`. Errors and timeouts show a retry button. The widget never makes decisions — it shows suggestions that the officer must confirm explicitly.

**Expected Outcomes**
- A collapsible "ClearBid Assistant" panel appears on `ReviewPage` (after the vendor table, before the Continue button) and on `DecisionPage` (before the award section).
- Three pre-defined quick-action buttons: "Explain flags", "Start review guide", "Draft public summary".
- Each button sends the relevant intent + current purchase context to `POST /api/assistant`; the response appears as a chat bubble below.
- Responses are labelled: live responses with "ClearBid Assistant (AI-assisted)" and demo responses with "ClearBid Assistant (Demo — not a live AI model)".
- If the response includes `source: "demo"`, a yellow disclaimer banner is shown.
- On error (network/timeout): shows "Assistant is unavailable. Retry?" with a retry button.
- Loading state: spinner + "Thinking…" text.
- The officer's explicit confirm actions (award button, publish button) are unchanged — the assistant cannot trigger them.
- In demo mode (`IS_DEMO`), calls `mockApi.assistant(intent, context)` which returns a canned response instantly.

**Todo List**
1. Add `assistant(intent, context)` to `realApi` in `frontend/src/api.js` — `POST /api/assistant`.
2. Add `assistant(intent, context)` to `mockApi.js` — returns `{ source: "demo", message: "...", disclaimer: "Demo response — not from a live AI model." }`.
3. Create `frontend/src/components/AssistantPanel.jsx`:
   - Props: `{ purchase, context? }`.
   - State: `open`, `loading`, `messages[]`, `error`.
   - Renders a collapsible `<aside>` with header "ClearBid Assistant".
   - Three buttons trigger the three intents.
   - Messages rendered as a chat list; source label and disclaimer shown per-message.
   - Error state: inline error + retry button.
4. Import and place `<AssistantPanel purchase={purchase} />` in `ReviewPage.jsx` and `DecisionPage.jsx`.
5. Add CSS to `index.css`: `.assistant-panel`, `.assistant-messages`, `.assistant-msg`, `.assistant-msg--demo`, `.assistant-btn-row`.

**Relevant Context**
- `frontend/src/pages/ReviewPage.jsx` lines 76–138 — insertion point after line 134 (before navigate button).
- `frontend/src/pages/DecisionPage.jsx` — read during implementation to find insertion point.
- `frontend/src/api.js` — `realApi`, `IS_DEMO`, `mockApi` pattern.
- `frontend/src/index.css` — `.card`, `.warning`, `.muted`, `.spinner`, `.btn-light` classes to reuse.
- `frontend/src/demo/mockApi.js` — extend existing `mockApi` export.

---

### Sub-task 7 — Tests, Validation and Demo Smoke-Test

**Status:** `[ ] pending`

**Intent**
Run all existing tests (orchestrate pytest, any new Node tests), confirm the frontend demo build still works, and produce a final summary of what is implemented vs mocked/limited.

**Expected Outcomes**
- `pytest orchestrate/tests/ -v` → all 19 existing tests pass, no regressions.
- `node --test backend/tests/*.test.js` → all new backend tests pass.
- `npm run build:demo` in `frontend/` completes without errors or new warnings.
- `npm run lint` in `frontend/` passes (oxlint).
- Summary section written as a comment at the bottom of this plan file.

**Todo List**
1. Run `pytest orchestrate/tests/ -v` and confirm 19/19 pass.
2. Run `node --test backend/tests/*.test.js` and fix any failures.
3. Run `cd frontend && npm run lint` and fix any oxlint errors introduced by new code.
4. Run `cd frontend && npm run build:demo` and verify no build errors.
5. Manually smoke-test the demo flow: upload → review → decide → report → public portal (history panel).
6. Write final summary at the bottom of this file.

**Relevant Context**
- `orchestrate/tests/test_review_tools.py` — 19 existing tests.
- `frontend/package.json` — `lint`, `build:demo` scripts.
- Backend has no test runner configured; `node --test` is built-in since Node 18.

---

## Implementation Notes

### Dependency additions (backend only)
| Package | Why | Alternative if rejected |
|---------|-----|------------------------|
| `multer` | Multipart file upload parsing | Use raw `busboy` or reject non-JSON uploads at the route level |
| `pdf-parse` | PDF text extraction for content comparison | Skip text comparison; implement validation + hashing only |

Both are MIT-licensed, widely used, and have zero transitive security advisories as of 2025.

### What is genuinely limited (not faked)
1. **In-memory persistence**: report history and audit log reset on server restart. All UI copy states this.
2. **Tamper-evident, not immutable**: the SHA-256 event chain makes edits detectable if the log is exported, but an admin with direct server access can still modify the in-memory array. The UI says "tamper-evident, not immutable."
3. **Text extraction on scanned PDFs**: `pdf-parse` cannot read image-only PDFs. The UI shows "Text extraction unavailable — human review required."
4. **watsonx Orchestrate assistant**: the MVP assistant route uses the existing review data + templates rather than a new Orchestrate agent call, to avoid new API costs. Live Orchestrate is used only if already configured. The source label is always truthful.
5. **No authentication**: the officer routes have no session/auth. This is an existing project constraint; the plan does not add auth.

---

## Final Summary
*(to be filled in after Sub-task 7)*
