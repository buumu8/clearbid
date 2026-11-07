/**
 * recommendation.js
 *
 * Deterministic best-choice vendor selection from a review result's vendors array.
 * Used by ReviewPage, DecisionPage, and ReportPage — single source of truth.
 *
 * Selection algorithm (compliance flags are excluded throughout, matching the
 * filter applied everywhere else in the UI):
 *
 *   Tier 1 (clean): zero high-level flags AND zero quality flags of any level
 *     → pick lowest unitPrice
 *   Tier 2 (conditional): zero high-level flags, may have medium flags
 *     → pick lowest unitPrice, mark conditional: true
 *   Tier 3 (fallback): all vendors have at least one high flag
 *     → pick lowest unitPrice, mark fallback: true
 */

/** Filter out compliance flags — matches the UI filter in ReviewPage/DecisionPage. */
function vendorRiskFlags(flags) {
    return flags.filter((f) => f.type !== 'compliance');
}

/**
 * Returns the agent's recommended vendor from a review result vendors array.
 *
 * @param {Array} vendors - review.vendors array from the tool response
 * @returns {{ vendor: string, unitPrice: number, conditional: boolean, fallback: boolean, reason: string }}
 */
export function getBestChoice(vendors) {
    if (!vendors || vendors.length === 0) return null;

    const scored = vendors.map((v) => {
        const flags = vendorRiskFlags(v.flags);
        const hasHighFlag = flags.some((f) => f.level === 'high');
        const hasQualityFlag = flags.some((f) => f.type === 'quality');
        return { ...v, _hasHighFlag: hasHighFlag, _hasQualityFlag: hasQualityFlag };
    });

    const byPrice = (a, b) => a.unitPrice - b.unitPrice;

    // Tier 1: zero high flags AND zero quality flags
    const tier1 = scored.filter((v) => !v._hasHighFlag && !v._hasQualityFlag).sort(byPrice);
    if (tier1.length > 0) {
        const { vendor, unitPrice } = tier1[0];
        return { vendor, unitPrice, conditional: false, fallback: false, reason: 'Lowest compliant bid with no unmanaged risks' };
    }

    // Tier 2: zero high flags (may have medium or quality flags)
    const tier2 = scored.filter((v) => !v._hasHighFlag).sort(byPrice);
    if (tier2.length > 0) {
        const { vendor, unitPrice } = tier2[0];
        return { vendor, unitPrice, conditional: true, fallback: false, reason: 'Conditional — unresolved medium flags present' };
    }

    // Tier 3: all vendors have high flags
    const tier3 = [...scored].sort(byPrice);
    const { vendor, unitPrice } = tier3[0];
    return { vendor, unitPrice, conditional: false, fallback: true, reason: 'All vendors have high-risk flags — manual review required' };
}
