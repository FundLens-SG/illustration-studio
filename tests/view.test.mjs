// View-layer tests — the client-facing numbers DERIVED from a simulate()
// result in the UI (RRP payback age / income multiple / % returned;
// par-WL breakeven + capital-multiple milestones). These used to be
// computed inline in the render layer and slipped the model-only gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel, loadView, rrpSettings, parWlSettings } from "./harness.mjs";

const model = loadModel();
const view = loadView();

test("computeRrpStats — RRP_10 age40 ret65 payout10 @ income 1000", () => {
  const result = model.simulate(rrpSettings(), [], "custom");
  const stats = view.computeRrpStats(result, result.rrpSummary);

  assert.equal(stats.incomeRows.length, 10, "payout 66-75 = 10 income rows");
  assert.equal(stats.breakEvenIndex, 3, "breakeven at payout year 4 (index 3)");
  assert.equal(stats.breakEvenRow.age, 69, "breakeven age 69");
  assert.ok(Math.abs(stats.totalBenefits - 120000) < 1, `totalBenefits ${stats.totalBenefits}`);
  assert.ok(Math.abs(stats.premiumTotal - 47438) < 50, `premiumTotal ${stats.premiumTotal}`);
  assert.ok(Math.abs(stats.multiple - 2.53) < 0.05, `multiple ${stats.multiple}`);
  assert.ok(stats.pctReturnedAtEnd > 2.5 && stats.pctReturnedAtEnd < 2.6, `pctReturned ${stats.pctReturnedAtEnd}`);
  // cumulative is what breakEvenIndex indexes into
  assert.ok(stats.cumulativeValues[stats.breakEvenIndex] >= stats.premiumTotal);
  assert.ok(stats.cumulativeValues[stats.breakEvenIndex - 1] < stats.premiumTotal, "index is the FIRST crossing");
});

test("computeRrpStats — not-reached path returns null breakeven + low pct", () => {
  // Premiums never recovered: one income row of 1000 against 100k premium.
  const fake = {
    annual: [{ rrpIncomeYear: true, rrpTotalAnnual425: 1000, rrpCumulativeTotalIncome425: 1000, age: 66, totalBasicPaid: 100000 }],
    rrpSummary: { totalPremiumsPaid: 100000, totalBenefits425: 1000 },
  };
  const stats = view.computeRrpStats(fake, fake.rrpSummary);
  assert.equal(stats.breakEvenIndex, -1);
  assert.equal(stats.breakEvenRow, null);
  assert.ok(Math.abs(stats.pctReturnedAtEnd - 0.01) < 1e-9, `pctReturned ${stats.pctReturnedAtEnd}`);
  assert.ok(Math.abs(stats.multiple - 0.01) < 1e-9, `multiple ${stats.multiple}`);
});

test("computeRrpStats — empty income rows degrade gracefully", () => {
  const stats = view.computeRrpStats({ annual: [], rrpSummary: {} }, {});
  assert.equal(stats.incomeRows.length, 0);
  assert.equal(stats.breakEvenIndex, -1);
  assert.equal(stats.breakEvenRow, null);
  assert.equal(stats.lastIncomeRow, null);
  assert.equal(stats.multiple, null);
  assert.equal(stats.pctReturnedAtEnd, null);
});

test("parWlMilestones — SLH_SP $100k single premium", () => {
  const result = model.simulate(parWlSettings(), [], "custom");
  const m = view.parWlMilestones(result);
  // Within a 40-year hold the $100k SP should break even (guaranteed and total).
  for (const k of ["breakevenTotal", "breakevenGuaranteed"]) {
    assert.ok(m[k] === null || (m[k] > 0 && m[k] <= 40), `${k} = ${m[k]}`);
  }
  // Capital multiples, when reached, occur in non-decreasing order.
  const reached = [m.multiple2, m.multiple4, m.multiple8].filter((x) => x !== null);
  for (let i = 1; i < reached.length; i += 1) {
    assert.ok(reached[i] >= reached[i - 1], `multiple milestones out of order: ${reached.join(",")}`);
  }
  // 2x is never reached before total breakeven.
  if (m.multiple2 !== null && m.breakevenTotal !== null) {
    assert.ok(m.multiple2 >= m.breakevenTotal, "2x before breakeven?");
  }
});
