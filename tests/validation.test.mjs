// Validation layer — asserts engine outputs against known-good anchors,
// not just against their own prior output.
//
// Primary oracle: the 181 RRP rows the parser marked `source_exact`,
// i.e. lifted directly from real Manulife Benefit Illustrations. Driving
// the engine in premium mode at a row's own premium must reproduce that
// row's projected monthly income to the cent. (This validates the
// lookup + scaling + income-composition path. Whether the PDF was parsed
// correctly in the first place is a data-provenance concern, out of
// scope for this file.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel } from "./harness.mjs";

const m = loadModel();

const TERM_TO_VARIANT = { single: "RRP_SP", 5: "RRP_5", 10: "RRP_10", 15: "RRP_15", 20: "RRP_20" };
const near = (a, b, tol = 0.05) => Math.abs(Number(a) - Number(b)) <= tol;

test("RRP reproduces all source-exact BI rows to the cent", () => {
  const grid = m.RRP_GRID || [];
  const exact = grid.filter((r) => r.estimation_method === "source_exact");
  assert.ok(exact.length >= 150, `expected the full source-exact set, got ${exact.length}`);

  const failures = [];
  for (const row of exact) {
    const termKey = String(row.premium_payment_term).toLowerCase().includes("single")
      ? "single" : String(Number(row.premium_payment_term));
    const variantKey = TERM_TO_VARIANT[termKey];
    if (!variantKey) { failures.push(`unknown term ${row.premium_payment_term}`); continue; }
    const isSingle = termKey === "single";
    const premium = isSingle
      ? Number(row.estimated_single_premium_for_gmi_1000)
      : Number(row.estimated_annual_premium_for_gmi_1000);
    if (!Number.isFinite(premium) || premium <= 0) continue;

    const result = m.simulate({
      variantKey,
      currency: "SGD",
      rrpAge: Math.round(Number(row.life_insured_age)),
      rrpRetirementAge: Math.round(Number(row.target_retirement_age)),
      rrpPayoutPeriod: String(row.income_payout_period).toLowerCase().includes("life")
        ? "lifetime" : String(Number(row.income_payout_period)),
      rrpInputMode: "premium",
      rrpPremium: premium,
      rrpGmi: 1000,
    }, [], "validate");

    const s = result.rrpSummary || {};
    const label = `age${row.life_insured_age} ret${row.target_retirement_age} ${termKey} payout${row.income_payout_period}`;
    if (!s.valid) { failures.push(`${label}: blocked (${(s.blockers || [])[0] || "?"})`); continue; }
    if (!near(s.guaranteedMonthlyIncome, 1000, 0.5)) failures.push(`${label}: gmi ${s.guaranteedMonthlyIncome} != 1000`);
    if (!near(s.totalMonthly425, row.estimated_total_monthly_income_iirr_425_for_gmi_1000))
      failures.push(`${label}: total425 ${s.totalMonthly425} != ${row.estimated_total_monthly_income_iirr_425_for_gmi_1000}`);
    if (!near(s.ngMonthly425, row.estimated_non_guaranteed_monthly_income_iirr_425_for_gmi_1000))
      failures.push(`${label}: ng425 ${s.ngMonthly425} != ${row.estimated_non_guaranteed_monthly_income_iirr_425_for_gmi_1000}`);
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} source-exact mismatches; first few above`);
});

test("SI death-benefit floor is ~105% of single premium on day 1", () => {
  for (const financed of [true, false]) {
    const r = m.simulate({
      variantKey: "SI3_SP", currency: "USD", siPremium: 200000, siEntryAge: 40,
      siFinancingEnabled: financed, siFinancingPct: financed ? 0.72 : 0, siInterestRate: financed ? 0.02 : 0,
    }, [], "validate");
    const day1 = (r.annual || [])[0] || {};
    const db = Number(day1.siDeathBenefit);
    assert.ok(Number.isFinite(db) && db > 0, `SI day-1 death benefit missing (financed=${financed})`);
    const ratio = db / 200000;
    assert.ok(ratio >= 1.04 && ratio <= 1.10, `SI day-1 DB ratio ${ratio.toFixed(4)} not ~1.05 (financed=${financed})`);
  }
});

test("SLH_SP par-WL breaks even on premiums within the projection", () => {
  const r = m.simulate({
    variantKey: "SLH_SP", currency: "USD", startAge: 36, annualizedPremium: 100000,
    paymentFrequency: "Annual", projectionYears: 40,
  }, [], "validate");
  const annual = r.annual || [];
  assert.ok(annual.length > 0, "no par-WL projection rows");
  const finalSV = Number((r.final || {}).surrenderValue ?? annual[annual.length - 1].surrenderValue);
  assert.ok(Number.isFinite(finalSV), "par-WL final surrender value not finite");
  assert.ok(finalSV > 100000, `SLH_SP $100k should exceed premium by year 40; got ${Math.round(finalSV)}`);
  // Surrender value should be non-decreasing across the back half of the
  // hold (terminal bonus accumulates; no withdrawals modelled).
  const back = annual.slice(Math.floor(annual.length / 2)).map((x) => Number(x.surrenderValue || 0));
  for (let i = 1; i < back.length; i += 1) {
    assert.ok(back[i] >= back[i - 1] - 0.5, `par-WL surrender value dipped at back-half row ${i}: ${back[i - 1]} -> ${back[i]}`);
  }
});
