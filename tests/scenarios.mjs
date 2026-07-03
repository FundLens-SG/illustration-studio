// Shared scenario matrix for regression + invariant tests. Built from
// variant metadata so premiums/currencies are always product-valid.
import { loadModel } from "./harness.mjs";

const m = loadModel();
const V = m.VARIANTS;

function firstCurrency(key) {
  return (V[key].currencies && V[key].currencies[0]) || "SGD";
}
function ilpPremium(key) {
  const cur = firstCurrency(key);
  const min = V[key].minPremiums?.[cur]?.Annual || 12000;
  return Math.max(min, 12000);
}

// ILP variants — each with its default per-year strategy (0% NAV growth,
// 6% dividend reinvest — the deterministic baseline defaultStrategy ships).
const ILP_KEYS = ["5F1", "6F2", "7F5", "10F3", "10F5", "10F8", "13F10", "IRG15F10", "IRG20F10"];

export function buildScenarios() {
  const list = [];

  for (const key of ILP_KEYS) {
    const settings = {
      variantKey: key,
      currency: firstCurrency(key),
      startAge: 36,
      annualizedPremium: ilpPremium(key),
      paymentFrequency: "Annual",
      projectionYears: 30,
      includeWelcome: true,
      includeAnnualBonus: true,
      includeLoyalty: true,
    };
    const strategy = m.defaultStrategy ? m.defaultStrategy(settings) : [];
    list.push({ name: `ilp:${key}`, kind: "ilp", settings, strategy });
  }

  // par-WL (SLH) — single/limited-pay whole life, factor-table engine.
  list.push({ name: "parwl:SLH_SP", kind: "par-wl", settings: {
    variantKey: "SLH_SP", currency: "USD", startAge: 36, annualizedPremium: 100000,
    paymentFrequency: "Annual", projectionYears: 40 }, strategy: [] });
  list.push({ name: "parwl:SLH_3PAY", kind: "par-wl", settings: {
    variantKey: "SLH_3PAY", currency: "USD", startAge: 36, annualizedPremium: 33400,
    paymentFrequency: "Annual", projectionYears: 40 }, strategy: [] });
  list.push({ name: "parwl:SLH_5PAY", kind: "par-wl", settings: {
    variantKey: "SLH_5PAY", currency: "USD", startAge: 36, annualizedPremium: 33400,
    paymentFrequency: "Annual", projectionYears: 40 }, strategy: [] });

  // SI / SLR — par-income-fin engine, financed and unfinanced.
  list.push({ name: "si:SI3_SP-financed", kind: "par-income-fin", settings: {
    variantKey: "SI3_SP", currency: "USD", siPremium: 200000, siEntryAge: 40,
    siFinancingEnabled: true, siFinancingPct: 0.72, siInterestRate: 0.02 }, strategy: [] });
  list.push({ name: "si:SI3_SP-cash", kind: "par-income-fin", settings: {
    variantKey: "SI3_SP", currency: "USD", siPremium: 200000, siEntryAge: 40,
    siFinancingEnabled: false, siFinancingPct: 0, siInterestRate: 0 }, strategy: [] });
  list.push({ name: "si:SLR_SP-financed", kind: "par-income-fin", settings: {
    variantKey: "SLR_SP", currency: "USD", siPremium: 200000, siEntryAge: 40,
    siFinancingEnabled: true, siFinancingPct: 0.72, siInterestRate: 0.02 }, strategy: [] });

  // RRP — retirement income, premium- and income-driven, finite + lifetime.
  const rrp = (name, o) => list.push({ name: `rrp:${name}`, kind: "rrp", settings: {
    variantKey: "RRP_10", currency: "SGD", rrpAge: 40, rrpRetirementAge: 65,
    rrpPayoutPeriod: "10", rrpInputMode: "income", rrpTargetIncome: 1000, rrpPremium: 0,
    rrpGmi: 1000, ...o }, strategy: [] });
  rrp("SP-lifetime", { variantKey: "RRP_SP", rrpAge: 40, rrpRetirementAge: 65, rrpPayoutPeriod: "lifetime", rrpInputMode: "premium", rrpPremium: 100000 });
  rrp("5-payout10", { variantKey: "RRP_5", rrpAge: 40, rrpRetirementAge: 60, rrpPayoutPeriod: "10", rrpTargetIncome: 1500 });
  rrp("10-payout10", { variantKey: "RRP_10", rrpAge: 40, rrpRetirementAge: 65, rrpPayoutPeriod: "10", rrpTargetIncome: 1000 });
  rrp("10-lifetime", { variantKey: "RRP_10", rrpAge: 45, rrpRetirementAge: 70, rrpPayoutPeriod: "lifetime", rrpTargetIncome: 1200 });
  rrp("15-payout20", { variantKey: "RRP_15", rrpAge: 40, rrpRetirementAge: 65, rrpPayoutPeriod: "20", rrpTargetIncome: 1000 });
  rrp("20-lifetime", { variantKey: "RRP_20", rrpAge: 40, rrpRetirementAge: 65, rrpPayoutPeriod: "lifetime", rrpTargetIncome: 1000 });

  // SII - indexed universal life income, 100% S&P 500 Index Sub-account.
  const siiBase = {
    variantKey: "SII", currency: "USD", paymentFrequency: "Annual", startAge: 46, siiAge: 46,
    siiPremiumTerm: "single", siiIncomeStartYear: 4, siiInputMode: "premium",
    siiAnnualPlannedPremium: 100000, siiTotalPlannedPremium: 100000, siiTargetMonthlyIncome: 0, projectionYears: 79,
    includeWelcome: false, includeAnnualBonus: false, includeLoyalty: false, deductPiFundMgmt: false,
  };
  // One scenario per estimation-method label the two-stage blend emits,
  // so every estimator code path is frozen in the golden master.
  list.push({ name: "sii:SP-start4-source", kind: "sii", settings: siiBase, strategy: [] });
  list.push({ name: "sii:3pay-start3-estimated", kind: "sii", settings: {
    ...siiBase, startAge: 55, siiAge: 55, siiPremiumTerm: 3, siiIncomeStartYear: 3,
    siiInputMode: "income", siiTargetMonthlyIncome: 500,
  }, strategy: [] });
  list.push({ name: "sii:SP-start4-age51-interpolated-age", kind: "sii", settings: {
    ...siiBase, startAge: 51, siiAge: 51,
  }, strategy: [] });
  list.push({ name: "sii:SP-start4-age70-age-clamped-high", kind: "sii", settings: {
    ...siiBase, startAge: 70, siiAge: 70,
  }, strategy: [] });
  list.push({ name: "sii:4pay-start9-age30-age-clamped-low", kind: "sii", settings: {
    ...siiBase, startAge: 30, siiAge: 30, siiPremiumTerm: 4, siiIncomeStartYear: 9,
    siiTotalPlannedPremium: 400000,
  }, strategy: [] });
  list.push({ name: "sii:10pay-start7-interpolated-sparse", kind: "sii", settings: {
    ...siiBase, siiPremiumTerm: 10, siiIncomeStartYear: 7, siiTotalPlannedPremium: 1000000,
  }, strategy: [] });
  list.push({ name: "sii:2pay-start21-extrapolated-sparse", kind: "sii", settings: {
    ...siiBase, siiPremiumTerm: 2, siiIncomeStartYear: 21, siiTotalPlannedPremium: 200000,
  }, strategy: [] });

  return list;
}

