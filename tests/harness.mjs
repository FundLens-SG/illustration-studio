// Test harness — loads the extracted model engine into a Node vm
// sandbox with a fake `window`, so the UMD model (which reads
// window.RRP3_RATES and sets window.IRModel) runs unchanged outside the
// browser. No DOM, no dependencies beyond Node built-ins.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let cached = null;

export function loadModel() {
  if (cached) return cached;
  const sandbox = {};
  sandbox.window = sandbox;        // model uses (typeof window !== undefined ? window : globalThis)
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
  for (const rel of ["assets/rrp3-rates.js", "assets/sii-rates.js", "assets/illustration-model.js"]) {
    const code = readFileSync(resolve(repoRoot, rel), "utf8");
    vm.runInContext(code, sandbox, { filename: rel });
  }
  const model = sandbox.IRModel || sandbox.module.exports;
  if (!model || typeof model.simulate !== "function") {
    throw new Error("model failed to load: IRModel.simulate missing");
  }
  cached = model;
  return model;
}

let cachedView = null;

// Load the pure view-layer helpers (assets/illustration-view.js) in a vm
// sandbox. No DOM, no rate data needed — it's pure derived-value math.
export function loadView() {
  if (cachedView) return cachedView;
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.module = { exports: {} };
  sandbox.Math = Math;
  sandbox.Number = Number;
  sandbox.Array = Array;
  sandbox.Object = Object;
  sandbox.String = String;
  sandbox.JSON = JSON;
  vm.createContext(sandbox);
  const code = readFileSync(resolve(repoRoot, "assets/illustration-view.js"), "utf8");
  vm.runInContext(code, sandbox, { filename: "assets/illustration-view.js" });
  const view = sandbox.IRView || sandbox.module.exports;
  if (!view || typeof view.computeRrpStats !== "function") {
    throw new Error("view module failed to load: IRView.computeRrpStats missing");
  }
  cachedView = view;
  return view;
}

// Minimal settings shapes per engine — mirror what the UI's
// currentSettings() produces for the fields each engine reads. Kept here
// so tests construct scenarios without the DOM.
export function rrpSettings(overrides = {}) {
  return {
    variantKey: "RRP_10",
    currency: "SGD",
    rrpAge: 40,
    rrpRetirementAge: 65,
    rrpPayoutPeriod: "10",
    rrpInputMode: "income",
    rrpTargetIncome: 1000,
    rrpPremium: 0,
    rrpGmi: 1000,
    ...overrides,
  };
}

export function ilpSettings(overrides = {}) {
  return {
    variantKey: "10F5",
    currency: "SGD",
    startAge: 36,
    annualizedPremium: 12000,
    paymentFrequency: "Annual",
    projectionYears: 30,
    includeWelcome: true,
    includeAnnualBonus: true,
    includeLoyalty: true,
    ...overrides,
  };
}

export function parWlSettings(overrides = {}) {
  return {
    variantKey: "SLH_SP",
    currency: "USD",
    startAge: 36,
    annualizedPremium: 100000,
    paymentFrequency: "Annual",
    projectionYears: 40,
    ...overrides,
  };
}

export function siSettings(overrides = {}) {
  return {
    variantKey: "SI3_SP",
    currency: "USD",
    siPremium: 200000,
    siEntryAge: 40,
    siFinancingEnabled: true,
    siFinancingPct: 0.72,
    siInterestRate: 0.02,
    ...overrides,
  };
}

export function siiSettings(overrides = {}) {
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
    projectionYears: 79,
    includeWelcome: false,
    includeAnnualBonus: false,
    includeLoyalty: false,
    deductPiFundMgmt: false,
    ...overrides,
  };
}

// Walk any nested result structure and collect non-finite numbers, so
// invariant tests can assert no NaN/Infinity ever reaches the caller
// (and therefore the DOM). Returns an array of dotted paths.
export function findNonFinite(node, path = "") {
  const bad = [];
  const visit = (value, p) => {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) bad.push(`${p} = ${value}`);
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${p}[${i}]`));
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        // Skip the back-reference to the raw source row + the variant
        // definition object — they carry product constants, not outputs.
        if (k === "row" || k === "variant" || k === "settings") continue;
        visit(v, p ? `${p}.${k}` : k);
      }
    }
  };
  visit(node, path);
  return bad;
}
