// Builds assets/sii-rates-runtime.js — the slim SII rates asset the
// browser actually loads — from the full assets/sii-rates.js archive.
// Keeps only the fields assets/illustration-model.js reads at runtime
// (verified against every SII_DATA / SII_CONSTANTS / scenario-row and
// annual-row property access), emits minified JSON, writes atomically,
// then proves parity by running simulate() against both assets in a vm.
//
// The pure builders (loadRates, slimScenario, buildRuntimePayload,
// loadModelWith) are exported so the test suite can regenerate the slim
// payload in-memory and gate the committed runtime asset for freshness
// without triggering a file write. The file-writing/parity work only
// runs when this module is invoked directly.
//
// Usage: node scripts/build-sii-runtime-asset.mjs [source.js] [out.js]
import { readFileSync, writeFileSync, renameSync, statSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const ASSET_PREFIX = "window.SII_RATES = ";
export const MAX_RUNTIME_BYTES = 1024 * 1024;

// Model reads (assets/illustration-model.js): siiSourceRows filter keys,
// siiBlendSources labels (life_insured_age, source_pdf, premium_payment_term_number,
// income_start_year), siiSolveInputs (initial_monthly_income_annualized,
// initial_total_planned_premium), siiBlendAmountByTotal("face_amount"),
// siiBlendScalar yield/TDC keys, siiRowCache("current_rows"/"deduction_rows").
export const SCENARIO_FIELDS = [
  "source_pdf",
  "life_insured_age",
  "premium_payment_term_number",
  "income_start_year",
  "initial_total_planned_premium",
  "initial_monthly_income_annualized",
  "face_amount",
  "total_distribution_cost_pct",
  "current_illustrated_yield_pct_pa",
  "guaranteed_illustrated_yield_pct_pa",
];
// simulateSII reads currentRow.policy_value / policy_value_less_surrender_charge_and_unvested_booster /
// surrender_value_floor / surrender_value / death_benefit; siiBlendIncomeRaw reads
// monthly_income_annualized; siiRowAt keys everything by policy_year.
export const CURRENT_ROW_FIELDS = [
  "policy_year",
  "policy_value",
  "policy_value_less_surrender_charge_and_unvested_booster",
  "surrender_value_floor",
  "surrender_value",
  "monthly_income_annualized",
  "death_benefit",
];
// simulateSII reads deductionRow.current_effect_of_deductions only.
export const DEDUCTION_ROW_FIELDS = [
  "policy_year",
  "current_effect_of_deductions",
];

export function loadRates(assetPath) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(assetPath, "utf8"), sandbox, { filename: assetPath });
  const rates = sandbox.window.SII_RATES;
  if (!rates || !Array.isArray(rates.scenarios) || !rates.scenarios.length) {
    throw new Error(`${assetPath} did not define window.SII_RATES with scenarios`);
  }
  return rates;
}

function pickFields(row, fields) {
  const out = {};
  fields.forEach((field) => {
    if (row[field] !== undefined) out[field] = row[field];
  });
  return out;
}

export function slimScenario(scenario) {
  const out = pickFields(scenario, SCENARIO_FIELDS);
  out.current_rows = (scenario.current_rows || []).map((row) => pickFields(row, CURRENT_ROW_FIELDS));
  out.deduction_rows = (scenario.deduction_rows || []).map((row) => pickFields(row, DEDUCTION_ROW_FIELDS));
  return out;
}

export function buildRuntimePayload(rates) {
  return {
    scenariosSha256: rates.scenariosSha256,
    source: rates.source,
    productConstants: rates.productConstants,
    scenarios: rates.scenarios.map(slimScenario),
  };
}

export function loadModelWith(assetPath) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  sandbox.console = console;
  sandbox.Math = Math;
  sandbox.Date = Date;
  sandbox.JSON = JSON;
  sandbox.Array = Array;
  sandbox.Object = Object;
  sandbox.Number = Number;
  sandbox.isFinite = isFinite;
  sandbox.isNaN = isNaN;
  sandbox.parseFloat = parseFloat;
  sandbox.parseInt = parseInt;
  vm.createContext(sandbox);
  for (const path of [resolve(repoRoot, "assets", "rrp3-rates.js"), assetPath, resolve(repoRoot, "assets", "illustration-model.js")]) {
    vm.runInContext(readFileSync(path, "utf8"), sandbox, { filename: path });
  }
  const model = sandbox.IRModel || sandbox.module.exports;
  if (!model || typeof model.simulate !== "function") {
    throw new Error(`model failed to load with ${assetPath}`);
  }
  return model;
}

