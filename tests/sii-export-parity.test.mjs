// Export parity guard — the committed SII Claude grid must be exactly
// what model.simulate produces today. Recomputes a fixed-seed random
// sample of grid rows (plus the first row of every estimation method)
// through the model with the export's settings mapping and rounding,
// and asserts cell-for-cell equality. Skips when the export CSV is not
// present (e.g. a fresh clone without the exports tree).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadModel } from "./harness.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = resolve(repoRoot, "exports", "claude", "sii", "sii_claude_all_extrapolations_annualised_100k.csv");

// Replicas of the export script's output rounding (scripts/export-sii-claude.mjs).
function n(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return Number(parsed.toFixed(decimals));
}

function pct(value, decimals = 6) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return Number((parsed * 100).toFixed(decimals));
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("committed SII export grid rows reproduce through model.simulate", { skip: !existsSync(csvPath) && "SII export CSV not present" }, () => {
  const m = loadModel();
  const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((name, index) => [name, index]));
  const rows = lines.slice(1);
  assert.ok(rows.length >= 1000, `unexpectedly small grid: ${rows.length} rows`);

  const picked = new Set();
  const seenMethods = new Set();
  rows.forEach((line, index) => {
    const method = parseCsvLine(line)[col.estimation_method];
    if (!seenMethods.has(method)) {
      seenMethods.add(method);
      picked.add(index);
    }
  });
  const random = mulberry32(20260703);
  while (picked.size < seenMethods.size + 12) picked.add(Math.floor(random() * rows.length));
  assert.ok(picked.size >= 10, `expected at least 10 sampled rows, got ${picked.size}`);

  const failures = [];
  for (const index of Array.from(picked).sort((a, b) => a - b)) {
    const cells = parseCsvLine(rows[index]);
    const key = cells[col.scenario_key];
    const age = Number(cells[col.age]);
    const termNum = Number(cells[col.premium_term_number]);
    const startYear = Number(cells[col.income_start_year]);
    const basis = Number(cells[col.annualised_premium_basis]) || 100000;

    const result = m.simulate({
      variantKey: "SII",
      currency: "USD",
      paymentFrequency: "Annual",
      siiAge: age,
      siiPremiumTerm: termNum === 1 ? "single" : termNum,
      siiIncomeStartYear: startYear,
      siiInputMode: "premium",
      siiAnnualPlannedPremium: basis,
      siiSkipMonthly: true,
      siiSkipAnnualIrr: true,
    }, [], "parity");
    const s = result.siiSummary || {};
    const annual = result.annual || [];
    const byYear = new Map(annual.map((row) => [row.year, row]));
    const start = byYear.get(startYear) || {};
    const y10 = byYear.get(10) || {};
    const y20 = byYear.get(20) || {};
    const y40 = byYear.get(40) || {};
    const final = annual[annual.length - 1] || {};

    const expected = {
      valid: s.valid,
      estimation_method: s.method,
      projection_years: s.projectionYears,
      projection_truncated: s.projectionTruncated ?? "",
      total_planned_premium: n(s.totalPlannedPremium, 2),
      target_monthly_income: n(s.targetMonthlyIncome, 6),
      annualised_income: n(s.annualizedIncome, 6),
      annual_income_rate_per_total_premium_pct: pct(s.incomeAnnualRate, 6),
      final_net_irr_pct: pct(s.finalNetIrr, 6),
      face_amount_estimate: n(s.faceAmount, 2),
      income_start_annual_income: n(start.siiAnnualIncome, 2),
      income_start_cumulative_income: n(start.siiCumulativeIncome, 2),
      income_start_surrender_value: n(start.siiSurrenderValue, 2),
      y10_annual_income: n(y10.siiAnnualIncome, 2),
      y10_surrender_value: n(y10.siiSurrenderValue, 2),
      y20_annual_income: n(y20.siiAnnualIncome, 2),
      y20_surrender_value: n(y20.siiSurrenderValue, 2),
      y40_annual_income: n(y40.siiAnnualIncome, 2),
      y40_cumulative_income: n(y40.siiCumulativeIncome, 2),
      y40_surrender_value: n(y40.siiSurrenderValue, 2),
      total_projected_income: n(s.totalProjectedIncome, 2),
      final_surrender_value: n(s.finalSurrenderValue, 2),
      final_death_benefit: n(s.finalDeathBenefit, 2),
      total_benefits_at_projection: n(s.totalBenefitsAtProjection, 2),
      final_policy_year: final.year,
      final_age: final.age,
    };
    for (const [field, value] of Object.entries(expected)) {
      const cell = cells[col[field]];
      if (String(value ?? "") !== String(cell)) {
        failures.push(`${key}.${field}: model ${value} != csv ${cell}`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} export parity mismatches across ${picked.size} sampled rows; first few above`);
});
