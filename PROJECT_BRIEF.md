# ClearBid – Project Brief

## What it is

Agentic AI assistant that reviews government vendor quotes before purchase. Agents RECOMMEND; a human officer DECIDES.

## Stack

- frontend/: React + Vite (done, written by me – do not modify unless asked)
- backend/: Node.js + Express, in-memory store, mock mode via USE_MOCK_AGENTS (done)
- orchestrate/: watsonx Orchestrate ADK (Python tools + agent YAML) – IN PROGRESS; model: groq/openai/gpt-oss-120b
- data/: synthetic demo data

## Agents (keep to 3 total, credits are limited)

1. clearbid_review_agent – calls run_quote_review once, explains flags in plain language
2. clearbid_report_agent – later
3. clearbid_supervisor – later
   Agents have NO tools that award contracts or publish anything.

## Review output contract (frontend depends on this exact shape)

{
"summary": "one sentence",
"vendors": [
{ "vendor": "Vendor A", "unitPrice": 3900,
"flags": [ { "type": "price|vendor|collusion|compliance",
"level": "low|medium|high",
"evidence": "short factual sentence" } ] }
]
}

## Checks (deterministic Python, no AI)

- price: unit price vs median past government award and market catalog; >25% above = medium, >100% above = high
- vendor: exact/fuzzy match on exclusions list → "possible match – verify" (never confirmed)
- collusion: competing vendors sharing address, phone, or bank routing+account
- bid spread: competing bids within 3% of each other
- compliance: >= 3 quotes required above $10,000; supervisor approval above $50,000

## Demo scenarios

- laptops-50 (fraud case): Vendor A 3.2x markup; Vendor B & C share address + bank account; Vendor C possible exclusion match; Vendor D clean
- chairs-120 (clean case): no flags
- toner-400 (single price flag)

## Rules

- No network calls inside tools (data is bundled)
- Tool output must be compact (no raw data dumps) to save model tokens
- All demo data is synthetic and labelled as such
