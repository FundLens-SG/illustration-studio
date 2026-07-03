import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadModel } from "../tests/harness.mjs";

const model = loadModel();
const outDir = resolve("exports", "claude", "sii");
mkdirSync(outDir, { recursive: true });

const ANNUALISED_PREMIUM_BASIS = 100000;
const now = new Date().toISOString();

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

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) value = value.join("; ");
  if (typeof value === "object") value = JSON.stringify(value);
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(path, rows, fields) {
  const csv = [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(",")),
  ].join("\n");
  writeFileSync(path, `${csv}\n`, "utf8");
}

function termKey(term) {
  return model.siiTermNumber(term) === 1 ? "SP" : `${model.siiTermNumber(term)}PAY`;
}

function sourceRowAt(source, key, year) {
  return (source?.[key] || []).find((row) => Math.round(Number(row.policy_year || 0)) === year) || null;
}

function sourcePdfCount(sourcePdf = "") {
  return String(sourcePdf || "").split(";").filter(Boolean).length;
}

const sourceScenarios = model.SII_SCENARIOS || [];
const sourceIds = new Map(sourceScenarios.map((row, index) => [
  row,
  row.scenario_id || `SRC_A${row.life_insured_age}_${termKey(row.premium_payment_term_number)}_PY${row.income_start_year}_${index + 1}`,
]));

const sourceScenarioRows = sourceScenarios.map((row) => ({
  scenario_id: sourceIds.get(row),
  source_pdf: row.source_pdf,
  source_pdf_count: sourcePdfCount(row.source_pdf),
  life_insured_age: row.life_insured_age,
  premium_payment_term: row.premium_payment_term,
  premium_payment_term_number: row.premium_payment_term_number,
  premium_payment_term_label: model.siiTermLabel(row.premium_payment_term_number),
  income_start_year: row.income_start_year,
  income_start_age: Number(row.life_insured_age) + Number(row.income_start_year),
  initial_annualised_premium: row.initial_planned_premium,
  initial_total_planned_premium: row.initial_total_planned_premium,
  initial_target_monthly_income: n(Number(row.initial_monthly_income_annualized) / 12, 6),
  initial_annualised_income: row.initial_monthly_income_annualized,
  annualised_income_per_100k_total_premium: row.initial_monthly_income_annualized_per_100k_total_premium,
  monthly_income_per_100k_total_premium: row.initial_monthly_income_per_100k_total_premium,
  face_amount: row.face_amount,
  current_illustrated_yield_pct_pa: row.current_illustrated_yield_pct_pa,
  guaranteed_illustrated_yield_pct_pa: row.guaranteed_illustrated_yield_pct_pa,
  total_distribution_cost: row.total_distribution_cost,
  total_distribution_cost_pct: row.total_distribution_cost_pct,
  current_row_count: (row.current_rows || []).length,
  guaranteed_row_count: (row.guaranteed_rows || []).length,
  income_row_count: (row.income_rows || []).length,
  deduction_row_count: (row.deduction_rows || []).length,
}));

writeCsv(resolve(outDir, "sii_claude_source_pi_scenarios.csv"), sourceScenarioRows, [
  "scenario_id",
  "source_pdf",
  "source_pdf_count",
  "life_insured_age",
  "premium_payment_term",
  "premium_payment_term_number",
  "premium_payment_term_label",
  "income_start_year",
  "income_start_age",
  "initial_annualised_premium",
  "initial_total_planned_premium",
  "initial_target_monthly_income",
  "initial_annualised_income",
  "annualised_income_per_100k_total_premium",
  "monthly_income_per_100k_total_premium",
  "face_amount",
  "current_illustrated_yield_pct_pa",
  "guaranteed_illustrated_yield_pct_pa",
  "total_distribution_cost",
  "total_distribution_cost_pct",
  "current_row_count",
  "guaranteed_row_count",
  "income_row_count",
  "deduction_row_count",
]);

