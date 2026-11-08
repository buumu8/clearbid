=================================== PROMPT 1 ===================================
Read PROJECT_BRIEF.md first. Work only inside the orchestrate/ and data/ folders.

Create the watsonx Orchestrate ADK files for the ClearBid review agent:

1. data/ – synthetic JSON for the 3 demo scenarios in the brief:
   vendors (name, address, phone, bank routing, bank account, registration date),
   quotes per scenario (vendor, item description, quantity, unit price),
   past government awards for each item (realistic USAspending-style records, 5–8 each),
   market price catalog, exclusions list (include a near-match name for Vendor C),
   rules (thresholds from the brief).

2. orchestrate/tools/review_tools.py – one ADK Python tool using
   `from ibm_watsonx_orchestrate.agent_builder.tools import tool`:
   run_quote_review(scenario_id: str) -> dict
   - Loads the bundled data (copy the data into the tool package so it works inside Orchestrate with no network access)
   - Runs all deterministic checks from the brief in plain Python
   - Returns EXACTLY the review output contract from the brief, plus a "risk_level" field (low/medium/high) computed in Python
   - Clear docstring with Args/Returns so the agent knows how to call it
   - Unknown scenario_id returns a clear error message

3. orchestrate/agents/review_agent.yaml – native agent "clearbid_review_agent",
   llm: watsonx/ibm/granite-3-8b-instruct, short instructions (max 12 lines):
   call run_quote_review exactly once, then reply with ONLY valid JSON matching the contract,
   rewriting each evidence string as one plain-English sentence and writing the summary.
   Never recommend awarding or rejecting a vendor. Never invent data not returned by the tool.

4. orchestrate/tests/test_review_tools.py – pytest tests for all 3 scenarios
   (fraud case flags A, B, C and leaves D clean; chairs case has zero flags; toner has one price flag).

5. orchestrate/requirements.txt and orchestrate/README.md with the exact import commands.

Keep the code simple and readable. Do not touch frontend/ or backend/.

=================================== PROMPT 2 ===================================

Read PROJECT_BRIEF.md. The review tool output is missing several approved changes. Fix only orchestrate/ and data/:

1. Remove the $50,000 supervisor check from vendor flags. Add top-level
   "requires_supervisor_approval": true/false (true if any line total >= 50000).
   Put "fewer than 3 quotes above $10,000" in a top-level "purchase_flags" list.
2. Rename vendor "Vendor C Supplies LLC" to "Apex Digital Solutions LLC" and the
   exclusion entry to "Apex Digitel Solutions LLC". Rename the overpriced vendor
   "Apex Federal Solutions LLC" to "Northline Tech Partners" so only one vendor is near
   the exclusion. Normalize names before fuzzy matching (lowercase, strip LLC/Inc/Corp/punctuation).
3. Price check: compare against max(median past award, catalog price); evidence must
   mention both numbers.
4. Summary: describe findings in plain English without the scenario ID.
5. Tests must assert: in laptops-50 the 4th vendor has ZERO flags; requires_supervisor_approval
   is true for laptops-50; no vendor except the intended one matches the exclusions list;
   test_data_in_sync passes. Do not weaken tests to make them pass.
6. Agent YAML: change llm to the GPT-OSS model ID I'm using, and change instructions to
   "Call run_quote_review once. Return its JSON unchanged except rewrite 'summary' as one
   or two plain-English sentences. Output only JSON."
Update PROJECT_BRIEF.md model line to GPT-OSS.

=================================== PROMPT 3 ===================================

Read PROJECT_BRIEF.md. Work only in backend/src/.

Create backend/src/orchestrate.js and update runReview() in review.js to call the
watsonx Orchestrate review agent when USE_MOCK_AGENTS is not "true":

- Get an IBM Cloud IAM token from https://iam.cloud.ibm.com/identity/token
  (grant_type=urn:ibm:params:oauth:grant-type:apikey, apikey=WXO_API_KEY);
  cache it in memory and refresh 5 minutes before expiry.
- POST {WXO_INSTANCE_URL}/v1/orchestrate/{WXO_REVIEW_AGENT_ID}/chat/completions
  with stream: false and one user message: "Review scenario <scenarioId>".
- Map purchases to scenario IDs: use purchase.scenarioId if set, otherwise "laptops-50".
- Log the raw response once (behind DEBUG_WXO=true) so I can confirm the shape.
- Extract the first JSON object from the assistant's text, validate it against the
  review contract (summary string, vendors array with vendor/unitPrice/flags).
- If the call fails or validation fails: retry once, then fall back to the mock review
  and add a field "source": "fallback" so the UI can show it. Successful results get "source": "agent".
- 60 second timeout. Never log the API key or token.
Use Node 18+ built-in fetch, no new dependencies. Keep the existing routes unchanged.

=================================== PROMPT 4 ===================================

now, let's fix the frontend and backend, I think I've already set USE_MOCK_AGENTS=false 
so we should recieve data from the IBM watsonx agent; however I still don't see that result 
back in my frontend. When I upload a mock quote from  data/sample_quqtes I uploaded the toner 
pdf but I got a fixed result of laptop quotes instead what went wrong? Is it because my frontend 
doesn't forward the scenario to the backend? and the backend doesn't pass this information to agent?


=================================== PROMPT 5 ===================================

Read PROJECT_BRIEF.md. Update the backend data, review tool, and frontend to integrate mock online user reviews and sentiment ratings for vendor products:

1. Data Layer (`data/reviews.json` or inline in tool):
   - Add mock user review metrics for each vendor/product across the scenarios (laptops-50, chairs-120, toner-400). Include: average rating (e.g., 4.8/5 vs 2.3/5), total review count, and 2-3 short snippet quotes from verified buyers or IT admins (e.g., "Screen hinges broke within 3 months", "Excellent build quality and battery life").

2. Review Tool (`orchestrate/tools/review_tools.py`):
   - Update `run_quote_review` to evaluate user satisfaction. If a vendor's product rating falls below 3.0 out of 5, or if customer reviews flag severe reliability risks, add a vendor flag of type "quality" with level "medium" or "high".
   - Adjust the agent's recommended best choice logic: the recommendation should balance price, risk flags, AND user review sentiment (e.g., avoiding a cheap vendor if user reviews show terrible reliability).

3. Frontend UI (`ReviewPage.jsx`, `DecisionPage.jsx`, `PublicPortal.jsx`):
   - Display a clean "User Reviews & Sentiment" breakdown box for each vendor when selected or listed on the review/decision panels. Show stars or rating scores and buyer feedback snippets.
   - Ensure the Public Portal displays the product's user satisfaction score alongside the final awarded vendor details for total transparency.

Keep code clean, modular, and ensure all React map components use unique composite keys. Do not break existing API routes.