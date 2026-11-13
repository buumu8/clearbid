/**
 * assistant.js
 *
 * Registers POST /api/assistant.
 *
 * Accepts { intent, purchaseId?, vendor?, flagType?, evidence? }
 * where intent ∈ { "start_review", "explain_flag", "draft_summary" }.
 *
 * Uses watsonx Orchestrate when configured (WXO_API_KEY + WXO_INSTANCE_URL set
 * and USE_MOCK_AGENTS !== "true"). Otherwise returns a clearly-labelled demo
 * response built from templates and existing purchase data.
 *
 * The assistant NEVER makes or publishes decisions — it returns text suggestions
 * only. The officer must review and confirm all decisions explicitly.
 *
 * IMPORTANT: This is NOT described as IBM Bob. Bob is the development tool
 * used to build this feature. The assistant runtime is either watsonx Orchestrate
 * (when configured) or a local template engine (demo/fallback mode).
 */

import { getPurchase, logEvent } from './store.js';

const VALID_INTENTS = ['start_review', 'explain_flag', 'draft_summary'];

/** Check whether watsonx Orchestrate is configured for live use. */
function isLiveMode() {
    const agentId =
        process.env.WXO_ASSISTANT_AGENT_ID ||
        process.env.WXO_REVIEW_AGENT_ID;

    return (
        process.env.USE_MOCK_AGENTS !== 'true' &&
        Boolean(process.env.WXO_API_KEY) &&
        Boolean(process.env.WXO_INSTANCE_URL) &&
        Boolean(agentId)
    );
}

// ── Template-based demo/fallback responses ────────────────────────────────

function demoResponse(intent, purchase, context) {
    switch (intent) {
        case 'start_review': {
            const vendorCount = purchase?.review?.vendors?.length;
            const summary = purchase?.review?.summary;
            const lines = [
                'Here is a review checklist for this procurement:',
                `• Confirm at least 3 vendor quotes were compared${vendorCount ? ` (${vendorCount} found)` : ''}.`,
                '• Check vendor registration dates — new registrations (< 6 months) warrant extra scrutiny.',
                '• Review any "high" risk flags first; they require a written justification to override.',
                '• Confirm prices are within 25% of past government awards for the same item type.',
                '• Verify no vendors share banking details or addresses (collusion indicator).',
            ];
            if (summary) lines.push(`\nAgent review summary: "${summary}"`);
            lines.push('\nAll flags require your independent human review. This checklist is a guide, not a decision.');
            return lines.join('\n');
        }

        case 'explain_flag': {
            const { vendor, flagType, evidence } = context;
            const explanations = {
                price: `A price flag means this vendor's quoted price is significantly higher than past government purchases or current market prices. This warrants further verification — it may be an error, or it may indicate bid manipulation. Evidence: ${evidence ?? 'see review panel'}.`,
                collusion: `A collusion flag means two or more vendors share identifying details (address, bank account) that suggest they may be coordinating bids rather than competing independently. This is a serious compliance concern and should be reported to your procurement supervisor. Evidence: ${evidence ?? 'see review panel'}.`,
                vendor: `A vendor flag means this vendor's name closely matches a name on a known exclusion or debarment list. Verify the vendor's registration against your authoritative exclusions list before awarding. Evidence: ${evidence ?? 'see review panel'}.`,
                quality: `A quality flag means this vendor has received below-threshold satisfaction ratings from previous government buyers. Consider this alongside price and compliance when making your decision. Evidence: ${evidence ?? 'see review panel'}.`,
                compliance: `A compliance flag means a procurement rule may not have been met — for example, too few competing quotes were obtained. Document your justification if you proceed. Evidence: ${evidence ?? 'see review panel'}.`,
            };
            const explanation = explanations[flagType] ?? `This flag (type: "${flagType}") indicates a potential issue that requires your review. Evidence: ${evidence ?? 'not provided'}.`;
            return `Flag explanation for "${vendor ?? 'unknown vendor'}" (${flagType ?? 'unknown'}):\n\n${explanation}\n\nThis is an officer review aid. It does not constitute a finding of fraud or non-compliance.`;
        }

        case 'draft_summary': {
            if (!purchase || purchase.status !== 'awarded') {
                return 'A public summary can be drafted once a vendor has been awarded. Please complete the award step first.';
            }
            const winner = purchase.review?.vendors?.find((v) => v.vendor === purchase.awardedVendor);
            const total = winner ? `$${(winner.unitPrice * purchase.quantity).toLocaleString()}` : 'an approved amount';
            const riskCount = purchase.review?.vendors?.reduce(
                (n, v) => n + v.flags.filter((f) => f.type !== 'compliance').length, 0
            ) ?? 0;
            return [
                `Draft public summary for ${purchase.id}:`,
                '',
                `The city purchased ${purchase.quantity} units of "${purchase.title}" from ${purchase.awardedVendor} for a total of ${total}. ${purchase.review?.vendors?.length ?? 0} vendor quotes were compared against past government prices and checked for vendor risks. ${riskCount > 0 ? `${riskCount} risk${riskCount !== 1 ? 's' : ''} were flagged and reviewed by a procurement officer.` : 'No risks were found.'} A named officer reviewed all findings and made the final award decision.`,
                '',
                '⚠ Review this draft carefully before publishing. Remove any vendor bank details, pricing not approved for public disclosure, or personal information.',
            ].join('\n');
        }

        default:
            return null;
    }
}