const sourceAnnualRows = [];
for (const source of sourceScenarios) {
  const currentYears = (source.current_rows || []).map((row) => Number(row.policy_year));
  const guaranteedYears = (source.guaranteed_rows || []).map((row) => Number(row.policy_year));
  const incomeYears = (source.income_rows || []).map((row) => Number(row.policy_year));
  const deductionYears = (source.deduction_rows || []).map((row) => Number(row.policy_year));
  const years = Array.from(new Set([...currentYears, ...guaranteedYears, ...incomeYears, ...deductionYears]))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  for (const year of years) {
    const current = sourceRowAt(source, "current_rows", year) || {};
    const guaranteed = sourceRowAt(source, "guaranteed_rows", year) || {};
    const income = sourceRowAt(source, "income_rows", year) || {};
    const deduction = sourceRowAt(source, "deduction_rows", year) || {};
    sourceAnnualRows.push({
      scenario_id: sourceIds.get(source),
      source_pdf: source.source_pdf,
      life_insured_age: source.life_insured_age,
      premium_payment_term_number: source.premium_payment_term_number,
      premium_payment_term_label: model.siiTermLabel(source.premium_payment_term_number),
      income_start_year: source.income_start_year,
      source_initial_total_planned_premium: source.initial_total_planned_premium,
      source_initial_annualised_income: source.initial_monthly_income_annualized,
      policy_year: year,
      attained_age_source: current.attained_age_source || guaranteed.attained_age_source || income.attained_age_source || deduction.attained_age_source,
      current_premium_schedule: current.premium_schedule,
      current_policy_value: current.policy_value,
      current_policy_value_less_surrender_charge_and_unvested_booster: current.policy_value_less_surrender_charge_and_unvested_booster,
      current_surrender_value_floor: current.surrender_value_floor,
      current_surrender_value: current.surrender_value,
      current_monthly_income_annualized: current.monthly_income_annualized || income.monthly_income_annualized_current,
      current_death_benefit: current.death_benefit,
      guaranteed_policy_value: guaranteed.policy_value,
      guaranteed_surrender_value: guaranteed.surrender_value,
      guaranteed_monthly_income_annualized: guaranteed.monthly_income_annualized || income.monthly_income_annualized_guaranteed,
      current_effect_of_deductions: deduction.current_effect_of_deductions,
      current_value_of_premiums: deduction.current_value_of_premiums,
      deduction_current_surrender_value: deduction.current_surrender_value,
    });
  }
}

writeCsv(resolve(outDir, "sii_claude_source_pi_annual_values.csv"), sourceAnnualRows, [
  "scenario_id",
  "source_pdf",
  "life_insured_age",
  "premium_payment_term_number",
  "premium_payment_term_label",
  "income_start_year",
  "source_initial_total_planned_premium",
  "source_initial_annualised_income",
  "policy_year",
  "attained_age_source",
  "current_premium_schedule",
  "current_policy_value",
  "current_policy_value_less_surrender_charge_and_unvested_booster",
  "current_surrender_value_floor",
  "current_surrender_value",
  "current_monthly_income_annualized",
  "current_death_benefit",
  "guaranteed_policy_value",
  "guaranteed_surrender_value",
  "guaranteed_monthly_income_annualized",
  "current_effect_of_deductions",
  "current_value_of_premiums",
  "deduction_current_surrender_value",
]);

const constants = model.SII_CONSTANTS || {};
const terms = ["single", 2, 3, 4, 5, 6, 7, 8, 9, 10];
const extrapolationRows = [];