// Deterministic fingerprint of a simulate() result: slim it to the
// load-bearing outputs, drop source/back-reference objects, round
// dollars to cents and sub-unit rates to 6dp. Stable across float noise,
// sensitive to any real change in projected values.
const STRIP_KEYS = new Set(["row", "variant", "settings", "monthly", "cashFlows"]);

export function deepRound(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);          // NaN/Infinity -> visible token
    const r = Math.abs(value) < 1 ? Number(value.toFixed(6)) : Number(value.toFixed(2));
    return r === 0 ? 0 : r;                                      // normalize -0 (JSON drops the sign)
  }
  if (Array.isArray(value)) return value.map(deepRound);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Skip refs, functions and undefined — undefined is dropped by
      // JSON.stringify, so leaving it in would make the in-memory object
      // diverge from the round-tripped snapshot and fail spuriously.
      if (STRIP_KEYS.has(k) || typeof v === "function" || v === undefined) continue;
      out[k] = deepRound(v);
    }
    return out;
  }
  return value === undefined ? null : value;
}

export function fingerprint(result) {
  const a = result.annual || [];
  const mid = a.length ? a[Math.floor(a.length / 2)] : null;
  return deepRound({
    mode: result.mode,
    variantKey: result.variant?.key,
    annualRows: a.length,
    first: a[0] || null,
    mid,
    last: a[a.length - 1] || null,
    final: result.final || null,
    rrpSummary: result.rrpSummary || null,
    siiSummary: result.siiSummary || result.final?.siiSummary || null,
    siSummary: result.siSummary || result.final?.siSummary || null,
  });
}
