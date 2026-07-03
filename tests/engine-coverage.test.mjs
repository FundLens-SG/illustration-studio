// Engine invariants the whole-app audit verified by simulation but that no
// committed test pinned: par-WL Bonus-Realisation income reconciliation (the
// path behind the comparison hero's Total Wealth, and the C1 IRR fix), the ILP
// totalValue/ordering identities across variants and ages, and the SI/SLR
// siTotalReceived payout accounting. Runs real simulate() calls via the harness.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel, loadFx, parWlSettings, siSettings } from "./harness.mjs";

const m = loadModel();
const fx = loadFx();

// ---- par-WL Bonus-Realisation income mode ----
test("par-WL BR income reconciles and feeds comparisonTotal via brTotalWealth", () => {
  const r = m.simulate(parWlSettings({ enableBRIncome: true }), [], "coverage");
  const a = r.annual;
  const f = a[a.length - 1];

  // Per-year realised income sums exactly to the cumulative (the C1 fix): the
  // IRR cash flow must see the true cash received, not an inflated figure.
  const sumIncome = a.reduce((s, x) => s + (x.brIncomeThisYear || 0), 0);
  assert.ok(Math.abs(sumIncome - f.brCumulativeIncome) < 1,
    `sum(brIncomeThisYear) ${sumIncome} != final brCumulativeIncome ${f.brCumulativeIncome}`);

  // brCumulativeIncome is monotonic non-decreasing; per-year income non-negative.
  let prev = -Infinity;
  for (const row of a) {
    assert.ok((row.brCumulativeIncome || 0) >= prev - 1e-6, `brCumulativeIncome dropped at PY${row.year}`);
    prev = row.brCumulativeIncome || 0;
    assert.ok((row.brIncomeThisYear || 0) >= -1e-6, `negative brIncomeThisYear at PY${row.year}`);
    assert.ok(Number.isFinite(row.brTotalWealth), `non-finite brTotalWealth at PY${row.year}`);
  }

  // Total wealth = policy value + cumulative realised income.
  assert.ok(Math.abs(f.brTotalWealth - (f.totalValue + f.brCumulativeIncome)) < 1,
    "brTotalWealth != totalValue + brCumulativeIncome");

  // comparisonTotal picks brTotalWealth when BR is on (income-inclusive).
  assert.equal(fx.comparisonTotal(f), f.brTotalWealth);

  // IRR is sane (the C1 fix: no longer overstated by ~1pp).
  const irr = r.final.irr;
  assert.ok(irr !== null && irr > 0 && irr < 0.12, `BR IRR out of range: ${irr}`);
});

test("par-WL without BR: comparisonTotal falls back to totalValue", () => {
  const r = m.simulate(parWlSettings({}), [], "coverage");
  const f = r.annual[r.annual.length - 1];
  assert.equal(f.brTotalWealth ?? undefined, undefined);
  assert.equal(fx.comparisonTotal(f), f.totalValue);
});

// ---- ILP identities across variants and ages ----
const ILP_KEYS = ["5F1", "6F2", "7F5", "10F3", "10F5", "10F8", "13F10", "IRG15F10", "IRG20F10"];
function ilpSettingsFor(key, startAge) {
  const V = m.VARIANTS[key];
  const cur = (V.currencies && V.currencies[0]) || "SGD";
  const premium = Math.max((V.minPremiums && V.minPremiums[cur] && V.minPremiums[cur].Annual) || 12000, 12000);
  return {
    variantKey: key, currency: cur, startAge, annualizedPremium: premium,
    paymentFrequency: "Annual", projectionYears: 30,
    includeWelcome: true, includeAnnualBonus: true, includeLoyalty: true,
  };
}

test("ILP identities hold across all variants and entry ages", () => {
  const bad = [];
  for (const key of ILP_KEYS) {
    for (const startAge of [1, 30, 45, 60]) {
      const settings = ilpSettingsFor(key, startAge);
      const strat = m.defaultStrategy ? m.defaultStrategy(settings) : [];
      const r = m.simulate(settings, strat, "coverage");
      for (const row of r.annual) {
        const tv = row.totalValue, av = row.accountValue, sv = row.surrenderValue, db = row.deathBenefit;
        // totalValue = account + cash dividends + cash withdrawals
        const identity = (av || 0) + (row.cashDividends || 0) + (row.cashWithdrawals || 0);
        if (Math.abs(tv - identity) > 0.5) bad.push(`${key}@${startAge} PY${row.year}: totalValue ${tv} != ${identity}`);
        // surrender <= account <= death benefit
        if (sv - av > 0.5) bad.push(`${key}@${startAge} PY${row.year}: SV ${sv} > account ${av}`);
        if (av - db > 0.5 && !row.lapsed) bad.push(`${key}@${startAge} PY${row.year}: account ${av} > DB ${db}`);
        // finite + non-negative money
        for (const [k, v] of [["totalValue", tv], ["accountValue", av], ["surrenderValue", sv], ["deathBenefit", db]]) {
          if (!Number.isFinite(v) || v < -0.5) bad.push(`${key}@${startAge} PY${row.year}: ${k}=${v}`);
        }
      }
      // IRR is finite or null (never NaN)
      const irr = r.final.irr;
      if (irr !== null && !Number.isFinite(irr)) bad.push(`${key}@${startAge}: IRR ${irr}`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} ILP identity violations`);
});

// ---- SI / SLR payout accounting ----
test("SI/SLR siTotalReceived = cash value net of financing + cumulative payouts, monotonic", () => {
  const bad = [];
  for (const variantKey of ["SI3_SP", "SLR_SP"]) {
    for (const financed of [true, false]) {
      const r = m.simulate(siSettings({
        variantKey, siPremium: 200000, siEntryAge: 40,
        siFinancingEnabled: financed, siFinancingPct: financed ? 0.72 : 0, siInterestRate: financed ? 0.02 : 0,
      }), [], "coverage");
      let prevReceived = -Infinity;
      for (const row of r.annual) {
        const expected = (row.siCashValueMinusFinancing || 0) + (row.siCumulativeNetPayout || 0);
        if (Math.abs((row.siTotalReceived || 0) - expected) > 0.5) {
          bad.push(`${variantKey}${financed ? "(fin)" : ""} PY${row.year}: siTotalReceived ${row.siTotalReceived} != ${expected}`);
        }
        if ((row.siTotalReceived || 0) < prevReceived - 0.5) bad.push(`${variantKey} PY${row.year}: siTotalReceived dropped`);
        prevReceived = row.siTotalReceived || 0;
        if ((row.siCumulativeNetPayout || 0) < -0.5) bad.push(`${variantKey} PY${row.year}: negative cumulative payout`);
      }
      // comparisonTotal picks siTotalReceived for SI/SLR
      const f = r.annual[r.annual.length - 1];
      assert.equal(fx.comparisonTotal(f), f.siTotalReceived, `${variantKey} comparisonTotal != siTotalReceived`);
    }
  }
  assert.deepEqual(bad.slice(0, 10), [], `${bad.length} SI/SLR payout violations`);
});