for (let age = constants.entryAgeMin ?? 0; age <= (constants.entryAgeMax ?? 70); age += 1) {
  for (const term of terms) {
    const termNum = model.siiTermNumber(term);
    const termLabel = model.siiTermLabel(term);
    const premiumBounds = model.siiPremiumBounds(term);
    const annualisedPremium = ANNUALISED_PREMIUM_BASIS;
    const starts = model.siiAvailableIncomeStartYears(term);
    for (const startYear of starts) {
      const result = model.simulate({
        variantKey: "SII",
        currency: "USD",
        paymentFrequency: "Annual",
        siiAge: age,
        siiPremiumTerm: term,
        siiIncomeStartYear: startYear,
        siiInputMode: "premium",
        siiAnnualPlannedPremium: annualisedPremium,
        siiSkipMonthly: true,
        siiSkipAnnualIrr: true,
      });
      const summary = result.siiSummary || {};
      const annual = result.annual || [];
      const byYear = new Map(annual.map((row) => [row.year, row]));
      const y1 = byYear.get(1) || {};
      const start = byYear.get(startYear) || {};
      const y10 = byYear.get(10) || {};
      const y20 = byYear.get(20) || {};
      const y40 = byYear.get(40) || {};
      const final = annual[annual.length - 1] || {};
      extrapolationRows.push({
        scenario_key: `AGE${age}_${termKey(term)}_PY${startYear}`,
        age,
        premium_term_number: termNum,
        premium_term_label: termLabel,
        income_start_year: startYear,
        income_start_age: summary.incomeStartAge,
        valid: summary.valid,
        blockers: (summary.blockers || []).join("; "),
        notes: (summary.notes || []).join("; "),
        estimation_method: summary.method,
        source_pdf_count: summary.sourcePdfCount,
        source_ages: summary.sourceAges,
        source_labels: summary.sourceLabels,
        annualised_premium_basis: annualisedPremium,
        min_annualised_premium: n(premiumBounds.minAnnualPlannedPremium, 2),
        max_annualised_premium: n(premiumBounds.maxAnnualPlannedPremium, 2),
        total_planned_premium: n(summary.totalPlannedPremium, 2),
        target_monthly_income: n(summary.targetMonthlyIncome, 6),
        annualised_income: n(summary.annualizedIncome, 6),
        monthly_income_per_100k_annualised_premium: n(summary.targetMonthlyIncome, 6),
        annualised_income_per_100k_annualised_premium: n(summary.annualizedIncome, 6),
        annual_income_rate_per_total_premium_pct: pct(summary.incomeAnnualRate, 6),
        projection_years: summary.projectionYears,
        maturity_age: summary.maturityAge,
        projection_truncated: summary.projectionTruncated ?? "",
        projection_end_age: summary.projectionEndAge ?? "",
        current_illustrated_yield_pct_pa: pct(summary.currentIllustratedYield, 6),
        guaranteed_illustrated_yield_pct_pa: pct(summary.guaranteedIllustratedYield, 6),
        total_distribution_cost_pct: pct(summary.totalDistributionCostPct, 6),
        final_net_irr_pct: pct(summary.finalNetIrr, 6),
        reference_year: summary.referenceYear,
        reference_age: summary.referenceAge,
        reference_surrender_value: n(summary.referenceSurrenderValue, 2),
        reference_policy_value: n(summary.referencePolicyValue, 2),
        reference_cumulative_income: n(summary.referenceCumulativeIncome, 2),
        reference_total_benefits: n(summary.referenceTotalBenefits, 2),
        total_projected_income: n(summary.totalProjectedIncome, 2),
        final_surrender_value: n(summary.finalSurrenderValue, 2),
        final_death_benefit: n(summary.finalDeathBenefit, 2),
        total_benefits_at_projection: n(summary.totalBenefitsAtProjection, 2),
        net_illustrated_yield_pct_pa: pct(summary.currentIllustratedYield, 6),
        index_account_assumption_pct_pa: n(constants.indexAssumedCreditingRateCurrentPct, 2),
        blended_drag_vs_index_assumption_pct: pct(Number.isFinite(summary.currentIllustratedYield)
          ? (Number(constants.indexAssumedCreditingRateCurrentPct ?? 6.35) / 100) - summary.currentIllustratedYield
          : null, 6),
        face_amount_estimate: n(summary.faceAmount, 2),
        total_premium_charge_estimate: n(summary.totalPremiumChargeEstimate, 2),
        total_policy_fee_estimate: n(summary.totalPolicyFeeEstimate, 2),
        total_admin_fee_estimate: n(summary.totalAdminFeeEstimate, 2),
        total_fee_estimate: n(summary.cumulativeChargesEstimate, 2),
        policy_value_booster_estimate: n(summary.cumulativeBoosterEstimate, 2),
        net_fees_after_booster: n(summary.cumulativeNetChargesAfterBooster, 2),
        effect_of_deductions: n(summary.cumulativeEffectOfDeductions, 2),
        y1_policy_value: n(y1.siiPolicyValue, 2),
        y1_surrender_value: n(y1.siiSurrenderValue, 2),
        y1_death_benefit: n(y1.siiDeathBenefit, 2),
        income_start_annual_income: n(start.siiAnnualIncome, 2),
        income_start_cumulative_income: n(start.siiCumulativeIncome, 2),
        income_start_surrender_value: n(start.siiSurrenderValue, 2),
        y10_annual_income: n(y10.siiAnnualIncome, 2),
        y10_cumulative_income: n(y10.siiCumulativeIncome, 2),
        y10_surrender_value: n(y10.siiSurrenderValue, 2),
        y20_annual_income: n(y20.siiAnnualIncome, 2),
        y20_cumulative_income: n(y20.siiCumulativeIncome, 2),
        y20_surrender_value: n(y20.siiSurrenderValue, 2),
        y40_annual_income: n(y40.siiAnnualIncome, 2),
        y40_cumulative_income: n(y40.siiCumulativeIncome, 2),
        y40_surrender_value: n(y40.siiSurrenderValue, 2),
        final_policy_year: final.year,
        final_age: final.age,
      });
    }
  }
}