// ── Live watsonx Orchestrate path ─────────────────────────────────────────

async function liveResponse(intent, purchase, context) {
    let prompt;

    switch (intent) {
        case 'start_review':
            prompt = [
                'You are ClearBid, a procurement review assistant.',
                `The officer is reviewing procurement ${purchase?.id ?? 'unknown'}.`,
                `Item: ${purchase?.title ?? 'not provided'}.`,
                'Give a brief, plain-English checklist for reviewing the findings.',
                'Do not make or recommend the final award decision.',
            ].join(' ');
            break;

        case 'explain_flag':
            prompt = [
                'You are ClearBid, a procurement review assistant.',
                `Explain this flag in plain English: type="${context.flagType ?? 'unknown'}",`,
                `vendor="${context.vendor ?? 'unknown'}",`,
                `evidence="${context.evidence ?? 'not provided'}".`,
                'Keep the explanation brief. Do not claim fraud or make a final decision.',
                'Tell the officer what evidence to verify.',
            ].join(' ');
            break;

        case 'draft_summary':
            if (!purchase || purchase.status !== 'awarded') {
                return 'A public summary can be drafted once a vendor has been awarded.';
            }

            prompt = [
                'You are ClearBid, a procurement review assistant.',
                `Draft a factual public summary for purchase ${purchase.id}.`,
                `Item: ${purchase.title}.`,
                `Awarded vendor: ${purchase.awardedVendor}.`,
                'Keep it under 80 words. Do not include sensitive information.',
                'The officer must review and approve the draft before publication.',
            ].join(' ');
            break;

        default:
            return null;
    }

    const { fetchAgentAssistant } = await import('./orchestrate.js');
    return await fetchAgentAssistant(prompt);
}
// ── Route registration ────────────────────────────────────────────────────

export function registerAssistantRoute(app) {
    app.post('/api/assistant', async (req, res, next) => {
        try {
            const { intent, purchaseId, vendor, flagType, evidence } = req.body ?? {};

            if (!intent || !VALID_INTENTS.includes(intent)) {
                return res.status(400).json({
                    error: `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}.`,
                });
            }

            const purchase = purchaseId ? getPurchase(purchaseId) : null;
            const context = { vendor, flagType, evidence };

            // Log the query for auditability (no personal data stored here).
            if (purchaseId) {
                logEvent(purchaseId, 'assistant', 'assistant_query', { intent });
            }

            let message = null;
            let source = 'demo';

            if (isLiveMode()) {
                try {
                    message = await liveResponse(intent, purchase, context);
                    if (message) source = 'agent';
                    console.log(message)
                } catch (err) {
                    console.error('[assistant] Live Orchestrate call failed:', err.message);
                }
            }


            if (!message) {
                message = demoResponse(intent, purchase, context);
                source = 'demo';
            }

            if (!message) {
                return res.status(400).json({ error: `No response could be generated for intent "${intent}".` });
            }

            const payload = {
                intent,
                source,
                message,
            };
            if (source === 'demo') {
                payload.disclaimer = 'Demo response — not from a live AI model. Review independently before acting.';
            }

            res.json(payload);
        } catch (err) {
            next(err);
        }
    });
}
