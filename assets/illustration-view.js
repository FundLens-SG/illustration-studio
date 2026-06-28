// Illustration Studio — view-layer derived-value helpers.
//
// Pure computation that the UI render layer relies on but that isn't part
// of the model engine: the client-facing numbers DERIVED from a simulate()
// result (RRP payback age / income multiple / % returned; par-WL breakeven
// and capital-multiple milestones). Extracted from illustration-studio.html
// so these — like the model — can be unit-tested headless. No DOM.
//
// UMD: window.IRView in the browser, module.exports in Node.
(function (root) {
  "use strict";

  // Derived RRP payback statistics for the chart / summary. Faithfully
  // reproduces the math that used to live inline in renderRRPBenefitsChart.
  // Returns numbers only; the render layer builds the display strings.
  function computeRrpStats(result, summary) {
    summary = summary
      || (result && (result.rrpSummary || (result.final && result.final.rrpSummary)))
      || {};
    const annual = (result && result.annual) || [];
    const incomeRows = annual.filter(
      (row) => row.rrpIncomeYear && Number(row.rrpTotalAnnual425 || 0) > 0
    );
    const lastIncomeRow = incomeRows.length ? incomeRows[incomeRows.length - 1] : null;
    const premiumTotal = Number(
      summary.totalPremiumsPaid || (lastIncomeRow ? lastIncomeRow.totalBasicPaid : 0) || 0
    );
    const totalBenefits = Number(
      summary.totalBenefits425 || (lastIncomeRow ? lastIncomeRow.rrpCumulativeTotalIncome425 : 0) || 0
    );
    const annualIncomeValues = incomeRows.map((row) => Number(row.rrpTotalAnnual425 || 0));
    const cumulativeValues = incomeRows.map((row) => Number(row.rrpCumulativeTotalIncome425 || 0));
    const breakEvenIndex = premiumTotal > 0
      ? cumulativeValues.findIndex((value) => value >= premiumTotal)
      : -1;
    const breakEvenRow = breakEvenIndex >= 0 ? incomeRows[breakEvenIndex] : null;
    const pctReturnedAtEnd = (premiumTotal > 0 && cumulativeValues.length)
      ? (cumulativeValues[cumulativeValues.length - 1] || 0) / premiumTotal
      : null;
    const multiple = premiumTotal > 0 ? totalBenefits / premiumTotal : null;
    return {
      incomeRows,
      lastIncomeRow,
      premiumTotal,
      totalBenefits,
      annualIncomeValues,
      cumulativeValues,
      breakEvenIndex,
      breakEvenRow,
      pctReturnedAtEnd,
      multiple,
    };
  }

  // par-WL milestones: first policy year the policy crosses a threshold.
  //   • Breakeven (G + non-G) — first year total wealth ≥ premiums paid
  //   • Official breakeven (G) — first year guaranteed SV ≥ premiums paid
  //   • Capital × N — first year total wealth ≥ N × premiums paid
  // Thresholds use cumulative basic premium paid at that year (so for
  // 3-Pay / 5-Pay the threshold itself rises until the premium term ends).
  // In BR (drawdown) mode, "wealth" = remaining policy value + cumulative
  // realised cash, so multiples aren't understated by the recurring
  // drawdown capping policy value.
  function parWlMilestones(result) {
    const annual = (result && result.annual) || [];
    const findFirst = (predicate) => {
      const row = annual.find(predicate);
      return row ? row.year : null;
    };
    const wealthOf = (r) => (r.brTotalWealth != null ? r.brTotalWealth : (r.totalValue || 0));
    const breakevenTotal = findFirst((r) => wealthOf(r) >= (r.totalBasicPaid || 0) && (r.totalBasicPaid || 0) > 0);
    const breakevenGuaranteed = findFirst((r) => (r.surrenderValue || 0) >= (r.totalBasicPaid || 0) && (r.totalBasicPaid || 0) > 0);
    const findMultiple = (mult) => findFirst((r) => (r.totalBasicPaid || 0) > 0 && wealthOf(r) >= mult * (r.totalBasicPaid || 0));
    return {
      breakevenTotal,
      breakevenGuaranteed,
      multiple2: findMultiple(2),
      multiple4: findMultiple(4),
      multiple8: findMultiple(8),
    };
  }

  const api = { computeRrpStats, parWlMilestones };
  root.IRView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