writeCsv(resolve(outDir, "sii_claude_all_extrapolations_annualised_100k.csv"), extrapolationRows, [
  "scenario_key",
  "age",
  "premium_term_number",
  "premium_term_label",
  "income_start_year",
  "income_start_age",
  "valid",
  "blockers",
  "notes",
  "estimation_method",
  "source_pdf_count",
  "source_ages",
  "source_labels",
  "annualised_premium_basis",
  "min_annualised_premium",
  "max_annualised_premium",
  "total_planned_premium",
  "target_monthly_income",
  "annualised_income",
  "monthly_income_per_100k_annualised_premium",
  "annualised_income_per_100k_annualised_premium",
  "annual_income_rate_per_total_premium_pct",
  "projection_years",
  "maturity_age",
  "projection_truncated",
  "projection_end_age",
  "current_illustrated_yield_pct_pa",
  "guaranteed_illustrated_yield_pct_pa",
  "total_distribution_cost_pct",
  "final_net_irr_pct",
  "reference_year",
  "reference_age",
  "reference_surrender_value",
  "reference_policy_value",
  "reference_cumulative_income",
  "reference_total_benefits",
  "total_projected_income",
  "final_surrender_value",
  "final_death_benefit",
  "total_benefits_at_projection",
  "net_illustrated_yield_pct_pa",
  "index_account_assumption_pct_pa",
  "blended_drag_vs_index_assumption_pct",
  "face_amount_estimate",
  "total_premium_charge_estimate",
  "total_policy_fee_estimate",
  "total_admin_fee_estimate",
  "total_fee_estimate",
  "policy_value_booster_estimate",
  "net_fees_after_booster",
  "effect_of_deductions",
  "y1_policy_value",
  "y1_surrender_value",
  "y1_death_benefit",
  "income_start_annual_income",
  "income_start_cumulative_income",
  "income_start_surrender_value",
  "y10_annual_income",
  "y10_cumulative_income",
  "y10_surrender_value",
  "y20_annual_income",
  "y20_cumulative_income",
  "y20_surrender_value",
  "y40_annual_income",
  "y40_cumulative_income",
  "y40_surrender_value",
  "final_policy_year",
  "final_age",
]);

