// Spec-window pinning — table-driven asserts of every SII input gate
// against the product spec: entry-age window, per-term income-start
// windows, income floors/caps and the total-premium cap. These were all
// correct in the engine but previously unasserted; a regression in any
// gate now fails loudly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel } from "./harness.mjs";

const m = loadModel();

function summarize(overrides = {}) {
  return m.simulate({
    variantKey: "SII",
    currency: "USD",
    paymentFrequency: "Annual",
    siiAge: 46,
    siiPremiumTerm: "single",
    siiIncomeStartYear: 4,
    siiInputMode: "premium",
    siiAnnualPlannedPremium: 100000,
    siiTargetMonthlyIncome: 0,
    siiSkipMonthly: true,
    siiSkipIrr: true,
    ...overrides,
  }, [], "windows").siiSummary || {};
}

const hasBlocker = (s, text) => (s.blockers || []).some((msg) => msg.includes(text));
const blockers = (s) => (s.blockers || []).join("; ");

test("SII income start windows per premium term match the spec", () => {
  const expected = {
    single: [2, 21], 2: [2, 21], 3: [2, 21],
    4: [3, 21], 5: [3, 21], 6: [3, 21],
    7: [4, 21], 8: [4, 21], 9: [4, 21], 10: [4, 21],
  };
  for (const [term, [min, max]] of Object.entries(expected)) {
    const years = m.siiAvailableIncomeStartYears(term);
    assert.equal(years[0], min, `${term}: window starts at PY${years[0]}, spec says PY${min}`);
    assert.equal(years[years.length - 1], max, `${term}: window ends at PY${years[years.length - 1]}, spec says PY${max}`);
    assert.equal(years.length, max - min + 1, `${term}: window not contiguous`);
  }
});

test("SII entry age window is 0-70 inclusive", () => {
  for (const [age, blocked] of [[-1, true], [0, false], [70, false], [71, true]]) {
    const s = summarize({ siiAge: age });
    assert.equal(hasBlocker(s, "Entry age must be 0-70"), blocked, `age ${age}: ${blockers(s)}`);
    if (!blocked) assert.equal(s.valid, true, `age ${age} should be valid: ${blockers(s)}`);
  }
});

test("SII PY2 income floor sits exactly at US$60", () => {
  const at59 = summarize({ siiIncomeStartYear: 2, siiInputMode: "income", siiTargetMonthlyIncome: 59 });
  assert.equal(at59.valid, false);
  assert.ok(hasBlocker(at59, "Target monthly income must be between US$60"), blockers(at59));
  // At exactly US$60 the floor no longer blocks; the only remaining
  // blocker is the US$100k minimum premium the implied US$60/mo sits
  // below at parsed source rates.
  const at60 = summarize({ siiIncomeStartYear: 2, siiInputMode: "income", siiTargetMonthlyIncome: 60 });
  assert.equal(hasBlocker(at60, "Target monthly income"), false, blockers(at60));
  assert.ok(hasBlocker(at60, "Single premium must be between"), blockers(at60));
});

test("SII income caps: US$100,000 early start and US$500,000 standard", () => {
  const earlyAt = summarize({ siiIncomeStartYear: 2, siiInputMode: "income", siiTargetMonthlyIncome: 100000 });
  assert.equal(earlyAt.valid, true, blockers(earlyAt));
  const earlyOver = summarize({ siiIncomeStartYear: 2, siiInputMode: "income", siiTargetMonthlyIncome: 100001 });
  assert.equal(earlyOver.valid, false);
  assert.ok(hasBlocker(earlyOver, "US$100,000 for income start year 2"), blockers(earlyOver));

  const standardAt = summarize({ siiInputMode: "income", siiTargetMonthlyIncome: 500000 });
  assert.equal(standardAt.valid, true, blockers(standardAt));
  const standardOver = summarize({ siiInputMode: "income", siiTargetMonthlyIncome: 500001 });
  assert.equal(standardOver.valid, false);
  assert.ok(hasBlocker(standardOver, "US$500,000 for income start year 4"), blockers(standardOver));
});

test("SII total planned premium cap sits exactly at US$166,000,000", () => {
  // SP at the cap: the premium gate passes (the income cap fires
  // instead, since US$166M implies income above US$500k/mo).
  const spAt = summarize({ siiAnnualPlannedPremium: 166000000 });
  assert.equal(hasBlocker(spAt, "Single premium must be between"), false, blockers(spAt));
  const spOver = summarize({ siiAnnualPlannedPremium: 166000001 });
  assert.ok(hasBlocker(spOver, "Single premium must be between US$100,000 and US$166,000,000"), blockers(spOver));

  // 10-pay at the cap is fully electable: US$16.6M x 10 = US$166M.
  const tenAt = summarize({ siiPremiumTerm: 10, siiAnnualPlannedPremium: 16600000 });
  assert.equal(tenAt.valid, true, blockers(tenAt));
  assert.equal(Math.round(tenAt.totalPlannedPremium), 166000000);
  const tenOver = summarize({ siiPremiumTerm: 10, siiAnnualPlannedPremium: 16600001 });
  assert.equal(tenOver.valid, false);
  assert.ok(hasBlocker(tenOver, "Annualised premium must be between US$10,000 and US$16,600,000"), blockers(tenOver));
});

test("SII rejects out-of-window term/start combinations", () => {
  const cases = [
    ["single", 1, "Single Premium can only start monthly income from policy year 2 to 21."],
    [2, 22, "2 Years can only start monthly income from policy year 2 to 21."],
    [4, 2, "4 Years can only start monthly income from policy year 3 to 21."],
    [7, 3, "7 Years can only start monthly income from policy year 4 to 21."],
    [10, 3, "10 Years can only start monthly income from policy year 4 to 21."],
  ];
  for (const [term, start, message] of cases) {
    const s = summarize({ siiPremiumTerm: term, siiIncomeStartYear: start });
    assert.equal(s.valid, false, `${term}/PY${start} should be blocked`);
    assert.ok(hasBlocker(s, message), `${term}/PY${start}: ${blockers(s)}`);
  }
});