function paritySettings(overrides) {
  return {
    variantKey: "SII",
    currency: "USD",
    paymentFrequency: "Annual",
    startAge: 46,
    siiAge: 46,
    siiPremiumTerm: "single",
    siiIncomeStartYear: 4,
    siiInputMode: "premium",
    siiAnnualPlannedPremium: 100000,
    siiTotalPlannedPremium: 100000,
    siiTargetMonthlyIncome: 0,
    ...overrides,
  };
}

export const PARITY_CASES = [
  paritySettings({}),
  paritySettings({ siiAge: 56, siiPremiumTerm: 10, siiIncomeStartYear: 11, siiAnnualPlannedPremium: 50000, siiTotalPlannedPremium: 500000 }),
  paritySettings({ siiAge: 30, siiPremiumTerm: 5, siiIncomeStartYear: 7, siiAnnualPlannedPremium: 40000, siiTotalPlannedPremium: 200000 }),
  paritySettings({ siiAge: 50, siiPremiumTerm: 2, siiIncomeStartYear: 3, siiInputMode: "income", siiTargetMonthlyIncome: 2000, siiAnnualPlannedPremium: 0, siiTotalPlannedPremium: 0 }),
];

export const PARITY_KEYS = [
  "valid", "method", "targetMonthlyIncome", "totalPlannedPremium", "incomeAnnualRate",
  "totalProjectedIncome", "finalSurrenderValue", "finalDeathBenefit", "finalNetIrr",
  "referenceSurrenderValue", "cumulativeChargesEstimate", "projectionYears",
];

export function assertParity(fullModel, runtimeModel) {
  PARITY_CASES.forEach((settings, index) => {
    const a = fullModel.simulate(settings, "none", "custom").siiSummary;
    const b = runtimeModel.simulate(settings, "none", "custom").siiSummary;
    PARITY_KEYS.forEach((key) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === "number" && typeof bv === "number") {
        const scale = Math.max(1, Math.abs(av));
        if (Math.abs(av - bv) / scale > 1e-9) {
          throw new Error(`parity case ${index + 1}: ${key} full=${av} runtime=${bv}`);
        }
      } else if (String(av) !== String(bv)) {
        throw new Error(`parity case ${index + 1}: ${key} full=${av} runtime=${bv}`);
      }
    });
    if (a.notes.join("|") !== b.notes.join("|") || a.blockers.join("|") !== b.blockers.join("|")) {
      throw new Error(`parity case ${index + 1}: notes/blockers differ`);
    }
  });
}

function main() {
  const sourcePath = resolve(process.argv[2] || resolve(repoRoot, "assets", "sii-rates.js"));
  const outPath = resolve(process.argv[3] || resolve(repoRoot, "assets", "sii-rates-runtime.js"));

  const rates = loadRates(sourcePath);
  const body = `${ASSET_PREFIX}${JSON.stringify(buildRuntimePayload(rates))};\n`;
  const tmpPath = `${outPath}.tmp`;
  writeFileSync(tmpPath, body, "utf8");
  renameSync(tmpPath, outPath);

  const runtimeBytes = statSync(outPath).size;
  const fullBytes = statSync(sourcePath).size;
  if (runtimeBytes > MAX_RUNTIME_BYTES) {
    throw new Error(`runtime asset is ${runtimeBytes} bytes — exceeds the ${MAX_RUNTIME_BYTES}-byte budget`);
  }

  assertParity(loadModelWith(sourcePath), loadModelWith(outPath));

  console.log(`sii-rates-runtime.js: ${runtimeBytes.toLocaleString()} bytes (full asset ${fullBytes.toLocaleString()} bytes, ${(100 - (runtimeBytes / fullBytes) * 100).toFixed(1)}% smaller); parity verified on ${PARITY_CASES.length} scenarios.`);
}

const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