const methodCounts = extrapolationRows.reduce((acc, row) => {
  acc[row.estimation_method] = (acc[row.estimation_method] || 0) + 1;
  return acc;
}, {});

const truncatedRowCount = extrapolationRows.filter((row) => row.projection_truncated === true).length;

const summary = {
  generatedAt: now,
  product: "SII / Signature Indexed Income",
  source: model.SII_DATA?.source,
  productConstants: model.SII_CONSTANTS,
  exportBasis: {
    annualisedPremiumBasisUsd: ANNUALISED_PREMIUM_BASIS,
    ageRange: `${constants.entryAgeMin ?? 0}-${constants.entryAgeMax ?? 70}`,
    premiumTerms: terms.map((term) => model.siiTermLabel(term)),
    incomeStartRules: constants.incomeStartRules,
  },
  counts: {
    sourceScenarioRows: sourceScenarioRows.length,
    sourceAnnualRows: sourceAnnualRows.length,
    extrapolationRows: extrapolationRows.length,
    estimationMethodLabels: Object.keys(methodCounts).sort(),
    estimationMethodCounts: methodCounts,
    projectionTruncatedRows: truncatedRowCount,
    projectionToMaturityRows: extrapolationRows.length - truncatedRowCount,
  },
  files: {
    sourceScenarios: "sii_claude_source_pi_scenarios.csv",
    sourceAnnualValues: "sii_claude_source_pi_annual_values.csv",
    allExtrapolations: "sii_claude_all_extrapolations_annualised_100k.csv",
    machineSummary: "sii_claude_export_summary.json",
    handoffMarkdown: "SII_CLAUDE_EXPORT.md",
  },
};

writeFileSync(resolve(outDir, "sii_claude_export_summary.json"), JSON.stringify(summary, null, 2), "utf8");

