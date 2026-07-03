// SII estimator invariants — properties the two-stage age-decoupled
// blend must uphold across the whole estimated space, not just at the
// parsed anchors: no income before the selected start year, cumulative
// income never decreases, money columns stay finite and non-negative,
// deferring income never pays less, and the income rate is effectively
// age-invariant (the C1/H1 audit defects would fail these sweeps).
//
// Two sweeps: full simulate() over a coarse age grid (row-level
// invariants), and a rate-only pass over every grid cell at every age
// via siiBlendSources (monotonicity, age deltas, weight sanity, method
// census).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModel } from "./harness.mjs";

const m = loadModel();

const SWEEP_AGES = [0, 10, 20, 30, 40, 50, 60, 70];
const ALL_AGES = Array.from({ length: 71 }, (_, age) => age);
const TERMS = ["single", 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MONEY_KEYS = [
  "premiums", "siiAnnualIncome", "siiMonthlyIncome", "siiCumulativeIncome",
  "siiPolicyValue", "siiPolicyValueLessCharges", "siiSurrenderValueFloor",
  "siiSurrenderValue", "siiDeathBenefit", "siiPremiumCharge", "siiPolicyFee",
  "siiAdminFeeEstimate", "siiPolicyValueBooster", "totalValue", "totalBasicPaid",
];

function cellLabel(age, term, startYear) {
  const termNum = m.siiTermNumber(term);
  return `age${age}/${termNum === 1 ? "SP" : `${termNum}-pay`}/PY${startYear}`;
}

function simulateCell(age, term, startYear, overrides = {}) {
  return m.simulate({
    variantKey: "SII",
    currency: "USD",
    paymentFrequency: "Annual",
    siiAge: age,
    siiPremiumTerm: term,
    siiIncomeStartYear: startYear,
    siiInputMode: "premium",
    siiAnnualPlannedPremium: 100000,
    siiSkipMonthly: true,
    siiSkipIrr: true,
    ...overrides,
  }, [], "sweep");
}

// Income rate per unit of total premium — the same weighted average
// siiSolveInputs computes from a blend's source weights.
function blendRate(term, startYear, age) {
  const blend = m.siiBlendSources(term, startYear, age);
  if (!blend) return 0;
  return blend.sources.reduce((sum, item) => {
    const total = Number(item.row.initial_total_planned_premium);
    const income = Number(item.row.initial_monthly_income_annualized);
    return sum + (total > 0 ? (income / total) * item.weight : 0);
  }, 0);
}

// --- Coarse full-projection sweep: one pass, violations bucketed. ---
const violations = {
  invalid: [],
  preStartIncome: [],
  cumulativeDrop: [],
  badMoney: [],
  startMonotone: [],
};
for (const age of SWEEP_AGES) {
  for (const term of TERMS) {
    let prevIncome = -Infinity;
    for (const startYear of m.siiAvailableIncomeStartYears(term)) {
      const cell = cellLabel(age, term, startYear);
      const result = simulateCell(age, term, startYear);
      const s = result.siiSummary || {};
      if (!s.valid) {
        violations.invalid.push(`${cell}: ${(s.blockers || [])[0] || "?"}`);
        continue;
      }
      if (s.targetMonthlyIncome < prevIncome - 1e-9) {
        violations.startMonotone.push(`${cell}: ${prevIncome} -> ${s.targetMonthlyIncome}`);
      }
      prevIncome = s.targetMonthlyIncome;
      let prevCumulative = -Infinity;
      for (const row of result.annual || []) {
        if (row.year < startYear && Math.abs(Number(row.siiAnnualIncome || 0)) > 1e-9) {
          violations.preStartIncome.push(`${cell}: income ${row.siiAnnualIncome} at PY${row.year}`);
          break;
        }
        if (Number(row.siiCumulativeIncome) < prevCumulative - 1e-9) {
          violations.cumulativeDrop.push(`${cell}: cumulative income ${prevCumulative} -> ${row.siiCumulativeIncome} at PY${row.year}`);
          break;
        }
        prevCumulative = Number(row.siiCumulativeIncome);
        let moneyBad = false;
        for (const key of MONEY_KEYS) {
          const value = Number(row[key]);
          if (!Number.isFinite(value) || value < -1e-9) {
            violations.badMoney.push(`${cell}: ${key} = ${row[key]} at PY${row.year}`);
            moneyBad = true;
            break;
          }
        }
        if (moneyBad) break;
      }
    }
  }
}

test("SII sweep: every in-window cell is valid at the US$100k basis", () => {
  assert.deepEqual(violations.invalid.slice(0, 8), [], `${violations.invalid.length} blocked cells`);
});

test("SII sweep: income is zero before the selected start year", () => {
  assert.deepEqual(violations.preStartIncome.slice(0, 8), [], `${violations.preStartIncome.length} pre-start income leaks`);
});

test("SII sweep: cumulative income never decreases", () => {
  assert.deepEqual(violations.cumulativeDrop.slice(0, 8), [], `${violations.cumulativeDrop.length} cumulative income drops`);
});

test("SII sweep: money columns are finite and non-negative", () => {
  assert.deepEqual(violations.badMoney.slice(0, 8), [], `${violations.badMoney.length} bad money values`);
});

test("SII sweep: deferring the income start never pays less", () => {
  assert.deepEqual(violations.startMonotone.slice(0, 8), [], `${violations.startMonotone.length} start-year inversions`);
});

// --- Full rate grid: every age x term x start (the shipped grid). ---
const rateGrid = { cells: 0, methodCounts: {}, startInversions: [], ageJumps: [], badWeights: [], badRates: [] };
for (const term of TERMS) {
  const starts = m.siiAvailableIncomeStartYears(term);
  for (const age of ALL_AGES) {
    let prevRate = -Infinity;
    for (const startYear of starts) {
      const cell = cellLabel(age, term, startYear);
      const blend = m.siiBlendSources(term, startYear, age);
      rateGrid.cells += 1;
      rateGrid.methodCounts[blend.method] = (rateGrid.methodCounts[blend.method] || 0) + 1;
      const weightSum = blend.sources.reduce((sum, item) => sum + item.weight, 0);
      const minWeight = Math.min(...blend.sources.map((item) => item.weight));
      if (Math.abs(weightSum - 1) > 1e-9) rateGrid.badWeights.push(`${cell}: weights sum ${weightSum}`);
      if (minWeight < -0.5 - 1e-9) rateGrid.badWeights.push(`${cell}: weight ${minWeight} below clamp bound`);
      const rate = blendRate(term, startYear, age);
      if (!Number.isFinite(rate) || rate <= 0) rateGrid.badRates.push(`${cell}: rate ${rate}`);
      if (rate < prevRate - 1e-12) rateGrid.startInversions.push(`${cell}: rate ${prevRate} -> ${rate}`);
      prevRate = rate;
    }
  }
  for (const startYear of starts) {
    let prevRate = null;
    for (const age of ALL_AGES) {
      const rate = blendRate(term, startYear, age);
      if (prevRate !== null && prevRate > 0 && Math.abs(rate - prevRate) / prevRate > 0.01) {
        rateGrid.ageJumps.push(`${cellLabel(age, term, startYear)}: adjacent-age delta ${((rate - prevRate) / prevRate * 100).toFixed(3)}%`);
      }
      prevRate = rate;
    }
  }
}

test("SII rate grid: income rate is monotone non-decreasing in start year at every age", () => {
  assert.deepEqual(rateGrid.startInversions.slice(0, 8), [], `${rateGrid.startInversions.length} start-year rate inversions`);
});

test("SII rate grid: adjacent-age income delta stays within 1%", () => {
  assert.deepEqual(rateGrid.ageJumps.slice(0, 8), [], `${rateGrid.ageJumps.length} adjacent-age jumps > 1%`);
});

test("SII rate grid: blend weights sum to 1 and respect the tail clamp", () => {
  assert.deepEqual(rateGrid.badWeights.slice(0, 8), [], `${rateGrid.badWeights.length} weight violations`);
  assert.deepEqual(rateGrid.badRates.slice(0, 8), [], `${rateGrid.badRates.length} non-positive rates`);
});

test("SII rate grid: estimation-method census matches the shipped grid", () => {
  assert.equal(rateGrid.cells, 13419);
  assert.deepEqual(rateGrid.methodCounts, {
    source_exact: 36,
    interpolated_age: 36,
    age_shifted_source: 2200,
    interpolated_sparse: 5751,
    extrapolated_sparse: 5396,
  });
});

// --- Per-method labels, modes and disclosure notes. ---
const METHOD_CASES = [
  { label: "source exact at anchor", age: 46, term: "single", start: 4, method: "source_exact", ageMode: "anchor" },
  { label: "age interpolated between anchors", age: 51, term: "single", start: 4, method: "interpolated_age", ageMode: "interpolated", note: "interpolated between source-age anchors" },
  { label: "borrowed node below anchor band", age: 30, term: 4, start: 9, method: "age_shifted_source", ageMode: "clamped_low", note: "outside the source-age anchors" },
  { label: "nearest anchor above band", age: 70, term: "single", start: 4, method: "age_shifted_source", ageMode: "clamped_high", note: "outside the source-age anchors" },
  { label: "sparse interior interpolation", age: 46, term: 10, start: 7, method: "interpolated_sparse", ageMode: "anchor", note: "interpolated or extrapolated from uploaded source PIs" },
  { label: "sparse clamped start tail", age: 46, term: 2, start: 21, method: "extrapolated_sparse", ageMode: "anchor", note: "held at the clamped extrapolation bound" },
];

for (const c of METHOD_CASES) {
  test(`SII method label — ${c.label}`, () => {
    const s = simulateCell(c.age, c.term, c.start).siiSummary || {};
    assert.equal(s.valid, true, (s.blockers || []).join("; "));
    assert.equal(s.method, c.method);
    assert.equal(s.blend?.ageMode, c.ageMode);
    if (c.note) {
      assert.ok((s.notes || []).some((note) => note.includes(c.note)), `missing note "${c.note}": ${(s.notes || []).join(" | ")}`);
    }
  });
}

test("SII truncation flags: young entry truncates, anchor and cap ages do not", () => {
  const young = simulateCell(0, "single", 4).siiSummary || {};
  assert.equal(young.projectionTruncated, true);
  assert.equal(young.projectionEndAge, 79);
  assert.ok((young.notes || []).some((note) => note.includes("before maturity age")), (young.notes || []).join(" | "));

  const anchor = simulateCell(56, "single", 4).siiSummary || {};
  assert.equal(anchor.projectionTruncated, false);
  assert.equal(anchor.projectionEndAge, 125);

  const capped = simulateCell(70, "single", 4).siiSummary || {};
  assert.equal(capped.projectionTruncated, false);
  assert.equal(capped.projectionEndAge, 125);
  assert.ok((capped.notes || []).some((note) => note.includes("capped at policy year")), (capped.notes || []).join(" | "));
  assert.ok(!(capped.notes || []).some((note) => note.includes("before maturity age")), (capped.notes || []).join(" | "));
});

test("SII C1 pin: 10-pay/PY5 income rate is identical at ages 0, 46 and 70", () => {
  const at46 = blendRate(10, 5, 46);
  assert.equal(blendRate(10, 5, 0), at46);
  assert.equal(blendRate(10, 5, 70), at46);
  const s = simulateCell(46, 10, 5).siiSummary || {};
  assert.ok(Math.abs(s.targetMonthlyIncome - 868.75) <= 0.005, `10-pay/PY5 monthly income ${s.targetMonthlyIncome} != 868.75 per US$1M total premium`);
});

test("SII H1 pin: 46/10-pay income increases through PY19/20/21 and PY20 equals the source node", () => {
  const monthly = (start) => (simulateCell(46, 10, start).siiSummary || {}).targetMonthlyIncome;
  const py19 = monthly(19);
  const py20 = monthly(20);
  const py21 = monthly(21);
  assert.ok(py19 < py20 && py20 < py21, `not increasing: ${py19} / ${py20} / ${py21}`);
  const node = (m.SII_SCENARIOS || []).find((row) =>
    Math.round(Number(row.premium_payment_term_number)) === 10 && Math.round(Number(row.income_start_year)) === 20);
  assert.ok(node, "expected a parsed 10-pay/PY20 source scenario");
  const expected = Number(node.initial_monthly_income_annualized) / Number(node.initial_total_planned_premium) * 1000000 / 12;
  assert.ok(Math.abs(py20 - expected) <= 0.005, `PY20 monthly income ${py20} != source node ${expected}`);
});

// --- Drift guards (DESIGN_FINAL §8.6). The two-stage estimator is only
// correct because the parsed anchors (ages 46 and 56) agree on income rate
// and per-100k value curves for every shared (term, start) combo, and each
// cohort's per-term start curve is strictly increasing. A future PI ingest
// that breaks either would ship silently wrong borrowed-term levels; these
// guards fail the build loudly instead. ---
const scenariosByAge = new Map();
for (const s of m.SII_SCENARIOS || []) {
  const age = Math.round(Number(s.life_insured_age));
  if (!Number.isFinite(age)) continue;
  if (!scenariosByAge.has(age)) scenariosByAge.set(age, new Map());
  const key = `${Math.round(Number(s.premium_payment_term_number))}|${Math.round(Number(s.income_start_year))}`;
  scenariosByAge.get(age).set(key, s);
}
const anchorAges = [...scenariosByAge.keys()].sort((a, b) => a - b);

function scenarioRate(s) {
  const total = Number(s.initial_total_planned_premium);
  const income = Number(s.initial_monthly_income_annualized);
  return total > 0 ? income / total : 0;
}

function per100k(rows, year, field, total) {
  const row = (rows || []).find((r) => Math.round(Number(r.policy_year)) === year);
  if (!row || total <= 0) return null;
  const value = Number(row[field]);
  return Number.isFinite(value) ? value / total * 100000 : null;
}

const sharedCombos = [];
if (anchorAges.length >= 2) {
  const mapLow = scenariosByAge.get(anchorAges[0]);
  const mapHigh = scenariosByAge.get(anchorAges[anchorAges.length - 1]);
  for (const [key, low] of mapLow) {
    if (mapHigh.has(key)) sharedCombos.push({ key, low, high: mapHigh.get(key) });
  }
}

test("SII drift guard: anchor cohorts share (term, start) combos to compare", () => {
  assert.ok(anchorAges.length >= 2, `expected >= 2 anchor ages, got ${anchorAges.join(",")}`);
  assert.ok(sharedCombos.length > 0, "no shared (term,start) combos across anchor ages — age-invariance is unverifiable");
});

test("SII drift guard: shared-combo income rates agree within 2%", () => {
  const bad = [];
  for (const { key, low, high } of sharedCombos) {
    const rl = scenarioRate(low);
    const rh = scenarioRate(high);
    if (rh > 0 && Math.abs(rl / rh - 1) > 0.02) bad.push(`${key}: ${rl} vs ${rh}`);
  }
  assert.deepEqual(bad, [], `${bad.length} shared combos with divergent income rates`);
});

test("SII drift guard: shared-combo per-100k value curves agree within 0.5%", () => {
  const FIELDS = ["policy_value", "surrender_value", "death_benefit"];
  const bad = [];
  const off = (a, b) => Math.abs(a - b) > 0.005 * Math.max(Math.abs(a), Math.abs(b)) && Math.abs(a - b) > 1;
  for (const { key, low, high } of sharedCombos) {
    const totalLow = Number(low.initial_total_planned_premium);
    const totalHigh = Number(high.initial_total_planned_premium);
    const yearsLow = new Set((low.current_rows || []).map((r) => Math.round(Number(r.policy_year))));
    for (const r of high.current_rows || []) {
      const year = Math.round(Number(r.policy_year));
      if (!yearsLow.has(year)) continue;
      for (const field of FIELDS) {
        const vl = per100k(low.current_rows, year, field, totalLow);
        const vh = per100k(high.current_rows, year, field, totalHigh);
        if (vl !== null && vh !== null && off(vl, vh)) bad.push(`${key} PY${year} ${field}: ${vl.toFixed(2)} vs ${vh.toFixed(2)}`);
      }
      const dl = per100k(low.deduction_rows, year, "current_effect_of_deductions", totalLow);
      const dh = per100k(high.deduction_rows, year, "current_effect_of_deductions", totalHigh);
      if (dl !== null && dh !== null && off(dl, dh)) bad.push(`${key} PY${year} deductions: ${dl.toFixed(2)} vs ${dh.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} shared-combo value-curve divergences`);
});

test("SII drift guard: source income rates strictly increase in start year per cohort/term", () => {
  const bad = [];
  for (const [age, byKey] of scenariosByAge) {
    const byTerm = new Map();
    for (const s of byKey.values()) {
      const term = Math.round(Number(s.premium_payment_term_number));
      if (!byTerm.has(term)) byTerm.set(term, []);
      byTerm.get(term).push(s);
    }
    for (const [term, list] of byTerm) {
      list.sort((x, y) => Number(x.income_start_year) - Number(y.income_start_year));
      for (let i = 1; i < list.length; i += 1) {
        if (scenarioRate(list[i]) <= scenarioRate(list[i - 1])) {
          bad.push(`age${age}/term${term}: PY${list[i - 1].income_start_year} -> PY${list[i].income_start_year}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `${bad.length} non-increasing source rate steps`);
});

// --- Performance pin (§8.7): a sparse full simulate — monthly rows plus the
// per-year Newton IRR, the real interactive path — must stay well under the
// 100ms budget with the byYear row cache in place. Warm up, then take the best
// of a few runs so a GC pause doesn't flake the gate. ---
test("SII performance: a sparse full simulate stays interactive", () => {
  const settings = {
    variantKey: "SII", currency: "USD", paymentFrequency: "Annual",
    siiAge: 33, siiPremiumTerm: 7, siiIncomeStartYear: 13,
    siiInputMode: "premium", siiAnnualPlannedPremium: 100000,
  };
  m.simulate(settings, [], "warmup");
  let best = Infinity;
  for (let i = 0; i < 5; i += 1) {
    const start = process.hrtime.bigint();
    const s = m.simulate(settings, [], "perf").siiSummary || {};
    assert.equal(s.valid, true, (s.blockers || []).join("; "));
    best = Math.min(best, Number(process.hrtime.bigint() - start) / 1e6);
  }
  assert.ok(best < 100, `fastest of 5 sparse full simulates was ${best.toFixed(1)}ms (budget 100ms)`);
});