const md = `# SII Claude Export

Generated: ${now}

## Important Caveat

These SII figures are derived from uploaded policy illustrations and extrapolated/interpolated by the Illustration Studio model. They are approximate, are not official Manulife policy illustrations, are not guaranteed to be 100% accurate, and must be validated against an official PI before client use or application.

## Files

- \`sii_claude_source_pi_scenarios.csv\` - one row per unique parsed source PI scenario.
- \`sii_claude_source_pi_annual_values.csv\` - annual source values from each parsed PI scenario, including current values, guaranteed values, income rows, and deduction rows where parsed.
- \`sii_claude_all_extrapolations_annualised_100k.csv\` - full extrapolation grid for all entry ages ${constants.entryAgeMin ?? 0}-${constants.entryAgeMax ?? 70}, all premium terms SP/2-pay/3-pay/4-pay/5-pay/6-pay/7-pay/8-pay/9-pay/10-pay, and every product-valid income start year.
- \`sii_claude_export_summary.json\` - machine-readable metadata and counts.

## Export Basis

- Currency: USD.
- Account basis: 100% S&P 500 Index Sub-account.
- Assumed current Index Account illustration rate: ${model.SII_CONSTANTS.indexAssumedCreditingRateCurrentPct}%.
- Fixed Account allocation: ${model.SII_CONSTANTS.fixedAccountAllocationPct}%.
- Index Account allocation: ${model.SII_CONSTANTS.indexAccountAllocationPct}%.
- S&P 500 floor/cap captured in this model: ${model.SII_CONSTANTS.indexFloorRatePct}% floor / ${model.SII_CONSTANTS.sp500CapRatePct}% cap.
- Extrapolation grid premium basis: US$${ANNUALISED_PREMIUM_BASIS.toLocaleString()} annualised premium.
- For SP, annualised premium basis is treated as the single premium.
- For multi-pay terms, total planned premium = annualised premium x premium term.

## Source Coverage

- Parsed unique source PI scenarios: ${sourceScenarioRows.length}.
- Source annual rows exported: ${sourceAnnualRows.length}.
- Source ages: ${(model.SII_DATA?.source?.sourceAges || []).join(", ")}.
- Source premium terms: ${(model.SII_DATA?.source?.sourcePremiumTerms || []).join(", ")}.
- Source income start years: ${(model.SII_DATA?.source?.sourceIncomeStartYears || []).join(", ")}.

## Extrapolation Coverage

- Extrapolation rows exported: ${extrapolationRows.length}.
- Method counts: ${Object.entries(methodCounts).map(([key, value]) => `${key}=${value}`).join(", ")}.
- Rows with \`projection_truncated=true\`: ${truncatedRowCount} of ${extrapolationRows.length}.

## Estimation Methods

- \`source_exact\` - a parsed PI exists for this exact age/term/start-year combination.
- \`age_shifted_source\` - the exact term/start-year PI from the nearest source-age anchor is used directly (parsed PIs show identical income rates per 100k premium at both anchor ages).
- \`interpolated_age\` - the exact term/start-year PI exists at both anchor ages and the value is interpolated across age.
- \`interpolated_sparse\` - no exact term/start-year PI; the value is interpolated along the per-term income-start curve within each anchor-age cohort (age is excluded from the term/start blend), then combined across anchor ages.
- \`extrapolated_sparse\` - as above, but the requested income start year falls outside the illustrated start-year range for the term; the tail extrapolation is linear and clamped, so far-out start years may be understated.

## Projection Horizon

- Every grid row projects annual values from policy year 1 to \`final_policy_year\` (attained age \`final_age\`).
- \`total_projected_income\`, \`final_surrender_value\`, \`final_death_benefit\`, and \`total_benefits_at_projection\` are measured to \`final_policy_year\`, NOT to maturity age ${model.SII_CONSTANTS.maturityAge ?? 125}.
- \`projection_truncated\` is \`true\` and \`projection_end_age\` (= the attained age the projection stops at) is below maturity age ${model.SII_CONSTANTS.maturityAge ?? 125} where the parsed source tables end before maturity (younger entry ages). When \`projection_truncated\` is \`false\`, \`projection_end_age\` equals maturity age. Do not compare \`total_*\` columns across ages with different \`projection_end_age\` values without accounting for the horizon difference.

## Model Notes For Claude

- Source-exact term/start/age cases use the matching parsed PI row.
- Estimation is two-stage: term/start-year values are blended within each source-age cohort with age excluded from the blend, then interpolated across the source-age anchors. Entry ages outside the anchor range use the nearest anchor (parsed PIs show the income rate per 100k premium is age-invariant across the anchors).
- Income is aligned to the selected income start year. Source payout curves are shifted so payout year 1 lands on the selected policy year; income before the selected start year is forced to zero.
- User-facing premium input is annualised premium for 2-pay to 10-pay and single premium for SP.
- The full extrapolation grid uses \`net_illustrated_yield_pct_pa\` as the collapsed annualised representation of charges blended with bonuses, and \`blended_drag_vs_index_assumption_pct\` as the spread against the ${model.SII_CONSTANTS.indexAssumedCreditingRateCurrentPct}% Index Account illustration assumption.
- Charges and bonuses include premium charge, policy fee, admin fee estimate, policy value booster, net fees after booster, surrender/unvested drag, and parsed effect of deductions.
- \`final_net_irr_pct\` is the net monthly-cash-flow IRR (premiums out, income in, final surrender value at \`final_policy_year\`), annualised. SII IRR values outside sane bounds are displayed as \`n.m.\` in the UI and exported as blank here.
- Rows whose derived monthly income at the US$${ANNUALISED_PREMIUM_BASIS.toLocaleString()} basis falls below the product minimum carry a below-minimum note in \`notes\`; that income level may not be electable on an official PI.
`;

writeFileSync(resolve(outDir, "SII_CLAUDE_EXPORT.md"), md, "utf8");

console.log(JSON.stringify(summary, null, 2));
